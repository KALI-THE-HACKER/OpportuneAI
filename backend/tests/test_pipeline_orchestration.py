from datetime import datetime, timedelta

import pytest

from database.models.scraper_run import ScraperRun
from database.session import AsyncSessionLocal
from services.pipeline_orchestrator import PipelineOrchestrator
from services.scheduler import SchedulerService


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_scraper_locking():
    """Test distributed locking mechanism prevents concurrent runs for the same provider."""
    provider = "linkedin"

    # Ensure unlocked initially
    PipelineOrchestrator.release_lock(provider)
    assert not PipelineOrchestrator.is_provider_running(provider)

    # Acquire lock
    acquired = PipelineOrchestrator.acquire_lock(provider, timeout_seconds=60)
    assert acquired is True
    assert PipelineOrchestrator.is_provider_running(provider) is True

    # Second acquisition must fail (preventing duplicate scraper runs)
    second_attempt = PipelineOrchestrator.acquire_lock(provider, timeout_seconds=60)
    assert second_attempt is False

    # Release lock
    PipelineOrchestrator.release_lock(provider)
    assert not PipelineOrchestrator.is_provider_running(provider)


@pytest.mark.anyio
async def test_pipeline_retry_and_due_evaluation(dispose_db_engine):
    """Test scraper run creation and scheduler due retry detection."""
    PipelineOrchestrator.release_lock("remoteok")

    async with AsyncSessionLocal() as db:
        # Create a run in 'retrying' status due now
        past_time = datetime.utcnow() - timedelta(minutes=5)
        retry_run = ScraperRun(
            provider="remoteok",
            trigger_type="manual",
            status="retrying",
            started_at=past_time,
            retry_count=1,
            max_retries=3,
            next_retry_at=past_time,
            error_message="Rate limit 429 encountered",
            logs=[
                {
                    "timestamp": past_time.isoformat(),
                    "level": "WARN",
                    "message": "Blocked 429",
                }
            ],
        )
        db.add(retry_run)
        await db.commit()
        await db.refresh(retry_run)
        run_id = retry_run.id

        # Scheduler checks due retries
        now = datetime.utcnow()
        await SchedulerService._evaluate_due_retries(now)

    # In a fresh session, verify the past run was unblocked
    async with AsyncSessionLocal() as db2:
        reloaded = await db2.get(ScraperRun, run_id)
        assert reloaded is not None
        assert reloaded.status == "queued"
        assert reloaded.next_retry_at is None
