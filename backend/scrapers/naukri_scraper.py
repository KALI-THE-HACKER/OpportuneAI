"""Naukri scraper — uses undetected-chromedriver to render JS and extract job cards."""

import os
import re
import time
from typing import Optional

from bs4 import BeautifulSoup, Tag

from utils.logging_config import get_feature_logger, log_dev, log_dev_error

logger = get_feature_logger("ingestion")

BASE_URL = "https://www.naukri.com"
MAX_PAGES = 2
DELAY_BETWEEN_PAGES = 2  # seconds


def _build_search_url(role: str, location: Optional[str] = None, page: int = 1) -> str:
    """Build Naukri search URL."""
    slug = role.strip().lower().replace(" ", "-")
    url = f"{BASE_URL}/{slug}-jobs"
    if location:
        loc_slug = location.strip().lower().replace(" ", "-")
        url += f"-in-{loc_slug}"
    if page > 1:
        url += f"-{page}"
    return url


def _extract_job_from_card(card: Tag) -> dict | None:
    """Pull title, company, location, link, date, salary, experience from a single card."""
    title_el = (
        card.select_one("a[class*='title']")
        or card.select_one("a.title")
        or card.find("a", href=re.compile(r"/job-listings-"))
    )
    if not title_el:
        return None
    title_text = title_el.get_text(strip=True)
    link = title_el.get("href", "")

    comp_el = (
        card.find(class_=re.compile(r"comp"))
        or card.select_one("a[class*='companyName']")
        or card.select_one("a.subTitle")
    )
    company = comp_el.get_text(strip=True) if comp_el else "N/A"

    loc_el = (
        card.find(class_=re.compile(r"loc"))
        or card.find(class_=re.compile(r"location"))
        or card.select_one("span.locWd498")
    )
    location = loc_el.get_text(" ", strip=True) if loc_el else "N/A"

    date_el = card.find(class_=re.compile(r"date|post.day|footer"))
    date_posted = date_el.get_text(strip=True) if date_el else None

    salary_el = card.find(class_=re.compile(r"salary"))
    salary = salary_el.get_text(strip=True) if salary_el else None

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

    logger.info(
        f"[Naukri] [PARSER] Found {len(cards)} potential job card elements in HTML"
    )

    for card in cards:
        try:
            job = _extract_job_from_card(card)
            if job:
                jobs.append(job)
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"[Naukri] Failed to parse card: {exc}")

    return jobs


def _init_browser_driver(headless: bool = True):
    """
    Initialize a headless Chrome browser driver with stealth anti-detection flags.

    Prefers Selenium Chrome with modern headless flags and CDP script injection,
    with an automatic fallback to undetected-chromedriver if needed.
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options

        options = Options()
        if headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1440,900")
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
        )
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        driver = webdriver.Chrome(options=options)
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                """
            },
        )
        return driver
    except Exception as e:
        logger.warning(
            f"[Naukri] Standard Selenium launch encountered '{e}', attempting undetected-chromedriver fallback..."
        )
        try:
            import undetected_chromedriver as uc

            uc_options = uc.ChromeOptions()
            uc_options.add_argument("--no-sandbox")
            uc_options.add_argument("--window-size=1440,900")
            if headless:
                uc_options.add_argument("--headless=new")
            return uc.Chrome(options=uc_options, headless=headless)
        except Exception as uc_err:
            logger.error(f"[Naukri] All browser drivers failed: {uc_err}")
            raise


def _is_cancelled(provider: str = "naukri") -> bool:
    try:
        from workers.connection import redis_connection

        return bool(redis_connection.get(f"cancel:scraper:{provider.lower()}"))
    except Exception:
        return False


