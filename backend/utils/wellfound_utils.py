import re


def extract_wellfound_job_id(url: str) -> str:
    """Extract numeric/slug job id from Wellfound job link."""
    match = re.search(r"/jobs/(\d+)", url)
    return match.group(1) if match else url
