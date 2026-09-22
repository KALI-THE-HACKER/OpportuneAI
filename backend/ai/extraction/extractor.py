import json
import logging
import re

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


def _clean_employment_type(emp_type: str | None) -> str | None:
    """Normalize employment type and strip markdown links, URLs, and titles."""
    if not emp_type:
        return None
    cleaned = re.sub(r"\[.*?\]\(.*?\)", "", str(emp_type))
    cleaned = re.sub(r"https?://\S+", "", cleaned).strip()
    cleaned_lower = cleaned.lower()
    if "full-time" in cleaned_lower or "full time" in cleaned_lower:
        return "Full-time"
    if "part-time" in cleaned_lower or "part time" in cleaned_lower:
        return "Part-time"
    if "contract" in cleaned_lower:
        return "Contract"
    if "intern" in cleaned_lower:
        return "Internship"
    if not cleaned:
        return None
    return cleaned.title()


def _clean_salary(salary: str | None) -> str | None:
    """Extract salary portion and strip out equity notes like '• No equity'."""
    if not salary:
        return None
    sal = str(salary)
    if "•" in sal or "|" in sal:
        sep = "•" if "•" in sal else "|"
        parts = [p.strip() for p in sal.split(sep) if "equity" not in p.lower()]
        sal = f" {sep} ".join(parts).strip()
    if "no equity" in sal.lower():
        sal = re.sub(r"no\s+equity", "", sal, flags=re.IGNORECASE).strip("•|- ")
    cleaned = sal.strip()
    return cleaned if cleaned else None


def _clean_job_description(
    desc: str | None,
    title: str | None,
    company: str | None,
    location: str | None,
) -> str:
    """Ensure job_description is clean natural language and not raw JSON or scraper debris."""
    title_str = title or "Software Engineer"
    company_str = company or "the hiring company"
    location_str = location or "Remote"

    if not desc or not desc.strip():
        return (
            f"Opportunity for {title_str} at {company_str}. Location: {location_str}."
        )

    text = desc.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    # If it is a raw JSON string or dict dump (e.g. {"salary": ..., "experience": ...})
    if (
        text.startswith("{") and text.endswith("}")
    ) or "Job Description & Details:\n{" in text:
        try:
            json_candidate = text
            if "{" in text:
                json_candidate = text[text.find("{") : text.rfind("}") + 1]
            data = json.loads(json_candidate)
            if isinstance(data, dict):
                parts = [f"{company_str} is hiring for a {title_str} position."]
                for k, v in data.items():
                    if v and k not in ("title", "company"):
                        clean_v = re.sub(r"\[.*?\]\(.*?\)", "", str(v)).strip()
                        if clean_v:
                            parts.append(f"{k.replace('_', ' ').title()}: {clean_v}.")
                if location_str and location_str != "N/A":
                    parts.append(f"Location: {location_str}.")
                return " ".join(parts)
        except Exception:
            pass

    if len(text) < 15 and text.lower().startswith("{"):
        return (
            f"Opportunity for {title_str} at {company_str}. Location: {location_str}."
        )

    return text


def _sanitize_extraction(result: JobExtraction, raw_job: RawJob) -> JobExtraction:
    """Ensure extracted fields are clean and free of formatting debris, raw JSON, or markdown links."""
    result.employment_type = _clean_employment_type(result.employment_type)
    result.salary = _clean_salary(result.salary)
    result.job_description = _clean_job_description(
        result.job_description,
        raw_job.title,
        raw_job.company,
        raw_job.location,
    )
    return result


def _build_job_text(raw_job: RawJob) -> str:
    """
    Build comprehensive structured text to send to the LLM for extraction.

    Combines both top-level RawJob metadata (title, company, location, date, link, source)
    and attributes from raw_payload (description, tags, salary, experience, etc.).
    Avoids raw JSON dumps in the prompt.
    """
    header_lines = [
        f"Job Title: {raw_job.title or 'N/A'}",
        f"Company Name: {raw_job.company or 'N/A'}",
        f"Location: {raw_job.location or 'Remote / Unspecified'}",
        f"Source: {raw_job.source or 'N/A'}",
        f"Date Posted: {raw_job.date_posted or 'N/A'}",
        f"Original Link: {raw_job.link or 'N/A'}",
    ]

    payload = raw_job.raw_payload or {}
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
                if key == "employment_type":
                    val = _clean_employment_type(str(val))
                if key == "salary":
                    val = _clean_salary(str(val))
                if val:
                    header_lines.append(f"{key.replace('_', ' ').title()}: {val}")

        desc_raw = payload.get("description")
        if isinstance(desc_raw, str) and desc_raw.strip():
            description = desc_raw.strip()
        else:
            # Construct human-readable overview rather than dumping JSON
            summary_parts = []
            if raw_job.title and raw_job.company:
                summary_parts.append(
                    f"{raw_job.company} is hiring for a {raw_job.title} role."
                )
            if raw_job.location and raw_job.location != "N/A":
                summary_parts.append(f"Location: {raw_job.location}.")
            if payload.get("experience"):
                summary_parts.append(f"Experience required: {payload['experience']}.")
            if payload.get("salary"):
                clean_sal = _clean_salary(str(payload["salary"]))
                if clean_sal:
                    summary_parts.append(f"Compensation: {clean_sal}.")
            if payload.get("employment_type"):
                clean_emp = _clean_employment_type(str(payload["employment_type"]))
                if clean_emp:
                    summary_parts.append(f"Employment type: {clean_emp}.")
            tags = payload.get("tags")
            if tags:
                tag_str = (
                    ", ".join(str(t) for t in tags)
                    if isinstance(tags, list)
                    else str(tags)
                )
                summary_parts.append(f"Key skills/tags: {tag_str}.")

            description = (
                " ".join(summary_parts)
                if summary_parts
                else (
                    f"Opportunity for {raw_job.title or 'candidate'} at {raw_job.company or 'company'}. "
                    f"Location: {raw_job.location or 'Remote'}."
                )
            )
    elif payload:
        description = str(payload).strip()

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
                synthetic_desc = _clean_job_description(
                    None,
                    raw_job.title,
                    raw_job.company,
                    raw_job.location,
                )
                result = JobExtraction(
                    job_title=raw_job.title,
                    company=raw_job.company,
                    location=raw_job.location or "",
                    job_description=synthetic_desc,
                    data_sufficient=True,
                )
            else:
                raise InsufficientJobDataError(
                    "LLM returned null extraction response and raw job lacks title/company."
                )

        # Defensive sanitization against LLM output anomalies
        result = _sanitize_extraction(result, raw_job)

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
