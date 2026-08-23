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
