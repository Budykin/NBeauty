from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Appointment, AppointmentStatus


AUTO_COMPLETABLE_STATUSES = (
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.UPCOMING,
)

ACTIVE_APPOINTMENT_STATUSES = AUTO_COMPLETABLE_STATUSES


async def auto_complete_due_appointments(session: AsyncSession) -> int:
    """Mark non-cancelled appointments as completed after their end time."""

    result = await session.execute(
        select(Appointment).where(
            Appointment.status.in_(AUTO_COMPLETABLE_STATUSES),
            Appointment.end_time <= datetime.now(),
        )
    )
    appointments = result.scalars().all()

    for appointment in appointments:
        appointment.status = AppointmentStatus.COMPLETED
        session.add(appointment)

    if appointments:
        await session.flush()

    return len(appointments)
