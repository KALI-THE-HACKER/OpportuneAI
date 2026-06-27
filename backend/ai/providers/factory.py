from ai.providers.base import BaseLLM
from ai.providers.gemini import GeminiLLM
from ai.providers.openrouter import OpenRouterLLM
from config.settings import settings


def get_llm() -> BaseLLM:
    if settings.llm_provider == "gemini":
        return GeminiLLM()
    elif settings.llm_provider == "openrouter":
        return OpenRouterLLM()

    raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")
