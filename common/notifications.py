from __future__ import annotations

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

from .config import settings


_bot = Bot(
    token=settings.bot_token,
    default=DefaultBotProperties(parse_mode="HTML"),
)


def _build_appointment_keyboard(appointment_id: int) -> InlineKeyboardMarkup:
    """Inline-клавиатура для записи: подтвердить / отменить."""

    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(
            text="✅ Подтвердить",
            callback_data=f"apt_confirm:{appointment_id}"
        )
    )
    builder.row(
        InlineKeyboardButton(
            text="❌ Отменить",
            callback_data=f"apt_cancel:{appointment_id}"
        )
    )
    return builder.as_markup()


async def notify_appointment_created(
    *,
    master_tg_id: int,
    client_name: str,
    service_name: str,
    date_str: str,
    start_time: str,
    appointment_id: int,
) -> None:
    """Отправить мастеру уведомление о созданной записи с кнопками действий."""

    text = (
        "🆕 <b>Новая запись</b>\n\n"
        f"Клиент: <b>{client_name}</b>\n"
        f"Услуга: <b>{service_name}</b>\n"
        f"Дата: <b>{date_str}</b>\n"
        f"Время: <b>{start_time}</b>"
    )

    keyboard = _build_appointment_keyboard(appointment_id)
    await _bot.send_message(chat_id=master_tg_id, text=text, reply_markup=keyboard)


async def notify_appointment_confirmed(
    *,
    client_tg_id: int,
    master_name: str,
    service_name: str,
    date_str: str,
    start_time: str,
) -> None:
    """Отправить клиенту уведомление о подтверждении записи."""

    text = (
        "✅ <b>Запись подтверждена</b>\n\n"
        f"Мастер: <b>{master_name}</b>\n"
        f"Услуга: <b>{service_name}</b>\n"
        f"Дата: <b>{date_str}</b>\n"
        f"Время: <b>{start_time}</b>"
    )

    await _bot.send_message(chat_id=client_tg_id, text=text)


async def notify_appointment_cancelled(
    *,
    master_tg_id: int,
    client_name: str,
    service_name: str,
    date_str: str,
    start_time: str,
) -> None:
    """Отправить мастеру уведомление об отмене записи."""

    text = (
        "❌ <b>Запись отменена</b>\n\n"
        f"Клиент: <b>{client_name}</b>\n"
        f"Услуга: <b>{service_name}</b>\n"
        f"Дата: <b>{date_str}</b>\n"
        f"Время: <b>{start_time}</b>"
    )

    await _bot.send_message(chat_id=master_tg_id, text=text)


async def edit_appointment_notification(
    *,
    chat_id: int,
    message_id: int,
    text: str,
) -> None:
    """Обновить текст в уведомлении (например, при подтверждении/отмене)."""

    try:
        await _bot.edit_message_text(
            chat_id=chat_id,
            message_id=message_id,
            text=text,
        )
    except Exception:
        # Сообщение могло быть уже удалено или изменено — игнорируем
        pass
