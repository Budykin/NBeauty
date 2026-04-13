from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import ServiceCreate, ServiceUpdate, ServiceOut
from common import get_async_session
from common.models import Service, User


router = APIRouter()


@router.get("/my", response_model=List[ServiceOut])
async def get_my_services(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Получить все услуги текущего мастера."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(Service)
        .where(Service.master_id == current_user.tg_id)
        .order_by(Service.is_active.desc(), Service.name)
    )
    services = result.scalars().all()

    return [
        ServiceOut(
            id=s.id,
            name=s.name,
            duration=s.duration,
            price=s.price,
            salon_id=str(s.salon_id) if s.salon_id else None,
            resource_id=s.resource_id,
            is_active=s.is_active,
        )
        for s in services
    ]


@router.post("/", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: ServiceCreate,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Создать новую услугу."""

    current_user = await get_current_user(authorization)

    service = Service(
        master_id=current_user.tg_id,
        name=payload.name,
        duration=payload.duration,
        price=payload.price,
        salon_id=payload.salon_id,
        resource_id=payload.resource_id,
    )
    session.add(service)
    await session.commit()
    await session.refresh(service)

    return ServiceOut(
        id=service.id,
        name=service.name,
        duration=service.duration,
        price=service.price,
        salon_id=str(service.salon_id) if service.salon_id else None,
        resource_id=service.resource_id,
        is_active=service.is_active,
    )


@router.put("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: int,
    payload: ServiceUpdate,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Обновить услугу."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(Service).where(
            Service.id == service_id,
            Service.master_id == current_user.tg_id,
        )
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Услуга не найдена",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)

    session.add(service)
    await session.commit()
    await session.refresh(service)

    return ServiceOut(
        id=service.id,
        name=service.name,
        duration=service.duration,
        price=service.price,
        salon_id=str(service.salon_id) if service.salon_id else None,
        resource_id=service.resource_id,
        is_active=service.is_active,
    )


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Удалить услугу."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(Service).where(
            Service.id == service_id,
            Service.master_id == current_user.tg_id,
        )
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Услуга не найдена",
        )

    await session.delete(service)
    await session.commit()
