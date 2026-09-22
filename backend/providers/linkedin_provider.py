from pathlib import Path

import yaml
from linkedin_jobs_scraper.filters import ExperienceLevelFilters, TypeFilters

from providers.base import BaseProvider
from providers.models.raw_jobs_data import RawJobData
from scrapers.linkedin_scraper import scrape_linkedin_jobs
from utils.hashing import compute_content_hash
from utils.linkedin_utils import extract_external_id, format_job_url
from utils.logging_config import get_feature_logger

logger = get_feature_logger("ingestion")


def _convert_filter_strings(filter_list: list[str], filter_class) -> list:
    """Convert string representations of filters to actual filter enum values."""
    if not filter_list:
        return []

    converted = []
    for filter_str in filter_list:
        if hasattr(filter_class, filter_str):
            converted.append(getattr(filter_class, filter_str))
        else:
            logger.warning(
                f"[LinkedIn] Filter '{filter_str}' not recognized in {filter_class.__name__}"
            )

    return converted


async def scrape_jobs():
    """Wrapper function reading configuration and invoking LinkedIn scraper."""
    CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "config.yml"

    scraper_config = {}
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as file:
                config = yaml.safe_load(file) or {}
                scraper_config = config.get("scraper_config", {})
        except Exception as e:
            logger.warning(
                f"[LinkedIn] Failed to read config.yml ({e}), using defaults"
            )

    job_type = _convert_filter_strings(scraper_config.get("job_type", []), TypeFilters)
    experience_level = _convert_filter_strings(
        scraper_config.get("experience_level", []), ExperienceLevelFilters
    )

    job_title = scraper_config.get("job_title", "Software Engineer Intern")
    locations = scraper_config.get("locations", ["India"])
    limit = scraper_config.get("limit", 20)

    scraped_data = scrape_linkedin_jobs(
        job_title=job_title,
        locations=locations,
        job_type=job_type if job_type else None,
        experience_level=experience_level if experience_level else None,
        limit=limit,
    )

    return scraped_data


class LinkedInProvider(BaseProvider):
    async def fetch_jobs(self) -> list[RawJobData]:
        logger.info("[LinkedIn] Starting job fetch via LinkedInProvider...")
        raw_jobs_data = await scrape_jobs()

        jobs = raw_jobs_data.get("jobs", [])
        errors = raw_jobs_data.get("errors", [])

        if errors:
            logger.warning(
                f"[LinkedIn] Completed with {len(errors)} error events reported during crawl."
            )

        raw_jobs = [
            RawJobData(
                source="linkedin",
                external_id=extract_external_id(job.get("link", "")),
                title=job.get("title", ""),
                company=job.get("company", ""),
                date_posted=job.get("date_posted"),
                location=job.get("location"),
                link=format_job_url(job.get("link", "")),
                content_hash=compute_content_hash(
                    job.get("title", ""),
                    job.get("company", ""),
                    job.get("date_posted", ""),
                    job.get("location", ""),
                ),
                raw_payload={"description": job.get("description") or ""},
            )
            for job in jobs
        ]

        logger.info(
            f"[LinkedIn] [SUCCESS] LinkedInProvider successfully normalized {len(raw_jobs)} job postings"
        )
        return raw_jobs
