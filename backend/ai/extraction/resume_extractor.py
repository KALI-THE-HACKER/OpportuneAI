from ai.extraction.resume_prompts import RESUME_EXTRACTION_PROMPT
from ai.providers.base import BaseLLM
from ai.schemas import ResumeExtraction
from utils.logging_config import log_dev


class ResumeExtractor:
    """Extracts structured candidate data from raw resume text using an LLM."""

    def __init__(self, llm: BaseLLM) -> None:
        self.llm = llm

    async def extract(self, resume_text: str) -> ResumeExtraction:
        """Invoke the LLM and return a ResumeExtraction for the supplied text.

        Args:
            resume_text: Plain-text content of the candidate's resume.

        Returns:
            ResumeExtraction with skills, experience_level, years_total, confidence, summary.
        """
        log_dev(
            "RESUME AI EXTRACTION REQUEST",
            {
                "resume_text_length": len(resume_text),
                "resume_text_sample": resume_text[:1000]
                + ("..." if len(resume_text) > 1000 else ""),
            },
            logger_name="resume",
        )

        messages = RESUME_EXTRACTION_PROMPT.format_messages(resume_text=resume_text)
        result = await self.llm.invoke(
            messages=messages, output_schema=ResumeExtraction
        )

        log_dev(
            "RESUME AI EXTRACTION RESPONSE",
            result.model_dump() if hasattr(result, "model_dump") else str(result),
            logger_name="resume",
        )

        return result
