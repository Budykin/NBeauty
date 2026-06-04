from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User, UserRole
from .phone_numbers import normalize_telephone_number


async def upsert_telegram_user(
    session: AsyncSession,
    *,
    tg_id: int,
    full_name: str,
    username: str | None,
    avatar: str | None = None,
    telephone_number: str | None = None,
) -> User:
    """Создать или обновить пользователя Telegram.

    Пользователь всегда определяется по постоянному tg_id.
    Username может меняться или исчезать, поэтому обновляем его отдельно
    и только если это не нарушает UNIQUE-ограничение.
    """

    result = await session.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()

    safe_username = username
    username_conflict = False
    if username:
        username_result = await session.execute(
            select(User).where(User.username == username, User.tg_id != tg_id)
        )
        if username_result.scalar_one_or_none():
            safe_username = None
            username_conflict = True

    normalized_telephone_number = normalize_telephone_number(telephone_number)

    if user is None:
        user = User(
            tg_id=tg_id,
            full_name=full_name or "Неизвестный пользователь",
            username=safe_username,
            avatar=avatar,
            telephone_number=normalized_telephone_number,
            role=UserRole.CLIENT,
        )
        session.add(user)
        await session.flush()
        return user

    # Важно: если пользователь уже есть в БД, НЕ перетираем его имя данными из Telegram.
    # Пользователь мог изменить full_name в настройках приложения, и это значение — source of truth.
    if not user.full_name or user.full_name == "Неизвестный пользователь":
        user.full_name = full_name or user.full_name
    if username is None:
        user.username = None
    elif not username_conflict:
        user.username = safe_username
    if user.avatar is None and avatar is not None:
        user.avatar = avatar
    if not user.telephone_number and normalized_telephone_number is not None:
        user.telephone_number = normalized_telephone_number

    session.add(user)
    await session.flush()
    return user
