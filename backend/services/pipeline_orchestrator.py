import asyncio
import logging
import traceback
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.raw_job import RawJob
from database.models.scraper_run import ScraperRun
from database.models.user import User
from database.repositories.raw_job_repository import RawJobRepository
from database.session import AsyncSessionLocal
from providers.linkedin_provider import LinkedInProvider
from providers.naukri_provider import NaukriProvider
from providers.remoteOK_provider import RemoteOKProvider
from providers.wellfound_provider import WellfoundProvider
from services.email_notification_service import EmailNotificationService
from services.system_config_service import SystemConfigService
from utils.logging_config import get_feature_logger
from workers.ai_worker import process_raw_job
from workers.queue import ai_processing_queue, redis_connection

logger = logging.getLogger(__name__)
ingestion_logger = get_feature_logger("ingestion")

# Provider map
PROVIDERS = {
    "linkedin": LinkedInProvider,
    "naukri": NaukriProvider,
    "wellfound": WellfoundProvider,
    "remoteok": RemoteOKProvider,
}

# In-memory cancel tokens
_running_tasks: dict[int, asyncio.Task] = {}


def classify_scraper_error(err: Exception) -> tuple[str, str, bool]:
    """
    Classify scraper error into structured category, human-readable summary, and blocked flag.
    Returns: (category, summary, is_blocked)
    """
    err_str = str(err)
    err_lower = err_str.lower()

    if (
        "429" in err_str
        or "rate limit" in err_lower
        or "too many requests" in err_lower
    ):
        return (
            "RATE_LIMIT_429",
            f"Rate limit exceeded (HTTP 429 / Too Many Requests): {err_str}",
            True,
        )

    if any(
        t in err_lower
        for t in [
            "cloudflare",
            "access denied",
            "captcha",
            "security challenge",
            "login wall",
            "403",
            "forbidden",
            "checkpoint",
        ]
    ):
        return (
            "ANTI_BOT_BLOCKED",
            f"Provider anti-bot protection / access challenge encountered: {err_str}",
            True,
        )

    if any(
        t in err_lower
        for t in [
            "firecrawl_api_key",
            "api key",
            "not found in env",
            "credentials",
            "unauthorized",
            "401",
        ]
    ):
        return (
            "AUTH_OR_CONFIG",
            f"Configuration or authentication error: {err_str}",
            False,
        )

    if any(
        t in err_lower
        for t in [
            "chromedriver",
            "selenium",
            "webdriver",
            "chrome binary",
            "browser",
            "driver.quit",
        ]
    ):
        return (
            "BROWSER_DRIVER_ERROR",
            f"Browser automation / WebDriver error: {err_str}",
            False,
        )

    if any(
        t in err_lower
        for t in [
            "timeout",
            "timed out",
            "connection error",
            "connecterror",
            "network",
            "nodename nor servname",
        ]
    ):
        return (
            "TIMEOUT_OR_NETWORK",
            f"Network timeout / connectivity failure: {err_str}",
            False,
        )

    if any(
        t in err_lower
        for t in ["jsondecodeerror", "beautifulsoup", "parser", "element not found"]
    ):
        return (
            "PARSER_ERROR",
            f"DOM / JSON parsing error: {err_str}",
            False,
        )

    return (
        "UNKNOWN_ERROR",
        f"Unexpected execution error: {err_str}",
        False,
    )


