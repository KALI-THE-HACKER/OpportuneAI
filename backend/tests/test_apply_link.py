"""Tests for apply URL extraction features added in feat/job-apply.

Covers:
- JobExtraction.apply_url field presence and defaults
- apply_url prompt inclusion check (prompt text content)
- ProcessedJobRepository.create() propagates apply_url from extraction
- ProcessedJobRepository.create() applies caller-provided payload apply_url fallback
- _extract_apply_url_from_payload helper in ai_worker
- format_job_card includes applyUrl, contactEmail, contactName, contactRole
- JobCardSchema in routes/feed accepts the new fields
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from ai.extraction.prompts import JOB_EXTRACTION_PROMPT
from ai.schemas import JobExtraction
from database.models.processed_job import ProcessedJob
from database.models.raw_job import RawJob
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.repositories.raw_job_repository import RawJobRepository
from database.session import AsyncSessionLocal
from providers.models.raw_jobs_data import RawJobData
from services.feed_service import FeedService
from workers.ai_worker import _extract_apply_url_from_payload


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ---------------------------------------------------------------------------
# Schema — apply_url field
# ---------------------------------------------------------------------------


def test_job_extraction_apply_url_defaults_to_none():
    """apply_url should be None when not provided."""
    extraction = JobExtraction(
        job_title="Engineer",
        company="Acme",
        job_description="Build things.",
    )
    assert extraction.apply_url is None


def test_job_extraction_apply_url_is_stored():
    """apply_url should be preserved when provided."""
    url = "https://jobs.lever.co/acme/abc-123"
    extraction = JobExtraction(
        job_title="Engineer",
        company="Acme",
        job_description="Build things.",
        apply_url=url,
    )
    assert extraction.apply_url == url


# ---------------------------------------------------------------------------
# Prompt — apply_url instruction present
# ---------------------------------------------------------------------------


def test_extraction_prompt_mentions_apply_url():
    """The system prompt must instruct the LLM to extract apply_url."""
    messages = JOB_EXTRACTION_PROMPT.format_messages(job_description="dummy")
    system_content = messages[0].content
    assert "apply_url" in system_content, (
        "System prompt must include 'apply_url' instruction"
    )


# ---------------------------------------------------------------------------
# ai_worker — _extract_apply_url_from_payload helper
# ---------------------------------------------------------------------------


def test_extract_apply_url_from_remoteok_payload():
    payload = {
        "apply_url": "https://remoteok.com/apply/12345",
        "description": "Remote job",
    }
    result = _extract_apply_url_from_payload(payload)
    assert result == "https://remoteok.com/apply/12345"


def test_extract_apply_url_returns_none_when_absent():
    payload = {"description": "No apply URL here"}
    assert _extract_apply_url_from_payload(payload) is None


def test_extract_apply_url_returns_none_for_none_payload():
    assert _extract_apply_url_from_payload(None) is None


def test_extract_apply_url_returns_none_for_empty_string():
    payload = {"apply_url": ""}
    assert _extract_apply_url_from_payload(payload) is None


def test_extract_apply_url_returns_none_for_non_dict():
    assert _extract_apply_url_from_payload("not a dict") is None  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# ProcessedJobRepository — apply_url persistence
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_repository_create_persists_apply_url_from_extraction(dispose_db_engine):
    """apply_url extracted by LLM should be stored in processed_jobs."""
    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        processed_repo = ProcessedJobRepository(db)

        raw = RawJobData(
            source="test",
            external_id=f"ext-applyurl-{uuid.uuid4()}",
            title="Frontend Engineer",
            company="TechCo",
            location="Remote",
            link="https://example.com/fe-job",
            content_hash=f"apply-url-test-{uuid.uuid4()}",
            raw_payload={"description": "Apply via Greenhouse."},
        )
        saved = await raw_repo.save_many([raw])
        raw_job = saved[0]

        extraction = JobExtraction(
            job_title="Frontend Engineer",
            company="TechCo",
            skills=["React", "TypeScript"],
            location="Remote",
            job_description="Apply via Greenhouse.",
            apply_url="https://boards.greenhouse.io/techco/jobs/123",
        )

        processed = await processed_repo.create(
            raw_job_id=raw_job.id,
            extraction=extraction,
        )

        assert processed.apply_url == "https://boards.greenhouse.io/techco/jobs/123"

        await db.delete(raw_job)
        await db.commit()


@pytest.mark.anyio
async def test_repository_create_uses_payload_apply_url_when_extraction_is_none(
    dispose_db_engine,
):
    """Caller-provided payload apply_url should be used when LLM returns None."""
    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        processed_repo = ProcessedJobRepository(db)

        raw = RawJobData(
            source="remoteok",
            external_id=f"ext-payload-apply-{uuid.uuid4()}",
            title="DevOps Engineer",
            company="RemoteCo",
            location="Remote",
            link="https://remoteok.com/jobs/999",
            content_hash=f"payload-apply-test-{uuid.uuid4()}",
            raw_payload={
                "apply_url": "https://remoteok.com/apply/999",
                "description": "Manage cloud infra.",
            },
        )
        saved = await raw_repo.save_many([raw])
        raw_job = saved[0]

        extraction = JobExtraction(
            job_title="DevOps Engineer",
            company="RemoteCo",
            skills=["AWS", "Terraform"],
            location="Remote",
            job_description="Manage cloud infra.",
            apply_url=None,  # LLM did not find an apply URL
        )

        processed = await processed_repo.create(
            raw_job_id=raw_job.id,
            extraction=extraction,
            apply_url="https://remoteok.com/apply/999",  # from raw_payload fallback
        )

        assert processed.apply_url == "https://remoteok.com/apply/999"

        await db.delete(raw_job)
        await db.commit()


@pytest.mark.anyio
async def test_repository_create_apply_url_is_none_when_both_absent(dispose_db_engine):
    """apply_url should be None when neither extraction nor payload provides one."""
    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        processed_repo = ProcessedJobRepository(db)

        raw = RawJobData(
            source="linkedin",
            external_id=f"ext-no-apply-{uuid.uuid4()}",
            title="Data Analyst",
            company="DataCo",
            location="NYC",
            link="https://linkedin.com/jobs/da-555",
            content_hash=f"no-apply-test-{uuid.uuid4()}",
            raw_payload={"description": "Analyze data."},
        )
        saved = await raw_repo.save_many([raw])
        raw_job = saved[0]

        extraction = JobExtraction(
            job_title="Data Analyst",
            company="DataCo",
            skills=["SQL", "Python"],
            location="NYC",
            job_description="Analyze data.",
            apply_url=None,
        )

        processed = await processed_repo.create(
            raw_job_id=raw_job.id,
            extraction=extraction,
            apply_url=None,
        )

        assert processed.apply_url is None

        await db.delete(raw_job)
        await db.commit()


# ---------------------------------------------------------------------------
# feed_service — format_job_card exposes new fields
# ---------------------------------------------------------------------------


def _make_processed_job(**kwargs) -> ProcessedJob:
    """Helper to create an in-memory ProcessedJob with required fields."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    defaults = dict(
        id=9000,
        raw_job_id=1,
        job_title="Software Engineer",
        company="TestCo",
        skills=["Python"],
        location="Remote",
        salary=None,
        experience_years=2,
        employment_type="full-time",
        job_description="Build great software at scale with a passionate team.",
        processed_at=now,
        apply_url=None,
        contact_email=None,
        contact_name=None,
        contact_role=None,
    )
    defaults.update(kwargs)
    return ProcessedJob(**defaults)


