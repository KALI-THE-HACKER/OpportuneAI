import pytest

from ai.providers.base import BaseLLM
from ai.providers.factory import get_llm
from ai.providers.gemini import GeminiLLM
from ai.pools.gemini_pool import get_pool
from config.settings import settings


def test_get_llm_returns_gemini_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Factory should return the configured Gemini provider."""

    monkeypatch.setattr(settings, "llm_provider", "gemini")

    llm = get_llm()

    assert isinstance(llm, BaseLLM)
    assert isinstance(llm, GeminiLLM)
    assert llm._pool is get_pool()


def test_get_llm_raises_for_unknown_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Factory should reject unsupported providers."""

    monkeypatch.setattr(settings, "llm_provider", "unsupported")

    with pytest.raises(ValueError, match="Unsupported LLM provider"):
        get_llm()
