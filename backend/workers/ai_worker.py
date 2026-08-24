import asyncio
import logging
from typing import Any

from ai.agents.contact_finder import ContactFinderAgent
from ai.extraction.extractor import InsufficientJobDataError, JobExtractor
from ai.providers.factory import get_llm
from database.models.raw_job import ProcessingStatus, RawJob
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _extract_apply_url_from_payload(raw_payload: dict | None) -> str | None:
    """Extract a direct application URL embedded in raw_payload by scrapers.

    Currently handles:
      - RemoteOK: raw_payload["apply_url"]
    """
    if not raw_payload or not isinstance(raw_payload, dict):
        return None
    return raw_payload.get("apply_url") or None


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

            # 4. Resolve apply URL: LLM result > raw_payload fallback > raw_job.link
            payload_apply_url = _extract_apply_url_from_payload(raw_job.raw_payload)

            # 5. Save processed job.
            processed_repo = ProcessedJobRepository(db)
            processed_job = await processed_repo.create(
                raw_job_id=raw_job.id,
                extraction=extraction,
                scraped_at=raw_job.scraped_at,
                apply_url=payload_apply_url,
            )

            # 6. Generate and persist job embedding.
            try:
                from ai.embeddings.canonical import build_job_embedding_text
                from ai.embeddings.service import get_embedding_service
                from config.settings import settings

                embedding_text = build_job_embedding_text(processed_job)
                embedding_service = get_embedding_service()
                embedding = await embedding_service.aembed_text(embedding_text)
                processed_job.embedding = embedding
                processed_job.embedding_model = settings.gemini_embedding_model
                await db.commit()
                logger.info(
                    "Generated embedding for processed job %s (dim=%d)",
                    processed_job.id,
                    len(embedding),
                )
            except Exception as e:
                logger.warning(
                    "Embedding generation failed for processed job %s: %s",
                    processed_job.id,
                    e,
                )

            # 7. If no apply URL, run Contact Finder Agent to discover HR/founder email.
            if not processed_job.apply_url:
                try:
                    agent = ContactFinderAgent(llm)
                    contact = await agent.find(
                        db=db,
                        company=processed_job.company,
                        job_link=raw_job.link or "",
                        job_title=processed_job.job_title,
                    )
                    if contact:
                        processed_job.contact_email = contact.contact_email
                        processed_job.contact_name = contact.contact_name
                        processed_job.contact_role = contact.contact_role
                        await db.commit()
                        logger.info(
                            "Contact Finder enriched job %s with contact: %s <%s>",
                            processed_job.id,
                            contact.contact_name,
                            contact.contact_email,
                        )
                except Exception as e:
                    logger.warning(
                        "Contact Finder Agent failed for job %s: %s",
                        processed_job.id,
                        e,
                    )

            # 8. Update processing_status -> PROCESSED.
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
