from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class CompanyContact(Base):
    """Cache table storing discovered HR / Founder contacts per company.

    Avoids re-running the expensive Contact Finder Agent for multiple jobs from
    the same company by persisting the best known contact.
    """

    __tablename__ = "company_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Normalized lowercase company name used as lookup key
    company_key: Mapped[str] = mapped_column(
        String(300), nullable=False, unique=True, index=True
    )
    company_name: Mapped[str] = mapped_column(String(300), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(253), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_role: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
