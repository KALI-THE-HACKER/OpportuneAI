import asyncio
import logging
from datetime import datetime

from croniter import croniter
from sqlalchemy import select

from database.models.scraper_run import ScraperRun
from database.session import AsyncSessionLocal
from services.pipeline_orchestrator import PipelineOrchestrator
from services.system_config_service import SystemConfigService

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_is_running: bool = False


class SchedulerService:
    @classmethod
    def start(cls):
        """Start the async scheduler loop."""
        global _scheduler_task, _is_running
        if _is_running:
            return
        _is_running = True
        _scheduler_task = asyncio.create_task(cls._run_scheduler_loop())
        logger.info("[SCHEDULER] Daily 2 AM Cron & Retry Scheduler started")

    @classmethod
    def stop(cls):
        """Stop the async scheduler loop."""
        global _scheduler_task, _is_running
        _is_running = False
        if _scheduler_task and not _scheduler_task.done():
            _scheduler_task.cancel()
            logger.info("[SCHEDULER] Daily 2 AM Cron Scheduler stopped")

    @classmethod
    async def _run_scheduler_loop(cls):
        """Continuous background loop running every 30 seconds to check cron triggers and due retries."""
        last_cron_check_min = -1

        while _is_running:
            try:
                now = datetime.utcnow()
                current_min = (
                    now.year * 525600
                    + now.month * 43800
                    + now.day * 1440
                    + now.hour * 60
                    + now.minute
                )

                if current_min != last_cron_check_min:
                    last_cron_check_min = current_min
                    await cls._evaluate_cron_schedule(now)

                # Check for due retries every 30 seconds
                await cls._evaluate_due_retries(now)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[SCHEDULER] Error in scheduler loop: {e}", exc_info=True)

            await asyncio.sleep(30)

    @classmethod
    async def _evaluate_cron_schedule(cls, now: datetime):
        """Check if current minute matches configured cron expression (default: 0 2 * * * = 2 AM daily)."""
        scheduler_config = await SystemConfigService.get_config("scheduler_config")
        if not scheduler_config.get("enabled", True):
            return

        cron_expr = scheduler_config.get("cron_expression", "0 2 * * *")
        try:
            # croniter matches if previous trigger time was within the last minute
            iter_cron = croniter(cron_expr, now)
            prev_time = iter_cron.get_prev(datetime)
            diff_seconds = (now - prev_time).total_seconds()

            if 0 <= diff_seconds < 60:
                logger.info(
                    f"[SCHEDULER TRIGGER] Cron expression '{cron_expr}' matched at {now.isoformat()}. Dispatching all scrapers..."
                )
                await PipelineOrchestrator.trigger_run(
                    provider_name="all",
                    trigger_type="scheduled",
                )
        except Exception as e:
            logger.error(
                f"[SCHEDULER] Error evaluating cron expression '{cron_expr}': {e}"
            )

    @classmethod
    async def _evaluate_due_retries(cls, now: datetime):
        """Check for scraper runs in 'retrying' status whose next_retry_at has arrived."""
        try:
            async with AsyncSessionLocal() as db:
                stmt = (
                    select(ScraperRun)
                    .where(ScraperRun.status == "retrying")
                    .where(ScraperRun.next_retry_at <= now)
                )
                due_retries = (await db.scalars(stmt)).all()

                for run in due_retries:
                    logger.info(
                        f"[SCHEDULER RETRY] Provider '{run.provider}' retry #{run.retry_count + 1} is due. Re-triggering..."
                    )
                    run.status = "queued"
                    run.retry_count += 1
                    run.next_retry_at = None
                    await db.commit()

                    # Trigger retry execution
                    await PipelineOrchestrator.trigger_run(
                        provider_name=run.provider,
                        trigger_type="retry",
                        retry_run_id=run.id,
                    )
        except Exception as e:
            logger.error(f"[SCHEDULER] Error checking due retries: {e}")
