from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from providers.linkedin_provider import LinkedInProvider, _convert_filter_strings
from providers.models.raw_jobs_data import RawJobData
from providers.naukri_provider import NaukriProvider, extract_naukri_job_id
from providers.remoteOK_provider import RemoteOKProvider
from providers.wellfound_provider import WellfoundProvider
from scrapers.naukri_scraper import _parse_jobs_from_html
from scrapers.wellfound_scraper import _parse_jobs_from_markdown
from services.pipeline_orchestrator import classify_scraper_error
from utils.logging_config import log_dev, log_dev_error


# ---------------------------------------------------------------------------
# 1. RemoteOK Provider Tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_remoteok_provider():
    """Test RemoteOK provider fetching and normalization."""
    mock_payload = [
        {"legal": "Notice..."},  # API header item
        {
            "id": "1001",
            "position": "Senior Python Backend Engineer",
            "company": "Stripe",
            "date": "2026-08-25T10:00:00Z",
            "url": "https://remoteok.com/jobs/1001",
            "tags": ["python", "fastapi", "backend"],
            "slug": "stripe-senior-python-backend-engineer",
            "description": "Building scalable payment infrastructure",
            "salary_min": 120000,
            "salary_max": 160000,
        },
        {
            "id": "1002",
            "position": "Marketing Manager",
            "company": "Acme Corp",
            "date": "2026-08-25T11:00:00Z",
            "url": "https://remoteok.com/jobs/1002",
            "tags": ["marketing", "sales"],
            "slug": "acme-marketing-manager",
        },
    ]

    provider = RemoteOKProvider()

    # Test filtering logic
    assert provider._matches(mock_payload[1], "Python Engineer") is True
    assert provider._matches(mock_payload[1], "Backend") is True
    assert provider._matches(mock_payload[2], "Software Engineer") is False

    # Test fetch with mocked HTTP client
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_payload
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response

        with patch("builtins.open", MagicMock()):
            with patch(
                "yaml.safe_load",
                return_value={"scraper_config": {"job_title": "Python Engineer"}},
            ):
                jobs = await provider.fetch_jobs()

    assert len(jobs) == 1
    job = jobs[0]
    assert isinstance(job, RawJobData)
    assert job.source == "remoteok"
    assert job.title == "Senior Python Backend Engineer"
    assert job.company == "Stripe"
    assert job.location == "Remote"
    assert job.date_posted == "2026-08-25"
    assert job.content_hash is not None


@pytest.mark.anyio
async def test_remoteok_provider_error_handling():
    """Test RemoteOK error logging on HTTP 429 and network errors."""
    provider = RemoteOKProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.text = "Rate limit exceeded"
    mock_resp.headers = {"Retry-After": "60"}

    def raise_429(*args, **kwargs):
        raise httpx.HTTPStatusError(
            "429 Too Many Requests", request=MagicMock(), response=mock_resp
        )

    mock_resp.raise_for_status = raise_429

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        with pytest.raises(httpx.HTTPStatusError):
            await provider.fetch_jobs()


# ---------------------------------------------------------------------------
# 2. LinkedIn Provider Tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_linkedin_provider():
    """Test LinkedIn provider data normalization and filter conversion."""
    provider = LinkedInProvider()

    mock_raw_data = {
        "jobs": [
            {
                "title": "Software Engineer Intern",
                "company": "Google",
                "location": "Bengaluru, Karnataka, India",
                "date": "2026-08-20",
                "link": "https://www.linkedin.com/jobs/view/1234567890",
                "description": "Join our cloud systems engineering team.",
            }
        ],
        "total_jobs": 1,
        "errors": [],
    }

    with patch(
        "providers.linkedin_provider.scrape_jobs", new_callable=AsyncMock
    ) as mock_scrape:
        mock_scrape.return_value = mock_raw_data
        jobs = await provider.fetch_jobs()

    assert len(jobs) == 1
    job = jobs[0]
    assert isinstance(job, RawJobData)
    assert job.source == "linkedin"
    assert job.title == "Software Engineer Intern"
    assert job.company == "Google"
    assert "Bengaluru" in job.location
    assert job.external_id == "1234567890"


def test_linkedin_filter_strings():
    """Test converting string filter configurations to LinkedIn enums."""
    from linkedin_jobs_scraper.filters import TypeFilters

    converted = _convert_filter_strings(["INTERNSHIP", "FULL_TIME"], TypeFilters)
    assert len(converted) == 2
    assert TypeFilters.INTERNSHIP in converted

    # Test unknown filter gracefully skipped
    unknown = _convert_filter_strings(["NON_EXISTENT_FILTER"], TypeFilters)
    assert len(unknown) == 0


