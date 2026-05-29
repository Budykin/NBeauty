from __future__ import annotations
from typing import List
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from starlette import status

from common.db import get_async_session
from common.models import Appointment, MasterSchedule, Review, User, UserRole
from fastapi import APIRouter, Depends, HTTPException

# Импортируем наши новые схемы
from backend.app.schemas.masters import MasterOut, ReviewSummaryOut, ScheduleOut, ServiceOut
from backend.app.services.default_schedules import ensure_default_master_schedules

router = APIRouter()


def map_user_to_master_out(
    master: User,
    review_count: int = 0,
    schedules: list[MasterSchedule] | None = None,
    reviews: list[ReviewSummaryOut] | None = None,
) -> MasterOut:
    """Вспомогательная функция для маппинга модели БД в схему ответа."""
    primary_salon_id = next(
        (str(service.salon_id) for service in master.services if service.salon_id is not None),
        None,
    )
    return MasterOut(
        id=str(master.tg_id),
        name=master.full_name,
        full_name=master.full_name,
        username=master.username,
        avatar=(master.avatar or master.full_name[:2].upper()),
        specialty=(master.specialty or "Мастер красоты"),
        rating=float(master.rating),
        review_count=review_count,
        reviews=reviews or [],
        services=[
            ServiceOut(
                id=str(s.id),
                name=s.name,
                price=s.price,
                duration=s.duration,
                resource_id=str(s.resource_id) if s.resource_id else None
            ) for s in master.services
        ],
        schedules=[
            ScheduleOut(
                id=s.id,
                day_of_week=s.day_of_week,
                is_enabled=s.is_enabled,
                start_time=s.start_time.strftime("%H:%M"),
                end_time=s.end_time.strftime("%H:%M"),
            )
            for s in sorted(schedules if schedules is not None else master.schedules, key=lambda schedule: schedule.day_of_week)
        ],
        salon_id=primary_salon_id,
    )


async def load_review_counts(session: AsyncSession, master_ids: list[int]) -> dict[int, int]:
    if not master_ids:
        return {}

    result = await session.execute(
        select(Appointment.master_id, func.count(Review.id))
        .join(Review, Review.appointment_id == Appointment.id)
        .where(Appointment.master_id.in_(master_ids))
        .group_by(Appointment.master_id)
    )
    return {master_id: count for master_id, count in result.all()}


async def load_reviews(session: AsyncSession, master_ids: list[int], limit_per_master: int = 10) -> dict[int, list[ReviewSummaryOut]]:
    if not master_ids:
        return {}

    result = await session.execute(
        select(Review, Appointment.master_id, User.full_name, User.username)
        .join(Appointment, Appointment.id == Review.appointment_id)
        .join(User, User.tg_id == Appointment.client_id)
        .where(Appointment.master_id.in_(master_ids))
        .order_by(Appointment.master_id, Review.created_at.desc())
    )

    reviews_by_master_id: dict[int, list[ReviewSummaryOut]] = {}
    for review, master_id, client_name, client_username in result.all():
        master_reviews = reviews_by_master_id.setdefault(master_id, [])
        if len(master_reviews) >= limit_per_master:
            continue
        master_reviews.append(
            ReviewSummaryOut(
                id=review.id,
                rating=review.rating,
                comment=review.comment,
                client_name=client_name,
                client_username=client_username,
                created_at=review.created_at,
            )
        )

    return reviews_by_master_id


@router.get("/", response_model=List[MasterOut])
async def list_masters(session: AsyncSession = Depends(get_async_session)):
    query = (
        select(User)
        .options(selectinload(User.services), selectinload(User.schedules))
        .where(User.role == UserRole.MASTER)
    )
    result = await session.execute(query)
    masters_db = result.scalars().all()

    schedules_by_master_id: dict[int, list[MasterSchedule]] = {}
    for master in masters_db:
        schedules = await ensure_default_master_schedules(session, master.tg_id)
        schedules_by_master_id[master.tg_id] = schedules

    await session.commit()

    master_ids = [master.tg_id for master in masters_db]
    review_counts = await load_review_counts(session, master_ids)
    reviews = await load_reviews(session, master_ids)

    return [
        map_user_to_master_out(
            m,
            review_counts.get(m.tg_id, 0),
            schedules_by_master_id.get(m.tg_id),
            reviews.get(m.tg_id, []),
        )
        for m in masters_db
    ]


@router.get("/{master_id}", response_model=MasterOut)
async def get_master_details(master_id: int, session: AsyncSession = Depends(get_async_session)):
    query = (
        select(User)
        .options(selectinload(User.services), selectinload(User.schedules))
        .where(User.tg_id == master_id, User.role == UserRole.MASTER)
    )
    result = await session.execute(query)
    master = result.scalar_one_or_none()

    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Мастер не найден"
        )

    schedules = await ensure_default_master_schedules(session, master.tg_id)
    await session.commit()
    review_counts = await load_review_counts(session, [master.tg_id])
    reviews = await load_reviews(session, [master.tg_id])

    return map_user_to_master_out(master, review_counts.get(master.tg_id, 0), schedules, reviews.get(master.tg_id, []))
