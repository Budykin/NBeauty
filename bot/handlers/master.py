import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery
from aiogram.filters import Command
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from common.appointments import auto_complete_due_appointments
from common.db import get_async_session
from common.models import Appointment, AppointmentStatus, User
from common.notifications import (
    notify_appointment_confirmed,
    notify_appointment_cancelled_for_client,
    edit_appointment_notification,
)

router = Router(name="master_router")
logger = logging.getLogger(__name__)


@router.callback_query(F.data.startswith("apt_confirm:"))
async def on_confirm_appointment(callback: CallbackQuery):
    """Обработка кнопки 'Подтвердить' в уведомлении о записи."""

    try:
        appointment_id = int(callback.data.split(":")[1])
    except (ValueError, IndexError):
        await callback.answer("Неверный формат данных", show_alert=True)
        return

    async for session in get_async_session():
        await auto_complete_due_appointments(session)
        await session.commit()

        # Находим запись
        result = await session.execute(
            select(Appointment)
            .options(selectinload(Appointment.service), selectinload(Appointment.salon))
            .where(Appointment.id == appointment_id)
        )
        appointment = result.scalar_one_or_none()

        if not appointment:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        if appointment.status == AppointmentStatus.CONFIRMED:
            await callback.answer("Запись уже подтверждена", show_alert=True)
            return

        if appointment.status == AppointmentStatus.CANCELLED:
            await callback.answer("Запись уже отменена", show_alert=True)
            return
        if appointment.status == AppointmentStatus.COMPLETED:
            await callback.answer("Запись уже завершена", show_alert=True)
            return

        # Подтверждаем
        appointment.status = AppointmentStatus.CONFIRMED
        await session.commit()

        # Получаем данные для уведомления клиенту
        master_result = await session.execute(
            select(User).where(User.tg_id == appointment.master_id)
        )
        master = master_result.scalar_one_or_none()

        client_result = await session.execute(
            select(User).where(User.tg_id == appointment.client_id)
        )
        client = client_result.scalar_one_or_none()

        await session.close()

        # Обновляем сообщение в чате мастера
        original_text = callback.message.html_text or callback.message.text or ""
        updated_text = original_text + "\n\n✅ <b>Запись подтверждена</b>"
        await edit_appointment_notification(
            chat_id=callback.message.chat.id,
            message_id=callback.message.message_id,
            text=updated_text,
        )

        # Отправляем клиенту уведомление
        if master and client:
            date_str = appointment.start_time.strftime("%d.%m.%Y")
            time_str = appointment.start_time.strftime("%H:%M")
            await notify_appointment_confirmed(
                client_tg_id=client.tg_id,
                master_name=master.full_name,
                master_tg_id=master.tg_id,
                master_username=master.username,
                service_name=appointment.service.name if appointment.service else "Услуга",
                date_str=date_str,
                start_time=time_str,
            )

        await callback.answer("✅ Запись подтверждена!", show_alert=True)
        return


@router.callback_query(F.data.startswith("apt_cancel:"))
async def on_cancel_appointment(callback: CallbackQuery):
    """Обработка кнопки 'Отменить' в уведомлении о записи."""

    try:
        appointment_id = int(callback.data.split(":")[1])
    except (ValueError, IndexError):
        await callback.answer("Неверный формат данных", show_alert=True)
        return

    async for session in get_async_session():
        await auto_complete_due_appointments(session)
        await session.commit()

        # Находим запись
        result = await session.execute(
            select(Appointment)
            .options(
                selectinload(Appointment.service),
                selectinload(Appointment.salon),
                selectinload(Appointment.master),
                selectinload(Appointment.client),
            )
            .where(Appointment.id == appointment_id)
        )
        appointment = result.scalar_one_or_none()

        if not appointment:
            await callback.answer("Запись не найдена", show_alert=True)
            return

        if appointment.status == AppointmentStatus.CANCELLED:
            await callback.answer("Запись уже отменена", show_alert=True)
            return

        if appointment.status == AppointmentStatus.COMPLETED:
            await callback.answer("Запись уже завершена. Нельзя отменить.", show_alert=True)
            return

        # Отменяем
        appointment.status = AppointmentStatus.CANCELLED
        await session.commit()

        # Обновляем сообщение в чате мастера
        original_text = callback.message.html_text or callback.message.text or ""
        updated_text = original_text + "\n\n❌ <b>Запись отменена</b>"
        await edit_appointment_notification(
            chat_id=callback.message.chat.id,
            message_id=callback.message.message_id,
            text=updated_text,
        )

        if appointment.master and appointment.client:
            await notify_appointment_cancelled_for_client(
                client_tg_id=appointment.client.tg_id,
                master_name=appointment.master.full_name,
                master_tg_id=appointment.master.tg_id,
                master_username=appointment.master.username,
                service_name=appointment.service.name if appointment.service else "Услуга",
                date_str=appointment.start_time.strftime("%d.%m.%Y"),
                start_time=appointment.start_time.strftime("%H:%M"),
                salon_name=appointment.salon.name if appointment.salon else None,
            )

        await session.close()

        await callback.answer("❌ Запись отменена", show_alert=True)
        return


@router.message(Command("help"))
async def cmd_help(message):
    """Справка по командам бота."""

    text = (
        "📋 <b>Доступные команды:</b>\n\n"
        "/start — Открыть CRM приложение\n"
        "/help — Эта справка\n\n"
        "💡 Уведомления о записях приходят автоматически.\n"
        "Используйте кнопки ✅/❌ для управления записями."
    )
    await message.answer(text)
