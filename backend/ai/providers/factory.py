from ai.providers.base import BaseLLM
from ai.providers.gemini import GeminiLLM
from config.settings import settings


def get_llm() -> BaseLLM:
    if settings.llm_provider == "gemini":
        return GeminiLLM()

    raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")
