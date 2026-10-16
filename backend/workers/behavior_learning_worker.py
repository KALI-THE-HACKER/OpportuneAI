import asyncio

import workers.fork_safety  # noqa: F401
from database.repositories.user_job_event_repository import UserJobEventRepository
from database.session import AsyncSessionLocal
from services.feed_service import FeedService, get_redis_client
from utils.logging_config import configure_logging, get_feature_logger

configure_logging()
logger = get_feature_logger("worker")


async def _process_user_event(event_id: int) -> None:
    async with AsyncSessionLocal() as db:
        repo = UserJobEventRepository(db)
        event = await repo.get_by_id(event_id)
        if not event:
            logger.warning("Event %s not found for behavior processing", event_id)
            return

        redis_client = get_redis_client()
        redis_client.hincrby(
            f"learning:user:{event.user_id}:events",
            event.event_type,
            1,
        )

        if event.event_type in {"save", "unsave", "apply", "dismiss", "not_interested"}:
            FeedService(db).invalidate_feed(event.user_id)

        logger.info(
            "Processed behavior event id=%s user_id=%s type=%s",
            event.id,
            event.user_id,
            event.event_type,
        )


def process_user_event(event_id: int) -> None:
    asyncio.run(_process_user_event(int(event_id)))
