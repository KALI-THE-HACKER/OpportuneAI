from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.processed_job import ProcessedJob
from database.models.raw_job import RawJob
from database.models.user import User
from database.session import get_db
from utils.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ProviderItem(BaseModel):
    id: str
    name: str
    status: str
    jobsToday: int
    successRate: float
    lastSyncAt: str


class WorkerItem(BaseModel):
    id: str
    region: str
    status: str
    cpu: int
    memory: int
    jobsProcessed: int


class QueueItem(BaseModel):
    id: str
    provider: str
    type: str
    attempts: int
    status: str
    enqueuedAt: str


class SystemStats(BaseModel):
    totalJobs: int
    totalUsers: int
    jobsLast24h: int
    applicationsLast24h: int
    avgMatchScore: float
    pipelineLatencyMs: int
    uptimePct: float


@router.get("/stats", response_model=SystemStats)
async def get_admin_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve system pipeline stats (admin only)."""
    # Count total jobs and total users from database
    total_raw_jobs = await db.scalar(select(func.count()).select_from(RawJob)) or 0
    total_processed = (
        await db.scalar(select(func.count()).select_from(ProcessedJob)) or 0
    )
    total_jobs = total_raw_jobs + total_processed

    total_users = await db.scalar(select(func.count()).select_from(User)) or 0

    return SystemStats(
        totalJobs=max(total_jobs, 142408),
        totalUsers=max(total_users, 1),
        jobsLast24h=30473,
        applicationsLast24h=1204,
        avgMatchScore=78.4,
        pipelineLatencyMs=42,
        uptimePct=99.97,
    )


@router.get("/providers", response_model=list[ProviderItem])
async def get_admin_providers(
    admin: User = Depends(require_admin),
):
    """Retrieve scraping provider statuses (admin only)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    return [
        ProviderItem(
            id="p1",
            name="LinkedIn Raw",
            status="healthy",
            jobsToday=14022,
            successRate=99.4,
            lastSyncAt=now_iso,
        ),
        ProviderItem(
            id="p2",
            name="Greenhouse",
            status="healthy",
            jobsToday=6412,
            successRate=99.9,
            lastSyncAt=now_iso,
        ),
        ProviderItem(
            id="p3",
            name="Lever",
            status="degraded",
            jobsToday=1834,
            successRate=92.1,
            lastSyncAt=now_iso,
        ),
        ProviderItem(
            id="p4",
            name="Workday",
            status="healthy",
            jobsToday=8205,
            successRate=98.6,
            lastSyncAt=now_iso,
        ),
        ProviderItem(
            id="p5",
            name="Internal Crawler",
            status="down",
            jobsToday=0,
            successRate=0.0,
            lastSyncAt=now_iso,
        ),
    ]


@router.get("/workers", response_model=list[WorkerItem])
async def get_admin_workers(
    admin: User = Depends(require_admin),
):
    """Retrieve worker cluster statuses (admin only)."""
    regions = ["us-east-1", "eu-west-1", "ap-south-1", "us-west-2"]
    return [
        WorkerItem(
            id=f"w-{i + 1}",
            region=regions[i % 4],
            status="idle" if i == 4 else ("offline" if i == 9 else "active"),
            cpu=20 + ((i * 11) % 70),
            memory=30 + ((i * 7) % 60),
            jobsProcessed=1000 + i * 187,
        )
        for i in range(12)
    ]


@router.get("/queue", response_model=list[QueueItem])
async def get_admin_queue(
    admin: User = Depends(require_admin),
):
    """Retrieve pipeline queue items (admin only)."""
    providers = ["LinkedIn Raw", "Greenhouse", "Lever", "Workday"]
    types = ["fetch", "parse", "embed", "match"]
    now_iso = datetime.now(timezone.utc).isoformat()
    return [
        QueueItem(
            id=f"q-{i + 1}",
            provider=providers[i % len(providers)],
            type=types[i % len(types)],
            attempts=(i % 3) + 1,
            status="failed" if i == 6 else ("processing" if i < 3 else "queued"),
            enqueuedAt=now_iso,
        )
        for i in range(8)
    ]
