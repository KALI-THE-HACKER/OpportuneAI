from ai.providers.base import BaseLLM
from ai.schemas import JobExtraction
from database.models.raw_job import RawJob
from ai.extraction.prompts import JOB_EXTRACTION_PROMPT


class JobExtractor:
    def __init__(self, llm: BaseLLM):
        self.llm = llm

    async def extract(self, raw_job: RawJob) -> JobExtraction:
        """Extract structured information from a raw job."""

        job_text = raw_job.raw_payload.get("description")
        if not job_text:
            job_text = str(raw_job.raw_payload)

        messages = JOB_EXTRACTION_PROMPT.format_messages(job_description=job_text)

        return await self.llm.invoke(
            messages=messages,
            output_schema=JobExtraction,
        )
