from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User
from database.repositories.activity_repository import ActivityRepository
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.repositories.user_job_event_repository import UserJobEventRepository
from database.session import get_db
from utils.auth import get_current_user
from workers.behavior_learning_worker import process_user_event
from workers.queue import behavior_learning_queue

router = APIRouter(prefix="/api/v1/events", tags=["events"])

# ---------------------------------------------------------------------------
# Controlled vocabularies (kept here so the frontend contract is stable)
# ---------------------------------------------------------------------------

VALID_EVENT_TYPES = frozenset(
    [
        "impression",
        "click",
        "view",
        "save",
        "unsave",
        "apply",
        "dismiss",
        "not_interested",
    ]
)
VALID_SOURCES = frozenset(
    ["feed", "search", "job_detail", "recommendation", "notification", "other"]
)


class CreateUserJobEventRequest(BaseModel):
    job_id: int
    event_type: str
    source: str
    position: int | None = Field(default=None, ge=0)
    session_id: str | None = None
    metadata: dict[str, Any] | None = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in VALID_EVENT_TYPES:
            raise ValueError(
                f"Unknown event_type '{v}'. Valid: {sorted(VALID_EVENT_TYPES)}"
            )
        return v

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in VALID_SOURCES:
            raise ValueError(f"Unknown source '{v}'. Valid: {sorted(VALID_SOURCES)}")
        return v

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, v: dict | None, info: Any) -> dict | None:
        if v is None:
            return v
        if info.data.get("event_type") == "view":
            duration = v.get("duration_seconds")
            if duration is not None and (
                not isinstance(duration, (int, float)) or duration < 0
            ):
                raise ValueError("duration_seconds must be non-negative")
        return v


SIGNIFICANT_FEED_EVENTS = frozenset(
    ["save", "unsave", "apply", "dismiss", "not_interested"]
)


class UserJobEventResponse(BaseModel):
    accepted: bool = True
    event_type: str
    event_id: int | None = None


@router.post(
    "/jobs",
    response_model=UserJobEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a user–job interaction event",
)
async def create_job_event(
    body: CreateUserJobEventRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserJobEventResponse:
    """Validate event, persist it, and enqueue behavior processing."""
    event_id: int | None = None
    if _user and _user.id:
        job = await ProcessedJobRepository(db).get_by_id_with_raw(body.job_id)
        if not job:
            return UserJobEventResponse(accepted=False, event_type=body.event_type)

        try:
            event = await UserJobEventRepository(db).create(
                user_id=_user.id,
                job_id=body.job_id,
                event_type=body.event_type,
                source=body.source,
                position=body.position,
                session_id=body.session_id,
                metadata=body.metadata,
            )
            event_id = event.id
            behavior_learning_queue.enqueue(
                process_user_event,
                event.id,
                job_timeout=180,
                result_ttl=600,
            )
        except Exception:
            pass

        if body.event_type in SIGNIFICANT_FEED_EVENTS:
            try:
                from services.feed_service import get_redis_client

                redis_client = get_redis_client()
                if body.event_type == "apply":
                    redis_client.sadd(f"user:{_user.id}:applied_jobs", str(body.job_id))
                else:
                    redis_client.delete(f"feed:user:{_user.id}")
            except Exception:
                pass

        if body.event_type in {"save", "apply"}:
            try:
                if job:
                    activity_repo = ActivityRepository(db)
                    if body.event_type == "save":
                        await activity_repo.create_unique_recent(
                            user_id=_user.id,
                            activity_type="save",
                            title=f"Saved job: {job.job_title}",
                            body=f"Saved {job.job_title} at {job.company} to your bookmarked jobs.",
                        )
                    elif body.event_type == "apply":
                        from database.repositories.job_application_repository import (
                            JobApplicationRepository,
                        )

                        app_repo = JobApplicationRepository(db)
                        await app_repo.create_or_update(
                            user_id=_user.id,
                            job_id=body.job_id,
                            status="applied",
                        )
                        await activity_repo.create_unique_recent(
                            user_id=_user.id,
                            activity_type="application",
                            title=f"Applied: {job.job_title}",
                            body=f"Application submitted for {job.job_title} at {job.company}.",
                        )
            except Exception:
                pass

    return UserJobEventResponse(
        accepted=True,
        event_type=body.event_type,
        event_id=event_id,
    )