# ---------------------------------------------------------------------------
# 3. Naukri Provider & Scraper Tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_naukri_provider():
    """Test Naukri provider normalization and job id extraction."""
    provider = NaukriProvider()

    mock_scraped = [
        {
            "title": "Backend Developer",
            "company": "Swiggy",
            "location": "Bangalore/Bengaluru",
            "link": "https://www.naukri.com/job-listings-backend-developer-swiggy-998877",
            "date_posted": "1 day ago",
            "salary": "15-25 Lacs PA",
            "experience": "2-5 Yrs",
            "description": "Python, Django, PostgreSQL",
        }
    ]

    with patch(
        "providers.naukri_provider.scrape_naukri_jobs", return_value=mock_scraped
    ):
        jobs = await provider.fetch_jobs()

    assert len(jobs) == 1
    job = jobs[0]
    assert isinstance(job, RawJobData)
    assert job.source == "naukri"
    assert job.title == "Backend Developer"
    assert job.company == "Swiggy"
    assert job.external_id == "998877"
    assert job.raw_payload.get("salary") == "15-25 Lacs PA"


def test_naukri_html_parser():
    """Test extracting jobs from Naukri HTML snippet."""
    sample_html = """
    <div id="listContainer">
        <div class="styles_job-listing-container__1">
            <div>
                <div class="srp-jobtuple-wrapper">
                    <a class="title" href="/job-listings-python-dev-12345">Python Developer</a>
                    <a class="companyName">Infosys</a>
                    <span class="locWd498">Hyderabad</span>
                    <span class="date">3 days ago</span>
                    <span class="salary">8-12 Lacs PA</span>
                    <span class="exp">1-3 Yrs</span>
                </div>
            </div>
        </div>
    </div>
    """
    jobs = _parse_jobs_from_html(sample_html)
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Python Developer"
    assert jobs[0]["company"] == "Infosys"
    assert jobs[0]["location"] == "Hyderabad"


def test_extract_naukri_job_id():
    """Test Naukri URL id extractor."""
    url = (
        "https://www.naukri.com/job-listings-swe-intern-meta-12345678?src=jobsearchDesk"
    )
    assert extract_naukri_job_id(url) == "12345678"


# ---------------------------------------------------------------------------
# 4. Wellfound Provider & Scraper Tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_wellfound_provider():
    """Test Wellfound provider normalization and markdown parser."""
    provider = WellfoundProvider()

    mock_scraped = [
        {
            "title": "Full Stack Engineer",
            "company": "Vercel",
            "location": "Remote",
            "link": "https://wellfound.com/jobs/554433",
            "date": "2 days ago",
            "salary": "$130k – $160k",
            "equity": "0.1% – 0.25%",
            "experience": "3+ years of exp",
            "employment_type": "Full-time",
            "remote": "Remote",
            "description": "Next.js & TypeScript",
        }
    ]

    with patch(
        "providers.wellfound_provider.scrape_wellfound_jobs", return_value=mock_scraped
    ):
        jobs = await provider.fetch_jobs()

    assert len(jobs) == 1
    job = jobs[0]
    assert isinstance(job, RawJobData)
    assert job.source == "wellfound"
    assert job.title == "Full Stack Engineer"
    assert job.company == "Vercel"
    assert job.external_id == "554433"
    assert job.raw_payload.get("equity") == "0.1% – 0.25%"


def test_wellfound_markdown_parser():
    """Test parsing markdown structure generated by Firecrawl."""
    sample_md = """
    # Wellfound Jobs
    [Linear](https://wellfound.com/company/linear)
    [Frontend Engineer](https://wellfound.com/jobs/987654)
    Remote
    2 days ago
    $140k - $180k
    Full-time
    """
    jobs = _parse_jobs_from_markdown(sample_md, search_location="Remote")
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Frontend Engineer"
    assert jobs[0]["company"] == "Linear"
    assert jobs[0]["link"] == "https://wellfound.com/jobs/987654"


def test_extract_wellfound_job_id():
    """Test Wellfound URL id extractor."""
    url = "https://wellfound.com/jobs/554433-full-stack-engineer"
    from utils.wellfound_utils import extract_wellfound_job_id

    assert extract_wellfound_job_id(url) == "554433"


# ---------------------------------------------------------------------------
# 5. Development Mode Logging & Error Diagnostics
# ---------------------------------------------------------------------------
def test_dev_mode_logging_and_error_classification():
    """Test error classifier categories and dev log functions."""
    # Rate limit error
    cat, summary, is_blocked = classify_scraper_error(
        Exception("429 Too Many Requests: Rate limit exceeded")
    )
    assert cat == "RATE_LIMIT_429"
    assert is_blocked is True

    # Cloudflare / Anti-bot error
    cat, summary, is_blocked = classify_scraper_error(
        Exception("Cloudflare challenge page received: 403 Forbidden")
    )
    assert cat == "ANTI_BOT_BLOCKED"
    assert is_blocked is True

    # Auth error
    cat, summary, is_blocked = classify_scraper_error(
        Exception("FIRECRAWL_API_KEY not found in environment")
    )
    assert cat == "AUTH_OR_CONFIG"
    assert is_blocked is False

    # Timeout error
    cat, summary, is_blocked = classify_scraper_error(
        Exception("Connection timeout after 30000ms")
    )
    assert cat == "TIMEOUT_OR_NETWORK"
    assert is_blocked is False

    # Test log_dev and log_dev_error execution without crashing
    log_dev("TEST_DEV_LOG", {"key": "value", "status": "ok"}, logger_name="ingestion")
    log_dev_error(
        "TEST_DEV_ERROR",
        ValueError("Invalid scraper config"),
        context={"provider": "test"},
        logger_name="ingestion",
    )
