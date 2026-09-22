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


def _normalize_employment_type(text: Optional[str]) -> Optional[str]:
    """Extract clean employment type from text without links or titles."""
    if not text:
        return None
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", "", text).strip()
    cleaned_lower = cleaned.lower()
    if "full-time" in cleaned_lower or "full time" in cleaned_lower:
        return "Full-time"
    if "part-time" in cleaned_lower or "part time" in cleaned_lower:
        return "Part-time"
    if "contract" in cleaned_lower:
        return "Contract"
    if "intern" in cleaned_lower:
        return "Internship"
    return None


def _parse_salary_equity(line: str) -> tuple[Optional[str], Optional[str]]:
    """Parse salary and equity from a line like '₹20L – ₹30L • No equity' or '$140k - $180k'."""
    salary: Optional[str] = None
    equity: Optional[str] = None

    has_salary = bool(
        re.search(
            r"[₹$€£]|(?:\b\d+[kK]\b)|(?:\b(?:INR|USD|EUR|GBP)\b)",
            line,
            re.IGNORECASE,
        )
    )
    has_equity = "equity" in line.lower()

    if not has_salary and not has_equity:
        return None, None

    if "•" in line or "|" in line:
        sep = "•" if "•" in line else "|"
        parts = [p.strip() for p in line.split(sep)]
        for part in parts:
            if "equity" in part.lower():
                equity = part
            elif re.search(
                r"[₹$€£]|(?:\b\d+[kK]\b)|(?:\b(?:INR|USD|EUR|GBP)\b)",
                part,
                re.IGNORECASE,
            ):
                salary = part
    elif has_equity and not has_salary:
        equity = line.strip()
    elif has_salary and not has_equity:
        salary = line.strip()
    elif has_salary and has_equity:
        eq_match = re.search(
            r"(\S+\s+equity|no\s+equity|\d+%\s*[-–]\s*\d+%\s*equity)",
            line,
            re.IGNORECASE,
        )
        if eq_match:
            equity = eq_match.group(0).strip()
            salary = line.replace(eq_match.group(0), "").strip().strip("•|- ")
        else:
            salary = line.strip()

    return salary, equity


def _parse_jobs_from_markdown(
    markdown: str,
    search_location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Parse Firecrawl markdown output into structured job dictionaries."""
    jobs: List[Dict[str, Any]] = []

    current_company = "Unknown"
    current_job: Optional[Dict[str, Any]] = None

    link_pattern = re.compile(
        r"\[([^\]]+)\]\((https?://[^\)]*wellfound\.com/[^\)]*)\)",
        re.IGNORECASE,
    )

    def _flush_current_job():
        nonlocal current_job
        if current_job:
            if not current_job.get("location") or current_job["location"] == "N/A":
                current_job["location"] = search_location or "Remote"
            jobs.append(current_job)
            current_job = None

    for line in markdown.splitlines():
        line_clean = line.strip().strip("*").strip("-").strip()
        if not line_clean:
            continue

        matches = link_pattern.findall(line)

        is_company = False
        is_job = False
        job_info = None

        for text, href in matches:
            text = text.strip().strip("*")
            if "/role/" in href:
                continue

            if "/company/" in href:
                _flush_current_job()
                current_company = text
                is_company = True
                break

            if "/jobs/" in href:
                is_job = True
                job_info = (text, href)
                break

        if is_company:
            continue

        if is_job and job_info:
            _flush_current_job()
            job_title, job_url = job_info
            emp_type = _normalize_employment_type(line)
            current_job = {
                "title": job_title,
                "company": current_company,
                "location": "N/A",
                "link": job_url,
                "date": None,
                "salary": None,
                "equity": None,
                "experience": None,
                "employment_type": emp_type,
                "remote": None,
                "description": "",
            }
            continue

        if current_job:
            date_match = re.search(
                r"(\d+\s+(?:day|days|week|weeks|month|months|year|years)\s+ago)",
                line_clean,
                re.IGNORECASE,
            )
            if date_match and not current_job.get("date"):
                current_job["date"] = date_match.group(1)

            exp_match = re.search(
                r"\d+\s*years?\s*of\s*exp|\d+years?\s*of\s*exp",
                line_clean,
                re.IGNORECASE,
            )
            if exp_match and not current_job.get("experience"):
                current_job["experience"] = exp_match.group(0)

            emp_type = _normalize_employment_type(line_clean)
            if emp_type and not current_job.get("employment_type"):
                current_job["employment_type"] = emp_type

            if any(
                kw in line_clean.lower() for kw in ("remote", "onsite", "hybrid")
            ) and not current_job.get("remote"):
                current_job["remote"] = line_clean
                current_job["location"] = line_clean

            salary, equity = _parse_salary_equity(line_clean)
            if salary and not current_job.get("salary"):
                current_job["salary"] = salary
            if equity and not current_job.get("equity"):
                current_job["equity"] = equity

    _flush_current_job()
    return jobs
