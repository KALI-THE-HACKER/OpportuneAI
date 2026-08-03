from datetime import datetime
from enum import StrEnum
from typing import Any, Optional

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from database.models.processed_job import ProcessedJob


class ProcessingStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class RawJob(Base):
    __tablename__ = "raw_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    company: Mapped[str] = mapped_column(String(300), index=True)
    date_posted: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    link: Mapped[str] = mapped_column(String(2048))
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ProcessingStatus.PENDING,
        server_default=ProcessingStatus.PENDING,
        index=True,
    )

    processed_job: Mapped[Optional["ProcessedJob"]] = relationship(
        "ProcessedJob",
        back_populates="raw_job",
        uselist=False,
        cascade="all, delete-orphan",
    )
