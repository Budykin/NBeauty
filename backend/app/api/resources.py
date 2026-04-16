from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import ResourceCreate, ResourceUpdate, ResourceOut
from common import get_async_session
from common.models import Resource, SalonMember, SalonMemberRole, User


router = APIRouter()


async def _check_salon_admin(session: AsyncSession, user_id: int, salon_id: str) -> None:
    """Проверить, что пользователь — admin данного салона."""

    import uuid
    from sqlalchemy import and_

    salon_uuid = uuid.UUID(salon_id)

    result = await session.execute(
        select(SalonMember).where(
            and_(
                SalonMember.salon_id == salon_uuid,
                SalonMember.user_id == user_id,
                SalonMember.role == SalonMemberRole.ADMIN,
            )
        )
    )

    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только admin салона может управлять ресурсами",
        )


@router.get("/salons/{salon_id}/resources", response_model=List[ResourceOut])
async def get_salon_resources(
    salon_id: str,
    session: AsyncSession = Depends(get_async_session),
):
    """Получить все ресурсы салона."""

    import uuid

    result = await session.execute(
        select(Resource)
        .where(Resource.salon_id == uuid.UUID(salon_id))
        .order_by(Resource.is_active.desc(), Resource.name)
    )
    resources = result.scalars().all()

    return [
        ResourceOut(
            id=r.id,
            salon_id=str(r.salon_id),
            name=r.name,
            is_active=r.is_active,
        )
        for r in resources
    ]


@router.post(
    "/salons/{salon_id}/resources",
    response_model=ResourceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_resource(
    salon_id: str,
    payload: ResourceCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Создать новый ресурс салона. Только для admin."""

    import uuid

    await _check_salon_admin(session, current_user.tg_id, salon_id)

    resource = Resource(
        salon_id=uuid.UUID(salon_id),
        name=payload.name,
        is_active=payload.is_active,
    )
    session.add(resource)
    await session.commit()
    await session.refresh(resource)

    return ResourceOut(
        id=resource.id,
        salon_id=str(resource.salon_id),
        name=resource.name,
        is_active=resource.is_active,
    )


@router.put("/resources/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Обновить ресурс салона. Только для admin."""

    result = await session.execute(
        select(Resource).where(Resource.id == resource_id)
    )
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ресурс не найден",
        )

    await _check_salon_admin(session, current_user.tg_id, str(resource.salon_id))

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(resource, field, value)

    session.add(resource)
    await session.commit()
    await session.refresh(resource)

    return ResourceOut(
        id=resource.id,
        salon_id=str(resource.salon_id),
        name=resource.name,
        is_active=resource.is_active,
    )


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Удалить ресурс салона. Только для admin."""

    result = await session.execute(
        select(Resource).where(Resource.id == resource_id)
    )
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ресурс не найден",
        )

    await _check_salon_admin(session, current_user.tg_id, str(resource.salon_id))

    await session.delete(resource)
    await session.commit()
