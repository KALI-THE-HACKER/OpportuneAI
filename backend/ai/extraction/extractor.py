import json

from ai.extraction.prompts import JOB_EXTRACTION_PROMPT
from ai.providers.base import BaseLLM
from ai.schemas import JobExtraction
from database.models.raw_job import RawJob
from utils.logging_config import log_dev


class InsufficientJobDataError(Exception):
    """Raised when the LLM signals the job payload lacks critical information."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Insufficient job data: {reason}")


def _build_job_text(raw_job: RawJob) -> str:
    """
    Build the text to send to the LLM.

    Always sends the full payload so the model has maximum context.
    Falls back gracefully when raw_payload is None or not a dict.
    """
    payload = raw_job.raw_payload

    if payload is None:
        # No payload at all — give the LLM whatever top-level metadata exists
        return (
            f"Title: {raw_job.title or 'N/A'}\n"
            f"Company: {raw_job.company or 'N/A'}\n"
            f"Location: {raw_job.location or 'N/A'}\n"
            f"Date Posted: {raw_job.date_posted or 'N/A'}\n"
            f"Source: {raw_job.source}\n"
            "(No additional payload data available)"
        )

    if isinstance(payload, dict):
        description = payload.get("description") or ""
        if description:
            # Prefer structured context: metadata header + full description
            header_parts = []
            for key in (
                "title",
                "company",
                "location",
                "salary",
                "experience",
                "employment_type",
                "tags",
            ):
                value = payload.get(key)
                if value:
                    header_parts.append(f"{key.capitalize()}: {value}")
            header = "\n".join(header_parts)
            return f"{header}\n\nDescription:\n{description}".strip()
        # No description key — dump the whole dict as JSON for maximum context
        return json.dumps(payload, ensure_ascii=False, indent=2)

    # Payload is a plain string or some other type
    return str(payload)


class JobExtractor:
    def __init__(self, llm: BaseLLM):
        self.llm = llm

    async def extract(self, raw_job: RawJob) -> JobExtraction:
        """Extract structured information from a raw job.

        Raises:
            InsufficientJobDataError: when the LLM determines the payload
                does not contain enough information to produce a valid extraction.
        """
        job_text = _build_job_text(raw_job)

        log_dev(
            "JOB AI EXTRACTION REQUEST",
            {
                "raw_job_id": str(raw_job.id),
                "job_title": raw_job.title,
                "company": raw_job.company,
                "description_length": len(job_text),
                "job_text_sample": job_text[:1000]
                + ("..." if len(job_text) > 1000 else ""),
            },
            logger_name="worker",
        )

        messages = JOB_EXTRACTION_PROMPT.format_messages(job_description=job_text)

        result: JobExtraction = await self.llm.invoke(
            messages=messages,
            output_schema=JobExtraction,
        )

        log_dev(
            "JOB AI EXTRACTION RESPONSE",
            {
                "raw_job_id": str(raw_job.id),
                "data_sufficient": result.data_sufficient,
                "failure_reason": result.failure_reason,
                "extracted_data": result.model_dump()
                if hasattr(result, "model_dump")
                else str(result),
            },
            logger_name="worker",
        )

        if not result.data_sufficient:
            raise InsufficientJobDataError(
                result.failure_reason
                or "LLM reported data insufficient with no reason given."
            )

        return result
