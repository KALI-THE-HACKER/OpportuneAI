"""Naukri scraper — uses ``undetected-chromedriver`` to open your real Chrome
browser, render the JS-heavy Naukri page, and extract job cards.

``undetected-chromedriver`` patches your system Chrome to remove automation
flags, making it virtually undetectable by Akamai / CloudFlare.

A ``--naukri-html`` fallback is kept for offline / debugging use.
"""

import logging
import os
import re
import time
from typing import Optional

from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

BASE_URL = "https://www.naukri.com"
MAX_PAGES = 2
DELAY_BETWEEN_PAGES = 2  # seconds


# ------------------------------------------------------------------
# URL helpers
# ------------------------------------------------------------------


def _build_search_url(role: str, location: Optional[str] = None, page: int = 1) -> str:
    """Build Naukri search URL.
    Examples:
        ("product manager", "bangalore") → naukri.com/product-manager-jobs-in-bangalore
        ("python developer", None)        → naukri.com/python-developer-jobs
    """
    slug = role.strip().lower().replace(" ", "-")
    url = f"{BASE_URL}/{slug}-jobs"
    if location:
        loc_slug = location.strip().lower().replace(" ", "-")
        url += f"-in-{loc_slug}"
    if page > 1:
        url += f"-{page}"
    return url


# ------------------------------------------------------------------
# HTML parsing (works on rendered DOM — Playwright or saved file)
# ------------------------------------------------------------------


def _extract_job_from_card(card: Tag) -> dict | None:
    """Pull title, company, location, link, date, salary, experience from a single card."""
    # --- title & link ---
    title_el = (
        card.select_one("a[class*='title']")
        or card.select_one("a.title")
        or card.find("a", href=re.compile(r"/job-listings-"))
    )
    if not title_el:
        return None
    title_text = title_el.get_text(strip=True)
    link = title_el.get("href", "")

    # --- company ---
    comp_el = (
        card.find(class_=re.compile(r"comp"))
        or card.select_one("a[class*='companyName']")
        or card.select_one("a.subTitle")
    )
    company = comp_el.get_text(strip=True) if comp_el else "N/A"

    # --- location ---
    loc_el = (
        card.find(class_=re.compile(r"loc"))
        or card.find(class_=re.compile(r"location"))
        or card.select_one("span.locWd498")
    )
    location = loc_el.get_text(" ", strip=True) if loc_el else "N/A"

    # --- date posted ---
    date_el = card.find(class_=re.compile(r"date|post.day|footer"))
    date_posted = date_el.get_text(strip=True) if date_el else None

    # --- salary ---
    salary_el = card.find(class_=re.compile(r"salary"))
    salary = salary_el.get_text(strip=True) if salary_el else None

    # --- experience ---
    exp_el = card.find(class_=re.compile(r"exp"))
    experience = exp_el.get_text(strip=True) if exp_el else None

    absolute_url = link if link.startswith("http") else f"{BASE_URL}{link}"
    return {
        "title": title_text,
        "company": company,
        "location": location,
        "link": absolute_url,
        "date_posted": date_posted,
        "salary": salary,
        "experience": experience,
        "description": "",
    }


def _parse_jobs_from_html(html: str) -> list[dict]:
    """Extract job listings from a fully-rendered Naukri page."""
    soup = BeautifulSoup(html, "html.parser")
    jobs: list[dict] = []

    # Strategy 1: current Naukri (CSS-modules)
    container = soup.find("div", id="listContainer")
    if container:
        listing_div = container.find(
            "div", class_=re.compile(r"styles_job-listing-container")
        )
        if listing_div:
            wrapper = listing_div.find("div", recursive=False)
            cards = wrapper.find_all("div", recursive=False) if wrapper else []
        else:
            cards = []
    else:
        # Strategy 2: older Naukri markup
        cards = soup.select(
            "div.srp-jobtuple-wrapper, article.jobTuple, "
            "div.cust-job-tuple, div[class*='jobTuple']"
        )

    logger.info("Found %d potential job card(s) in HTML.", len(cards))

    for card in cards:
        try:
            job = _extract_job_from_card(card)
            if job:
                jobs.append(job)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to parse a Naukri card: %s", exc)
    return jobs


# ------------------------------------------------------------------
# JSON parsing (intercepted jobapi response)
# ------------------------------------------------------------------


