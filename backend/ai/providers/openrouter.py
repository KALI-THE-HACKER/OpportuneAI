from langchain_core.messages import BaseMessage
from langchain_openrouter import ChatOpenRouter
from pydantic import BaseModel
from typing import TypeVar

from ai.providers.base import BaseLLM
from config.settings import settings

T = TypeVar("T", bound=BaseModel)


class OpenRouterLLM(BaseLLM):
    """OpenRouter implementation of the application's LLM interface."""

    def __init__(self) -> None:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured in settings")

        self.client = ChatOpenRouter(
            model=settings.openrouter_model,
            openrouter_api_key=settings.openrouter_api_key,
            temperature=settings.llm_temperature,
        )

    async def invoke(
        self,
        messages: list[BaseMessage],
        output_schema: type[T],
    ) -> T:
        structured_llm = self.client.with_structured_output(output_schema)
        response = await structured_llm.ainvoke(messages)
        return response
