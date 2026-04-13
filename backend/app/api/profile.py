from __future__ import annotations

from fastapi import APIRouter, Depends, Header

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import MeOut, MeUpdate
from common import get_async_session
from common.models import User
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter()


@router.get("/me", response_model=MeOut)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Получить текущего пользователя."""

    return current_user


@router.put("/me", response_model=MeOut)
async def update_me(
    payload: MeUpdate,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Обновить профиль текущего пользователя."""

    from backend.app.core.auth import get_current_user as _get_user

    current_user = await _get_user(authorization)

    # Обновляем поля
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return current_user
