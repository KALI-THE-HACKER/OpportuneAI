import sys
from pathlib import Path
from uuid import uuid4

from rq.job import Job

from workers.ai_worker import process_raw_job
from workers.queue import ai_processing_queue


def test_enqueue_job_to_redis() -> None:
    """Verify a job is pushed onto the Redis-backed RQ queue."""

    job = ai_processing_queue.enqueue(
        process_raw_job,
        uuid4(),
    )

    assert isinstance(job, Job)
    assert job.id is not None

    fetched = ai_processing_queue.fetch_job(job.id)

    assert fetched is not None
    assert fetched.id == job.id

    # Clean up so repeated test runs don't accumulate jobs.
    fetched.delete()
