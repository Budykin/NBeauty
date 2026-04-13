from __future__ import annotations
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_

from common.db import get_async_session
from common.models import Appointment, Service, AppointmentStatus, User
from backend.app.schemas.bookings import BookingCreate, BookingOut

router = APIRouter()


@router.post("/create", response_model=BookingOut)
async def create_booking(
        payload: BookingCreate,
        session: AsyncSession = Depends(get_async_session)
):
    """Создать новую запись с проверкой доступности времени и кабинета."""

    # 1. Находим услугу, чтобы узнать её длительность и нужен ли ей кабинет (resource_id)
    # Предполагаем, что ID передаются как строки (UUID)
    service_query = select(Service).where(Service.id == payload.service_id)
    service_result = await session.execute(service_query)
    service = service_result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    # 2. Вычисляем время окончания на основе длительности услуги
    end_time = payload.start_time + timedelta(minutes=service.duration)

    # 3. ПРОВЕРКИ КОНФЛИКТОВ
    # Запись невозможна, если (StartA < EndB) И (EndA > StartB)
    busy_target_filter = Appointment.master_id == payload.master_id
    if service.resource_id is not None:
        busy_target_filter = or_(
            busy_target_filter,
            Appointment.resource_id == service.resource_id,
        )

    conflict_query = select(Appointment).where(
        and_(
            Appointment.status != AppointmentStatus.CANCELLED,
            busy_target_filter,
            Appointment.start_time < end_time,
            Appointment.end_time > payload.start_time,
        )
    )

    conflict_result = await session.execute(conflict_query)
    if conflict_result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="Выбранное время уже занято мастером или необходимый кабинет недоступен"
        )

    # 4. Если конфликтов нет, создаем запись
    new_appointment = Appointment(
        master_id=payload.master_id,
        client_id=payload.client_id,
        salon_id=service.salon_id,
        service_id=payload.service_id,
        resource_id=service.resource_id,  # Автоматически привязываем нужный кабинет
        start_time=payload.start_time,
        end_time=end_time,
        status=AppointmentStatus.PENDING  # Статус "Ожидает подтверждения"
    )

    session.add(new_appointment)
    await session.commit()
    await session.refresh(new_appointment)

    return BookingOut(
        id=str(new_appointment.id),
        master_id=str(new_appointment.master_id),
        client_id=str(new_appointment.client_id),
        service_id=str(new_appointment.service_id),
        resource_id=str(new_appointment.resource_id) if new_appointment.resource_id else None,
        start_time=new_appointment.start_time,
        end_time=new_appointment.end_time,
        status=new_appointment.status.value
    )
