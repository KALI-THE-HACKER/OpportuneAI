"""Routes for AI outreach email generation."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ai.agents.outreach_generator import OutreachEmail, generate_outreach_email
from ai.providers.factory import get_llm
from database.models.processed_job import ProcessedJob
from database.models.user import User
from database.session import get_db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/outreach", tags=["outreach"])


class GenerateOutreachRequest(BaseModel):
    job_id: int | str
    contact_name: str | None = None
    contact_role: str | None = None


class GenerateOutreachResponse(BaseModel):
    subject: str
    body: str


@router.post("/generate", response_model=GenerateOutreachResponse)
async def generate_outreach(
    request: GenerateOutreachRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GenerateOutreachResponse:
    """Generate personalized outreach email based on current user profile + job data."""
    # Parse integer ID from "job-123" or 123
    job_id_str = str(request.job_id).replace("job-", "")
    try:
        job_id = int(job_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )

    processed_job = await db.get(ProcessedJob, job_id)
    if not processed_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    try:
        llm = get_llm()
        result: OutreachEmail = await generate_outreach_email(
            llm=llm,
            user=current_user,
            job_title=processed_job.job_title,
            company=processed_job.company,
            job_description=processed_job.job_description,
            job_skills=processed_job.skills,
            contact_name=request.contact_name or processed_job.contact_name,
            contact_role=request.contact_role or processed_job.contact_role,
        )
        return GenerateOutreachResponse(subject=result.subject, body=result.body)
    except Exception as e:
        logger.error("Outreach email generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate outreach email",
        )
