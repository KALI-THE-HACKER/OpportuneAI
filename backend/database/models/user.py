from datetime import datetime
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base

if TYPE_CHECKING:
    from database.models.activity import UserActivity


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    auth0_sub: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Role ('admin' or 'user')
    role: Mapped[str] = mapped_column(
        String(50), default="user", server_default="user", nullable=False
    )

    # Profile fields matching frontend UserProfile
    title: Mapped[str] = mapped_column(String(255), default="", server_default="")
    location: Mapped[str] = mapped_column(String(255), default="", server_default="")
    bio: Mapped[str] = mapped_column(String(1000), default="", server_default="")
    years_of_experience: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
    preferred_roles: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    preferred_locations: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    work_modes: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    min_salary: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Preference Embedding fields for Hybrid Recommendation
    preference_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(768), nullable=True
    )
    preference_embedding_model: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    # Resume fields
    resume_file_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resume_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    resume_size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resume_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resume_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # processing | processed | failed
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_extracted_skills: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    resume_experience_level: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    resume_years_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resume_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Email verification state from Auth0
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    activities: Mapped[list["UserActivity"]] = relationship(
        "UserActivity",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
