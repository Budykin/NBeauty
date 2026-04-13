from __future__ import annotations
import asyncio
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_

from common.db import get_async_session
from common.models import Appointment, Service, AppointmentStatus, User
from common.notifications import notify_appointment_created
from backend.app.core.auth import get_current_user
from backend.app.schemas.bookings import BookingCreate, BookingOut

router = APIRouter()


@router.post("/create", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
        payload: BookingCreate,
        authorization: str = Header(...),
        session: AsyncSession = Depends(get_async_session)
):
    """Создать новую запись с проверкой доступности времени и кабинета.

    Клиент может записать ТОЛЬКО себя (client_id должен совпадать с текущим пользователем).
    """

    current_user = await get_current_user(authorization)

    # 0. Проверяем, что клиент записывает только себя
    if str(current_user.tg_id) != payload.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы можете записать только себя",
        )

    # 1. Находим услугу, чтобы узнать её длительность и нужен ли ей кабинет (resource_id)
    service_query = select(Service).where(Service.id == payload.service_id)
    service_result = await session.execute(service_query)
    service = service_result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    # 2. Вычисляем время окончания на основе длительности услуги
    end_time = payload.start_time + timedelta(minutes=service.duration)

    # 3. ПРОВЕРКИ КОНФЛИКТОВ
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
        resource_id=service.resource_id,
        start_time=payload.start_time,
        end_time=end_time,
        status=AppointmentStatus.PENDING
    )

    session.add(new_appointment)
    await session.commit()
    await session.refresh(new_appointment)

    # 5. Отправляем уведомление мастеру (в фоне, не блокируя ответ)
    master_result = await session.execute(
        select(User).where(User.tg_id == payload.master_id)
    )
    master = master_result.scalar_one_or_none()

    client_result = await session.execute(
        select(User).where(User.tg_id == payload.client_id)
    )
    client = client_result.scalar_one_or_none()

    if master and client:
        start_str = new_appointment.start_time.strftime("%d.%m.%Y %H:%M")
        asyncio.create_task(
            notify_appointment_created(
                master_tg_id=master.tg_id,
                client_name=client.full_name,
                service_name=service.name,
                date_str=start_str,
                start_time=start_str,
                appointment_id=new_appointment.id,
            )
        )

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
