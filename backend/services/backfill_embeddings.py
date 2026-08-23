"""Resumable and idempotent backfill script for job embeddings.

Usage:
    python -m services.backfill_embeddings [--batch-size 50] [--force-recompute]
"""

import argparse
import asyncio
import logging

from sqlalchemy import or_, select

from ai.embeddings.canonical import build_job_embedding_text
from ai.embeddings.service import get_embedding_service
from config.settings import settings
from database.models.processed_job import ProcessedJob
from database.session import AsyncSessionLocal

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("backfill_embeddings")


async def backfill_job_embeddings(
    batch_size: int = 50,
    force_recompute: bool = False,
) -> tuple[int, int]:
    """Find processed jobs without embeddings and generate vector representations.

    Returns (processed_count, error_count).
    """
    embedding_service = get_embedding_service()
    total_processed = 0
    total_errors = 0

    async with AsyncSessionLocal() as db:
        # Build query for jobs needing embeddings
        if force_recompute:
            stmt = select(ProcessedJob).order_by(ProcessedJob.id.asc())
        else:
            stmt = (
                select(ProcessedJob)
                .where(
                    or_(
                        ProcessedJob.embedding.is_(None),
                        ProcessedJob.embedding_model != settings.gemini_embedding_model,
                    )
                )
                .order_by(ProcessedJob.id.asc())
            )

        result = await db.execute(stmt)
        jobs = list(result.scalars().all())
        total_jobs = len(jobs)
        logger.info("Found %d processed jobs requiring embeddings", total_jobs)

        if not jobs:
            return 0, 0

        # Process in batches
        for i in range(0, total_jobs, batch_size):
            batch = jobs[i : i + batch_size]
            logger.info(
                "Processing batch %d-%d of %d",
                i + 1,
                min(i + batch_size, total_jobs),
                total_jobs,
            )

            for job in batch:
                try:
                    canonical_text = build_job_embedding_text(job)
                    embedding = await embedding_service.aembed_text(canonical_text)
                    job.embedding = embedding
                    job.embedding_model = settings.gemini_embedding_model
                    total_processed += 1
                except Exception as e:
                    logger.error(
                        "Failed to generate embedding for job %s: %s", job.id, e
                    )
                    total_errors += 1

            await db.commit()
            logger.info(
                "Saved batch. Total completed: %d, errors: %d",
                total_processed,
                total_errors,
            )

    logger.info(
        "Backfill finished: %d embeddings saved, %d errors out of %d total",
        total_processed,
        total_errors,
        total_jobs,
    )
    return total_processed, total_errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill ProcessedJob embeddings")
    parser.add_argument(
        "--batch-size", type=int, default=50, help="Batch size for embedding generation"
    )
    parser.add_argument(
        "--force-recompute",
        action="store_true",
        help="Recompute embeddings for all jobs even if already present",
    )
    args = parser.parse_args()

    asyncio.run(
        backfill_job_embeddings(
            batch_size=args.batch_size,
            force_recompute=args.force_recompute,
        )
    )
