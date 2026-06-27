import pytest

from database.session import AsyncSessionLocal
from database.repositories.raw_job_repository import RawJobRepository
from providers.models.raw_jobs_data import RawJobData

import uuid

hash_value = f"test-{uuid.uuid4()}"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_save_many_and_get_existing_hashes(dispose_db_engine):
    async with AsyncSessionLocal() as db:
        repo = RawJobRepository(db)

        test_job = RawJobData(
            source="test",
            external_id="test-123",
            title="Software Engineer Intern",
            company="Test Company",
            date_posted=None,
            location="Remote",
            link="https://example.com/job",
            content_hash=hash_value,
            raw_payload={"description": "test"},
        )

        saved_jobs = await repo.save_many([test_job])

        assert len(saved_jobs) == 1
        assert saved_jobs[0].id is not None
        assert saved_jobs[0].content_hash == hash_value
        assert saved_jobs[0].processing_status == "pending"

        hashes = await repo.get_existing_hashes()

        assert hash_value in hashes
