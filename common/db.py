from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import settings


def _make_async_engine() -> AsyncEngine:
    """Создать AsyncEngine для PostgreSQL.

    Ожидается, что DATABASE_URL будет в async-формате, например:
    postgres+asyncpg://user:password@host:port/dbname
    """

    return create_async_engine(
        str(settings.database_url),
        echo=False,
        future=True,
    )


async_engine: AsyncEngine = _make_async_engine()

async_session_factory = async_sessionmaker(
    bind=async_engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Зависимость FastAPI / провайдер для aiogram-хендлеров."""

    async with async_session_factory() as session:
        yield session

