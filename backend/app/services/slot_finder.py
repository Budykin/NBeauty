from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import List

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import Appointment, AppointmentStatus, MasterSchedule, Service
from backend.app.services.default_schedules import ensure_default_master_schedules


@dataclass
class TimeSlot:
    """Простой DTO для свободного слота."""

    start: datetime
    end: datetime


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Проверка пересечения двух интервалов времени."""

    return max(a_start, b_start) < min(a_end, b_end)


def _as_local_naive(value: datetime) -> datetime:
    return value.replace(tzinfo=None)


async def find_slots_for_service(
    session: AsyncSession,
    *,
    master_id: int,
    service_id: int,
    target_date: date,
    step_minutes: int = 30,
) -> List[TimeSlot]:
    """Найти свободные слоты для указанного мастера и услуги на дату.

    Алгоритм:
    1. Находим услугу и её длительность, а также привязанный ресурс (если есть).
    2. Получаем рабочее время мастера для дня недели (MasterSchedule).
    3. Забираем все записи мастера в этот день.
    4. Если услуга требует ресурс, дополнительно учитываем все записи по этому ресурсу
       (любой мастер), чтобы ресурс не пересекался.
    5. Генерируем слоты с шагом step_minutes и фильтруем пересекающиеся.
    """

    service: Service | None = await session.scalar(
        select(Service).where(Service.id == service_id, Service.master_id == master_id)
    )
    if service is None:
        return []

    weekday = target_date.weekday()  # 0=понедельник
    await ensure_default_master_schedules(session, master_id)
    await session.commit()

    schedule: MasterSchedule | None = await session.scalar(
        select(MasterSchedule).where(
            MasterSchedule.master_id == master_id,
            MasterSchedule.day_of_week == weekday,
        )
    )
    if schedule is None or not schedule.is_enabled:
        return []

    # Рабочий интервал мастера в конкретный день
    work_start = datetime.combine(target_date, schedule.start_time)
    work_end = datetime.combine(target_date, schedule.end_time)

    # Все записи мастера на эту дату
    base_filter = and_(
        Appointment.master_id == master_id,
        func.date(Appointment.start_time) == target_date,
        Appointment.status != AppointmentStatus.CANCELLED,
    )

    busy_appointments: list[Appointment] = list(
        await session.scalars(select(Appointment).where(base_filter))
    )

    # Если услуга использует ресурс, учитываем все записи по этому ресурсу в этот день
    if service.resource_id is not None:
        resource_filter = and_(
            Appointment.resource_id == service.resource_id,
            func.date(Appointment.start_time) == target_date,
            Appointment.status != AppointmentStatus.CANCELLED,
        )
        resource_appointments = list(
            await session.scalars(select(Appointment).where(resource_filter))
        )
        busy_appointments.extend(resource_appointments)

    # Убираем дубликаты по id
    unique_by_id: dict[int, Appointment] = {a.id: a for a in busy_appointments}
    busy_intervals = [
        (_as_local_naive(appt.start_time), _as_local_naive(appt.end_time))
        for appt in sorted(unique_by_id.values(), key=lambda a: a.start_time)
    ]

    duration = timedelta(minutes=service.duration)
    step = timedelta(minutes=step_minutes)

    slots: list[TimeSlot] = []
    current_start = work_start

    while current_start + duration <= work_end:
        current_end = current_start + duration

        # Проверяем, пересекается ли интервал с занятыми
        conflict = False
        for busy_start, busy_end in busy_intervals:
            if _overlaps(current_start, current_end, busy_start, busy_end):
                conflict = True
                break

        if not conflict:
            slots.append(TimeSlot(start=current_start, end=current_end))

        current_start += step

    return slots
