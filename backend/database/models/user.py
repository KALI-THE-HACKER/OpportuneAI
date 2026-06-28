from datetime import datetime
from sqlalchemy import JSON, DateTime, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


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

    # Email verification state from Auth0
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
