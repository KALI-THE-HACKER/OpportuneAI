from pydantic import BaseModel, Field


class JobExtraction(BaseModel):
    job_title: str
    company: str
    skills: list[str]
    location: str
    salary: str | None = None
    experience_years: int | None
    employment_type: str | None
    job_description: str


class ResumeExtraction(BaseModel):
    """Structured data extracted from a candidate resume."""

    skills: list[str] = Field(
        default_factory=list,
        description="Technical and soft skills found in the resume.",
    )
    experience_level: str = Field(
        default="",
        description="Seniority level: Intern, Junior, Mid, Senior, Staff, Principal, or Executive.",
    )
    years_total: int = Field(
        default=0, description="Total years of professional experience."
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score 0-1 for the quality/completeness of extraction.",
    )
    summary: str = Field(
        default="",
        description="One-paragraph professional summary derived from the resume.",
    )
