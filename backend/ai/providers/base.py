from abc import ABC, abstractmethod
from langchain_core.messages import BaseMessage
from pydantic import BaseModel
from typing import TypeVar

T = TypeVar("T", bound=BaseModel)


class BaseLLM(ABC):
    """Abstract interface implemented by all LLM providers."""

    @abstractmethod
    async def invoke(self, messages: list[BaseMessage], output_schema: type[T]) -> T:
        """Invoke the underlying LLM and return structured output."""
        raise NotImplementedError
