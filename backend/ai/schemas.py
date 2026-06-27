from pydantic import BaseModel
from typing import Optional


class JobExtraction(BaseModel):
    job_title: str
    company: str
    skills: list[str]
    location: str
    salary: Optional[str] = None
    experience_years: Optional[int] | None
    employment_type: str | None
    job_description: str
