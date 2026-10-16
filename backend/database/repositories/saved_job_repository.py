from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database.models.processed_job import ProcessedJob
from database.models.saved_job import SavedJob


class SavedJobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_user(self, user_id: int) -> list[SavedJob]:
        result = await self.db.execute(
            select(SavedJob)
            .options(joinedload(SavedJob.job).joinedload(ProcessedJob.raw_job))
            .where(SavedJob.user_id == user_id)
            .order_by(SavedJob.saved_at.desc())
        )
        return list(result.scalars().all())

    async def get_saved_job_ids(self, user_id: int) -> set[int]:
        result = await self.db.execute(
            select(SavedJob.job_id).where(SavedJob.user_id == user_id)
        )
        return {row[0] for row in result.all()}

    async def is_saved(self, user_id: int, job_id: int) -> bool:
        result = await self.db.execute(
            select(SavedJob.id).where(
                SavedJob.user_id == user_id,
                SavedJob.job_id == job_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def save(self, user_id: int, job_id: int) -> SavedJob:
        existing = await self.db.execute(
            select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job_id)
        )
        item = existing.scalar_one_or_none()
        if item:
            return item

        item = SavedJob(user_id=user_id, job_id=job_id)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def unsave(self, user_id: int, job_id: int) -> bool:
        result = await self.db.execute(
            select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
