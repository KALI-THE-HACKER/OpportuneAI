import os
import sys

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from config.settings import settings

connect_args = {}
if (
    "supabase" in settings.database_url
    or ":6543" in settings.database_url
    or "pooler" in settings.database_url
):
    connect_args["statement_cache_size"] = 0

is_testing = "pytest" in sys.modules or os.getenv("TESTING") == "1"

if is_testing:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        poolclass=NullPool,
        connect_args=connect_args,
    )
else:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
