from __future__ import annotations

from aiogram import Bot

from .config import settings


_bot = Bot(token=settings.bot_token, parse_mode="HTML")


async def notify_appointment_created(
    *,
    master_tg_id: int,
    client_name: str,
    service_name: str,
    date_str: str,
    start_time: str,
) -> None:
    """Отправить мастеру уведомление о созданной записи."""

    text = (
        "🆕 <b>Новая запись</b>\n\n"
        f"Клиент: <b>{client_name}</b>\n"
        f"Услуга: <b>{service_name}</b>\n"
        f"Дата: <b>{date_str}</b>\n"
        f"Время: <b>{start_time}</b>"
    )

    await _bot.send_message(chat_id=master_tg_id, text=text)


async def notify_appointment_confirmed(
    *,
    client_tg_id: int,
    master_name: str,
    service_name: str,
    date_str: str,
    start_time: str,
) -> None:
    """Отправить клиенту уведомление о подтверждении записи (заготовка)."""

    text = (
        "✅ <b>Запись подтверждена</b>\n\n"
        f"Мастер: <b>{master_name}</b>\n"
        f"Услуга: <b>{service_name}</b>\n"
        f"Дата: <b>{date_str}</b>\n"
        f"Время: <b>{start_time}</b>"
    )

    await _bot.send_message(chat_id=client_tg_id, text=text)

