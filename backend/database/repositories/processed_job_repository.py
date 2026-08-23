from datetime import datetime, timedelta, timezone

from dateutil import parser as date_parser
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ai.schemas import JobExtraction
from config.settings import settings
from database.models.processed_job import ProcessedJob


def resolve_expiry_date(
    date_str: str | None,
    scraped_at: datetime | None = None,
    default_days: int | None = None,
) -> datetime:
    """Resolve last date to apply from extracted string or fallback to scraped_at + default_days."""
    if date_str:
        try:
            dt = date_parser.parse(date_str)
            if dt.tzinfo:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            pass

    days = (
        default_days if default_days is not None else settings.default_job_expiry_days
    )
    base_time = scraped_at or datetime.utcnow()
    return base_time + timedelta(days=days)


class ProcessedJobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        raw_job_id: int,
        extraction: JobExtraction,
        scraped_at: datetime | None = None,
    ) -> ProcessedJob:
        """Create a new ProcessedJob record from raw_job_id and JobExtraction."""
        last_date = resolve_expiry_date(
            date_str=extraction.last_date_to_apply,
            scraped_at=scraped_at,
        )

        processed_job = ProcessedJob(
            raw_job_id=raw_job_id,
            job_title=extraction.job_title,
            company=extraction.company,
            skills=extraction.skills,
            location=extraction.location,
            salary=extraction.salary,
            experience_years=extraction.experience_years,
            employment_type=extraction.employment_type,
            last_date_to_apply=last_date,
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

    async def get_by_id_with_raw(self, processed_job_id: int) -> ProcessedJob | None:
        """Retrieve a ProcessedJob with joined RawJob by its ID."""
        result = await self.db.execute(
            select(ProcessedJob)
            .options(joinedload(ProcessedJob.raw_job))
            .where(ProcessedJob.id == processed_job_id)
        )
        return result.scalar_one_or_none()

    async def get_by_ids(self, job_ids: list[int]) -> list[ProcessedJob]:
        """Batch retrieve ProcessedJobs with joined RawJobs by a list of IDs."""
        if not job_ids:
            return []
        result = await self.db.execute(
            select(ProcessedJob)
            .options(joinedload(ProcessedJob.raw_job))
            .where(ProcessedJob.id.in_(job_ids))
        )
        return list(result.scalars().all())

    async def get_all_eligible(self, limit: int = 1000) -> list[ProcessedJob]:
        """Retrieve active, unexpired ProcessedJobs for feed ranking."""
        now = datetime.utcnow()
        result = await self.db.execute(
            select(ProcessedJob)
            .options(joinedload(ProcessedJob.raw_job))
            .where(
                or_(
                    ProcessedJob.last_date_to_apply.is_(None),
                    ProcessedJob.last_date_to_apply >= now,
                )
            )
            .order_by(ProcessedJob.processed_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_raw_job_id(self, raw_job_id: int) -> ProcessedJob | None:
        """Retrieve a ProcessedJob by its associated raw_job_id."""
        result = await self.db.execute(
            select(ProcessedJob).where(ProcessedJob.raw_job_id == raw_job_id)
        )
        return result.scalar_one_or_none()
