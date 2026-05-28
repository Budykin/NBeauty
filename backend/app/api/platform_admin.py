from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user, require_platform_admin
from backend.app.schemas.common import AppointmentOut, ResourceOut, ReviewOut, ServiceOut
from backend.app.schemas.platform_admin import (
    AdminAnalyticsOut,
    AdminSalonOut,
    AdminUserOut,
    ConfirmDelete,
    DeleteImpactOut,
    PlatformAdminMeOut,
)
from common.appointments import auto_complete_due_appointments
from common import get_async_session
from common.models import (
    Appointment,
    AppointmentStatus,
    PlatformAdmin,
    Resource,
    Review,
    Salon,
    SalonMember,
    Service,
    TelegramLoginSession,
    User,
    UserRole,
)


router = APIRouter()


async def _count(session: AsyncSession, statement) -> int:
    return int(await session.scalar(statement) or 0)


def _appointment_out(appointment: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=appointment.id,
        salon_id=str(appointment.salon_id) if appointment.salon_id else None,
        master_id=appointment.master_id,
        master_name=appointment.master.full_name if appointment.master else "Неизвестный",
        client_id=appointment.client_id,
        client_name=appointment.client.full_name if appointment.client else "Неизвестный",
        service_name=appointment.service.name if appointment.service else "Неизвестная услуга",
        resource_id=appointment.resource_id,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status.value,
        created_at=appointment.created_at,
    )


@router.get("/me", response_model=PlatformAdminMeOut)
async def get_platform_admin_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    is_admin = await session.scalar(
        select(PlatformAdmin.user_id).where(
            PlatformAdmin.user_id == current_user.tg_id,
            PlatformAdmin.is_active.is_(True),
        )
    )
    return PlatformAdminMeOut(is_admin=is_admin is not None)


