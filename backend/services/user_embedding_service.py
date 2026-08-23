"""User preference embedding synchronization service.

Builds canonical user preference text, generates vector embeddings,
persists to database, and invalidates cached user feeds.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from ai.embeddings.canonical import build_user_preference_embedding_text
from ai.embeddings.service import get_embedding_service
from config.settings import settings
from database.models.user import User

logger = logging.getLogger("user_embeddings")


class UserEmbeddingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_service = get_embedding_service()

    async def sync_user_preference_embedding(self, user: User) -> bool:
        """Update a user's preference embedding and invalidate their feed cache.

        Returns True if an embedding was generated, False if the user lacks preferences (cold start).
        """
        canonical_text = build_user_preference_embedding_text(user)

        if not canonical_text:
            logger.info(
                "User %s has insufficient preference data; clearing embedding", user.id
            )
            user.preference_embedding = None
            user.preference_embedding_model = None
            await self.db.commit()
            await self.db.refresh(user)

            try:
                from services.feed_service import FeedService

                FeedService(self.db).invalidate_feed(user.id)
            except Exception as e:
                logger.warning(
                    "Failed to invalidate feed cache for user %s: %s", user.id, e
                )
            return False

        try:
            embedding = await self.embedding_service.aembed_text(canonical_text)
            user.preference_embedding = embedding
            user.preference_embedding_model = settings.gemini_embedding_model
            await self.db.commit()
            await self.db.refresh(user)

            logger.info(
                "Updated preference embedding for user %s (dim=%d, model=%s)",
                user.id,
                len(embedding),
                settings.gemini_embedding_model,
            )

            try:
                from services.feed_service import FeedService

                FeedService(self.db).invalidate_feed(user.id)
            except Exception as e:
                logger.warning(
                    "Failed to invalidate feed cache for user %s: %s", user.id, e
                )

            return True
        except Exception as e:
            logger.error(
                "Failed to generate preference embedding for user %s: %s",
                user.id,
                e,
                exc_info=True,
            )
            # Do not crash the caller if embedding fails
            return False
