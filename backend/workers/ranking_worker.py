import asyncio

import workers.fork_safety  # noqa: F401
from database.session import AsyncSessionLocal
from services.feed_service import FeedService
from utils.logging_config import configure_logging, get_feature_logger

configure_logging()
logger = get_feature_logger("worker")


async def _recalculate_user_match(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        feed = FeedService(db)
        feed.invalidate_feed(user_id)
        logger.info("Recalculation trigger executed for user_id=%s", user_id)


def recalculate_user_match(user_id: int) -> None:
    asyncio.run(_recalculate_user_match(int(user_id)))