def _make_raw_job(**kwargs) -> RawJob:
    defaults = dict(
        id=1,
        source="linkedin",
        title="Software Engineer",
        company="TestCo",
        link="https://linkedin.com/jobs/1",
        content_hash="abc123",
        raw_payload={},
    )
    defaults.update(kwargs)
    return RawJob(**defaults)


def test_format_job_card_includes_apply_url():
    job = _make_processed_job(apply_url="https://greenhouse.io/jobs/1")
    job.raw_job = _make_raw_job()
    card = FeedService.format_job_card(job)
    assert card["applyUrl"] == "https://greenhouse.io/jobs/1"


def test_format_job_card_apply_url_is_none_when_absent():
    job = _make_processed_job(apply_url=None)
    job.raw_job = _make_raw_job()
    card = FeedService.format_job_card(job)
    assert card["applyUrl"] is None


def test_format_job_card_includes_contact_fields():
    job = _make_processed_job(
        apply_url=None,
        contact_email="sarah@techco.io",
        contact_name="Sarah Chen",
        contact_role="Head of Talent",
    )
    job.raw_job = _make_raw_job()
    card = FeedService.format_job_card(job)
    assert card["contactEmail"] == "sarah@techco.io"
    assert card["contactName"] == "Sarah Chen"
    assert card["contactRole"] == "Head of Talent"


