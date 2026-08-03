import logging
from pathlib import Path

from database.repositories.raw_job_repository import RawJobRepository
from providers.linkedin_provider import LinkedInProvider
from providers.naukri_provider import NaukriProvider
from providers.remoteOK_provider import RemoteOKProvider
from providers.wellfound_provider import WellfoundProvider
from workers.ai_worker import process_raw_job
from workers.queue import ai_processing_queue

# Configure logging to write to ingestion.log in the backend directory
log_file = Path(__file__).resolve().parent.parent / "ingestion.log"
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# Avoid adding duplicate handlers if the module is re-imported
if not any(isinstance(h, logging.FileHandler) for h in root_logger.handlers):
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """
    IngestionPipeline is responsible for orchestrating the entire data
    ingestion process. It initializes all the providers, fetches job
    listings from each provider, checks for duplicates, and saves unique
    job listings to the repository.
    """

    def __init__(self, repository: RawJobRepository):
        self.repository = repository

        self.providers = [
            LinkedInProvider(),
            WellfoundProvider(),
            RemoteOKProvider(),
            NaukriProvider(),
        ]

    async def run(self):
        total_saved = 0

        existing_hashes = await self.repository.get_existing_hashes()

        for provider in self.providers:
            try:
                jobs = await provider.fetch_jobs()

                new_jobs = [
                    job for job in jobs if job.content_hash not in existing_hashes
                ]

                saved_jobs = await self.repository.save_many(new_jobs)

                for job in saved_jobs:
                    ai_processing_queue.enqueue(
                        process_raw_job,
                        job.id,
                    )

                existing_hashes.update(job.content_hash for job in new_jobs)
                total_saved += len(new_jobs)
            except Exception as e:
                logger.error(
                    f"Error occurred during ingestion for provider {provider.__class__.__name__}: {e}",
                    exc_info=True,
                )

        return total_saved