def _parse_jobs_from_api(data: dict) -> list[dict]:
    """Parse the JSON payload returned by Naukri's internal jobapi."""
    jobs: list[dict] = []
    for item in data.get("jobDetails", []):
        try:
            title = item.get("title", "").strip()
            if not title:
                continue

            company = item.get("companyName", "N/A")

            placeholders = item.get("placeholders", [])
            location = "N/A"
            for ph in placeholders:
                if ph.get("type") == "location":
                    location = ph.get("label", "N/A")
                    break

            jd_url = item.get("jdURL", "")
            url = jd_url if jd_url.startswith("http") else f"{BASE_URL}{jd_url}"

            date_posted = item.get("footerPlaceholderLabel") or item.get("createdDate")

            jobs.append(
                {
                    "title": title,
                    "company": company,
                    "location": location,
                    "link": url,
                    "date_posted": date_posted,
                    "salary": item.get("salaryDetail") or item.get("salary"),
                    "experience": item.get("experienceText") or item.get("experience"),
                    "description": item.get("jobDescription") or "",
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to parse Naukri API item: %s", exc)
    return jobs


# ------------------------------------------------------------------
# Live mode — undetected-chromedriver (uses your real Chrome)
# ------------------------------------------------------------------


def _scrape_live(role: str, location: Optional[str], headless: bool) -> list[dict]:
    """Open Naukri in real Chrome via undetected-chromedriver."""
    try:
        import undetected_chromedriver as uc
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.support.ui import WebDriverWait
    except ImportError:
        logger.error(
            "undetected-chromedriver is required for Naukri scraping. "
            "Install with: pip install undetected-chromedriver"
        )
        return []

    # Fix SSL cert issue on macOS
    try:
        import certifi

        os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    except ImportError:
        pass

    all_jobs: list[dict] = []
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1440,900")

    driver = None
    try:
        driver = uc.Chrome(options=options, headless=headless)

        for pg in range(1, MAX_PAGES + 1):
            url = _build_search_url(role, location, pg)
            logger.info("Naukri page %d → %s", pg, url)

            driver.get(url)

            # Check for access denied
            if "Access Denied" in driver.page_source[:500]:
                logger.warning(
                    "Naukri returned Access Denied. "
                    "Try running with headless=False or use --naukri-html."
                )
                break

            # Wait for the job-list container to render
            try:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "listContainer"))
                )
                # Extra time for all job cards to load
                time.sleep(3)
            except Exception:
                logger.info("Job container did not appear on page %d.", pg)

            rendered_html = driver.page_source
            page_jobs = _parse_jobs_from_html(rendered_html)
            logger.info("Parsed %d job(s) from page %d.", len(page_jobs), pg)
            all_jobs.extend(page_jobs)

            if not page_jobs:
                logger.info("No jobs on page %d — stopping pagination.", pg)
                break

            if pg < MAX_PAGES:
                time.sleep(DELAY_BETWEEN_PAGES)

    except Exception as exc:
        logger.error("undetected-chromedriver error: %s", exc)
    finally:
        if driver:
            driver.quit()

    return all_jobs


# ------------------------------------------------------------------
# Offline fallback — parse a saved HTML file
# ------------------------------------------------------------------


def _scrape_from_file(path: str) -> list[dict]:
    """Parse a locally-saved Naukri HTML file."""
    if not path or not os.path.isfile(path):
        logger.error("HTML file not found: %s", path)
        return []

    logger.info("Parsing saved Naukri HTML: %s", path)
    with open(path, encoding="utf-8", errors="replace") as fh:
        return _parse_jobs_from_html(fh.read())


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------


def scrape_naukri_jobs(
    job_title: str,
    location: Optional[str] = None,
    html_file: str | None = None,
    headless: bool = False,
) -> list[dict]:
    """Scrape Naukri jobs as normalized dicts."""
    if html_file:
        return _scrape_from_file(html_file)
    return _scrape_live(job_title, location, headless)


# ------------------------------------------------------------------
# Script entrypoint
# ------------------------------------------------------------------

if __name__ == "__main__":
    jobs = scrape_naukri_jobs(
        job_title="Software Engineer",
        location="Bangalore",
    )
    print(f"Found {len(jobs)} jobs")
