"""Wellfound scraper — uses Firecrawl markdown extraction for low credit usage."""

import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from firecrawl import V1FirecrawlApp

from utils.logging_config import get_feature_logger, log_dev, log_dev_error

logger = get_feature_logger("ingestion")

BASE_URL = "https://wellfound.com"


def scrape_wellfound_jobs(
    job_title: str = "Software Engineer Intern",
    location: Optional[str] = "India",
) -> List[Dict[str, Any]]:
    """Scrape Wellfound jobs and return normalized data."""
    load_dotenv()

    api_key = os.getenv("FIRECRAWL_API_KEY", "").strip()
    if not api_key:
        err_msg = "FIRECRAWL_API_KEY not found in environment or .env"
        logger.error(f"[Wellfound] [ERROR:AUTH_OR_CONFIG] {err_msg}")
        log_dev_error(
            "WELLFOUND_MISSING_API_KEY",
            err_msg,
            context={"job_title": job_title, "location": location},
            logger_name="ingestion",
        )
        raise ValueError("FIRECRAWL_API_KEY not found in environment or .env")

    url = _build_search_url(job_title, location)
    logger.info(
        f"[Wellfound] [START] Initiating Firecrawl scrape for role='{job_title}', location='{location}' → URL: {url}"
    )
    log_dev(
        "WELLFOUND_FIRECRAWL_START",
        {"job_title": job_title, "location": location, "url": url},
        logger_name="ingestion",
    )

    try:
        app = V1FirecrawlApp(api_key=api_key)
        result = app.scrape_url(
            url,
            formats=["markdown"],
            timeout=30000,
        )
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "rate limit" in err_str.lower():
            logger.error(
                f"[Wellfound] [ERROR:RATE_LIMIT_429] Firecrawl API rate limit exceeded: {e}"
            )
            log_dev_error(
                "WELLFOUND_FIRECRAWL_429",
                e,
                context={"url": url},
                logger_name="ingestion",
            )
        elif "401" in err_str or "auth" in err_str.lower() or "key" in err_str.lower():
            logger.error(
                f"[Wellfound] [ERROR:AUTH_OR_CONFIG] Invalid or expired Firecrawl API key: {e}"
            )
            log_dev_error(
                "WELLFOUND_FIRECRAWL_AUTH_ERROR",
                e,
                context={"url": url},
                logger_name="ingestion",
            )
        elif "timeout" in err_str.lower():
            logger.error(
                f"[Wellfound] [ERROR:TIMEOUT] Firecrawl scrape timed out after 30s for {url}: {e}"
            )
            log_dev_error(
                "WELLFOUND_FIRECRAWL_TIMEOUT",
                e,
                context={"url": url, "timeout": 30000},
                logger_name="ingestion",
            )
        else:
            logger.error(
                f"[Wellfound] [ERROR:FIRECRAWL] Firecrawl request failed for {url}: {e}",
                exc_info=True,
            )
            log_dev_error(
                "WELLFOUND_FIRECRAWL_ERROR",
                e,
                context={"url": url},
                logger_name="ingestion",
            )
        raise

    markdown = getattr(result, "markdown", "") or ""
    logger.info(
        f"[Wellfound] [FIRECRAWL_SUCCESS] Received {len(markdown)} bytes of markdown from Firecrawl"
    )

    jobs = _parse_jobs_from_markdown(markdown, location)
    logger.info(
        f"[Wellfound] [SUCCESS] Successfully parsed {len(jobs)} jobs from Wellfound markdown"
    )
    log_dev(
        "WELLFOUND_SCRAPER_COMPLETE",
        {
            "markdown_length": len(markdown),
            "jobs_parsed_count": len(jobs),
            "sample_job": jobs[0] if jobs else None,
        },
        logger_name="ingestion",
    )
    return jobs


def _build_search_url(
    role: str,
    location: Optional[str] = None,
) -> str:
    role_slug = role.strip().lower().replace(" ", "-")

    if location:
        location_slug = location.strip().lower().replace(" ", "-")
        return f"{BASE_URL}/role/l/{role_slug}/{location_slug}"

    return f"{BASE_URL}/role/r/{role_slug}"


def _parse_jobs_from_markdown(
    markdown: str,
    search_location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Parse Firecrawl markdown output."""
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

        exp_match = re.search(
            r"\d+\s*years?\s*of\s*exp|\d+years?\s*of\s*exp", line, re.IGNORECASE
        )
        if exp_match:
            current_experience = exp_match.group(0)

        if any(
            keyword in line.lower()
            for keyword in ["full-time", "part-time", "contract", "internship"]
        ):
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
