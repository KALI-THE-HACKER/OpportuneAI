import logging
from typing import Any

from rq import Queue, Worker
from rq.registry import FailedJobRegistry

from workers.queue import (
    ai_processing_queue,
    redis_connection,
    resume_processing_queue,
)

logger = logging.getLogger(__name__)

# Scraper queue instance
scraper_queue = Queue("scraper-queue", connection=redis_connection)


class QueueService:
    @classmethod
    def get_all_queues(cls) -> list[Queue]:
        return [ai_processing_queue, resume_processing_queue, scraper_queue]

    @classmethod
    def get_queue_telemetry(cls) -> dict[str, Any]:
        """Collect real-time queue lengths, worker states, and failed registries."""
        queues_data = []
        total_queued = 0
        total_failed = 0

        for q in cls.get_all_queues():
            try:
                registry = FailedJobRegistry(queue=q)
                failed_count = len(registry)
                queued_count = len(q)
                total_queued += queued_count
                total_failed += failed_count

                queues_data.append(
                    {
                        "name": q.name,
                        "queued_jobs": queued_count,
                        "failed_jobs": failed_count,
                        "is_empty": q.is_empty,
                    }
                )
            except Exception as e:
                logger.error(f"Error reading queue {q.name}: {e}")
                queues_data.append(
                    {
                        "name": q.name,
                        "queued_jobs": 0,
                        "failed_jobs": 0,
                        "is_empty": True,
                    }
                )

        # Worker information
        workers_data = []
        try:
            workers = Worker.all(connection=redis_connection)
            for w in workers:
                workers_data.append(
                    {
                        "id": w.name,
                        "name": w.name,
                        "state": w.get_state(),
                        "queues": [q.name for q in w.queues],
                        "current_job_id": w.get_current_job_id(),
                        "birth_date": w.birth_date.isoformat()
                        if w.birth_date
                        else None,
                        "successful_job_count": getattr(w, "successful_job_count", 0),
                        "failed_job_count": getattr(w, "failed_job_count", 0),
                    }
                )
        except Exception as e:
            logger.error(f"Error reading workers: {e}")

        return {
            "total_queued": total_queued,
            "total_failed": total_failed,
            "active_workers_count": len(workers_data),
            "queues": queues_data,
            "workers": workers_data,
        }

    @classmethod
    def retry_failed_jobs(cls, queue_name: str | None = None) -> int:
        """Requeue failed jobs from FailedJobRegistry back into their respective queues."""
        retried_count = 0
        target_queues = (
            [Queue(queue_name, connection=redis_connection)]
            if queue_name
            else cls.get_all_queues()
        )

        for q in target_queues:
            try:
                registry = FailedJobRegistry(queue=q)
                job_ids = registry.get_job_ids()
                for job_id in job_ids:
                    registry.requeue(job_id)
                    retried_count += 1
            except Exception as e:
                logger.error(f"Error retrying failed jobs on queue {q.name}: {e}")

        return retried_count

    @classmethod
    def clear_failed_jobs(cls, queue_name: str | None = None) -> int:
        """Purge failed jobs registry."""
        cleared_count = 0
        target_queues = (
            [Queue(queue_name, connection=redis_connection)]
            if queue_name
            else cls.get_all_queues()
        )

        for q in target_queues:
            try:
                registry = FailedJobRegistry(queue=q)
                job_ids = registry.get_job_ids()
                for job_id in job_ids:
                    registry.remove(job_id, delete_job=True)
                    cleared_count += 1
            except Exception as e:
                logger.error(f"Error clearing failed jobs on queue {q.name}: {e}")

        return cleared_count
