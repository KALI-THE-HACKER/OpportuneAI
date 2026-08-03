import logging
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

logger = logging.getLogger(__name__)


def scrape_linkedin_jobs(
    job_title: str = "Software Engineer Intern",
    locations: List[str] | None = None,
    job_type: List[TypeFilters] | None = None,
    experience_level: List[ExperienceLevelFilters] | None = None,
    limit: int = 20,
    headless: bool = True,
) -> Dict[str, Any]:
    """
    Scrape LinkedIn job listings and return the data.

    Args:
        job_title: The job title to search for
        locations: List of locations (e.g., ['India'])
        job_type: List of job types (e.g., [TypeFilters.INTERNSHIP])
        experience_level: List of experience levels
        limit: Maximum number of jobs to scrape

    Returns:
        Dictionary containing scraped jobs data and errors
    """
    if locations is None:
        locations = ["India"]
    if job_type is None:
        job_type = [TypeFilters.INTERNSHIP]
    if experience_level is None:
        experience_level = [ExperienceLevelFilters.INTERNSHIP]

    jobs_data = []
    errors = []

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
        logger.info(f"✓ Scraped: {data.title} at {data.company}")

    def on_error(error):
        """Callback when an error occurs"""
        logger.error(f"✗ Error: {error}")
        errors.append(str(error))

    def on_end():
        """Callback when scraping is complete"""
        logger.info(f"✓ Scraping complete. Found {len(jobs_data)} jobs")

    # Initialize scraper
    scraper = LinkedinScraper(
        chrome_executable_path=None,
        chrome_binary_location=None,
        headless=headless,
        max_workers=1,
        slow_mo=2,
    )

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
    scraper.run([query])

    # Return results
    return {"jobs": jobs_data, "total_jobs": len(jobs_data), "errors": errors}


if __name__ == "__main__":
    # Configure logging to output progress to terminal when run directly
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
    )

    # Example usage when run directly
    result = scrape_linkedin_jobs(
        job_title="Software Engineer Intern", locations=["India"], limit=20
    )
    print("\n" + "=" * 50)
    print(f"Found {result['total_jobs']} jobs")
    print("=" * 50)
