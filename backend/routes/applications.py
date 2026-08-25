from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User
from database.repositories.activity_repository import ActivityRepository
from database.repositories.job_application_repository import JobApplicationRepository
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.session import get_db
from routes.feed import JobCardSchema
from services.feed_service import FeedService, get_redis_client
from utils.auth import get_current_user

router = APIRouter(prefix="/api/applications", tags=["applications"])

VALID_APPLICATION_STATUSES = frozenset(
    ["applied", "interviewing", "offer", "rejected", "withdrawn"]
)


class ApplicationResponse(BaseModel):
    id: str
    jobId: str
    status: str
    appliedAt: str
    lastUpdate: str
    notes: str | None = None
    job: JobCardSchema


class CreateApplicationRequest(BaseModel):
    job_id: int | str
    status: str = "applied"
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_APPLICATION_STATUSES:
            raise ValueError(
                f"Unknown status '{v}'. Valid: {sorted(VALID_APPLICATION_STATUSES)}"
            )
        return v


class UpdateApplicationRequest(BaseModel):
    status: str | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_APPLICATION_STATUSES:
            raise ValueError(
                f"Unknown status '{v}'. Valid: {sorted(VALID_APPLICATION_STATUSES)}"
            )
        return v


def _format_application(
    app: Any, user: User | None = None
) -> ApplicationResponse | None:
    if not app.job:
        return None

    job_card_data = FeedService.format_job_card(app.job, user=user, is_applied=True)
    job_card = JobCardSchema(**job_card_data)

    return ApplicationResponse(
        id=f"app-{app.id}",
        jobId=f"job-{app.job_id}",
        status=app.status,
        appliedAt=app.applied_at.isoformat() + "Z"
        if not app.applied_at.isoformat().endswith("Z")
        else app.applied_at.isoformat(),
        lastUpdate=app.updated_at.isoformat() + "Z"
        if not app.updated_at.isoformat().endswith("Z")
        else app.updated_at.isoformat(),
        notes=app.notes,
        job=job_card,
    )


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApplicationResponse]:
    """List all real job applications submitted by the current user."""
    repo = JobApplicationRepository(db)
    apps = await repo.list_by_user(user_id=user.id, status=status_filter)

    formatted: list[ApplicationResponse] = []
    for app in apps:
        formatted_app = _format_application(app, user=user)
        if formatted_app:
            formatted.append(formatted_app)

    return formatted


@router.post(
    "",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_application(
    body: CreateApplicationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicationResponse:
    """Create or update a job application record for the current user."""
    try:
        numeric_job_id = (
            int(body.job_id.replace("job-", ""))
            if isinstance(body.job_id, str)
            else int(body.job_id)
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job_id format: '{body.job_id}'",
        )

    # Verify job exists
    job = await ProcessedJobRepository(db).get_by_id_with_raw(numeric_job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {numeric_job_id} not found",
        )

    repo = JobApplicationRepository(db)
    app = await repo.create_or_update(
        user_id=user.id,
        job_id=numeric_job_id,
        status=body.status,
        notes=body.notes,
    )

    # Update Redis applied set (do NOT delete feed cache to prevent heavy re-ranking)
    try:
        redis_client = get_redis_client()
        redis_client.sadd(f"user:{user.id}:applied_jobs", str(numeric_job_id))
    except Exception:
        pass

    # Create user activity
    try:
        activity_repo = ActivityRepository(db)
        await activity_repo.create_unique_recent(
            user_id=user.id,
            activity_type="application",
            title=f"Applied: {job.job_title}",
            body=f"Application submitted for {job.job_title} at {job.company}.",
        )
    except Exception:
        pass

    formatted = _format_application(app, user=user)
    if not formatted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to format created application",
        )
    return formatted


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: str,
    body: UpdateApplicationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicationResponse:
    """Update status or notes for an existing job application."""
    try:
        numeric_app_id = int(application_id.replace("app-", ""))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid application_id format: '{application_id}'",
        )

    repo = JobApplicationRepository(db)
    app = await repo.update_status_or_notes(
        application_id=numeric_app_id,
        user_id=user.id,
        status=body.status,
        notes=body.notes,
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    formatted = _format_application(app, user=user)
    if not formatted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to format updated application",
        )
    return formatted


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete / withdraw a job application."""
    try:
        numeric_app_id = int(application_id.replace("app-", ""))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid application_id format: '{application_id}'",
        )

    repo = JobApplicationRepository(db)
    app = await repo.get_by_id(numeric_app_id, user.id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    job_id = app.job_id
    success = await repo.delete(numeric_app_id, user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    # Invalidate feed cache and remove from Redis set if needed
    try:
        redis_client = get_redis_client()
        redis_client.delete(f"feed:user:{user.id}")
        redis_client.srem(f"user:{user.id}:applied_jobs", str(job_id))
    except Exception:
        pass
