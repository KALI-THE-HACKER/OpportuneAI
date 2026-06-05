"""
Wellfound scraper — uses Firecrawl markdown extraction only for lower
credit usage and parses job listings directly from markdown.

Requires FIRECRAWL_API_KEY in the environment (or .env file).
"""

from typing import List, Dict, Any, Optional
import os
import re

from dotenv import load_dotenv
from firecrawl import V1FirecrawlApp

BASE_URL = "https://wellfound.com"


def scrape_wellfound_jobs(
    job_title: str = "Software Engineer Intern",
    location: Optional[str] = "India",
) -> List[Dict[str, Any]]:
    """
    Scrape Wellfound jobs and return normalized data.

    Returns:
    [
        {
            "title": "...",
            "company": "...",
            "location": "...",
            "link": "...",
            "date": "...",
            "salary": "...",
            "equity": "...",
            "experience": "...",
            "employment_type": "...",
            "remote": "...",
            "description": "...",
        }
    ]
    """

    load_dotenv()

    api_key = os.getenv("FIRECRAWL_API_KEY", "").strip()
    if not api_key:
        raise ValueError("FIRECRAWL_API_KEY not found")

    url = _build_search_url(job_title, location)

    app = V1FirecrawlApp(api_key=api_key)

    result = app.scrape_url(
        url,
        formats=["markdown"],
        timeout=30000,
    )

    markdown = getattr(result, "markdown", "") or ""
    with open("wellfound.md", "w", encoding="utf-8") as f:
        f.write(markdown)

    return _parse_jobs_from_markdown(markdown, location)


def _build_search_url(
    role: str,
    location: Optional[str] = None,
) -> str:
    """
    Examples:
        software engineer + bangalore
        -> https://wellfound.com/role/l/software-engineer/bangalore

        software engineer
        -> https://wellfound.com/role/r/software-engineer
    """

    role_slug = role.strip().lower().replace(" ", "-")

    if location:
        location_slug = location.strip().lower().replace(" ", "-")
        return f"{BASE_URL}/role/l/{role_slug}/{location_slug}"

    return f"{BASE_URL}/role/r/{role_slug}"


def _parse_jobs_from_markdown(
    markdown: str,
    search_location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Parse Firecrawl markdown output.

    Wellfound markdown typically looks like:

        [Stripe](https://wellfound.com/company/stripe)
        [Software Engineer](https://wellfound.com/jobs/123456)

    We track the latest company link and attach it to
    subsequent job links.
    """

    jobs: List[Dict[str, Any]] = []

    current_company = "Unknown"
    current_date = None
    current_salary = None
    current_equity = None
    current_experience = None
    current_remote = None
    current_employment_type = None

    link_pattern = re.compile(
        r"\[([^\]]+)\]\((https?://[^\)]*wellfound\.com/[^\)]*)\)",
        re.IGNORECASE,
    )

    for line in markdown.splitlines():
        matches = link_pattern.findall(line)

        date_match = re.search(
            r"(\d+\s+(?:day|days|week|weeks|month|months|year|years)\s+ago)",
            line,
            re.IGNORECASE,
        )
        if date_match:
            current_date = date_match.group(1)

        salary_match = re.search(r"₹[^\n]+", line)
        if salary_match:
            current_salary = salary_match.group(0).strip()

        if "equity" in line.lower():
            current_equity = line.strip()

        if "remote" in line.lower():
            current_remote = line.strip()

        exp_match = re.search(r"\d+\s*years?\s*of\s*exp|\d+years?\s*of\s*exp", line, re.IGNORECASE)
        if exp_match:
            current_experience = exp_match.group(0)

        if any(keyword in line.lower() for keyword in ["full-time", "part-time", "contract", "internship"]):
            current_employment_type = line.strip()

        for text, href in matches:
            text = text.strip().strip("*")

            if "/role/" in href:
                continue

            if "/company/" in href:
                current_company = text
                continue

            if "/jobs/" in href:
                jobs.append(
                    {
                        "title": text,
                        "company": current_company,
                        "location": current_remote or search_location or "N/A",
                        "link": href,
                        "date": current_date,
                        "salary": current_salary,
                        "equity": current_equity,
                        "experience": current_experience,
                        "employment_type": current_employment_type,
                        "remote": current_remote,
                        "description": "",
                    }
                )
                current_salary = None
                current_equity = None
                current_experience = None
                current_remote = None
                current_employment_type = None

    return jobs


if __name__ == "__main__":
    jobs = scrape_wellfound_jobs(
        job_title="Software Engineer Intern",
        location="India",
    )

    for job in jobs:
        print(job)
