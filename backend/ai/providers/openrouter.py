import logging
import re
from typing import TypeVar

from langchain_core.messages import BaseMessage
from langchain_openrouter import ChatOpenRouter
from pydantic import BaseModel

from ai.providers.base import BaseLLM
from config.settings import settings
from utils.logging_config import log_dev

logger = logging.getLogger("ai")
T = TypeVar("T", bound=BaseModel)


def _extract_json_payload(text: str) -> str | None:
    if not text or not isinstance(text, str):
        return None
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    if "{" in text and "}" in text:
        start = text.find("{")
        end = text.rfind("}") + 1
        return text[start:end]
    return None


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

        response: T | None = None
        try:
            structured_llm = self.client.with_structured_output(
                output_schema, include_raw=True
            )
            result_dict = await structured_llm.ainvoke(messages)
            response = result_dict.get("parsed")
            raw_msg = result_dict.get("raw")

            # Fallback 1: check if raw content from tool call message contains JSON
            if response is None and raw_msg:
                raw_content = getattr(raw_msg, "content", "")
                json_str = _extract_json_payload(raw_content)
                if json_str:
                    try:
                        response = output_schema.model_validate_json(json_str)
                    except Exception as parse_err:
                        logger.debug(
                            "Failed to validate JSON from raw tool-call message: %s",
                            parse_err,
                        )
        except Exception as e:
            logger.warning("OpenRouter structured_llm.ainvoke failed: %s", e)

        # Fallback 2: Direct invoke without tool calling constraint if response is still None
        if response is None:
            try:
                logger.info(
                    "OpenRouter structured_llm returned None; attempting direct prompt invoke."
                )
                direct_msg = await self.client.ainvoke(messages)
                raw_content = getattr(direct_msg, "content", "")
                json_str = _extract_json_payload(raw_content)
                if json_str:
                    response = output_schema.model_validate_json(json_str)
            except Exception as e:
                logger.error("OpenRouter direct fallback extraction failed: %s", e)

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
