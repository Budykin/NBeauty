from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User, UserRole


async def upsert_telegram_user(
    session: AsyncSession,
    *,
    tg_id: int,
    full_name: str,
    username: str | None,
) -> User:
    """Создать или обновить пользователя Telegram.

    Username в Telegram может меняться и должен оставаться уникальным в БД,
    поэтому при конфликте не перезаписываем его чужим значением.
    """

    result = await session.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()

    safe_username = username
    if username:
        username_result = await session.execute(
            select(User).where(User.username == username, User.tg_id != tg_id)
        )
        if username_result.scalar_one_or_none():
            safe_username = None

    if user is None:
        user = User(
            tg_id=tg_id,
            full_name=full_name or "Неизвестный пользователь",
            username=safe_username,
            role=UserRole.CLIENT,
        )
        session.add(user)
        await session.flush()
        return user

    user.full_name = full_name or user.full_name
    if safe_username is not None:
        user.username = safe_username

    session.add(user)
    await session.flush()
    return user
