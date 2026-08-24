from pydantic import BaseModel, Field


class JobExtraction(BaseModel):
    data_sufficient: bool = Field(
        default=True,
        description="False if key fields (title, company, job_description) cannot be determined from the input.",
    )
    failure_reason: str | None = Field(
        default=None,
        description="Short human-readable explanation of why data is insufficient. Populate only when data_sufficient=false.",
    )
    job_title: str = Field(default="")
    company: str = Field(default="")
    skills: list[str] = Field(default_factory=list)
    location: str = Field(default="")
    salary: str | None = None
    experience_years: int | None = None
    employment_type: str | None = None
    last_date_to_apply: str | None = Field(
        default=None,
        description="Application deadline or last date to apply if explicitly stated in the job posting (e.g. YYYY-MM-DD or date string). Set to null if not explicitly mentioned.",
    )
    job_description: str = Field(default="")
    apply_url: str | None = Field(
        default=None,
        description="Direct application URL if explicitly present in the posting (e.g. Greenhouse, Lever, Ashby, Workday, company careers link, or Google Form link). Set to null if not explicitly mentioned.",
    )


class ContactInfo(BaseModel):
    """Contact information discovered by the autonomous Contact Finder Agent."""

    name: str | None = Field(default=None, description="Full name of the contact.")
    role: str | None = Field(
        default=None,
        description="Job title or role (e.g. Co-Founder, Head of Talent, Technical Recruiter).",
    )
    email: str | None = Field(
        default=None, description="Best-guess or confirmed contact email address."
    )
    linkedin_url: str | None = Field(
        default=None, description="LinkedIn profile URL of the contact if found."
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score 0-1 for the correctness of the email.",
    )


class ResumeExtraction(BaseModel):
    """Structured data extracted from a candidate resume."""

    skills: list[str] = Field(
        default_factory=list,
        description="High-signal, relevant technical and domain skills strongly evidenced in the resume.",
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
