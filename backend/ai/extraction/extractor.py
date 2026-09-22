import json
import logging

from ai.extraction.prompts import JOB_EXTRACTION_PROMPT
from ai.providers.base import BaseLLM
from ai.schemas import JobExtraction
from database.models.raw_job import RawJob
from utils.logging_config import log_dev

logger = logging.getLogger("worker")


class InsufficientJobDataError(Exception):
    """Raised when the LLM signals the job payload lacks critical information."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Insufficient job data: {reason}")


def _build_job_text(raw_job: RawJob) -> str:
    """
    Build comprehensive structured text to send to the LLM for extraction.

    Combines both top-level RawJob metadata (title, company, location, date, link, source)
    and all attributes from raw_payload (description, tags, salary, experience, etc.).
    """
    header_lines = [
        f"Job Title: {raw_job.title or 'N/A'}",
        f"Company Name: {raw_job.company or 'N/A'}",
        f"Location: {raw_job.location or 'Remote / Unspecified'}",
        f"Source: {raw_job.source or 'N/A'}",
        f"Date Posted: {raw_job.date_posted or 'N/A'}",
        f"Original Link: {raw_job.link or 'N/A'}",
    ]

    payload = raw_job.raw_payload
    description = ""

    if isinstance(payload, dict):
        for key in (
            "salary",
            "salary_min",
            "salary_max",
            "experience",
            "employment_type",
            "remote",
            "equity",
            "tags",
            "apply_url",
        ):
            val = payload.get(key)
            if val:
                if isinstance(val, list):
                    val = ", ".join(str(x) for x in val)
                header_lines.append(f"{key.replace('_', ' ').title()}: {val}")

        description = payload.get("description") or ""
        if not description:
            # Fallback to other string fields if description is empty
            extra_items = {
                k: v
                for k, v in payload.items()
                if k not in ("title", "company", "location", "link") and v
            }
            if extra_items:
                description = json.dumps(extra_items, ensure_ascii=False, indent=2)
    elif payload:
        description = str(payload)

    if not description or len(description.strip()) < 10:
        description = (
            f"Opportunity for {raw_job.title} at {raw_job.company}. "
            f"Location: {raw_job.location or 'Remote'}. Source: {raw_job.source}."
        )

    header = "\n".join(header_lines)
    return f"{header}\n\nJob Description & Details:\n{description}".strip()


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

        result: JobExtraction | None = await self.llm.invoke(
            messages=messages,
            output_schema=JobExtraction,
        )

        if result is None:
            if raw_job.title and raw_job.company:
                logger.warning(
                    "LLM returned null extraction for raw job %s; synthesizing basic extraction from raw job data.",
                    raw_job.id,
                )
                result = JobExtraction(
                    job_title=raw_job.title,
                    company=raw_job.company,
                    location=raw_job.location or "",
                    job_description=job_text,
                    data_sufficient=True,
                )
            else:
                raise InsufficientJobDataError(
                    "LLM returned null extraction response and raw job lacks title/company."
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
