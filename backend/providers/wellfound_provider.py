from pathlib import Path

import yaml

from providers.base import BaseProvider
from providers.models.raw_jobs_data import RawJobData
from scrapers.wellfound_scraper import scrape_wellfound_jobs
from utils.hashing import compute_content_hash
from utils.logging_config import get_feature_logger
from utils.wellfound_utils import extract_wellfound_job_id

logger = get_feature_logger("ingestion")


async def scrape_jobs():
    """Wrapper function that reads configuration and invokes Wellfound scraper."""
    CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "config.yml"

    role = "Software Engineer Intern"
    location = "India"
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as file:
                config = yaml.safe_load(file) or {}
                scraper_config = config.get("scraper_config", {})
                role = scraper_config.get("job_title", role)
                locs = scraper_config.get("locations", [location])
                location = locs[0] if locs else location
        except Exception as e:
            logger.warning(
                f"[Wellfound] Failed to read config.yml ({e}), using defaults"
            )

    return scrape_wellfound_jobs(
        job_title=role,
        location=location,
    )


class WellfoundProvider(BaseProvider):
    async def fetch_jobs(self) -> list[RawJobData]:
        logger.info("[Wellfound] Starting job fetch via WellfoundProvider...")
        jobs = await scrape_jobs()

        raw_jobs: list[RawJobData] = []

        for job in jobs:
            raw_jobs.append(
                RawJobData(
                    source="wellfound",
                    external_id=extract_wellfound_job_id(job["link"]),
                    title=job["title"],
                    company=job["company"],
                    date_posted=job["date"] or "",
                    location=job["location"],
                    link=job["link"],
                    content_hash=compute_content_hash(
                        job["title"],
                        job["company"],
                        job["date"],
                        job["location"],
                    ),
                    raw_payload={
                        "salary": job.get("salary"),
                        "equity": job.get("equity"),
                        "experience": job.get("experience"),
                        "employment_type": job.get("employment_type"),
                        "remote": job.get("remote"),
                        "description": job.get("description"),
                    },
                )
            )

        logger.info(
            f"[Wellfound] [SUCCESS] WellfoundProvider normalized {len(raw_jobs)} job postings"
        )
        return raw_jobs
