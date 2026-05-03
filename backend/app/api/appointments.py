from __future__ import annotations

import asyncio
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import AppointmentOut, TimeSlotOut
from backend.app.services.slot_finder import find_slots_for_service
from common import get_async_session
from common.models import (
    Appointment,
    AppointmentStatus,
    Service,
    User,
)
from common.notifications import notify_appointment_cancelled


router = APIRouter()


def _appointment_options():
    return (
        selectinload(Appointment.service),
        selectinload(Appointment.master),
        selectinload(Appointment.client),
    )


def _to_appointment_out(appointment: Appointment) -> AppointmentOut:
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


@router.get("/{master_id}/slots", response_model=List[TimeSlotOut])
async def get_master_slots(
    master_id: int,
    service_id: int = Query(alias="serviceId"),
    date_str: str = Query(alias="date", description="Формат: YYYY-MM-DD"),
    step_minutes: int = Query(default=30, alias="stepMinutes"),
    session: AsyncSession = Depends(get_async_session),
):
    """Получить свободные слоты мастера на указанную дату."""

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат даты. Ожидается YYYY-MM-DD",
        )

    slots = await find_slots_for_service(
        session,
        master_id=master_id,
        service_id=service_id,
        target_date=target_date,
        step_minutes=step_minutes,
    )

    return [
        TimeSlotOut(start=slot.start, end=slot.end)
        for slot in slots
    ]


@router.get("/my", response_model=List[AppointmentOut])
async def get_my_appointments(
    role: str = Query(default="master", description="Контекст: 'master' или 'client'"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Получить записи текущего пользователя (как мастера или клиента)."""

    if role == "master":
        query = (
            select(Appointment)
            .options(*_appointment_options())
            .where(
                Appointment.master_id == current_user.tg_id,
                Appointment.status != AppointmentStatus.CANCELLED,
            )
            .order_by(Appointment.start_time)
        )
    else:
        query = (
            select(Appointment)
            .options(*_appointment_options())
            .where(
                Appointment.client_id == current_user.tg_id,
                Appointment.status != AppointmentStatus.CANCELLED,
            )
            .order_by(Appointment.start_time)
        )

    result = await session.execute(query)
    appointments = result.scalars().all()
    return [_to_appointment_out(appointment) for appointment in appointments]


@router.get("/my/history", response_model=List[AppointmentOut])
async def get_my_appointments_history(
    role: str = Query(default="master", description="Контекст: 'master' или 'client'"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Получить историю записей (включая отменённые и завершённые)."""

    if role == "master":
        query = (
            select(Appointment)
            .options(*_appointment_options())
            .where(Appointment.master_id == current_user.tg_id)
            .order_by(Appointment.start_time.desc())
        )
    else:
        query = (
            select(Appointment)
            .options(*_appointment_options())
            .where(Appointment.client_id == current_user.tg_id)
            .order_by(Appointment.start_time.desc())
        )

    result = await session.execute(query)
    appointments = result.scalars().all()
    return [_to_appointment_out(appointment) for appointment in appointments]


@router.put("/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Отменить запись."""

    result = await session.execute(
        select(Appointment)
        .options(*_appointment_options())
        .where(
            Appointment.id == appointment_id,
            or_(
                Appointment.master_id == current_user.tg_id,
                Appointment.client_id == current_user.tg_id,
            ),
        )
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена",
        )

    if appointment.status == AppointmentStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Запись уже отменена",
        )

    appointment.status = AppointmentStatus.CANCELLED
    session.add(appointment)
    await session.commit()

    # Отправляем уведомление мастеру об отмене (в фоне)
    if appointment.master_id != current_user.tg_id:
        # Если отменил клиент — уведомляем мастера
        master_result = await session.execute(
            select(User).where(User.tg_id == appointment.master_id)
        )
        master = master_result.scalar_one_or_none()
        client_result = await session.execute(
            select(User).where(User.tg_id == current_user.tg_id)
        )
        client = client_result.scalar_one_or_none()

        if master and client and appointment.service:
            date_str = appointment.start_time.strftime("%d.%m.%Y")
            time_str = appointment.start_time.strftime("%H:%M")
            asyncio.create_task(
                notify_appointment_cancelled(
                    master_tg_id=master.tg_id,
                    client_name=client.full_name,
                    service_name=appointment.service.name,
                    date_str=date_str,
                    start_time=time_str,
                )
            )

    return _to_appointment_out(appointment)
