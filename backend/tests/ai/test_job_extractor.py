from unittest.mock import AsyncMock

import pytest

from ai.extraction.extractor import JobExtractor
from ai.schemas import JobExtraction
from database.models.raw_job import RawJob


@pytest.mark.anyio
async def test_extract_invokes_llm_and_returns_schema() -> None:
    llm = AsyncMock()

    expected = JobExtraction(
        job_title="Backend Intern",
        company="Acme",
        job_description="Looking for a Backend Intern with Python and FastAPI.",
        skills=["Python", "FastAPI"],
        experience_years=0,
        location="Remote",
        employment_type="Internship",
        last_date_to_apply="2026-09-30",
    )

    llm.invoke.return_value = expected

    extractor = JobExtractor(llm)

    raw_job = RawJob(
        source="linkedin",
        external_id="123",
        title="Backend Intern",
        company="Acme",
        location="Remote",
        link="https://example.com/job",
        content_hash="hash",
        raw_payload={
            "description": "Looking for a Backend Intern with Python and FastAPI.",
        },
    )

    result = await extractor.extract(raw_job)

    assert result == expected
    llm.invoke.assert_awaited_once()

    _, kwargs = llm.invoke.await_args

    assert "messages" in kwargs
    assert kwargs["output_schema"] is JobExtraction

    messages = kwargs["messages"]
    assert isinstance(messages, list)
    assert len(messages) == 2


@pytest.mark.anyio
async def test_extract_sanitizes_dirty_llm_output() -> None:
    llm = AsyncMock()

    dirty_extraction = JobExtraction(
        job_title="Site Reliability Engineer (SRE)",
        company="Wellfound Corp",
        job_description='{\n  "salary": "₹20L – ₹30L • No equity",\n  "experience": "3years of exp",\n  "employment_type": "[Site Reliability Engineer (SRE)](https://wellfound.com/jobs/4126035) Full-time"\n}',
        skills=["Kubernetes", "Linux"],
        experience_years=3,
        location="Remote",
        salary="₹20L – ₹30L • No equity",
        employment_type="[Site Reliability Engineer (SRE)](https://wellfound.com/jobs/4126035) Full-time",
    )

    llm.invoke.return_value = dirty_extraction
    extractor = JobExtractor(llm)

    raw_job = RawJob(
        source="wellfound",
        external_id="4126035",
        title="Site Reliability Engineer (SRE)",
        company="Wellfound Corp",
        location="Remote",
        link="https://wellfound.com/jobs/4126035",
        content_hash="hash_sre",
        raw_payload={
            "salary": "₹20L – ₹30L • No equity",
            "experience": "3years of exp",
            "employment_type": "[Site Reliability Engineer (SRE)](https://wellfound.com/jobs/4126035) Full-time",
        },
    )

    result = await extractor.extract(raw_job)

    assert result.employment_type == "Full-time"
    assert result.salary == "₹20L – ₹30L"
    assert not result.job_description.startswith("{")
    assert (
        "Wellfound Corp is hiring for a Site Reliability Engineer (SRE) position."
        in result.job_description
    )
    assert "Experience: 3years of exp" in result.job_description


@pytest.mark.anyio
async def test_build_job_text_never_dumps_raw_json() -> None:
    from ai.extraction.extractor import _build_job_text

    raw_job = RawJob(
        source="wellfound",
        external_id="4632620",
        title="Forward Deployment Engineer",
        company="Palantir Partner",
        location="San Francisco",
        link="https://wellfound.com/jobs/4632620",
        content_hash="hash_fde",
        raw_payload={
            "experience": "8years of exp",
            "employment_type": "[Forward Deployment Engineer](https://wellfound.com/jobs/4632620) Full-time",
            "remote": "Onsite or remote • San Francisco+5",
            "salary": "$150k - $200k • 0.1% equity",
        },
    )

    job_text = _build_job_text(raw_job)
    assert '{\n  "experience"' not in job_text
    assert '{\n  "salary"' not in job_text
    assert "Job Description & Details:" in job_text
    assert (
        "Palantir Partner is hiring for a Forward Deployment Engineer role." in job_text
    )
