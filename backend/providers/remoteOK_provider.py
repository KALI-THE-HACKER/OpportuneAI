from pathlib import Path

import httpx
import yaml

from providers.models.raw_jobs_data import RawJobData
from providers.base import BaseProvider
from utils.hashing import compute_content_hash
from utils.remoteOK_utils import extract_remoteok_job_id

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

        with open(config_path, "r") as f:
            config = yaml.safe_load(f)

        scraper_config = config.get("scraper_config", {})
        role = scraper_config.get("job_title", "Software Engineer")

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                API_URL,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            data = response.json()

        listings = data[1:] if len(data) > 1 else []

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

        return raw_jobs
