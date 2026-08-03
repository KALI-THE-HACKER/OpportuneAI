from unittest.mock import patch
from uuid import uuid4

from workers.ai_worker import process_raw_job
from workers.queue import ai_processing_queue, resume_processing_queue


def test_queue_configuration() -> None:
    """Verify the application is using the expected RQ queue."""
    assert ai_processing_queue.name == "ai-processing"
    assert resume_processing_queue.name == "resume-processing"


@patch("rq.queue.Queue.enqueue")
def test_enqueue_ai_job(mock_enqueue) -> None:
    """Verify enqueue() is invoked with the correct worker and job id."""
    job_id = uuid4()

    ai_processing_queue.enqueue(
        process_raw_job,
        job_id,
    )

    mock_enqueue.assert_called_once()

    args, kwargs = mock_enqueue.call_args

    assert args[0] == process_raw_job
    assert args[1] == job_id
    assert kwargs == {}
