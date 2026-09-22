import time
from pathlib import Path

import httpx
import yaml

from providers.base import BaseProvider
from providers.models.raw_jobs_data import RawJobData
from utils.hashing import compute_content_hash
from utils.logging_config import get_feature_logger, log_dev, log_dev_error
from utils.remoteOK_utils import extract_remoteok_job_id

logger = get_feature_logger("ingestion")

API_URL = "https://remoteok.com/api"
USER_AGENT = "OpportuneAI/1.0"


class RemoteOKProvider(BaseProvider):
    def _matches(self, item: dict, role: str) -> bool:
        role = role.lower().strip()

        position = item.get("position", "").lower()
        tags = [str(tag).lower() for tag in item.get("tags", [])]

        searchable = f"{position} {' '.join(tags)}"
        role_words = role.split()

        return (
            role in searchable
            or any(role in tag for tag in tags)
            or all(word in searchable for word in role_words)
        )

    async def fetch_jobs(self) -> list[RawJobData]:
        config_path = Path(__file__).resolve().parent.parent / "config" / "config.yml"

        role = "Software Engineer"
        if config_path.exists():
            try:
                with open(config_path, "r") as f:
                    config = yaml.safe_load(f) or {}
                scraper_config = config.get("scraper_config", {})
                role = scraper_config.get("job_title", "Software Engineer")
            except Exception as e:
                logger.warning(
                    f"[RemoteOK] Failed to read config.yml ({e}), using default role '{role}'"
                )

        logger.info(
            f"[RemoteOK] [START] Requesting jobs from {API_URL} (matching role: '{role}')..."
        )
        log_dev(
            "REMOTEOK_SCRAPER_START",
            {"api_url": API_URL, "target_role": role, "user_agent": USER_AGENT},
            logger_name="ingestion",
        )

        start_ts = time.time()

        try:
            async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
                response = await client.get(
                    API_URL,
                    headers={"User-Agent": USER_AGENT},
                )
                elapsed_ms = int((time.time() - start_ts) * 1000)

                if response.status_code == 429:
                    err_msg = (
                        f"RemoteOK rate limit exceeded (HTTP 429) after {elapsed_ms}ms"
                    )
                    logger.error(f"[RemoteOK] [ERROR:RATE_LIMIT_429] {err_msg}")
                    log_dev_error(
                        "REMOTEOK_RATE_LIMIT_429",
                        err_msg,
                        context={
                            "status_code": 429,
                            "elapsed_ms": elapsed_ms,
                            "headers": dict(response.headers),
                        },
                        logger_name="ingestion",
                    )
                    response.raise_for_status()

                if response.status_code != 200:
                    err_msg = f"RemoteOK returned status {response.status_code}: {response.text[:300]}"
                    logger.error(
                        f"[RemoteOK] [ERROR:HTTP_{response.status_code}] {err_msg}"
                    )
                    log_dev_error(
                        f"REMOTEOK_HTTP_{response.status_code}",
                        err_msg,
                        context={
                            "status_code": response.status_code,
                            "response_snippet": response.text[:500],
                        },
                        logger_name="ingestion",
                    )
                    response.raise_for_status()

                data = response.json()
        except httpx.TimeoutException as e:
            logger.error(
                f"[RemoteOK] [ERROR:TIMEOUT] Connection timed out after 20s while fetching {API_URL}: {e}"
            )
            log_dev_error(
                "REMOTEOK_TIMEOUT",
                e,
                context={"api_url": API_URL, "timeout": 20},
                logger_name="ingestion",
            )
            raise
        except httpx.HTTPStatusError as e:
            logger.error(
                f"[RemoteOK] [ERROR:HTTP_STATUS] HTTP status error: {e.response.status_code} - {e}"
            )
            log_dev_error(
                "REMOTEOK_HTTP_STATUS_ERROR",
                e,
                context={
                    "status_code": e.response.status_code,
                    "response": e.response.text[:500],
                },
                logger_name="ingestion",
            )
            raise
        except Exception as e:
            logger.error(
                f"[RemoteOK] [ERROR:NETWORK] Failed to connect to RemoteOK API: {e}",
                exc_info=True,
            )
            log_dev_error(
                "REMOTEOK_FETCH_FAILED",
                e,
                context={"api_url": API_URL},
                logger_name="ingestion",
            )
            raise

        listings = data[1:] if len(data) > 1 else []
        logger.info(
            f"[RemoteOK] [FETCHED] Received {len(listings)} raw listings from API in {elapsed_ms}ms"
        )

        raw_jobs: list[RawJobData] = []

        for item in listings:
            if not self._matches(item, role):
                continue

            title = item.get("position", "").strip()
            if not title:
                continue

            company = item.get("company", "N/A").strip()
            location = "Remote"
            link = item.get("url", "")

            date = item.get("date", "")
            if date and "T" in date:
                date = date.split("T")[0]

            raw_jobs.append(
                RawJobData(
                    source="remoteok",
                    external_id=extract_remoteok_job_id(item),
                    title=title,
                    company=company,
                    date_posted=date,
                    location=location,
                    link=link,
                    content_hash=compute_content_hash(
                        title,
                        company,
                        date,
                        location,
                    ),
                    raw_payload={
                        "slug": item.get("slug"),
                        "tags": item.get("tags", []),
                        "salary_min": item.get("salary_min"),
                        "salary_max": item.get("salary_max"),
                        "description": item.get("description"),
                        "apply_url": item.get("apply_url"),
                        "logo": item.get("logo"),
                        "company_logo": item.get("company_logo"),
                        "epoch": item.get("epoch"),
                        "location": item.get("location"),
                    },
                )
            )

        logger.info(
            f"[RemoteOK] [SUCCESS] Successfully extracted {len(raw_jobs)} matching job listings for role '{role}'"
        )
        log_dev(
            "REMOTEOK_EXTRACTION_SUCCESS",
            {
                "raw_listings_count": len(listings),
                "matched_jobs_count": len(raw_jobs),
                "sample_job": raw_jobs[0].model_dump() if raw_jobs else None,
            },
            logger_name="ingestion",
        )
        return raw_jobs
