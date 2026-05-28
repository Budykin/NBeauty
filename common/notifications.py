from __future__ import annotations

from html import escape

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


def build_review_rating_keyboard(appointment_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(
        *[
            InlineKeyboardButton(
                text=str(rating),
                callback_data=f"apt_rate:{appointment_id}:{rating}",
            )
            for rating in range(1, 6)
        ]
    )
    return builder.as_markup()


def build_review_comment_keyboard(review_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="Написать отзыв", callback_data=f"review_comment:{review_id}"),
        InlineKeyboardButton(text="В другой раз", callback_data=f"review_later:{review_id}"),
    )
    return builder.as_markup()


def _safe(value: str | None) -> str:
    return escape(value or "", quote=True)


def _username_link(username: str | None) -> str | None:
    if not username:
        return None

    clean_username = username.removeprefix("@")
    if not clean_username:
        return None

    escaped_username = _safe(clean_username)
    return f'<a href="https://t.me/{escaped_username}">@{escaped_username}</a>'


def _user_line(label: str, name: str, tg_id: int, username: str | None = None) -> str:
    link = _username_link(username)
    suffix = f" ({link})" if link else ""
    return f"{label}: <b>{_safe(name)}</b>{suffix}\nID {label.lower()}: <code>{tg_id}</code>"


def _salon_line(salon_name: str | None) -> str:
    return f"\nСалон: <b>{_safe(salon_name)}</b>" if salon_name else ""


async def notify_appointment_created(
    *,
    master_tg_id: int,
    client_name: str,
    client_tg_id: int,
    client_username: str | None = None,
    service_name: str,
    date_str: str,
    start_time: str,
    appointment_id: int,
) -> None:
    """Отправить мастеру уведомление о созданной записи с кнопками действий."""

    text = (
        "🆕 <b>Новая запись</b>\n\n"
        f"{_user_line('Клиент', client_name, client_tg_id, client_username)}\n"
        f"Услуга: <b>{_safe(service_name)}</b>\n"
        f"Дата: <b>{_safe(date_str)}</b>\n"
        f"Время: <b>{_safe(start_time)}</b>"
    )

    keyboard = _build_appointment_keyboard(appointment_id)
    await _bot.send_message(chat_id=master_tg_id, text=text, reply_markup=keyboard)


async def notify_appointment_confirmed(
    *,
    client_tg_id: int,
    master_name: str,
    master_tg_id: int,
    master_username: str | None = None,
    service_name: str,
    date_str: str,
    start_time: str,
) -> None:
    """Отправить клиенту уведомление о подтверждении записи."""

    text = (
        "✅ <b>Запись подтверждена</b>\n\n"
        f"{_user_line('Мастер', master_name, master_tg_id, master_username)}\n"
        f"Услуга: <b>{_safe(service_name)}</b>\n"
        f"Дата: <b>{_safe(date_str)}</b>\n"
        f"Время: <b>{_safe(start_time)}</b>"
    )

    await _bot.send_message(chat_id=client_tg_id, text=text)


async def notify_appointment_cancelled_for_master(
    *,
    master_tg_id: int,
    client_name: str,
    client_tg_id: int,
    client_username: str | None = None,
    service_name: str,
    date_str: str,
    start_time: str,
    salon_name: str | None = None,
) -> None:
    """Отправить мастеру уведомление об отмене записи."""

    text = (
        "❌ <b>Запись отменена</b>\n\n"
        f"{_user_line('Клиент', client_name, client_tg_id, client_username)}\n"
        f"Услуга: <b>{_safe(service_name)}</b>\n"
        f"Дата: <b>{_safe(date_str)}</b>\n"
        f"Время: <b>{_safe(start_time)}</b>"
        f"{_salon_line(salon_name)}"
    )

    await _bot.send_message(chat_id=master_tg_id, text=text)


async def notify_appointment_cancelled_for_client(
    *,
    client_tg_id: int,
    master_name: str,
    master_tg_id: int,
    master_username: str | None = None,
    service_name: str,
    date_str: str,
    start_time: str,
    salon_name: str | None = None,
) -> None:
    """Отправить клиенту уведомление об отмене записи."""

    text = (
        "❌ <b>Запись отменена</b>\n\n"
        f"Услуга: <b>{_safe(service_name)}</b>\n"
        f"Дата: <b>{_safe(date_str)}</b>\n"
        f"Время: <b>{_safe(start_time)}</b>\n"
        f"{_user_line('Мастер', master_name, master_tg_id, master_username)}"
        f"{_salon_line(salon_name)}"
    )

    await _bot.send_message(chat_id=client_tg_id, text=text)


async def notify_review_request(
    *,
    client_tg_id: int,
    appointment_id: int,
) -> None:
    """Ask a client to rate a completed appointment."""

    await _bot.send_message(
        chat_id=client_tg_id,
        text="Ваша запись завершена. Понравилась ли вам услуга?",
        reply_markup=build_review_rating_keyboard(appointment_id),
    )


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
