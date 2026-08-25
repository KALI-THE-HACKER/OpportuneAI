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
is_pooler = (
    "supabase" in settings.database_url
    or ":6543" in settings.database_url
    or "pooler" in settings.database_url
)

if is_testing or is_pooler:
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
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
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
