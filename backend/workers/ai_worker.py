import logging
from uuid import UUID

logger = logging.getLogger(__name__)


def process_raw_job(raw_job_id: UUID) -> None:
    """RQ worker entrypoint for processing a raw job.

    The full AI processing pipeline will be implemented incrementally.
    """

    logger.info("Starting AI processing for raw job %s", raw_job_id)

    # TODO: Load raw job from repository.
    # TODO: Update processing_status -> PROCESSING.
    # TODO: Invoke LLM extraction service.
    # TODO: Save processed job.
    # TODO: Generate embeddings.
    # TODO: Update processing_status -> PROCESSED.

    logger.info("Finished AI processing for raw job %s", raw_job_id)
