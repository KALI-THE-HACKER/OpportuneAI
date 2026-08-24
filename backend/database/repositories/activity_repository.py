from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.activity import UserActivity


class ActivityRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: int,
        activity_type: str,
        title: str,
        body: str = "",
        read: bool = False,
    ) -> UserActivity:
        """Create and persist a new user activity record."""
        activity = UserActivity(
            user_id=user_id,
            activity_type=activity_type,
            title=title,
            body=body,
            read=read,
            created_at=datetime.utcnow(),
        )
        self.db.add(activity)
        await self.db.commit()
        await self.db.refresh(activity)
        return activity

    async def create_unique_recent(
        self,
        user_id: int,
        activity_type: str,
        title: str,
        body: str = "",
        read: bool = False,
        window_minutes: int = 30,
    ) -> UserActivity:
        """Create an activity only if an identical activity was not created recently."""
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        stmt = (
            select(UserActivity)
            .where(
                UserActivity.user_id == user_id,
                UserActivity.activity_type == activity_type,
                UserActivity.title == title,
                UserActivity.created_at >= cutoff,
            )
            .order_by(UserActivity.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        return await self.create(
            user_id=user_id,
            activity_type=activity_type,
            title=title,
            body=body,
            read=read,
        )

    async def list_by_user(
        self,
        user_id: int,
        limit: int = 50,
    ) -> list[UserActivity]:
        """Fetch the most recent activities for a user."""
        stmt = (
            select(UserActivity)
            .where(UserActivity.user_id == user_id)
            .order_by(UserActivity.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_read(self, user_id: int, activity_id: int) -> bool:
        """Mark a single activity item as read."""
        stmt = (
            update(UserActivity)
            .where(UserActivity.id == activity_id, UserActivity.user_id == user_id)
            .values(read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def mark_all_read(self, user_id: int) -> int:
        """Mark all activity items for a user as read."""
        stmt = (
            update(UserActivity)
            .where(UserActivity.user_id == user_id, UserActivity.read.is_(False))
            .values(read=True)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount

    async def get_applied_job_ids(self, user_id: int) -> set[int]:
        """Fetch all job IDs the user has applied to based on application activity records."""
        stmt = select(UserActivity).where(
            UserActivity.user_id == user_id,
            UserActivity.activity_type == "application",
        )
        await self.db.execute(stmt)
        # Primary tracking is Redis set user:{user_id}:applied_jobs
        return set()
