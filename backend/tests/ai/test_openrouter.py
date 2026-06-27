from unittest.mock import patch, AsyncMock
import pytest
from pydantic import BaseModel

from ai.providers.openrouter import OpenRouterLLM
from ai.providers.factory import get_llm


class DummySchema(BaseModel):
    name: str


@pytest.fixture
def anyio_backend():
    return "asyncio"


@patch("config.settings.settings.openrouter_api_key", None)
def test_openrouter_init_raises_if_missing_key() -> None:
    with pytest.raises(ValueError, match="OPENROUTER_API_KEY is not configured"):
        OpenRouterLLM()


@pytest.mark.anyio
@patch("ai.providers.openrouter.ChatOpenRouter")
async def test_openrouter_invoke(mock_chat_openrouter) -> None:
    from unittest.mock import MagicMock

    mock_client = AsyncMock()
    mock_chat_openrouter.return_value = mock_client
    mock_structured = AsyncMock()
    mock_client.with_structured_output = MagicMock(return_value=mock_structured)

    expected_output = DummySchema(name="Extracted Name")
    mock_structured.ainvoke.return_value = expected_output

    with patch("config.settings.settings.openrouter_api_key", "test-api-key"):
        provider = OpenRouterLLM()
        result = await provider.invoke(messages=[], output_schema=DummySchema)

        assert result == expected_output
        mock_client.with_structured_output.assert_called_once_with(DummySchema)


@patch("config.settings.settings.llm_provider", "openrouter")
@patch("config.settings.settings.openrouter_api_key", "test-api-key")
def test_factory_returns_openrouter() -> None:
    provider = get_llm()
    assert isinstance(provider, OpenRouterLLM)
