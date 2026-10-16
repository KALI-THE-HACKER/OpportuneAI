from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User
from database.repositories.activity_repository import ActivityRepository
from database.repositories.processed_job_repository import ProcessedJobRepository
from database.repositories.saved_job_repository import SavedJobRepository
from database.session import get_db
from routes.feed import JobCardSchema
from services.feed_service import FeedService
from utils.auth import get_current_user

router = APIRouter(prefix="/api/saved", tags=["saved"])


class ToggleSavedResponse(BaseModel):
    saved: bool


@router.get("", response_model=list[JobCardSchema])
async def list_saved_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[JobCardSchema]:
    repo = SavedJobRepository(db)
    items = await repo.list_by_user(user.id)
    cards: list[JobCardSchema] = []
    for item in items:
        if item.job is None:
            continue
        cards.append(
            JobCardSchema(
                **FeedService.format_job_card(item.job, user=user, is_saved=True)
            )
        )
    return cards


@router.post("/{job_id}", response_model=ToggleSavedResponse)
async def toggle_saved_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ToggleSavedResponse:
    try:
        numeric_job_id = int(job_id.replace("job-", ""))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid job_id format: '{job_id}'",
        ) from exc

    job = await ProcessedJobRepository(db).get_by_id_with_raw(numeric_job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {numeric_job_id} not found",
        )

    repo = SavedJobRepository(db)
    currently_saved = await repo.is_saved(user.id, numeric_job_id)

    if currently_saved:
        await repo.unsave(user.id, numeric_job_id)
    else:
        await repo.save(user.id, numeric_job_id)

    # Invalidate feed for reranking responsiveness
    FeedService(db).invalidate_feed(user.id)

    try:
        activity_repo = ActivityRepository(db)
        if currently_saved:
            await activity_repo.create_unique_recent(
                user_id=user.id,
                activity_type="save",
                title=f"Removed saved job: {job.job_title}",
                body=f"Removed {job.job_title} at {job.company} from saved jobs.",
            )
        else:
            await activity_repo.create_unique_recent(
                user_id=user.id,
                activity_type="save",
                title=f"Saved job: {job.job_title}",
                body=f"Saved {job.job_title} at {job.company} to your bookmarked jobs.",
            )
    except Exception:
        pass

    return ToggleSavedResponse(saved=not currently_saved)
