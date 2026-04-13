from __future__ import annotations

from typing import List
from datetime import time
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import ScheduleCreate, ScheduleOut
from common import get_async_session
from common.models import MasterSchedule, User


router = APIRouter()


def _parse_time(t: str) -> time:
    """Парсинг строки времени HH:MM."""
    try:
        parts = t.split(":")
        return time(hour=int(parts[0]), minute=int(parts[1]))
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверный формат времени: {t}. Ожидается HH:MM",
        )


@router.get("/my", response_model=List[ScheduleOut])
async def get_my_schedules(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Получить расписание текущего мастера."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(MasterSchedule)
        .where(MasterSchedule.master_id == current_user.tg_id)
        .order_by(MasterSchedule.day_of_week)
    )
    schedules = result.scalars().all()

    return [
        ScheduleOut(
            id=s.id,
            salon_id=str(s.salon_id) if s.salon_id else None,
            day_of_week=s.day_of_week,
            is_enabled=s.is_enabled,
            start_time=s.start_time.strftime("%H:%M"),
            end_time=s.end_time.strftime("%H:%M"),
        )
        for s in schedules
    ]


@router.post("/", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: ScheduleCreate,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Создать запись в расписании."""

    current_user = await get_current_user(authorization)

    # Проверяем, нет ли уже записи для этого дня/салона
    existing = await session.execute(
        select(MasterSchedule).where(
            MasterSchedule.master_id == current_user.tg_id,
            MasterSchedule.day_of_week == payload.day_of_week,
            MasterSchedule.salon_id == payload.salon_id,
        )
    )

    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Расписание на этот день уже существует. Используйте PUT для обновления.",
        )

    schedule = MasterSchedule(
        master_id=current_user.tg_id,
        salon_id=payload.salon_id,
        day_of_week=payload.day_of_week,
        is_enabled=payload.is_enabled,
        start_time=_parse_time(payload.start_time),
        end_time=_parse_time(payload.end_time),
    )
    session.add(schedule)
    await session.commit()
    await session.refresh(schedule)

    return ScheduleOut(
        id=schedule.id,
        salon_id=str(schedule.salon_id) if schedule.salon_id else None,
        day_of_week=schedule.day_of_week,
        is_enabled=schedule.is_enabled,
        start_time=schedule.start_time.strftime("%H:%M"),
        end_time=schedule.end_time.strftime("%H:%M"),
    )


@router.put("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: int,
    payload: ScheduleCreate,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Обновить запись в расписании."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(MasterSchedule).where(
            MasterSchedule.id == schedule_id,
            MasterSchedule.master_id == current_user.tg_id,
        )
    )
    schedule = result.scalar_one_or_none()

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись в расписании не найдена",
        )

    schedule.day_of_week = payload.day_of_week
    schedule.is_enabled = payload.is_enabled
    schedule.start_time = _parse_time(payload.start_time)
    schedule.end_time = _parse_time(payload.end_time)
    if payload.salon_id:
        schedule.salon_id = payload.salon_id

    session.add(schedule)
    await session.commit()
    await session.refresh(schedule)

    return ScheduleOut(
        id=schedule.id,
        salon_id=str(schedule.salon_id) if schedule.salon_id else None,
        day_of_week=schedule.day_of_week,
        is_enabled=schedule.is_enabled,
        start_time=schedule.start_time.strftime("%H:%M"),
        end_time=schedule.end_time.strftime("%H:%M"),
    )


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_async_session),
):
    """Удалить запись из расписания."""

    current_user = await get_current_user(authorization)

    result = await session.execute(
        select(MasterSchedule).where(
            MasterSchedule.id == schedule_id,
            MasterSchedule.master_id == current_user.tg_id,
        )
    )
    schedule = result.scalar_one_or_none()

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись в расписании не найдена",
        )

    await session.delete(schedule)
    await session.commit()
