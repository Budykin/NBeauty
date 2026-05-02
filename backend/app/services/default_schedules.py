from __future__ import annotations

from datetime import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import MasterSchedule


DEFAULT_WEEKLY_SCHEDULE = {
    0: (True, time(9, 0), time(18, 0)),
    1: (True, time(9, 0), time(18, 0)),
    2: (True, time(9, 0), time(18, 0)),
    3: (True, time(9, 0), time(18, 0)),
    4: (True, time(9, 0), time(17, 0)),
    5: (True, time(10, 0), time(15, 0)),
    6: (False, time(10, 0), time(15, 0)),
}


async def ensure_default_master_schedules(
    session: AsyncSession,
    master_id: int,
) -> list[MasterSchedule]:
    result = await session.execute(
        select(MasterSchedule)
        .where(
            MasterSchedule.master_id == master_id,
            MasterSchedule.salon_id.is_(None),
        )
        .order_by(MasterSchedule.day_of_week)
    )
    schedules = list(result.scalars().all())
    existing_days = {schedule.day_of_week for schedule in schedules}

    created: list[MasterSchedule] = []
    for day_of_week, (is_enabled, start_time, end_time) in DEFAULT_WEEKLY_SCHEDULE.items():
        if day_of_week in existing_days:
            continue

        schedule = MasterSchedule(
            master_id=master_id,
            salon_id=None,
            day_of_week=day_of_week,
            is_enabled=is_enabled,
            start_time=start_time,
            end_time=end_time,
        )
        session.add(schedule)
        created.append(schedule)

    if created:
        await session.flush()
        schedules.extend(created)

    return sorted(schedules, key=lambda schedule: schedule.day_of_week)