class PipelineOrchestrator:
    @classmethod
    def is_provider_running(cls, provider: str) -> bool:
        """Check if a distributed Redis lock exists for this provider."""
        lock_key = f"lock:scraper:{provider.lower()}"
        return bool(redis_connection.get(lock_key))

    @classmethod
    def acquire_lock(cls, provider: str, timeout_seconds: int = 1800) -> bool:
        """Acquire distributed Redis lock to prevent duplicate runs."""
        lock_key = f"lock:scraper:{provider.lower()}"
        return bool(
            redis_connection.set(lock_key, "locked", nx=True, ex=timeout_seconds)
        )

    @classmethod
    def release_lock(cls, provider: str):
        """Release distributed Redis lock."""
        lock_key = f"lock:scraper:{provider.lower()}"
        redis_connection.delete(lock_key)

    @classmethod
    async def trigger_run(
        cls,
        provider_name: str,
        trigger_type: str = "manual",
        user: User | None = None,
        retry_run_id: int | None = None,
    ) -> list[int]:
        """
        Trigger one or all providers.
        Returns a list of created ScraperRun IDs.
        """
        provider_name = provider_name.lower().strip()
        targets = list(PROVIDERS.keys()) if provider_name == "all" else [provider_name]

        run_ids: list[int] = []
        user_id = user.id if user else None
        user_email = user.email if user else "system"

        async with AsyncSessionLocal() as db:
            for p in targets:
                if p not in PROVIDERS:
                    ingestion_logger.warning(
                        f"[ORCHESTRATOR] Unknown scraper provider '{p}' requested. Skipping."
                    )
                    continue

                if cls.is_provider_running(p):
                    ingestion_logger.warning(
                        f"[{p.upper()}] Scraper '{p}' is already running with active lock. Skipping duplicate trigger."
                    )
                    continue

                run_entry = ScraperRun(
                    provider=p,
                    trigger_type=trigger_type,
                    status="queued",
                    started_at=datetime.utcnow(),
                    triggered_by_user_id=user_id,
                    triggered_by_email=user_email,
                    logs=[
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "level": "INFO",
                            "message": f"Run queued via {trigger_type} trigger by {user_email}",
                        }
                    ],
                )
                db.add(run_entry)
                await db.commit()
                await db.refresh(run_entry)
                run_ids.append(run_entry.id)

                ingestion_logger.info(
                    f"[{p.upper()}] [QUEUED] Run #{run_entry.id} queued ({trigger_type} by {user_email})"
                )

                # Launch async background task
                task = asyncio.create_task(cls._execute_scraper_run(run_entry.id, p))
                _running_tasks[run_entry.id] = task

        return run_ids

    @classmethod
    async def _execute_scraper_run(cls, run_id: int, provider_name: str):
        """Execute scraper with detailed logging, error categorization, duplicate prevention, and retries."""
        start_time = datetime.utcnow()
        provider_tag = provider_name.upper()

        acquired = cls.acquire_lock(provider_name, timeout_seconds=1800)
        if not acquired:
            ingestion_logger.warning(
                f"[{provider_tag}] [LOCK_FAILED] Could not acquire execution lock for {provider_name}. Another run is in progress."
            )
            async with AsyncSessionLocal() as db:
                run = await db.get(ScraperRun, run_id)
                if run:
                    run.status = "failed"
                    run.error_message = (
                        "Failed to acquire execution lock. Provider is busy."
                    )
                    run.completed_at = datetime.utcnow()
                    await db.commit()
            return

        # Clear any lingering cancellation signals from previous runs
        try:
            redis_connection.delete(f"cancel:scraper:{provider_name.lower()}")
            redis_connection.delete(f"cancel:scraper:{run_id}")
        except Exception:
            pass

        run_logs: list[dict[str, Any]] = [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": f"[{provider_tag}] Acquired execution lock. Initializing scraper...",
            }
        ]
        ingestion_logger.info(
            f"[{provider_tag}] [LOCK_ACQUIRED] Lock acquired for Run #{run_id}. Initializing scraper..."
        )

        async with AsyncSessionLocal() as db:
            run = await db.get(ScraperRun, run_id)
            if run:
                run.status = "running"
                run.logs = list(run.logs) + run_logs
                await db.commit()

        try:
            provider_cls = PROVIDERS.get(provider_name)
            if not provider_cls:
                raise ValueError(f"Unknown provider: {provider_name}")

            provider_instance = provider_cls()
            msg_fetch = f"[{provider_tag}] [FETCH_START] Requesting job postings from {provider_name}..."
            run_logs.append(
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "INFO",
                    "message": msg_fetch,
                }
            )
            ingestion_logger.info(msg_fetch)

            # Execute provider fetch
            fetched_jobs = await provider_instance.fetch_jobs()
            items_fetched = len(fetched_jobs)

            msg_fetched = f"[{provider_tag}] [FETCH_SUCCESS] Scraped {items_fetched} raw job listings. Checking deduplication against database..."
            run_logs.append(
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "INFO",
                    "message": msg_fetched,
                }
            )
            ingestion_logger.info(msg_fetched)

            # Ingest into DB
            saved_count = 0
            async with AsyncSessionLocal() as db:
                repo = RawJobRepository(db)
                existing_hashes = await repo.get_existing_hashes()

                new_jobs = [
                    j for j in fetched_jobs if j.content_hash not in existing_hashes
                ]
                saved_jobs = await repo.save_many(new_jobs)
                saved_count = len(saved_jobs)
                duplicates_count = items_fetched - saved_count

                # Enqueue AI worker processing for new jobs
                config = await SystemConfigService.get_config("feature_flags")
                if config.get("enable_auto_ai_processing", True) and saved_jobs:
                    for job in saved_jobs:
                        ai_processing_queue.enqueue(
                            process_raw_job,
                            job.id,
                        )
                    msg_ai = f"[{provider_tag}] [AI_ENQUEUED] Enqueued {saved_count} new jobs to 'ai-processing' queue"
                    run_logs.append(
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "level": "INFO",
                            "message": msg_ai,
                        }
                    )
                    ingestion_logger.info(msg_ai)

            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            msg_complete = (
                f"[{provider_tag}] [SUCCESS] Scraper completed in {duration_ms}ms. "
                f"Fetched: {items_fetched} raw jobs | Saved: {saved_count} new unique jobs | Skipped: {duplicates_count} duplicates."
            )
            run_logs.append(
                {
                    "timestamp": end_time.isoformat(),
                    "level": "INFO",
                    "message": msg_complete,
                }
            )
            ingestion_logger.info(msg_complete)

            async with AsyncSessionLocal() as db:
                run = await db.get(ScraperRun, run_id)
                if run:
                    run.status = "completed"
                    run.completed_at = end_time
                    run.duration_ms = duration_ms
                    run.items_fetched = items_fetched
                    run.items_saved = saved_count
                    run.logs = list(run.logs) + run_logs
                    await db.commit()

        except asyncio.CancelledError:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            msg_cancel = f"[{provider_tag}] [CANCELLED] Scraper run #{run_id} was cancelled by administrator after {duration_ms}ms."
            run_logs.append(
                {
                    "timestamp": end_time.isoformat(),
                    "level": "WARN",
                    "message": msg_cancel,
                }
            )
            ingestion_logger.warning(msg_cancel)
            async with AsyncSessionLocal() as db:
                run = await db.get(ScraperRun, run_id)
                if run:
                    run.status = "cancelled"
                    run.completed_at = end_time
                    run.duration_ms = duration_ms
                    run.logs = list(run.logs) + run_logs
                    await db.commit()

        except Exception as e:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            err_str = str(e)
            stack = traceback.format_exc()

            category, summary, is_blocked = classify_scraper_error(e)

            msg_error = f"[{provider_tag}] [ERROR:{category}] Run #{run_id} failed after {duration_ms}ms: {summary}"
            ingestion_logger.error(msg_error)
            logger.error(msg_error, exc_info=True)

            retry_policy = await SystemConfigService.get_config("retry_policy")
            max_retries = retry_policy.get("max_retries", 3)
            retry_2h_enabled = retry_policy.get("retry_after_2h_on_blocked", True)

            async with AsyncSessionLocal() as db:
                run = await db.get(ScraperRun, run_id)
                if run:
                    run.completed_at = end_time
                    run.duration_ms = duration_ms
                    run.error_message = f"[{category}] {err_str}"
                    run.stack_trace = stack

                    # Calculate retry schedule
                    if run.retry_count < max_retries:
                        run.status = "retrying"
                        if is_blocked and retry_2h_enabled:
                            delay_secs = retry_policy.get(
                                "blocked_delay_seconds", 7200
                            )  # 2 hours
                            run.next_retry_at = end_time + timedelta(seconds=delay_secs)
                            msg_retry = (
                                f"[{provider_tag}] [BLOCKED_BACKOFF] Anti-bot / rate-limit detected ({category}). "
                                f"Scheduled 2-hour delayed retry at {run.next_retry_at.isoformat()} (attempt #{run.retry_count + 1}/{max_retries})"
                            )
                            run_logs.append(
                                {
                                    "timestamp": end_time.isoformat(),
                                    "level": "WARN",
                                    "message": msg_retry,
                                }
                            )
                            ingestion_logger.warning(msg_retry)

                            # Alert admin about blocked provider
                            await EmailNotificationService.send_alert(
                                event_type="provider_blocked",
                                title=f"Scraper Blocked: {provider_name.capitalize()} [{category}]",
                                message=(
                                    f"Provider '{provider_name}' encountered an access challenge or rate limit.\n\n"
                                    f"Error Category: {category}\n"
                                    f"Details: {summary}\n"
                                    f"Next Retry: {run.next_retry_at.strftime('%Y-%m-%d %H:%M:%S UTC')} (in 2 hours)"
                                ),
                                severity="critical",
                            )
                        else:
                            # Standard exponential backoff
                            backoff = (2**run.retry_count) * retry_policy.get(
                                "base_backoff_seconds", 60
                            )
                            run.next_retry_at = end_time + timedelta(seconds=backoff)
                            msg_retry = (
                                f"[{provider_tag}] [RETRY_SCHEDULED] Execution failed with {category}. "
                                f"Scheduled retry attempt #{run.retry_count + 1}/{max_retries} in {backoff}s at {run.next_retry_at.isoformat()}"
                            )
                            run_logs.append(
                                {
                                    "timestamp": end_time.isoformat(),
                                    "level": "ERROR",
                                    "message": msg_retry,
                                }
                            )
                            ingestion_logger.error(msg_retry)

                            if run.retry_count >= 1:
                                await EmailNotificationService.send_alert(
                                    event_type="repeated_retry",
                                    title=f"Repeated Retry on {provider_name.capitalize()} [{category}]",
                                    message=f"Scraper '{provider_name}' failed attempt #{run.retry_count + 1}:\n{summary}",
                                    severity="warning",
                                )
                    else:
                        run.status = "failed"
                        msg_max_retries = f"[{provider_tag}] [FAILED_PERMANENTLY] Exceeded maximum retries ({max_retries}). Run marked as failed."
                        run_logs.append(
                            {
                                "timestamp": end_time.isoformat(),
                                "level": "CRITICAL",
                                "message": msg_max_retries,
                            }
                        )
                        ingestion_logger.critical(msg_max_retries)

                        # Alert admin on total failure
                        await EmailNotificationService.send_alert(
                            event_type="scraper_failure",
                            title=f"Scraper Failed: {provider_name.capitalize()} [{category}]",
                            message=(
                                f"Provider '{provider_name}' failed permanently after {run.retry_count} retries.\n\n"
                                f"Error Category: {category}\n"
                                f"Summary: {summary}\n\n"
                                f"Stack Trace:\n{stack}"
                            ),
                            severity="critical",
                        )

                    run.logs = list(run.logs) + run_logs
                    await db.commit()

        finally:
            cls.release_lock(provider_name)
            _running_tasks.pop(run_id, None)
            try:
                redis_connection.delete(f"cancel:scraper:{provider_name.lower()}")
                redis_connection.delete(f"cancel:scraper:{run_id}")
            except Exception:
                pass

    @classmethod
    async def cancel_run(cls, run_id: int) -> bool:
        """Cancel an in-flight or orphaned scraper run and release its distributed lock."""
        # 1. Set cancellation signal in Redis for fast termination
        try:
            redis_connection.set(f"cancel:scraper:{run_id}", "1", ex=600)
        except Exception:
            pass

        # 2. Cancel in-memory asyncio task if active
        task = _running_tasks.pop(run_id, None)
        task_was_running = task is not None and not task.done()
        if task_was_running:
            task.cancel()

        # 3. Always update the database record and release the distributed lock
        async with AsyncSessionLocal() as db:
            run = await db.get(ScraperRun, run_id)
            if not run:
                return False

            provider_name = run.provider
            try:
                redis_connection.set(
                    f"cancel:scraper:{provider_name.lower()}", "1", ex=600
                )
            except Exception:
                pass

            if run.status in ["running", "pending", "retrying"]:
                end_time = datetime.utcnow()
                duration_ms = (
                    int((end_time - run.started_at).total_seconds() * 1000)
                    if run.started_at
                    else 0
                )
                run.status = "cancelled"
                run.completed_at = end_time
                run.duration_ms = duration_ms
                cancel_log = {
                    "timestamp": end_time.isoformat(),
                    "level": "WARN",
                    "message": f"[{run.provider.upper()}] [CANCELLED] Scraper run #{run_id} was cancelled by administrator.",
                }
                run.logs = list(run.logs or []) + [cancel_log]
                await db.commit()

                # Always release the provider lock in Redis
                cls.release_lock(provider_name)
                ingestion_logger.info(
                    f"[{provider_name.upper()}] [CANCELLED] Run #{run_id} successfully marked cancelled and lock released."
                )
                return True
            elif task_was_running:
                cls.release_lock(provider_name)
                return True

        return False

    @classmethod
    async def cleanup_orphaned_runs(cls):
        """Clean up any dangling 'running' scraper runs from prior server lifecycles."""
        async with AsyncSessionLocal() as db:
            stmt = select(ScraperRun).where(ScraperRun.status == "running")
            orphaned = (await db.scalars(stmt)).all()
            for run in orphaned:
                run.status = "cancelled"
                run.completed_at = datetime.utcnow()
                run.error_message = "Server restarted while scraper was in-flight."
                cancel_log = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "WARN",
                    "message": f"[{run.provider.upper()}] [ORPHANED_CLEANUP] Server restarted while scraper was running. Marked cancelled.",
                }
                run.logs = list(run.logs or []) + [cancel_log]
                cls.release_lock(run.provider)
            if orphaned:
                await db.commit()
                ingestion_logger.info(
                    f"Cleaned up {len(orphaned)} orphaned scraper run(s) from prior session."
                )

    @classmethod
    async def get_scrapers_health(cls, db: AsyncSession) -> list[dict[str, Any]]:
        """
        Aggregate operational telemetry for all scrapers:
        - Health status (healthy, running, degraded, blocked, idle)
        - Last run date and status
        - Success / failure rate (last 30 runs)
        - Average duration
        - Total jobs indexed
        - Failure reason
        """
        health_list = []
        now = datetime.utcnow()

        for provider_key in PROVIDERS.keys():
            is_running = cls.is_provider_running(provider_key)

            last_run_stmt = (
                select(ScraperRun)
                .where(ScraperRun.provider == provider_key)
                .order_by(desc(ScraperRun.started_at))
                .limit(1)
            )
            last_run = await db.scalar(last_run_stmt)

            recent_runs_stmt = (
                select(ScraperRun)
                .where(ScraperRun.provider == provider_key)
                .order_by(desc(ScraperRun.started_at))
                .limit(30)
            )
            recent_runs = (await db.scalars(recent_runs_stmt)).all()

            total_runs = len(recent_runs)
            successful_runs = sum(1 for r in recent_runs if r.status == "completed")
            success_rate = (
                round((successful_runs / total_runs) * 100, 1)
                if total_runs > 0
                else 100.0
            )

            completed_with_duration = [
                r.duration_ms
                for r in recent_runs
                if r.status == "completed" and r.duration_ms
            ]
            avg_duration_ms = (
                int(sum(completed_with_duration) / len(completed_with_duration))
                if completed_with_duration
                else 0
            )

            total_jobs = (
                await db.scalar(
                    select(func.count(RawJob.id)).where(RawJob.source == provider_key)
                )
                or 0
            )

            # Determine status
            if is_running:
                status = "running"
            elif last_run and last_run.status == "retrying":
                status = (
                    "blocked"
                    if (
                        last_run.error_message
                        and any(
                            t in last_run.error_message.lower()
                            for t in [
                                "429",
                                "rate limit",
                                "cloudflare",
                                "403",
                                "anti_bot",
                            ]
                        )
                    )
                    else "degraded"
                )
            elif last_run and last_run.status == "failed":
                status = "failed"
            elif success_rate < 80.0:
                status = "degraded"
            else:
                status = "healthy"

            next_run_target = now.replace(hour=2, minute=0, second=0, microsecond=0)
            if next_run_target <= now:
                next_run_target += timedelta(days=1)

            health_list.append(
                {
                    "provider": provider_key,
                    "name": provider_key.capitalize(),
                    "status": status,
                    "is_running": is_running,
                    "total_jobs_indexed": total_jobs,
                    "success_rate": success_rate,
                    "avg_duration_ms": avg_duration_ms,
                    "last_run_at": last_run.started_at.isoformat()
                    if last_run
                    else None,
                    "last_run_status": last_run.status if last_run else "never",
                    "last_error": last_run.error_message if last_run else None,
                    "next_scheduled_run_at": next_run_target.isoformat(),
                    "next_retry_at": last_run.next_retry_at.isoformat()
                    if last_run and last_run.next_retry_at
                    else None,
                    "total_runs_count": total_runs,
                }
            )

        return health_list
