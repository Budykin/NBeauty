from __future__ import annotations
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from starlette import status

from common.db import get_async_session
from common.models import User, UserRole
from fastapi import APIRouter, Depends, HTTPException

# Импортируем наши новые схемы
from backend.app.schemas.masters import MasterOut, ServiceOut

router = APIRouter()


def map_user_to_master_out(master: User) -> MasterOut:
    """Вспомогательная функция для маппинга модели БД в схему ответа."""
    primary_salon_id = next(
        (str(service.salon_id) for service in master.services if service.salon_id is not None),
        None,
    )
    return MasterOut(
        id=str(master.tg_id),
        name=master.full_name,
        avatar=(master.avatar or master.full_name[:2].upper()),
        specialty=(master.specialty or "Мастер красоты"),
        rating=float(master.rating),
        review_count=master.review_count,
        services=[
            ServiceOut(
                id=str(s.id),
                name=s.name,
                price=s.price,
                duration=s.duration,
                resource_id=str(s.resource_id) if s.resource_id else None
            ) for s in master.services
        ],
        salon_id=primary_salon_id,
    )


@router.get("/", response_model=List[MasterOut])
async def list_masters(session: AsyncSession = Depends(get_async_session)):
    query = (
        select(User)
        .options(selectinload(User.services))
        .where(User.role == UserRole.MASTER)
    )
    result = await session.execute(query)
    masters_db = result.scalars().all()

    return [map_user_to_master_out(m) for m in masters_db]


@router.get("/{master_id}", response_model=MasterOut)
async def get_master_details(master_id: int, session: AsyncSession = Depends(get_async_session)):
    query = (
        select(User)
        .options(selectinload(User.services))
        .where(User.tg_id == master_id, User.role == UserRole.MASTER)
    )
    result = await session.execute(query)
    master = result.scalar_one_or_none()

    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Мастер не найден"
        )

    return map_user_to_master_out(master)
