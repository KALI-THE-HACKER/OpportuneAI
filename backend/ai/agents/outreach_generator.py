"""AI Outreach Generator service.

Generates concise, highly personalized cold outreach emails combining user profile data
(skills, experience, current role, resume highlights) and job description details
(company, job title, required skills, key responsibilities).
"""

import logging

from pydantic import BaseModel, Field

from ai.providers.base import BaseLLM
from database.models.user import User

logger = logging.getLogger(__name__)


class OutreachEmail(BaseModel):
    subject: str = Field(
        description="Compelling, concise email subject line referencing the specific role and applicant strength."
    )
    body: str = Field(
        description="Personalized cold outreach email body (100-160 words max). Concise, professional, highlights 2-3 specific matching skills/experiences and value proposition."
    )


_OUTREACH_PROMPT_SYSTEM = (
    "You are an expert career advisor and cold outreach specialist. "
    "Write a high-converting, professional, yet authentic cold outreach email for a candidate "
    "reaching out directly to a hiring manager, founder, or recruiter.\n\n"
    "Guidelines:\n"
    "- Keep it concise (100-160 words max). Busy leaders appreciate brevity.\n"
    "- First sentence: State clearly who the candidate is and the specific role they are applying for.\n"
    "- Middle paragraph: Highlight 2-3 specific technical skills or domain experiences from the candidate's profile "
    "that directly solve problems mentioned in the job description.\n"
    "- Closing: Friendly call to action proposing a brief 10-15 minute sync or review of resume/portfolio.\n"
    "- Tone: Confident, polite, proactive, no cheesy flattery or buzzword stuffing.\n"
    "- Output ONLY structured JSON conforming to the schema."
)


async def generate_outreach_email(
    llm: BaseLLM,
    user: User | None,
    job_title: str,
    company: str,
    job_description: str,
    job_skills: list[str] | None = None,
    contact_name: str | None = None,
    contact_role: str | None = None,
) -> OutreachEmail:
    """Generate personalized cold outreach email using user profile and job info."""
    from langchain_core.messages import HumanMessage, SystemMessage

    user_name = user.name if user and user.name else "Candidate"
    user_skills = (
        ", ".join(user.skills)
        if user and user.skills
        else "Software Engineering proficiencies"
    )
    user_roles = (
        ", ".join(user.preferred_roles) if user and user.preferred_roles else job_title
    )
    user_exp = (
        user.experience_level if user and user.experience_level else "Experienced"
    )
    user_bio = user.bio if user and user.bio else ""

    contact_target = (
        f"{contact_name} ({contact_role})"
        if contact_name and contact_role
        else (contact_name or contact_role or "Hiring Team")
    )

    human_prompt = f"""
Candidate Info:
- Name: {user_name}
- Experience Level: {user_exp}
- Skills: {user_skills}
- Target Roles: {user_roles}
- Bio/Background: {user_bio or "N/A"}

Job Posting Info:
- Target Contact: {contact_target}
- Target Role: {job_title}
- Company: {company}
- Key Skills Needed: {", ".join(job_skills) if job_skills else "N/A"}
- Job Description Summary:
{job_description[:1200]}

Generate a high-impact personalized outreach email for {user_name} to send to {contact_target} at {company}.
"""

    messages = [
        SystemMessage(content=_OUTREACH_PROMPT_SYSTEM),
        HumanMessage(content=human_prompt),
    ]

    outreach: OutreachEmail = await llm.invoke(
        messages=messages,
        output_schema=OutreachEmail,
    )
    return outreach
