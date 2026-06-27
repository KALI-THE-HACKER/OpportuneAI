import pytest
import uuid

from database.session import AsyncSessionLocal
from database.repositories.raw_job_repository import RawJobRepository
from database.repositories.processed_job_repository import ProcessedJobRepository
from providers.models.raw_jobs_data import RawJobData
from ai.schemas import JobExtraction

hash_value = f"test-{uuid.uuid4()}"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_create_and_retrieve_processed_job(dispose_db_engine):
    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        processed_repo = ProcessedJobRepository(db)

        # 1. Create a RawJob
        test_job = RawJobData(
            source="test",
            external_id=f"ext-{uuid.uuid4()}",
            title="Raw Engineer",
            company="Test Company",
            date_posted=None,
            location="Remote",
            link="https://example.com/job",
            content_hash=hash_value,
            raw_payload={"description": "Looking for a Python developer."},
        )

        saved_raw_jobs = await raw_repo.save_many([test_job])
        assert len(saved_raw_jobs) == 1
        raw_job = saved_raw_jobs[0]

        # 2. Extract Data (mocked/constructed locally as JobExtraction)
        extraction = JobExtraction(
            job_title="Software Engineer",
            company="Test Company",
            skills=["Python"],
            location="Remote",
            salary="100k",
            experience_years=3,
            employment_type="Full-time",
            job_description="Looking for a Python developer.",
        )

        # 3. Save to ProcessedJob using ProcessedJobRepository
        processed_job = await processed_repo.create(
            raw_job_id=raw_job.id,
            extraction=extraction,
        )

        assert processed_job.id is not None
        assert processed_job.raw_job_id == raw_job.id
        assert processed_job.job_title == "Software Engineer"
        assert processed_job.skills == ["Python"]
        assert processed_job.experience_years == 3

        # 4. Retrieve by id
        retrieved = await processed_repo.get_by_id(processed_job.id)
        assert retrieved is not None
        assert retrieved.job_title == "Software Engineer"

        # 5. Retrieve by raw_job_id
        retrieved_by_raw = await processed_repo.get_by_raw_job_id(raw_job.id)
        assert retrieved_by_raw is not None
        assert retrieved_by_raw.id == processed_job.id

        # 6. Verify relationship cascade delete
        await db.delete(raw_job)
        await db.commit()

        # The processed job should now be deleted as well due to foreign key CASCADE
        deleted_processed = await processed_repo.get_by_id(processed_job.id)
        assert deleted_processed is None
