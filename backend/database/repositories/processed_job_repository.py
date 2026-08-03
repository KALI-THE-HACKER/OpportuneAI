from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.schemas import JobExtraction
from database.models.processed_job import ProcessedJob


class ProcessedJobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, raw_job_id: int, extraction: JobExtraction) -> ProcessedJob:
        """Create a new ProcessedJob record from raw_job_id and JobExtraction."""
        processed_job = ProcessedJob(
            raw_job_id=raw_job_id,
            job_title=extraction.job_title,
            company=extraction.company,
            skills=extraction.skills,
            location=extraction.location,
            salary=extraction.salary,
            experience_years=extraction.experience_years,
            employment_type=extraction.employment_type,
            job_description=extraction.job_description,
        )
        self.db.add(processed_job)
        await self.db.commit()
        await self.db.refresh(processed_job)
        return processed_job

    async def get_by_id(self, processed_job_id: int) -> ProcessedJob | None:
        """Retrieve a ProcessedJob by its ID."""
        result = await self.db.execute(
            select(ProcessedJob).where(ProcessedJob.id == processed_job_id)
        )
        return result.scalar_one_or_none()

    async def get_by_raw_job_id(self, raw_job_id: int) -> ProcessedJob | None:
        """Retrieve a ProcessedJob by its associated raw_job_id."""
        result = await self.db.execute(
            select(ProcessedJob).where(ProcessedJob.raw_job_id == raw_job_id)
        )
        return result.scalar_one_or_none()
