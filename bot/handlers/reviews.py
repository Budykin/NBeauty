from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from common.db import get_async_session
from common.models import Appointment, AppointmentStatus, Review
from common.notifications import build_review_comment_keyboard


router = Router(name="reviews_router")
pending_review_comments: dict[int, int] = {}


@router.callback_query(F.data.startswith("apt_rate:"))
async def on_rate_appointment(callback: CallbackQuery):
    try:
        _, appointment_id_raw, rating_raw = callback.data.split(":")
        appointment_id = int(appointment_id_raw)
        rating = int(rating_raw)
    except (AttributeError, ValueError):
        await callback.answer("Неверный формат оценки", show_alert=True)
        return

    if rating < 1 or rating > 5:
        await callback.answer("Оценка должна быть от 1 до 5", show_alert=True)
        return

    user_id = callback.from_user.id

    async for session in get_async_session():
        appointment = await session.scalar(
            select(Appointment)
            .options(selectinload(Appointment.review))
            .where(
                Appointment.id == appointment_id,
                Appointment.client_id == user_id,
                Appointment.status == AppointmentStatus.COMPLETED,
            )
        )

        if appointment is None:
            await callback.answer("Завершённая запись не найдена", show_alert=True)
            return

        if appointment.review is not None:
            review = appointment.review
            review.rating = rating
            session.add(review)
        else:
            review = Review(
                appointment_id=appointment.id,
                rating=rating,
                comment=None,
            )
            session.add(review)
            await session.flush()

        await session.commit()

        if callback.message:
            await callback.message.edit_text(
                "Спасибо за оценку! Хотите оставить текстовый отзыв?",
                reply_markup=build_review_comment_keyboard(review.id),
            )

        await callback.answer("Спасибо за оценку!", show_alert=True)
        return


@router.callback_query(F.data.startswith("review_comment:"))
async def on_review_comment_request(callback: CallbackQuery):
    try:
        review_id = int(callback.data.split(":")[1])
    except (AttributeError, ValueError, IndexError):
        await callback.answer("Неверный формат данных", show_alert=True)
        return

    user_id = callback.from_user.id

    async for session in get_async_session():
        review = await session.scalar(
            select(Review)
            .join(Appointment, Appointment.id == Review.appointment_id)
            .where(Review.id == review_id, Appointment.client_id == user_id)
        )

        if review is None:
            await callback.answer("Отзыв не найден", show_alert=True)
            return

        pending_review_comments[user_id] = review.id

        if callback.message:
            await callback.message.edit_text("Напишите текстовый отзыв одним сообщением.")

        await callback.answer()
        return


@router.callback_query(F.data.startswith("review_later:"))
async def on_review_later(callback: CallbackQuery):
    pending_review_comments.pop(callback.from_user.id, None)

    if callback.message:
        await callback.message.edit_text("Спасибо за оценку!")

    await callback.answer()


@router.message(F.text)
async def on_review_comment(message: Message):
    if message.from_user is None or not message.text:
        return

    user_id = message.from_user.id
    review_id = pending_review_comments.get(user_id)
    if review_id is None:
        return

    async for session in get_async_session():
        review = await session.scalar(
            select(Review)
            .join(Appointment, Appointment.id == Review.appointment_id)
            .where(Review.id == review_id, Appointment.client_id == user_id)
        )

        if review is None:
            pending_review_comments.pop(user_id, None)
            await message.answer("Отзыв не найден.")
            return

        review.comment = message.text[:1000]
        session.add(review)
        await session.commit()

        pending_review_comments.pop(user_id, None)
        await message.answer("Спасибо за отзыв!")
        return
