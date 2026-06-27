import pytest
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from ai.providers.gemini import GeminiLLM


class EchoResponse(BaseModel):
    message: str


@pytest.mark.integration
@pytest.mark.llm
@pytest.mark.anyio
async def test_gemini_invoke_returns_structured_output() -> None:
    """Verify Gemini returns structured output matching the requested schema."""

    llm = GeminiLLM()

    messages = [
        HumanMessage(
            content=(
                "Return a JSON object that exactly matches the provided schema. "
                'The value of the `message` field must be exactly "hello". '
                "Do not include any additional fields, explanations, or markdown."
            )
        )
    ]

    response = await llm.invoke(
        messages=messages,
        output_schema=EchoResponse,
    )

    assert isinstance(response, EchoResponse)
    assert response.message.lower() == "hello"
