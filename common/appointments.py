from __future__ import annotations

import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import Appointment, AppointmentStatus
from .notifications import notify_review_request


AUTO_COMPLETABLE_STATUSES = (
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.UPCOMING,
)

ACTIVE_APPOINTMENT_STATUSES = AUTO_COMPLETABLE_STATUSES


async def auto_complete_due_appointments(session: AsyncSession) -> int:
    """Mark non-cancelled appointments as completed after their end time."""

    result = await session.execute(
        select(Appointment)
        .options(selectinload(Appointment.review))
        .where(
            Appointment.status.in_(AUTO_COMPLETABLE_STATUSES),
            Appointment.end_time <= func.now(),
        )
    )
    appointments = result.scalars().all()

    for appointment in appointments:
        appointment.status = AppointmentStatus.COMPLETED
        session.add(appointment)

    if appointments:
        await session.flush()
        for appointment in appointments:
            if appointment.review is None:
                asyncio.create_task(
                    notify_review_request(
                        client_tg_id=appointment.client_id,
                        appointment_id=appointment.id,
                    )
                )

    return len(appointments)
