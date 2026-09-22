import time

from database.repositories.raw_job_repository import RawJobRepository
from providers.linkedin_provider import LinkedInProvider
from providers.naukri_provider import NaukriProvider
from providers.remoteOK_provider import RemoteOKProvider
from providers.wellfound_provider import WellfoundProvider
from utils.logging_config import get_feature_logger
from workers.ai_worker import process_raw_job
from workers.queue import ai_processing_queue

logger = get_feature_logger("ingestion")


class IngestionPipeline:
    """IngestionPipeline orchestrates the crawler ingestion process for all providers."""

    def __init__(self, repository: RawJobRepository):
        self.repository = repository
        self.providers = [
            LinkedInProvider(),
            WellfoundProvider(),
            RemoteOKProvider(),
            NaukriProvider(),
        ]

    async def run(self) -> int:
        total_saved = 0
        total_fetched = 0
        start_time = time.time()

        logger.info(
            f"[PIPELINE START] Beginning full ingestion crawl across {len(self.providers)} providers..."
        )

        existing_hashes = await self.repository.get_existing_hashes()
        logger.info(
            f"[PIPELINE] Initialized with {len(existing_hashes)} existing job content hashes in database."
        )

        for provider in self.providers:
            provider_name = provider.__class__.__name__.replace("Provider", "")
            provider_start = time.time()
            logger.info(f"[{provider_name}] [START] Starting provider crawl...")

            try:
                jobs = await provider.fetch_jobs()
                provider_fetched = len(jobs)
                total_fetched += provider_fetched

                new_jobs = [
                    job for job in jobs if job.content_hash not in existing_hashes
                ]
                saved_jobs = await self.repository.save_many(new_jobs)
                saved_count = len(saved_jobs)
                duplicates_count = provider_fetched - saved_count

                for job in saved_jobs:
                    ai_processing_queue.enqueue(
                        process_raw_job,
                        job.id,
                    )

                existing_hashes.update(job.content_hash for job in new_jobs)
                total_saved += saved_count
                provider_elapsed_ms = int((time.time() - provider_start) * 1000)

                logger.info(
                    f"[{provider_name}] [SUCCESS] Scraped {provider_fetched} jobs. Saved {saved_count} new unique jobs ({duplicates_count} duplicates skipped). Duration: {provider_elapsed_ms}ms"
                )

            except Exception as e:
                provider_elapsed_ms = int((time.time() - provider_start) * 1000)
                err_str = str(e)
                logger.error(
                    f"[{provider_name}] [ERROR] Provider failed after {provider_elapsed_ms}ms: {err_str}",
                    exc_info=True,
                )

        total_elapsed_sec = round(time.time() - start_time, 2)
        logger.info(
            f"[PIPELINE COMPLETE] Ingestion finished in {total_elapsed_sec}s. Total fetched: {total_fetched}, Total newly saved: {total_saved}"
        )
        return total_saved
