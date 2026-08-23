from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base

if TYPE_CHECKING:
    from database.models.raw_job import RawJob


class ProcessedJob(Base):
    __tablename__ = "processed_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    raw_job_id: Mapped[int] = mapped_column(
        ForeignKey("raw_jobs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    job_title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    skills: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    location: Mapped[str] = mapped_column(String(300), nullable=False)
    salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_date_to_apply: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    raw_job: Mapped["RawJob"] = relationship("RawJob", back_populates="processed_job")