def _scrape_live(
    role: str, location: Optional[str] = None, headless: bool = True
) -> list[dict]:
    """Open Naukri in headless Chrome via stealth browser driver."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    # Fix SSL cert issue on macOS
    try:
        import certifi

        os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    except ImportError:
        pass

    all_jobs: list[dict] = []
    driver = None
    try:
        logger.info(
            f"[Naukri] [BROWSER] Launching Chrome browser (headless={headless})..."
        )
        log_dev(
            "NAUKRI_BROWSER_LAUNCH",
            {"role": role, "location": location, "headless": headless},
            logger_name="ingestion",
        )
        driver = _init_browser_driver(headless=headless)

        for pg in range(1, MAX_PAGES + 1):
            if _is_cancelled("naukri"):
                logger.info(
                    "[Naukri] [CANCELLED] Scraper cancellation signal received. Halting crawl."
                )
                break

            url = _build_search_url(role, location, pg)
            logger.info(f"[Naukri] [FETCHING] Page {pg}/{MAX_PAGES} → {url}")

            driver.get(url)

            if _is_cancelled("naukri"):
                logger.info(
                    "[Naukri] [CANCELLED] Scraper cancellation signal received. Halting crawl."
                )
                break

            # Check for access denied
            page_snippet = driver.page_source[:800]
            if any(
                t in page_snippet
                for t in ["Access Denied", "Cloudflare", "Security Challenge"]
            ):
                err_msg = f"Access Denied / Cloudflare block encountered on {url}"
                logger.error(f"[Naukri] [ERROR:ANTI_BOT_BLOCKED] {err_msg}")
                log_dev_error(
                    "NAUKRI_ANTI_BOT_BLOCKED",
                    err_msg,
                    context={
                        "page": pg,
                        "url": url,
                        "html_snippet": page_snippet[:300],
                    },
                    logger_name="ingestion",
                )
                break

            # Wait for the job-list container to render
            try:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "listContainer"))
                )
                time.sleep(3)
            except Exception as e:
                logger.warning(
                    f"[Naukri] [TIMEOUT] Job container '#listContainer' did not appear on page {pg} within 15s: {e}"
                )
                log_dev(
                    "NAUKRI_CONTAINER_WAIT_TIMEOUT",
                    {"page": pg, "url": url, "warning": str(e)},
                    logger_name="ingestion",
                )

            rendered_html = driver.page_source
            page_jobs = _parse_jobs_from_html(rendered_html)
            logger.info(
                f"[Naukri] [PARSED] Page {pg}: Successfully parsed {len(page_jobs)} jobs"
            )
            all_jobs.extend(page_jobs)

            if not page_jobs:
                logger.info(
                    f"[Naukri] No jobs found on page {pg}, terminating pagination."
                )
                break

            if pg < MAX_PAGES:
                time.sleep(DELAY_BETWEEN_PAGES)

    except Exception as exc:
        logger.error(
            f"[Naukri] [ERROR:BROWSER_CRASH] undetected-chromedriver execution error: {exc}",
            exc_info=True,
        )
        log_dev_error(
            "NAUKRI_EXECUTION_ERROR",
            exc,
            context={"role": role, "location": location},
            logger_name="ingestion",
        )
        raise
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass

    logger.info(
        f"[Naukri] [SUCCESS] Scraped total of {len(all_jobs)} jobs from Naukri across {MAX_PAGES} pages."
    )
    log_dev(
        "NAUKRI_SCRAPER_COMPLETE",
        {
            "total_jobs_scraped": len(all_jobs),
            "sample_job": all_jobs[0] if all_jobs else None,
        },
        logger_name="ingestion",
    )
    return all_jobs


def _scrape_from_file(path: str) -> list[dict]:
    """Parse a locally-saved Naukri HTML file."""
    if not path or not os.path.isfile(path):
        logger.error(f"[Naukri] [ERROR:FILE_NOT_FOUND] HTML file not found: {path}")
        return []

    logger.info(f"[Naukri] Parsing saved HTML file: {path}")
    with open(path, encoding="utf-8", errors="replace") as fh:
        return _parse_jobs_from_html(fh.read())


def scrape_naukri_jobs(
    job_title: str,
    location: Optional[str] = None,
    html_file: str | None = None,
    headless: bool = True,
) -> list[dict]:
    """Scrape Naukri jobs as normalized dicts in headless browser mode."""
    if html_file:
        return _scrape_from_file(html_file)
    return _scrape_live(job_title, location, headless)
