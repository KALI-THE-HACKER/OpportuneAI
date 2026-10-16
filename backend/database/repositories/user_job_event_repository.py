from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user_job_event import UserJobEvent


class UserJobEventRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: int,
        job_id: int,
        event_type: str,
        source: str,
        position: int | None = None,
        session_id: str | None = None,
        metadata: dict | None = None,
    ) -> UserJobEvent:
        event = UserJobEvent(
            user_id=user_id,
            job_id=job_id,
            event_type=event_type,
            source=source,
            position=position,
            session_id=session_id,
            metadata=metadata,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_by_id(self, event_id: int) -> UserJobEvent | None:
        result = await self.db.execute(
            select(UserJobEvent).where(UserJobEvent.id == event_id)
        )
        return result.scalar_one_or_none()
