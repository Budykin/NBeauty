from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import SalonCreate, SalonJoin
from backend.app.schemas.salons import SalonOut, SalonMemberOut, ResourceOut
from common import get_async_session
from common.models import Salon, SalonMember, SalonMemberRole, User


router = APIRouter()


@router.post("/create", response_model=SalonOut, status_code=status.HTTP_201_CREATED)
async def create_salon(
    payload: SalonCreate,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Создать новый салон. Создатель автоматически становится admin."""

    current_user = await get_current_user(authorization)

    # Создаём салон
    salon = Salon(
        name=payload.name,
        owner_id=current_user.tg_id,
    )
    session.add(salon)
    await session.flush()  # Получаем ID салона

    # Добавляем создателя как admin салона
    member = SalonMember(
        salon_id=salon.id,
        user_id=current_user.tg_id,
        role=SalonMemberRole.ADMIN,
    )
    session.add(member)
    await session.commit()
    await session.refresh(salon)

    # Возвращаем с данными участников
    return SalonOut(
        id=str(salon.id),
        name=salon.name,
        owner_id=str(salon.owner_id),
        invite_code=salon.invite_code,
        members=[
            SalonMemberOut(
                id=str(member.id),
                master_id=str(current_user.tg_id),
                master_name=current_user.full_name,
                master_avatar=current_user.full_name[:2].upper(),
                role=member.role.value,
                joined_at=member.created_at.strftime("%Y-%m-%d"),
            )
        ],
        resources=[],
    )


@router.post("/join", response_model=SalonOut)
async def join_salon(
    payload: SalonJoin,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Вступить в салон по коду приглашения."""

    current_user = await get_current_user(authorization)

    # Ищем салон по коду
    result = await session.execute(
        select(Salon)
        .options(
            selectinload(Salon.members).joinedload(SalonMember.user),
            selectinload(Salon.resources),
        )
        .where(Salon.invite_code == payload.invite_code)
    )
    salon = result.scalar_one_or_none()

    if not salon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Салон с таким кодом приглашения не найден",
        )

    # Проверяем, не состоит ли уже пользователь
    existing = await session.execute(
        select(SalonMember).where(
            SalonMember.salon_id == salon.id,
            SalonMember.user_id == current_user.tg_id,
        )
    )

    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вы уже состоите в этом салоне",
        )

    # Добавляем как master
    member = SalonMember(
        salon_id=salon.id,
        user_id=current_user.tg_id,
        role=SalonMemberRole.MASTER,
    )
    session.add(member)
    await session.commit()

    # Собираем ответ
    resources_list = [
        ResourceOut(
            id=str(r.id),
            name=r.name,
            salon_id=str(salon.id),
            is_active=r.is_active,
        ) for r in salon.resources
    ]

    members_list = [
        SalonMemberOut(
            id=str(m.id),
            master_id=str(m.user.tg_id),
            master_name=m.user.full_name,
            master_avatar=m.user.full_name[:2].upper(),
            role=m.role.value,
            joined_at=m.created_at.strftime("%Y-%m-%d"),
        ) for m in salon.members + [member]
    ]

    return SalonOut(
        id=str(salon.id),
        name=salon.name,
        owner_id=str(salon.owner_id),
        invite_code=salon.invite_code,
        members=members_list,
        resources=resources_list,
    )


@router.get("/my", response_model=List[SalonOut])
async def get_my_salons(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Получить все салоны, где состоит текущий пользователь."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(Salon)
        .options(
            selectinload(Salon.members).joinedload(SalonMember.user),
            selectinload(Salon.resources),
        )
        .join(SalonMember)
        .where(SalonMember.user_id == current_user.tg_id)
    )
    salons = result.scalars().all()

    response = []
    for s in salons:
        resources_list = [
            ResourceOut(
                id=str(r.id),
                name=r.name,
                salon_id=str(s.id),
                is_active=r.is_active,
            ) for r in s.resources
        ]

        members_list = [
            SalonMemberOut(
                id=str(m.id),
                master_id=str(m.user.tg_id),
                master_name=m.user.full_name,
                master_avatar=m.user.full_name[:2].upper(),
                role=m.role.value,
                joined_at=m.created_at.strftime("%Y-%m-%d"),
            ) for m in s.members
        ]

        response.append(SalonOut(
            id=str(s.id),
            name=s.name,
            owner_id=str(s.owner_id),
            invite_code=s.invite_code,
            members=members_list,
            resources=resources_list,
        ))

    return response
