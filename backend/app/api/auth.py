from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from urllib.parse import parse_qsl

import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.schemas.auth import AuthResponse, TelegramInitData
from common import get_async_session, settings
from common.models import User, UserRole


router = APIRouter()


def _check_telegram_auth(init_data: str, bot_token: str) -> Dict[str, Any]:
    """Проверка подписи initData по алгоритму Telegram.

    Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    """

    # Разбираем query-string формат
    data_pairs = parse_qsl(init_data, keep_blank_values=True)
    data: Dict[str, str] = {k: v for k, v in data_pairs}

    hash_from_telegram = data.pop("hash", None)
    if not hash_from_telegram:
        raise HTTPException(status_code=400, detail="Missing hash in initData")

    # Строка данных в формате "key=value" по алфавиту ключей
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.items(), key=lambda x: x[0])
    )

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    hmac_string = hmac.new(
        secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(hmac_string, hash_from_telegram):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    # Дополнительно можно проверять срок жизни auth_date
    auth_date_str = data.get("auth_date")
    if auth_date_str is not None:
        try:
            auth_ts = int(auth_date_str)
            auth_dt = datetime.fromtimestamp(auth_ts, tz=timezone.utc)
            if datetime.now(tz=timezone.utc) - auth_dt > timedelta(days=1):
                raise HTTPException(status_code=401, detail="initData has expired")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid auth_date")

    # user приходит как JSON-объект в строке
    user_json = data.get("user")
    if not user_json:
        raise HTTPException(status_code=400, detail="Missing user field in initData")

    try:
        user_data = json.loads(user_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid user JSON in initData")

    return user_data


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

    user_data = _check_telegram_auth(body.init_data, settings.bot_token)

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

