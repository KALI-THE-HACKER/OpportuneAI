from typing import TypeVar

from langchain_core.messages import BaseMessage
from pydantic import BaseModel

from ai.pools.gemini_pool import get_pool
from ai.providers.base import BaseLLM
from config.settings import settings
from utils.logging_config import log_dev

T = TypeVar("T", bound=BaseModel)


class GeminiLLM(BaseLLM):
    """Gemini implementation of the application's LLM interface."""

    def __init__(self) -> None:
        self._pool = get_pool()

    async def invoke(
        self,
        messages: list[BaseMessage],
        output_schema: type[T],
    ) -> T:
        log_dev(
            "AI REQUEST MADE (Gemini)",
            {
                "provider": "gemini",
                "model": settings.gemini_model,
                "output_schema": output_schema.__name__,
                "messages": [
                    {
                        "role": getattr(m, "type", "user"),
                        "content": getattr(m, "content", str(m)),
                    }
                    for m in messages
                ],
            },
            logger_name="ai",
        )

        client = self._pool.acquire()
        structured_llm = client.with_structured_output(output_schema)
        response = await structured_llm.ainvoke(messages)

        log_dev(
            "AI DATA GIVEN (Gemini)",
            {
                "provider": "gemini",
                "model": settings.gemini_model,
                "output_schema": output_schema.__name__,
                "response": response.model_dump()
                if hasattr(response, "model_dump")
                else str(response),
            },
            logger_name="ai",
        )

        return response
