import logging
import re
from typing import TypeVar

from langchain_core.messages import BaseMessage
from pydantic import BaseModel

from ai.pools.gemini_pool import get_pool
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


class GeminiLLM(BaseLLM):
    """Gemini implementation of the application's LLM interface."""

    def __init__(self) -> None:
        self._pool = get_pool()

    async def invoke(
        self,
        messages: list[BaseMessage],
        output_schema: type[T],
    ) -> T:
        log_dev(
            "AI REQUEST MADE (Gemini)",
            {
                "provider": "gemini",
                "model": settings.gemini_model,
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

        client = self._pool.acquire()
        response: T | None = None
        try:
            structured_llm = client.with_structured_output(
                output_schema, include_raw=True
            )
            result_dict = await structured_llm.ainvoke(messages)
            response = result_dict.get("parsed")
            raw_msg = result_dict.get("raw")

            if response is None and raw_msg:
                raw_content = getattr(raw_msg, "content", "")
                json_str = _extract_json_payload(raw_content)
                if json_str:
                    try:
                        response = output_schema.model_validate_json(json_str)
                    except Exception as parse_err:
                        logger.debug(
                            "Failed to validate JSON from raw Gemini message: %s",
                            parse_err,
                        )
        except Exception as e:
            logger.warning("Gemini structured_llm.ainvoke failed: %s", e)

        # Fallback 2: Direct invoke without tool calling constraint if response is still None
        if response is None:
            try:
                logger.info(
                    "Gemini structured_llm returned None; attempting direct prompt invoke."
                )
                direct_msg = await client.ainvoke(messages)
                raw_content = getattr(direct_msg, "content", "")
                json_str = _extract_json_payload(raw_content)
                if json_str:
                    response = output_schema.model_validate_json(json_str)
            except Exception as e:
                logger.error("Gemini direct fallback extraction failed: %s", e)

        log_dev(
            "AI DATA GIVEN (Gemini)",
            {
                "provider": "gemini",
                "model": settings.gemini_model,
                "output_schema": output_schema.__name__,
                "response": response.model_dump()
                if hasattr(response, "model_dump")
                else str(response),
            },
            logger_name="ai",
        )

        return response
