from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import validate_telegram_init_data
from backend.app.schemas.auth import AuthResponse, TelegramInitData
from common import get_async_session, settings
from common.models import User, UserRole


router = APIRouter()


def _create_jwt_token(user: User) -> str:
    """Создание JWT-токена для клиента."""

    now = datetime.utcnow()
    payload = {
        "sub": str(user.tg_id),
        "role": user.role.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_in_minutes),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token


@router.post("/telegram", response_model=AuthResponse)
async def telegram_auth(
    body: TelegramInitData,
    session: AsyncSession = Depends(get_async_session),
) -> AuthResponse:
    """Точка входа для авторизации через Telegram initData.

    Фронтенд должен отправлять raw `window.Telegram.WebApp.initData` как `initData`.
    """

    user_data = validate_telegram_init_data(body.init_data)

    tg_id = int(user_data["id"])
    full_name = user_data.get("first_name", "")
    last_name = user_data.get("last_name")
    if last_name:
        full_name = f"{full_name} {last_name}"
    username = user_data.get("username")

    # Ищем пользователя или создаём
    result = await session.execute(select(User).where(User.tg_id == tg_id))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        user = User(
            tg_id=tg_id,
            full_name=full_name or "Неизвестный пользователь",
            username=username,
            role=UserRole.CLIENT,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    token = _create_jwt_token(user)

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.tg_id,
        full_name=user.full_name,
        username=user.username,
        role=user.role.value,
    )

