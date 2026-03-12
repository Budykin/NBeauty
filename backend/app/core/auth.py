from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from urllib.parse import parse_qsl

import jwt
from fastapi import HTTPException

from common import settings
from common.models import User


def validate_telegram_init_data(init_data: str) -> Dict[str, Any]:
    """Проверка подписи initData, полученного из Telegram WebApp.

    Ожидается raw-строка из window.Telegram.WebApp.initData.
    Алгоритм реализован по официальной документации:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    """

    # Разбираем query-string формат в словарь
    data_pairs = parse_qsl(init_data, keep_blank_values=True)
    data: Dict[str, str] = {k: v for k, v in data_pairs}

    hash_from_telegram = data.pop("hash", None)
    if not hash_from_telegram:
        raise HTTPException(status_code=400, detail="Missing hash in initData")

    # Строка данных в формате "key=value" по алфавиту ключей
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.items(), key=lambda x: x[0])
    )

    secret_key = hashlib.sha256(settings.bot_token.encode()).digest()
    hmac_string = hmac.new(
        secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(hmac_string, hash_from_telegram):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    # Дополнительно проверяем срок жизни auth_date
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


def create_access_token(user: User) -> str:
    """Создать JWT access-токен для пользователя."""

    now = datetime.utcnow()
    payload = {
        "sub": str(user.tg_id),
        "role": user.role.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_in_minutes),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token

