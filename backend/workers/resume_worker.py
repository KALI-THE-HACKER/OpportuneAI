"""RQ worker for AI-powered resume parsing.

Entrypoint: ``process_resume(user_id)``

Flow:
  1. Load user from DB.
  2. Read ``resume_text`` already stored during upload.
  3. Run ``ResumeExtractor`` → ``ResumeExtraction``.
  4. Persist extracted fields via ``UserRepository.save_resume_extraction``.
  5. Merge extracted skills into ``users.skills`` (deduplication handled in repo).

The worker uses a dedicated ``resume-processing`` RQ queue so it doesn't
compete with the heavier AI job-extraction pipeline on ``ai-processing``.
"""

import asyncio

from ai.extraction.resume_extractor import ResumeExtractor
from ai.providers.factory import get_llm
from database.repositories.activity_repository import ActivityRepository
from database.repositories.user_repository import UserRepository
from database.session import AsyncSessionLocal
from utils.logging_config import configure_logging, get_feature_logger

configure_logging()
logger = get_feature_logger("worker")


async def _process_resume(user_id: int) -> None:
    """Async implementation of resume AI parsing pipeline."""
    logger.info("Starting resume processing for user %s", user_id)

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(user_id)
        if not user:
            logger.error("User %s not found; aborting resume processing", user_id)
            return

        if not user.resume_text:
            logger.error("User %s has no resume_text; aborting", user_id)
            await repo.update(user, resume_status="failed")
            return

        try:
            llm = get_llm()
            extractor = ResumeExtractor(llm)
            result = await extractor.extract(user.resume_text)

            await repo.save_resume_extraction(
                user=user,
                extracted_skills=result.skills,
                experience_level=result.experience_level or None,
                years_total=result.years_total or None,
                confidence=result.confidence or None,
            )

            try:
                activity_repo = ActivityRepository(db)
                conf_pct = int((result.confidence or 0.85) * 100)
                level_str = (
                    f" ({result.experience_level})" if result.experience_level else ""
                )
                await activity_repo.create(
                    user_id=user_id,
                    activity_type="resume",
                    title="Resume analysis complete",
                    body=f"Profile updated with {len(result.skills)} skills extracted{level_str} at {conf_pct}% confidence.",
                )
            except Exception:
                pass

            try:
                from services.user_embedding_service import UserEmbeddingService

                await UserEmbeddingService(db).sync_user_preference_embedding(user)
            except Exception:
                pass

            logger.info(
                "Resume processed for user %s: %d skills, level=%s, years=%s, confidence=%.2f",
                user_id,
                len(result.skills),
                result.experience_level,
                result.years_total,
                result.confidence,
            )

        except Exception:
            logger.exception("Failed to process resume for user %s", user_id)
            try:
                await db.rollback()
                user = await repo.get_by_id(user_id)
                if user:
                    await repo.update(user, resume_status="failed")
            except Exception:
                logger.exception(
                    "Also failed to update resume_status to failed for user %s", user_id
                )


def process_resume(user_id: int) -> None:
    """RQ worker entrypoint. Called by the ``resume-processing`` queue."""
    asyncio.run(_process_resume(user_id))
