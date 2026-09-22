from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.raw_job import RawJob
from providers.models.raw_jobs_data import RawJobData


class RawJobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_existing_hashes(self) -> set[str]:
        result = await self.db.execute(select(RawJob.content_hash))
        return set(result.scalars().all())

    async def save_many(self, jobs: list[RawJobData]) -> list[RawJob]:
        """Insert jobs, silently skipping any that already exist by content_hash.

        Uses ``INSERT … ON CONFLICT (content_hash) DO NOTHING`` so concurrent
        scraper runs never raise a UniqueViolationError, even if two pipelines
        race past the in-memory hash filter with identical jobs.

        Returns only the rows that were actually inserted this call.
        """
        if not jobs:
            return []

        rows = [
            {
                "source": job.source,
                "external_id": job.external_id,
                "title": job.title,
                "company": job.company,
                "date_posted": job.date_posted,
                "location": job.location,
                "link": job.link,
                "content_hash": job.content_hash,
                "raw_payload": job.raw_payload,
            }
            for job in jobs
        ]

        stmt = (
            pg_insert(RawJob)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["content_hash"])
            .returning(RawJob.id, RawJob.content_hash)
        )

        result = await self.db.execute(stmt)
        inserted_pairs = result.fetchall()  # [(id, hash), ...]
        await self.db.commit()

        if not inserted_pairs:
            return []

        # Fetch full ORM objects for only the newly inserted rows.
        inserted_ids = [row.id for row in inserted_pairs]
        fetched = await self.db.execute(
            select(RawJob).where(RawJob.id.in_(inserted_ids))
        )
        return list(fetched.scalars().all())
