from config.settings import settings
from langchain_core.messages import BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel
from typing import TypeVar

from ai.providers.base import BaseLLM

T = TypeVar("T", bound=BaseModel)


class GeminiLLM(BaseLLM):
    """Gemini implementation of the application's LLM interface."""

    def __init__(self) -> None:
        self._llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=settings.llm_temperature,
        )

    async def invoke(
        self,
        messages: list[BaseMessage],
        output_schema: type[T],
    ) -> T:
        structured_llm = self._llm.with_structured_output(output_schema)

        response = await structured_llm.ainvoke(messages)

        return response
