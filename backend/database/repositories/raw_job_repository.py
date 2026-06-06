from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.raw_job import RawJob
from providers.models.raw_jobs_data import RawJobData


class RawJobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_existing_hashes(self) -> set[str]:
        result = await self.db.execute(select(RawJob.content_hash))

        return set(result.scalars().all())

    async def save_many(self, jobs: list[RawJobData]) -> None:

        db_jobs = [
            RawJob(
                source=job.source,
                external_id=job.external_id,
                title=job.title,
                company=job.company,
                date_posted=job.date_posted,
                location=job.location,
                link=job.link,
                content_hash=job.content_hash,
                raw_payload=job.raw_payload,
            )
            for job in jobs
        ]

        self.db.add_all(db_jobs)

        await self.db.commit()
