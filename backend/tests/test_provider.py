import pytest

from providers.linkedin_provider import LinkedInProvider
from providers.naukri_provider import NaukriProvider
from providers.remoteOK_provider import RemoteOKProvider
from providers.wellfound_provider import WellfoundProvider


@pytest.mark.anyio
async def test_all_providers():
    jobs_length = 0

    providers = [
        LinkedInProvider(),
        WellfoundProvider(),
        RemoteOKProvider(),
        NaukriProvider(),
    ]

    for provider in providers:
        print(f"\nFetching jobs from {provider.__class__.__name__}...")

        jobs = await provider.fetch_jobs()

        print(f"Fetched {len(jobs)} jobs")

        jobs_length += len(jobs)

    assert jobs_length > 0, "No jobs were fetched from any provider."
