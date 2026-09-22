from typing import Any, Dict, List

from linkedin_jobs_scraper import LinkedinScraper
from linkedin_jobs_scraper.events import EventData, Events
from linkedin_jobs_scraper.filters import (
    ExperienceLevelFilters,
    IndustryFilters,
    OnSiteOrRemoteFilters,
    RelevanceFilters,
    TimeFilters,
    TypeFilters,
)
from linkedin_jobs_scraper.query import Query, QueryFilters, QueryOptions

from utils.logging_config import get_feature_logger, log_dev, log_dev_error

logger = get_feature_logger("ingestion")


def scrape_linkedin_jobs(
    job_title: str = "Software Engineer Intern",
    locations: List[str] | None = None,
    job_type: List[TypeFilters] | None = None,
    experience_level: List[ExperienceLevelFilters] | None = None,
    limit: int = 20,
    headless: bool = True,
) -> Dict[str, Any]:
    """Scrape LinkedIn job listings and return the data."""
    if locations is None:
        locations = ["India"]
    if job_type is None:
        job_type = [TypeFilters.INTERNSHIP]
    if experience_level is None:
        experience_level = [ExperienceLevelFilters.INTERNSHIP]

    jobs_data = []
    errors = []

    logger.info(
        f"[LinkedIn] [START] Initializing scraper for role='{job_title}', locations={locations}, limit={limit}, headless={headless}"
    )
    log_dev(
        "LINKEDIN_SCRAPER_INIT",
        {
            "job_title": job_title,
            "locations": locations,
            "limit": limit,
            "headless": headless,
        },
        logger_name="ingestion",
    )

    def on_data(data: EventData):
        """Callback when job data is scraped"""
        job_info = {
            "title": data.title,
            "company": data.company,
            "location": data.location,
            "date_posted": data.date,
            "link": data.link,
            "description": data.description,
        }
        jobs_data.append(job_info)
        logger.info(
            f"[LinkedIn] [SCRAPED #{len(jobs_data)}] '{data.title}' at '{data.company}' ({data.location})"
        )

    def on_error(error):
        """Callback when an error occurs"""
        err_str = str(error)
        is_blocked = any(
            t in err_str.lower()
            for t in [
                "auth",
                "login",
                "captcha",
                "security check",
                "429",
                "403",
                "checkpoint",
            ]
        )
        if is_blocked:
            logger.error(
                f"[LinkedIn] [ERROR:ANTI_BOT_BLOCKED] LinkedIn anti-bot/login wall detected: {err_str}"
            )
            log_dev_error(
                "LINKEDIN_ANTI_BOT_BLOCKED",
                err_str,
                context={"job_title": job_title, "locations": locations},
                logger_name="ingestion",
            )
        else:
            logger.error(f"[LinkedIn] [ERROR:SCRAPER] Scraper event error: {err_str}")
            log_dev_error(
                "LINKEDIN_SCRAPER_EVENT_ERROR",
                err_str,
                context={"scraped_so_far": len(jobs_data)},
                logger_name="ingestion",
            )
        errors.append(err_str)

    def on_end():
        """Callback when scraping is complete"""
        logger.info(
            f"[LinkedIn] [FINISH] Scraping completed. Successfully collected {len(jobs_data)} jobs (encountered {len(errors)} error events)"
        )
        log_dev(
            "LINKEDIN_SCRAPER_END",
            {
                "jobs_collected": len(jobs_data),
                "errors_count": len(errors),
                "sample_job": jobs_data[0] if jobs_data else None,
            },
            logger_name="ingestion",
        )

    # Initialize scraper
    try:
        scraper = LinkedinScraper(
            chrome_executable_path=None,
            chrome_binary_location=None,
            headless=headless,
            max_workers=1,
            slow_mo=2,
        )
    except Exception as e:
        logger.error(
            f"[LinkedIn] [ERROR:BROWSER_DRIVER] Failed to initialize LinkedIn Chromium browser: {e}",
            exc_info=True,
        )
        log_dev_error(
            "LINKEDIN_BROWSER_INIT_FAILED",
            e,
            context={"headless": headless},
            logger_name="ingestion",
        )
        raise

    # Register event handlers
    scraper.on(Events.DATA, on_data)
    scraper.on(Events.ERROR, on_error)
    scraper.on(Events.END, on_end)

    # Build query
    query = Query(
        query=job_title,
        options=QueryOptions(
            locations=locations,
            apply_link=True,
            skip_promoted_jobs=True,
            limit=limit,
            filters=QueryFilters(
                relevance=RelevanceFilters.RECENT,
                time=TimeFilters.MONTH,
                type=job_type,
                on_site_or_remote=[
                    OnSiteOrRemoteFilters.REMOTE,
                    OnSiteOrRemoteFilters.HYBRID,
                    OnSiteOrRemoteFilters.ON_SITE,
                ],
                experience=experience_level,
                industry=[
                    IndustryFilters.SOFTWARE_DEVELOPMENT,
                    IndustryFilters.IT_SERVICES,
                    IndustryFilters.TECHNOLOGY_INTERNET,
                ],
            ),
        ),
    )

    # Run scraper
    try:
        scraper.run([query])
    except Exception as e:
        logger.error(
            f"[LinkedIn] [ERROR:EXECUTION] LinkedIn scraper run failed: {e}",
            exc_info=True,
        )
        log_dev_error(
            "LINKEDIN_RUN_EXECUTION_FAILED",
            e,
            context={"job_title": job_title, "locations": locations},
            logger_name="ingestion",
        )
        raise

    return {"jobs": jobs_data, "total_jobs": len(jobs_data), "errors": errors}
