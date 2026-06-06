import logging
from providers.base import BaseProvider
from providers.models.raw_jobs_data import RawJobData
from scrapers.linkedin_scraper import scrape_linkedin_jobs
from linkedin_jobs_scraper.filters import TypeFilters, ExperienceLevelFilters
from utils.hashing import compute_content_hash
from utils.linkedin_utils import extract_external_id, format_job_url
from pathlib import Path
import yaml

logger = logging.getLogger(__name__)


def _convert_filter_strings(filter_list: list[str], filter_class) -> list:
    """
    Convert string representations of filters to actual filter enum values.
    Supports TypeFilters and ExperienceLevelFilters.
    """
    if not filter_list:
        return []

    converted = []
    for filter_str in filter_list:
        if hasattr(filter_class, filter_str):
            converted.append(getattr(filter_class, filter_str))
        else:
            logger.warning(
                f"Warning: Filter '{filter_str}' not recognized in {filter_class.__name__}"
            )

    return converted


async def scrape_jobs():
    """
    This is a wrapper function that reads configuration from config.yml and calls the actual LinkedIn scraper with the appropriate parameters.
    """

    # Get path to config.yml
    CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "config.yml"

    # Load YAML configuration
    with open(CONFIG_PATH, "r") as file:
        config = yaml.safe_load(file)

    # Extract LinkedIn scraper config
    scraper_config = config.get("scraper_config", {})

    # Convert filter strings to enums
    job_type = _convert_filter_strings(scraper_config.get("job_type", []), TypeFilters)
    experience_level = _convert_filter_strings(
        scraper_config.get("experience_level", []), ExperienceLevelFilters
    )

    # Call scrape_linkedin_jobs with config values
    scraped_data = scrape_linkedin_jobs(
        job_title=scraper_config.get("job_title", "Software Engineer Intern"),
        locations=scraper_config.get("locations", ["India"]),
        job_type=job_type if job_type else None,
        experience_level=experience_level if experience_level else None,
        limit=scraper_config.get("limit", 20),
    )

    return scraped_data


class LinkedInProvider(BaseProvider):
    """
    LinkedInProvider is responsible for fetching job listings from LinkedIn, normalizing the data, and returning it in a structured format.
    It uses the scrape_jobs function to get raw job data and then processes it into RawJobData objects.
    """

    async def fetch_jobs(self) -> list[RawJobData]:
        raw_jobs_data = await scrape_jobs()

        # Extract jobs from the returned dictionary
        jobs = raw_jobs_data.get("jobs", [])

        return [
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
                raw_payload=job.get("description"),
            )
            for job in jobs
        ]