@router.get("/analytics", response_model=AdminAnalyticsOut)
async def get_platform_analytics(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    await auto_complete_due_appointments(session)
    await session.commit()

    now = datetime.now(timezone.utc)
    totals = {
        "users": await _count(session, select(func.count(User.tg_id))),
        "clients": await _count(session, select(func.count(User.tg_id)).where(User.role == UserRole.CLIENT)),
        "masters": await _count(session, select(func.count(User.tg_id)).where(User.role == UserRole.MASTER)),
        "activePlatformAdmins": await _count(session, select(func.count(PlatformAdmin.user_id)).where(PlatformAdmin.is_active.is_(True))),
        "salons": await _count(session, select(func.count(Salon.id))),
        "salonMembers": await _count(session, select(func.count(SalonMember.id))),
        "services": await _count(session, select(func.count(Service.id))),
        "resources": await _count(session, select(func.count(Resource.id))),
        "appointments": await _count(session, select(func.count(Appointment.id))),
        "reviews": await _count(session, select(func.count(Review.id))),
    }

    status_rows = await session.execute(
        select(Appointment.status, func.count(Appointment.id)).group_by(Appointment.status)
    )
    appointments_by_status = {status.value if isinstance(status, AppointmentStatus) else str(status): count for status, count in status_rows.all()}

    appointments_recent = {
        "day": await _count(session, select(func.count(Appointment.id)).where(Appointment.created_at >= now - timedelta(days=1))),
        "week": await _count(session, select(func.count(Appointment.id)).where(Appointment.created_at >= now - timedelta(days=7))),
        "month": await _count(session, select(func.count(Appointment.id)).where(Appointment.created_at >= now - timedelta(days=30))),
    }

    average_master_rating = float(
        await session.scalar(select(func.coalesce(func.avg(User.rating), 0)).where(User.role == UserRole.MASTER))
        or 0
    )

    master_rows = await session.execute(
        select(User.tg_id, User.full_name, User.rating)
        .where(User.role == UserRole.MASTER)
        .order_by(User.rating.desc(), User.full_name)
        .limit(5)
    )
    top_masters: list[dict[str, Any]] = [
        {"id": user_id, "name": full_name, "rating": float(rating)}
        for user_id, full_name, rating in master_rows.all()
    ]

    salon_rows = await session.execute(
        select(Salon.id, Salon.name, func.count(Appointment.id))
        .outerjoin(Appointment, Appointment.salon_id == Salon.id)
        .group_by(Salon.id, Salon.name)
        .order_by(func.count(Appointment.id).desc(), Salon.name)
        .limit(5)
    )
    top_salons: list[dict[str, Any]] = [
        {"id": str(salon_id), "name": name, "appointments": count}
        for salon_id, name, count in salon_rows.all()
    ]

    session_rows = await session.execute(
        select(TelegramLoginSession.status, func.count(TelegramLoginSession.token))
        .group_by(TelegramLoginSession.status)
    )
    telegram_login_sessions = {str(status.value if hasattr(status, "value") else status): count for status, count in session_rows.all()}

    return AdminAnalyticsOut(
        totals=totals,
        appointments_by_status=appointments_by_status,
        appointments_recent=appointments_recent,
        average_master_rating=round(average_master_rating, 2),
        top_masters=top_masters,
        top_salons=top_salons,
        telegram_login_sessions=telegram_login_sessions,
    )


@router.get("/users", response_model=list[AdminUserOut])
async def list_admin_users(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(User).order_by(User.created_at.desc()).limit(200))
    return result.scalars().all()


@router.get("/salons", response_model=list[AdminSalonOut])
async def list_admin_salons(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(Salon).order_by(Salon.created_at.desc()).limit(200))
    return [
        AdminSalonOut(
            id=str(salon.id),
            name=salon.name,
            owner_id=salon.owner_id,
            invite_code=salon.invite_code,
            created_at=salon.created_at,
        )
        for salon in result.scalars().all()
    ]


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_admin_appointments(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    from sqlalchemy.orm import selectinload

    await auto_complete_due_appointments(session)
    await session.commit()

    result = await session.execute(
        select(Appointment)
        .options(selectinload(Appointment.master), selectinload(Appointment.client), selectinload(Appointment.service))
        .order_by(Appointment.start_time.desc())
        .limit(200)
    )
    return [_appointment_out(appointment) for appointment in result.scalars().all()]


@router.get("/reviews", response_model=list[ReviewOut])
async def list_admin_reviews(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(Review).order_by(Review.created_at.desc()).limit(200))
    return result.scalars().all()


@router.get("/resources", response_model=list[ResourceOut])
async def list_admin_resources(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(Resource).order_by(Resource.created_at.desc()).limit(200))
    return result.scalars().all()


@router.get("/services", response_model=list[ServiceOut])
async def list_admin_services(
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(Service).order_by(Service.created_at.desc()).limit(200))
    return result.scalars().all()


@router.get("/users/{user_id}/delete-impact", response_model=DeleteImpactOut)
async def get_user_delete_impact(
    user_id: int,
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    counts = {
        "appointmentsAsMaster": await _count(session, select(func.count(Appointment.id)).where(Appointment.master_id == user_id)),
        "appointmentsAsClient": await _count(session, select(func.count(Appointment.id)).where(Appointment.client_id == user_id)),
        "ownedSalons": await _count(session, select(func.count(Salon.id)).where(Salon.owner_id == user_id)),
        "salonMemberships": await _count(session, select(func.count(SalonMember.id)).where(SalonMember.user_id == user_id)),
        "services": await _count(session, select(func.count(Service.id)).where(Service.master_id == user_id)),
        "platformAdminRecords": await _count(session, select(func.count(PlatformAdmin.user_id)).where(PlatformAdmin.user_id == user_id)),
    }
    warnings = ["Будут удалены записи пользователя; связанные отзывы удалятся каскадом."]
    if counts["ownedSalons"]:
        warnings.append("Салоны владельца будут удалены по внешнему ключу.")

    return DeleteImpactOut(entity_type="user", entity_id=str(user_id), counts=counts, warnings=warnings)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: int,
    payload: ConfirmDelete = Body(...),
    admin: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    if not payload.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Требуется confirm=true")
    if user_id == admin.tg_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя удалить текущего администратора")

    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    await session.execute(delete(Appointment).where(or_(Appointment.master_id == user_id, Appointment.client_id == user_id)))
    await session.delete(user)
    await session.commit()


@router.get("/salons/{salon_id}/delete-impact", response_model=DeleteImpactOut)
async def get_salon_delete_impact(
    salon_id: str,
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    salon_uuid = uuid.UUID(salon_id)
    salon = await session.get(Salon, salon_uuid)
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Салон не найден")

    counts = {
        "members": await _count(session, select(func.count(SalonMember.id)).where(SalonMember.salon_id == salon_uuid)),
        "resources": await _count(session, select(func.count(Resource.id)).where(Resource.salon_id == salon_uuid)),
        "services": await _count(session, select(func.count(Service.id)).where(Service.salon_id == salon_uuid)),
        "appointments": await _count(session, select(func.count(Appointment.id)).where(Appointment.salon_id == salon_uuid)),
    }
    warnings = ["У записей salon_id станет NULL; ресурсы салона будут удалены каскадом."]

    return DeleteImpactOut(entity_type="salon", entity_id=salon_id, counts=counts, warnings=warnings)


@router.delete("/salons/{salon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_salon(
    salon_id: str,
    payload: ConfirmDelete = Body(...),
    _: User = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_async_session),
):
    if not payload.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Требуется confirm=true")

    salon_uuid = uuid.UUID(salon_id)
    salon = await session.get(Salon, salon_uuid)
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Салон не найден")

    await session.delete(salon)
    await session.commit()
