import asyncio
import logging
from typing import Any

from ai.extraction.extractor import InsufficientJobDataError, JobExtractor
from ai.providers.factory import get_llm
from database.models.raw_job import ProcessingStatus, RawJob
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def _process_raw_job(raw_job_id: Any) -> None:
    """Asynchronous implementation of the AI processing pipeline for a raw job."""
    logger.info("Starting AI processing for raw job %s", raw_job_id)

    async with AsyncSessionLocal() as db:
        # 1. Load raw job from repository.
        raw_job = await db.get(RawJob, raw_job_id)
        if not raw_job:
            logger.error("RawJob %s not found in database", raw_job_id)
            return

        # 2. Update processing_status -> PROCESSING.
        raw_job.processing_status = ProcessingStatus.PROCESSING
        await db.commit()
        logger.info("RawJob %s status updated to PROCESSING", raw_job_id)

        try:
            # 3. Invoke LLM extraction service.
            llm = get_llm()
            extractor = JobExtractor(llm)
            extraction = await extractor.extract(raw_job)

            # 4. Save processed job.
            processed_repo = ProcessedJobRepository(db)
            await processed_repo.create(
                raw_job_id=raw_job.id,
                extraction=extraction,
                scraped_at=raw_job.scraped_at,
            )

            # TODO: Generate embeddings.

            # 5. Update processing_status -> PROCESSED.
            raw_job.processing_status = ProcessingStatus.PROCESSED
            await db.commit()
            logger.info("Successfully processed raw job %s", raw_job_id)

        except InsufficientJobDataError as e:
            # LLM explicitly flagged missing critical data — mark FAILED cleanly.
            logger.warning(
                "RawJob %s marked FAILED — insufficient data: %s",
                raw_job_id,
                e.reason,
            )
            await db.rollback()
            raw_job.processing_status = ProcessingStatus.FAILED
            await db.commit()

        except Exception as e:
            logger.error(
                "Failed to process raw job %s: %s", raw_job_id, e, exc_info=True
            )
            await db.rollback()
            raw_job.processing_status = ProcessingStatus.FAILED
            await db.commit()


def process_raw_job(raw_job_id: Any) -> None:
    """RQ worker entrypoint for processing a raw job."""
    asyncio.run(_process_raw_job(raw_job_id))
