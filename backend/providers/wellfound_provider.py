from pathlib import Path

import yaml

from providers.models.raw_jobs_data import RawJobData
from providers.base import BaseProvider
from scrapers.wellfound_scraper import scrape_wellfound_jobs
from utils.hashing import compute_content_hash
from utils.wellfound_utils import extract_wellfound_job_id


async def scrape_jobs():
    """
    This is a wrapper function that reads configuration from config.yml and calls the actual Wellfound scraper with the appropriate parameters.
    """
    CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "config.yml"

    with open(CONFIG_PATH, "r") as file:
        config = yaml.safe_load(file)

    scraper_config = config.get("scraper_config", {})

    return scrape_wellfound_jobs(
        job_title=scraper_config.get(
            "job_title",
            "Software Engineer Intern",
        ),
        location=scraper_config.get(
            "locations",
            ["India"],
        )[0],
    )


class WellfoundProvider(BaseProvider):
    """
    WellfoundProvider is responsible for fetching job listings from Wellfound, normalizing the data, and returning it in a structured format.
    It uses the scrape_jobs function to get raw job data and then processes it into RawJobData objects.
    """

    async def fetch_jobs(self) -> list[RawJobData]:
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

        return raw_jobs
