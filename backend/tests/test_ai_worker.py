import uuid
from unittest.mock import AsyncMock, patch

import pytest

from ai.schemas import JobExtraction
from database.models.raw_job import ProcessingStatus, RawJob
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.repositories.raw_job_repository import RawJobRepository
from database.session import AsyncSessionLocal
from providers.models.raw_jobs_data import RawJobData
from workers.ai_worker import _process_raw_job, process_raw_job


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
@patch("workers.ai_worker.get_llm")
async def test_worker_success(mock_get_llm, dispose_db_engine) -> None:
    # Set up mock LLM and extraction return value
    mock_llm = AsyncMock()
    mock_get_llm.return_value = mock_llm

    expected_extraction = JobExtraction(
        job_title="AI Engineer",
        company="Antigravity Corp",
        skills=["Python", "PyTorch"],
        location="San Francisco",
        salary="200k",
        experience_years=5,
        employment_type="Full-time",
        job_description="Create advanced AI agents.",
    )
    mock_llm.invoke.return_value = expected_extraction

    # 1. Create a RawJob in database
    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        hash_val = f"worker-test-{uuid.uuid4()}"

        test_job = RawJobData(
            source="linkedin",
            external_id=f"ext-{uuid.uuid4()}",
            title="Raw AI Engineer",
            company="Antigravity Corp",
            date_posted=None,
            location="San Francisco",
            link="https://example.com/job",
            content_hash=hash_val,
            raw_payload={"description": "Create advanced AI agents."},
        )

        saved_raw = await raw_repo.save_many([test_job])
        raw_job = saved_raw[0]
        raw_job_id = raw_job.id

    # 2. Run the async worker function
    await _process_raw_job(raw_job_id)

    # 3. Verify changes in DB
    async with AsyncSessionLocal() as db:
        # Check raw job status is updated to PROCESSED
        raw_job_check = await db.get(RawJob, raw_job_id)
        assert raw_job_check is not None
        assert raw_job_check.processing_status == ProcessingStatus.PROCESSED

        # Check processed job was created
        processed_repo = ProcessedJobRepository(db)
        processed_job = await processed_repo.get_by_raw_job_id(raw_job_id)
        assert processed_job is not None
        assert processed_job.job_title == "AI Engineer"
        assert processed_job.skills == ["Python", "PyTorch"]
        assert processed_job.last_date_to_apply is not None

        # Clean up
        await db.delete(raw_job_check)
        await db.commit()


@pytest.mark.anyio
@patch("workers.ai_worker.get_llm")
async def test_worker_failure(mock_get_llm, dispose_db_engine) -> None:
    # Set up mock LLM to throw an exception
    mock_llm = AsyncMock()
    mock_get_llm.return_value = mock_llm
    mock_llm.invoke.side_effect = Exception("LLM call failed")

    # 1. Create a RawJob in database
    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        hash_val = f"worker-test-fail-{uuid.uuid4()}"

        test_job = RawJobData(
            source="linkedin",
            external_id=f"ext-{uuid.uuid4()}",
            title="Raw AI Engineer",
            company="Antigravity Corp",
            date_posted=None,
            location="San Francisco",
            link="https://example.com/job",
            content_hash=hash_val,
            raw_payload={"description": "Create advanced AI agents."},
        )

        saved_raw = await raw_repo.save_many([test_job])
        raw_job = saved_raw[0]
        raw_job_id = raw_job.id

    # 2. Run the worker
    await _process_raw_job(raw_job_id)

    # 3. Verify status updated to FAILED
    async with AsyncSessionLocal() as db:
        raw_job_check = await db.get(RawJob, raw_job_id)
        assert raw_job_check is not None
        assert raw_job_check.processing_status == ProcessingStatus.FAILED

        # Verify no ProcessedJob record exists
        processed_repo = ProcessedJobRepository(db)
        processed_job = await processed_repo.get_by_raw_job_id(raw_job_id)
        assert processed_job is None

        # Clean up
        await db.delete(raw_job_check)
        await db.commit()


@patch("workers.ai_worker.get_llm")
def test_sync_worker_entrypoint(mock_get_llm) -> None:
    # Verify the sync entrypoint process_raw_job runs correctly using asyncio.run
    mock_llm = AsyncMock()
    mock_get_llm.return_value = mock_llm

    # Using dummy ID that will not be found (leads to direct return without throwing)
    process_raw_job(9999999)