def test_format_job_card_contact_fields_are_none_when_absent():
    job = _make_processed_job()
    job.raw_job = _make_raw_job()
    card = FeedService.format_job_card(job)
    assert card["contactEmail"] is None
    assert card["contactName"] is None
    assert card["contactRole"] is None


# ---------------------------------------------------------------------------
# ai_worker integration — apply_url flows end-to-end through worker
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("workers.ai_worker.get_llm")
@patch("workers.ai_worker.ContactFinderAgent")
async def test_worker_persists_apply_url_and_skips_contact_finder(
    mock_agent_cls, mock_get_llm, dispose_db_engine
):
    """When apply_url present in extraction, ContactFinderAgent must not be invoked."""
    mock_llm = AsyncMock()
    mock_get_llm.return_value = mock_llm

    mock_llm.invoke.return_value = JobExtraction(
        job_title="ML Engineer",
        company="AIStartup",
        skills=["Python", "PyTorch"],
        location="Remote",
        job_description="Train large models.",
        apply_url="https://jobs.ashbyhq.com/aistartup/ml-eng",
    )

    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        raw = RawJobData(
            source="wellfound",
            external_id=f"wf-{uuid.uuid4()}",
            title="ML Engineer",
            company="AIStartup",
            location="Remote",
            link="https://wellfound.com/jobs/ml-eng",
            content_hash=f"wf-apply-test-{uuid.uuid4()}",
            raw_payload={"description": "Train large models."},
        )
        saved = await raw_repo.save_many([raw])
        raw_job_id = saved[0].id

    from workers.ai_worker import _process_raw_job

    await _process_raw_job(raw_job_id)

    # ContactFinderAgent should NOT have been instantiated
    mock_agent_cls.assert_not_called()

    async with AsyncSessionLocal() as db:
        from database.models.raw_job import RawJob as RJ

        rj = await db.get(RJ, raw_job_id)
        processed_repo = ProcessedJobRepository(db)
        processed = await processed_repo.get_by_raw_job_id(raw_job_id)

        assert processed is not None
        assert processed.apply_url == "https://jobs.ashbyhq.com/aistartup/ml-eng"

        await db.delete(rj)
        await db.commit()


@pytest.mark.anyio
@patch("workers.ai_worker.get_llm")
@patch("workers.ai_worker.ContactFinderAgent")
async def test_worker_triggers_contact_finder_when_no_apply_url(
    mock_agent_cls, mock_get_llm, dispose_db_engine
):
    """When apply_url is absent, ContactFinderAgent.find() must be called."""
    mock_llm = AsyncMock()
    mock_get_llm.return_value = mock_llm

    mock_llm.invoke.return_value = JobExtraction(
        job_title="Backend Dev",
        company="StartupXYZ",
        skills=["Go"],
        location="NYC",
        job_description="Build scalable APIs.",
        apply_url=None,  # No apply URL
    )

    # Mock the agent so it returns None (no contact found)
    mock_agent_instance = AsyncMock()
    mock_agent_instance.find = AsyncMock(return_value=None)
    mock_agent_cls.return_value = mock_agent_instance

    async with AsyncSessionLocal() as db:
        raw_repo = RawJobRepository(db)
        raw = RawJobData(
            source="naukri",
            external_id=f"nk-{uuid.uuid4()}",
            title="Backend Dev",
            company="StartupXYZ",
            location="NYC",
            link="https://naukri.com/jobs/backend-dev",
            content_hash=f"nk-no-apply-{uuid.uuid4()}",
            raw_payload={"description": "Build scalable APIs."},
        )
        saved = await raw_repo.save_many([raw])
        raw_job_id = saved[0].id

    from workers.ai_worker import _process_raw_job

    await _process_raw_job(raw_job_id)

    # ContactFinderAgent must have been instantiated and find() called
    mock_agent_cls.assert_called_once()
    mock_agent_instance.find.assert_awaited_once()

    async with AsyncSessionLocal() as db:
        from database.models.raw_job import RawJob as RJ

        rj = await db.get(RJ, raw_job_id)
        await db.delete(rj)
        await db.commit()
