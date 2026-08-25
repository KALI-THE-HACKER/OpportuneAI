from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models.job_application import JobApplication
from database.models.processed_job import ProcessedJob


class JobApplicationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_and_job(
        self, user_id: int, job_id: int
    ) -> JobApplication | None:
        """Fetch existing application for a specific user and job."""
        stmt = (
            select(JobApplication)
            .options(
                selectinload(JobApplication.job).selectinload(ProcessedJob.raw_job)
            )
            .where(
                JobApplication.user_id == user_id,
                JobApplication.job_id == job_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(
        self, application_id: int, user_id: int
    ) -> JobApplication | None:
        """Fetch an application by its ID and owning user."""
        stmt = (
            select(JobApplication)
            .options(
                selectinload(JobApplication.job).selectinload(ProcessedJob.raw_job)
            )
            .where(
                JobApplication.id == application_id,
                JobApplication.user_id == user_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_or_update(
        self,
        user_id: int,
        job_id: int,
        status: str = "applied",
        notes: str | None = None,
    ) -> JobApplication:
        """Create a new job application or update status/notes if already exists."""
        existing = await self.get_by_user_and_job(user_id, job_id)
        if existing:
            existing.status = status
            if notes is not None:
                existing.notes = notes
            existing.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        app = JobApplication(
            user_id=user_id,
            job_id=job_id,
            status=status,
            notes=notes,
            applied_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(app)
        await self.db.commit()
        await self.db.refresh(app)
        # Re-fetch with relationships loaded
        return (await self.get_by_id(app.id, user_id)) or app

    async def list_by_user(
        self,
        user_id: int,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[JobApplication]:
        """Fetch all applications for a given user ordered by most recent."""
        stmt = (
            select(JobApplication)
            .options(
                selectinload(JobApplication.job).selectinload(ProcessedJob.raw_job)
            )
            .where(JobApplication.user_id == user_id)
        )
        if status:
            stmt = stmt.where(JobApplication.status == status)

        stmt = (
            stmt.order_by(JobApplication.applied_at.desc()).offset(offset).limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_user(self, user_id: int, status: str | None = None) -> int:
        """Count total applications for a user, optionally filtered by status."""
        stmt = select(func.count(JobApplication.id)).where(
            JobApplication.user_id == user_id
        )
        if status:
            stmt = stmt.where(JobApplication.status == status)
        result = await self.db.execute(stmt)
        return result.scalar_one() or 0

    async def update_status_or_notes(
        self,
        application_id: int,
        user_id: int,
        status: str | None = None,
        notes: str | None = None,
    ) -> JobApplication | None:
        """Update the status or notes of an existing application."""
        app = await self.get_by_id(application_id, user_id)
        if not app:
            return None

        if status is not None:
            app.status = status
        if notes is not None:
            app.notes = notes
        app.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(app)
        return app

    async def delete(self, application_id: int, user_id: int) -> bool:
        """Delete an application."""
        stmt = delete(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def get_applied_job_ids(self, user_id: int) -> set[int]:
        """Fetch all job IDs the user has applied to."""
        stmt = select(JobApplication.job_id).where(JobApplication.user_id == user_id)
        result = await self.db.execute(stmt)
        return set(result.scalars().all())
