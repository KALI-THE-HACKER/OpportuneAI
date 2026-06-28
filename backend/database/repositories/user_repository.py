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
