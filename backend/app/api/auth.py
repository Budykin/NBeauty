from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import create_access_token, validate_telegram_init_data
from backend.app.schemas.auth import (
    AuthResponse,
    LoginSessionResponse,
    LoginSessionStatusResponse,
    TelegramInitData,
)
from common import get_async_session, settings
from common.login_sessions import create_login_session, expire_login_session_if_needed
from common.models import LoginSessionStatus, TelegramLoginSession, User
from common.telegram_users import upsert_telegram_user


router = APIRouter()


def _build_auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user),
        token_type="bearer",
        user_id=user.tg_id,
        full_name=user.full_name,
        username=user.username,
        role=user.role,
    )


def _build_telegram_login_link(token: str) -> str:
    base = settings.telegram_bot_url.rstrip("/")
    return f"{base}?start=login_{quote(token)}"


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

    user = await upsert_telegram_user(
        session,
        tg_id=tg_id,
        full_name=full_name,
        username=username,
    )
    await session.commit()
    await session.refresh(user)

    return _build_auth_response(user)


@router.post("/telegram/login-session", response_model=LoginSessionResponse)
async def create_telegram_login_session(
    session: AsyncSession = Depends(get_async_session),
) -> LoginSessionResponse:
    login_session = await create_login_session(session)
    await session.commit()

    return LoginSessionResponse(
        token=login_session.token,
        status=login_session.status,
        expires_at=login_session.expires_at,
        bot_link=_build_telegram_login_link(login_session.token),
    )


@router.get("/telegram/login-session/{token}", response_model=LoginSessionStatusResponse)
async def get_telegram_login_session(
    token: str,
    session: AsyncSession = Depends(get_async_session),
) -> LoginSessionStatusResponse:
    result = await session.execute(
        select(TelegramLoginSession).where(TelegramLoginSession.token == token)
    )
    login_session = result.scalar_one_or_none()

    if login_session is None:
        raise HTTPException(status_code=404, detail="Login session not found")

    if expire_login_session_if_needed(login_session):
        await session.commit()

    auth_response: AuthResponse | None = None
    if login_session.status == LoginSessionStatus.COMPLETED:
        if login_session.user_id is None:
            raise HTTPException(status_code=500, detail="Completed session has no user")

        user_result = await session.execute(select(User).where(User.tg_id == login_session.user_id))
        user = user_result.scalar_one_or_none()

        if user is None:
            raise HTTPException(status_code=404, detail="Authorized user not found")

        auth_response = _build_auth_response(user)

    return LoginSessionStatusResponse(
        status=login_session.status,
        expires_at=login_session.expires_at,
        bot_link=_build_telegram_login_link(login_session.token),
        auth=auth_response,
    )
