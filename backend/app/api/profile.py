from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import MeOut, MeUpdate, BecomeMasterOut
from common import get_async_session
from common.models import User, UserRole
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Обновить профиль текущего пользователя."""

    # Обновляем поля
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return current_user


@router.post("/me/become-master", response_model=BecomeMasterOut)
async def become_master(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Переключить роль пользователя на мастера.

    После этого пользователь видит интерфейс мастера:
    - Dashboard с записями
    - Управление услугами
    - Настройка расписания
    - Управление салоном (если есть)
    """

    if current_user.role == UserRole.MASTER:
        return BecomeMasterOut(
            role="master",
            message="Вы уже мастер",
        )

    current_user.role = UserRole.MASTER
    session.add(current_user)
    await session.commit()

    return BecomeMasterOut(
        role="master",
        message="Теперь вы мастер! Настройте услуги и расписание.",
    )


@router.post("/me/switch-to-client", response_model=BecomeMasterOut)
async def switch_to_client(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Переключить роль обратно на клиента.

    Мастер может переключиться в режим клиента,
    чтобы записаться к другим мастерам.
    """

    if current_user.role == UserRole.CLIENT:
        return BecomeMasterOut(
            role="client",
            message="Вы уже клиент",
        )

    current_user.role = UserRole.CLIENT
    session.add(current_user)
    await session.commit()

    return BecomeMasterOut(
        role="client",
        message="Теперь вы в режиме клиента",
    )
