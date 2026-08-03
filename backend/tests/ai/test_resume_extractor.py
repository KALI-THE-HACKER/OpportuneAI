from unittest.mock import AsyncMock

import pytest

from ai.extraction.resume_extractor import ResumeExtractor
from ai.schemas import ResumeExtraction


@pytest.mark.anyio
async def test_resume_extractor_invokes_llm_with_structured_schema() -> None:
    llm = AsyncMock()
    expected = ResumeExtraction(
        skills=["Python", "FastAPI"],
        experience_level="Senior",
        years_total=6,
        confidence=0.9,
        summary="Backend engineer.",
    )
    llm.invoke.return_value = expected

    result = await ResumeExtractor(llm).extract("Python and FastAPI developer")

    assert result == expected
    llm.invoke.assert_awaited_once()
    _, kwargs = llm.invoke.await_args
    assert kwargs["output_schema"] is ResumeExtraction
    assert len(kwargs["messages"]) == 2
