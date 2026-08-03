from ai.providers.base import BaseLLM
from ai.schemas import JobExtraction
from database.models.raw_job import RawJob
from ai.extraction.prompts import JOB_EXTRACTION_PROMPT
from utils.logging_config import log_dev


class JobExtractor:
    def __init__(self, llm: BaseLLM):
        self.llm = llm

    async def extract(self, raw_job: RawJob) -> JobExtraction:
        """Extract structured information from a raw job."""

        job_text = raw_job.raw_payload.get("description")
        if not job_text:
            job_text = str(raw_job.raw_payload)

        log_dev(
            "JOB AI EXTRACTION REQUEST",
            {
                "raw_job_id": str(raw_job.id),
                "job_title": raw_job.raw_payload.get("title", ""),
                "company": raw_job.raw_payload.get("company", ""),
                "description_length": len(job_text),
                "job_text_sample": job_text[:1000]
                + ("..." if len(job_text) > 1000 else ""),
            },
            logger_name="worker",
        )

        messages = JOB_EXTRACTION_PROMPT.format_messages(job_description=job_text)

        result = await self.llm.invoke(
            messages=messages,
            output_schema=JobExtraction,
        )

        log_dev(
            "JOB AI EXTRACTION RESPONSE",
            {
                "raw_job_id": str(raw_job.id),
                "extracted_data": result.model_dump()
                if hasattr(result, "model_dump")
                else str(result),
            },
            logger_name="worker",
        )

        return result
