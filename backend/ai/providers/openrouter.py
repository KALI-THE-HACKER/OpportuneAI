from typing import TypeVar

from langchain_core.messages import BaseMessage
from langchain_openrouter import ChatOpenRouter
from pydantic import BaseModel

from ai.providers.base import BaseLLM
from config.settings import settings
from utils.logging_config import log_dev

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
        log_dev(
            "AI REQUEST MADE (OpenRouter)",
            {
                "provider": "openrouter",
                "model": settings.openrouter_model,
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

        structured_llm = self.client.with_structured_output(output_schema)
        response = await structured_llm.ainvoke(messages)

        log_dev(
            "AI DATA GIVEN (OpenRouter)",
            {
                "provider": "openrouter",
                "model": settings.openrouter_model,
                "output_schema": output_schema.__name__,
                "response": response.model_dump()
                if hasattr(response, "model_dump")
                else str(response),
            },
            logger_name="ai",
        )

        return response
