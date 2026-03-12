from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from common.db import get_async_session
from common.models import Salon, SalonMember
from backend.app.schemas.salons import SalonOut, SalonMemberOut, ResourceOut

router = APIRouter()


@router.get("/", response_model=List[SalonOut])
async def list_salons(session: AsyncSession = Depends(get_async_session)):
    """Получить список салонов с их ресурсами и участниками из БД."""

    # Жадная загрузка: тянем салон, его ресурсы и участников (вместе с данными юзеров)
    query = (
        select(Salon)
        .options(
            selectinload(Salon.resources),
            selectinload(Salon.members).joinedload(SalonMember.user)
        )
    )

    result = await session.execute(query)
    salons_db = result.scalars().all()

    response = []
    for s in salons_db:
        # 1. Собираем ресурсы (кабинеты)
        resources_list = [
            ResourceOut(
                id=str(r.id),
                name=r.name,
                salon_id=str(s.id),
                is_active=r.is_active
            ) for r in s.resources
        ]

        # 2. Собираем участников (мастеров)
        members_list = [
            SalonMemberOut(
                id=str(m.id),
                master_id=str(m.user.tg_id),
                master_name=m.user.full_name,
                master_avatar=m.user.full_name[:2].upper(),
                role=m.role.value,
                joined_at=m.created_at.strftime("%Y-%m-%d") if m.created_at else ""
            ) for m in s.members
        ]

        # 3. Собираем итоговый объект салона
        response.append(SalonOut(
            id=str(s.id),
            name=s.name,
            owner_id=str(s.owner_id),
            invite_code=s.invite_code,
            members=members_list,
            resources=resources_list
        ))

    return response