from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.core.auth import get_current_user
from backend.app.schemas.common import ReviewCreate, ReviewOut, ReviewUpdate
from common import get_async_session
from common.appointments import auto_complete_due_appointments
from common.models import Appointment, AppointmentStatus, Review, User


router = APIRouter()


def _to_review_out(review: Review) -> ReviewOut:
    return ReviewOut(
        id=review.id,
        appointment_id=review.appointment_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


@router.get("/my", response_model=List[ReviewOut])
async def get_my_reviews(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(Review)
        .join(Appointment, Appointment.id == Review.appointment_id)
        .where(
            or_(
                Appointment.client_id == current_user.tg_id,
                Appointment.master_id == current_user.tg_id,
            )
        )
        .order_by(Review.created_at.desc())
    )
    return [_to_review_out(review) for review in result.scalars().all()]


@router.post("/", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    await auto_complete_due_appointments(session)
    await session.commit()

    appointment = await session.scalar(
        select(Appointment)
        .options(selectinload(Appointment.review))
        .where(Appointment.id == payload.appointment_id)
    )
    if appointment is None or appointment.client_id != current_user.tg_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись не найдена")
    if appointment.status != AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отзыв можно оставить только после завершения записи")
    if appointment.review is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отзыв для этой записи уже создан")

    review = Review(
        appointment_id=appointment.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)
    return _to_review_out(review)


@router.put("/{review_id}", response_model=ReviewOut)
async def update_review(
    review_id: int,
    payload: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    review = await session.scalar(
        select(Review)
        .join(Appointment, Appointment.id == Review.appointment_id)
        .where(Review.id == review_id, Appointment.client_id == current_user.tg_id)
    )
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Отзыв не найден")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(review, field, value)

    session.add(review)
    await session.commit()
    await session.refresh(review)
    return _to_review_out(review)


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    review = await session.scalar(
        select(Review)
        .join(Appointment, Appointment.id == Review.appointment_id)
        .where(Review.id == review_id, Appointment.client_id == current_user.tg_id)
    )
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Отзыв не найден")

    await session.delete(review)
    await session.commit()
