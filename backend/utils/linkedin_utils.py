"""
This file will contain utilities for LinkedIn Provider.
"""

from urllib.parse import urlparse, urlunparse


def extract_external_id(job_url: str) -> str:
    """
    Example job_url:  https://in.linkedin.com/jobs/view/software-engineer-intern-at-anakin-yc-s21-4416159817?position=4&pageNum=0&refId=ZFYkaHjh4%2FcV%2B9dcqLfBAA%3D%3D&trackingId=CYfFQkELORlWSZuDYSINoA%3D%3D

    external_id to be extracted = 4416159817
    """
    path = urlparse(job_url).path
    segments = [segment for segment in path.split("/") if segment]

    for segment in reversed(segments):
        parts = segment.split("-")

        for part in reversed(parts):
            if part.isdigit():
                return part

    return None  # Return None in case of no ID extracted


def format_job_url(job_url: str) -> str:
    """
    Remove query parameters and fragments from a job URL.

    Example:
        Input:
        https://in.linkedin.com/jobs/view/software-engineer-intern-at-anakin-yc-s21-4416159817?position=4&pageNum=0&trackingId=abc

        Output:
        https://in.linkedin.com/jobs/view/software-engineer-intern-at-anakin-yc-s21-4416159817
    """
    parsed = urlparse(job_url)

    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            "",  # params
            "",  # query
            "",  # fragment
        )
    )
