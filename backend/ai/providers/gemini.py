from langchain_core.messages import BaseMessage
from ai.pools.gemini_pool import get_pool

from pydantic import BaseModel
from typing import TypeVar

from ai.providers.base import BaseLLM

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
        client = self._pool.acquire()

        structured_llm = client.with_structured_output(output_schema)

        response = await structured_llm.ainvoke(messages)

        return response
