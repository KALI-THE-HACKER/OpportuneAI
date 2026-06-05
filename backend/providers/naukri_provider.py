from pathlib import Path
import re

import yaml

from providers.models.raw_jobs_data import RawJobData
from providers.base import BaseProvider
from scrapers.naukri_scraper import scrape_naukri_jobs
from utils.hashing import compute_content_hash


def extract_naukri_job_id(url: str) -> str:
    """Extract a stable job id from a Naukri URL."""
    match = re.search(r"(\d+)(?:\?|$)", url)
    if match:
        return match.group(1)
    return url


class NaukriProvider(BaseProvider):
    async def fetch_jobs(self) -> list[RawJobData]:
        config_path = Path(__file__).resolve().parent.parent / "config.yml"

        with open(config_path, "r") as f:
            config = yaml.safe_load(f)

        scraper_config = config.get("scraper_config", {})

        role = scraper_config.get(
            "job_title",
            "Software Engineer",
        )

        locations = scraper_config.get("locations", [])

        jobs: list[dict] = []

        if locations:
            for location in locations:
                jobs.extend(
                    scrape_naukri_jobs(
                        job_title=role,
                        location=location,
                    )
                )
        else:
            jobs = scrape_naukri_jobs(
                job_title=role,
            )

        raw_jobs: list[RawJobData] = []

        for job in jobs:
            raw_jobs.append(
                RawJobData(
                    source="naukri",
                    external_id=extract_naukri_job_id(job["link"]),
                    title=job["title"],
                    company=job["company"],
                    date_posted=job.get("date_posted") or "",
                    location=job["location"],
                    link=job["link"],
                    content_hash=compute_content_hash(
                        job["title"],
                        job["company"],
                        job.get("date_posted") or "",
                        job["location"],
                    ),
                    raw_payload={
                        "salary": job.get("salary"),
                        "experience": job.get("experience"),
                        "description": job.get("description", ""),
                    },
                )
            )

        seen_ids: set[str] = set()
        unique_jobs: list[RawJobData] = []

        for raw_job in raw_jobs:
            if raw_job.external_id in seen_ids:
                continue

            seen_ids.add(raw_job.external_id)
            unique_jobs.append(raw_job)

        return unique_jobs
