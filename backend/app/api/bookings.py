from __future__ import annotations
import asyncio
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import AppointmentOut
from common.db import get_async_session
from common.models import Appointment, MasterSchedule, Service, AppointmentStatus, User
from common.notifications import notify_appointment_created
from backend.app.schemas.bookings import BookingCreate
from backend.app.services.default_schedules import ensure_default_master_schedules

router = APIRouter()


@router.post("/create", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
        payload: BookingCreate,
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_async_session),
):
    """Создать новую запись с проверкой доступности времени и кабинета."""

    # Фронт может прислать ISO с таймзоной (например, 2026-05-02T12:00:00+03:00).
    # В нашей модели хранения/слотов время используется как "локальное на часах" (naive datetime),
    # поэтому сохраняем часы/минуты как есть и игнорируем tzinfo, чтобы не было сдвига в UTC.
    start_time = payload.start_time.replace(tzinfo=None) if payload.start_time.tzinfo else payload.start_time

    # 1. Находим услугу, чтобы узнать её длительность и нужен ли ей кабинет (resource_id)
    service_query = select(Service).where(Service.id == payload.service_id)
    service_result = await session.execute(service_query)
    service = service_result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    if payload.master_id != service.master_id:
        raise HTTPException(status_code=400, detail="Услуга не принадлежит выбранному мастеру")

    if payload.client_id != current_user.tg_id:
        raise HTTPException(status_code=403, detail="Нельзя создать запись от имени другого клиента")

    # 2. Вычисляем время окончания на основе длительности услуги
    end_time = start_time + timedelta(minutes=service.duration)

    await ensure_default_master_schedules(session, service.master_id)
    await session.commit()

    schedule = await session.scalar(
        select(MasterSchedule).where(
            MasterSchedule.master_id == service.master_id,
            MasterSchedule.salon_id.is_(None),
            MasterSchedule.day_of_week == payload.start_time.weekday(),
        )
    )
    if schedule is None or not schedule.is_enabled:
        raise HTTPException(status_code=400, detail="Мастер не работает в выбранный день")

    if start_time.time() < schedule.start_time or end_time.time() > schedule.end_time:
        raise HTTPException(status_code=400, detail="Выбранное время вне рабочего графика мастера")

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
            Appointment.end_time > start_time,
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
        master_id=service.master_id,
        client_id=current_user.tg_id,
        salon_id=service.salon_id,
        service_id=payload.service_id,
        resource_id=service.resource_id,
        start_time=start_time,
        end_time=end_time,
        status=AppointmentStatus.PENDING
    )

    session.add(new_appointment)
    await session.commit()
    await session.refresh(new_appointment)

    # 5. Отправляем уведомление мастеру (в фоне, не блокируя ответ)
    master_result = await session.execute(
        select(User).where(User.tg_id == service.master_id)
    )
    master = master_result.scalar_one_or_none()

    if master:
        date_str = new_appointment.start_time.strftime("%d.%m.%Y")
        time_str = new_appointment.start_time.strftime("%H:%M")
        asyncio.create_task(
            notify_appointment_created(
                master_tg_id=master.tg_id,
                client_name=current_user.full_name,
                service_name=service.name,
                date_str=date_str,
                start_time=time_str,
                appointment_id=new_appointment.id,
            )
        )

    return AppointmentOut(
        id=new_appointment.id,
        salon_id=str(new_appointment.salon_id) if new_appointment.salon_id else None,
        master_id=new_appointment.master_id,
        master_name=master.full_name if master else "Неизвестный",
        client_id=current_user.tg_id,
        client_name=current_user.full_name,
        service_name=service.name,
        resource_id=new_appointment.resource_id,
        start_time=new_appointment.start_time,
        end_time=new_appointment.end_time,
        status=new_appointment.status.value,
        created_at=new_appointment.created_at,
    )
