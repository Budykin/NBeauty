from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from .models import LoginSessionStatus, TelegramLoginSession, User


LOGIN_SESSION_TTL_MINUTES = 10
COMPLETED_LOGIN_SESSION_TTL_MINUTES = 2


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_login_session_expired(login_session: TelegramLoginSession) -> bool:
    return login_session.expires_at <= utcnow()


def expire_login_session_if_needed(login_session: TelegramLoginSession) -> bool:
    if login_session.status != LoginSessionStatus.EXPIRED and is_login_session_expired(login_session):
        login_session.status = LoginSessionStatus.EXPIRED
        return True
    return False


async def create_login_session(session: AsyncSession) -> TelegramLoginSession:
    login_session = TelegramLoginSession(
        token=secrets.token_urlsafe(24),
        expires_at=utcnow() + timedelta(minutes=LOGIN_SESSION_TTL_MINUTES),
    )
    session.add(login_session)
    await session.flush()
    return login_session


async def complete_login_session(
    session: AsyncSession,
    login_session: TelegramLoginSession,
    user: User,
) -> TelegramLoginSession:
    login_session.status = LoginSessionStatus.COMPLETED
    login_session.user_id = user.tg_id
    login_session.completed_at = utcnow()
    login_session.expires_at = utcnow() + timedelta(minutes=COMPLETED_LOGIN_SESSION_TTL_MINUTES)
    session.add(login_session)
    await session.flush()
    return login_session
