from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        """Retrieve a user by their local database ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_auth0_sub(self, auth0_sub: str) -> User | None:
        """Retrieve a user by their Auth0 subject ID (e.g. auth0|123)."""
        result = await self.db.execute(select(User).where(User.auth0_sub == auth0_sub))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Retrieve a user by their email address."""
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        auth0_sub: str,
        email: str,
        name: str | None = None,
        avatar_url: str | None = None,
        email_verified: bool = False,
    ) -> User:
        """Create a new user in the database."""
        user = User(
            auth0_sub=auth0_sub,
            email=email,
            name=name,
            avatar_url=avatar_url,
            email_verified=email_verified,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        """Update a user's details."""
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_resume(
        self,
        user: User,
        file_name: str,
        storage_key: str,
        size_kb: int,
        resume_text: str,
        status: str = "processing",
    ) -> User:
        """Persist raw resume metadata and text; set status to processing."""
        from datetime import datetime, timezone

        user.resume_file_name = file_name
        user.resume_storage_key = storage_key
        user.resume_size_kb = size_kb
        user.resume_text = resume_text
        user.resume_uploaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        user.resume_status = status
        # Clear previously extracted fields until new parse completes
        user.resume_extracted_skills = []
        user.resume_experience_level = None
        user.resume_years_total = None
        user.resume_confidence = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def save_resume_extraction(
        self,
        user: User,
        extracted_skills: list[str],
        experience_level: str | None,
        years_total: int | None,
        confidence: float | None,
        status: str = "processed",
    ) -> User:
        """Store AI-extracted resume fields and merge skills into user profile."""
        user.resume_extracted_skills = extracted_skills
        user.resume_experience_level = experience_level
        user.resume_years_total = years_total
        user.resume_confidence = confidence
        user.resume_status = status

        # Merge extracted skills into user's profile skills (deduplicated, case-insensitive)
        existing_lower = {s.lower() for s in (user.skills or [])}
        merged = list(user.skills or [])
        for skill in extracted_skills:
            if skill.lower() not in existing_lower:
                merged.append(skill)
                existing_lower.add(skill.lower())
        user.skills = merged

        if years_total is not None and user.years_of_experience == 0:
            user.years_of_experience = years_total

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def clear_resume(self, user: User) -> User:
        """Remove all resume fields from a user."""
        user.resume_file_name = None
        user.resume_storage_key = None
        user.resume_size_kb = None
        user.resume_uploaded_at = None
        user.resume_status = None
        user.resume_text = None
        user.resume_extracted_skills = []
        user.resume_experience_level = None
        user.resume_years_total = None
        user.resume_confidence = None
        await self.db.commit()
        await self.db.refresh(user)
        return user
