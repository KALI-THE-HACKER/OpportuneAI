from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.session import get_db
from services.feed_service import FeedService
from utils.auth import get_current_user

router = APIRouter(tags=["feed"])


class JobCardSchema(BaseModel):
    id: str
    title: str
    company: str
    companyLogo: str | None = None
    location: str
    workMode: str
    type: str
    salaryMin: int
    salaryMax: int
    currency: str
    postedAt: str
    description: str
    responsibilities: list[str] = []
    requirements: list[str] = []
    skills: list[str] = []
    matchScore: int = 50
    missingSkills: list[str] = []
    matchedSkills: list[str] = []
    experienceLevel: str = "Mid"
    saved: bool = False
    link: str | None = None
    lastDateToApply: str | None = None


class FeedResponseSchema(BaseModel):
    items: list[JobCardSchema]
    next_cursor: str | None = None
    total: int


@router.get("/api/feed", response_model=FeedResponseSchema)
async def get_feed(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponseSchema:
    """Retrieve the personalized, cached feed of job recommendations for the user."""
    feed_service = FeedService(db)
    feed_data = await feed_service.get_feed(user=user, limit=limit, cursor=cursor)
    return FeedResponseSchema(**feed_data)


@router.get("/api/jobs/{job_id}", response_model=JobCardSchema)
async def get_job_detail(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobCardSchema:
    """Retrieve detailed information for a single job."""
    try:
        numeric_id = int(job_id.replace("job-", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job ID format: '{job_id}'",
        )

    repo = ProcessedJobRepository(db)
    job = await repo.get_by_id_with_raw(numeric_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    job_card = FeedService.format_job_card(job, user=user)
    return JobCardSchema(**job_card)
