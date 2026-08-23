from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User
from database.repositories.activity_repository import ActivityRepository
from database.session import get_db
from utils.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat().replace("+00:00", "Z")


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: str
    createdAt: str
    read: bool


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    """List recent activity and notifications for the authenticated user."""
    repo = ActivityRepository(db)
    activities = await repo.list_by_user(user.id, limit=50)

    if not activities:
        welcome = await repo.create(
            user_id=user.id,
            activity_type="system",
            title="Welcome to OpportuneAI",
            body="Personalized job discovery and match scoring are ready.",
            read=False,
        )
        activities = [welcome]

    return [
        NotificationResponse(
            id=str(a.id),
            type=a.activity_type,
            title=a.title,
            body=a.body,
            createdAt=_to_iso(a.created_at),
            read=a.read,
        )
        for a in activities
    ]


@router.post("/{activity_id}/read")
async def mark_notification_read(
    activity_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Mark a specific notification/activity item as read."""
    repo = ActivityRepository(db)
    try:
        numeric_id = int(activity_id.replace("act-", "").replace("n-", ""))
    except ValueError:
        return {"success": False}

    success = await repo.mark_read(user.id, numeric_id)
    return {"success": success}


@router.post("/read-all")
async def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Mark all notifications for the authenticated user as read."""
    repo = ActivityRepository(db)
    count = await repo.mark_all_read(user.id)
    return {"updated": count}
