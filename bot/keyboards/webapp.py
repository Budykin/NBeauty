from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder


def get_webapp_keyboard(webapp_url: str) -> InlineKeyboardMarkup:
    """Создает клавиатуру с кнопкой для открытия Mini App."""
    builder = InlineKeyboardBuilder()

    # Кнопка, которая открывает WebApp
    builder.row(
        InlineKeyboardButton(
            text="📱 Открыть CRM",
            web_app=WebAppInfo(url=webapp_url)
        )
    )

    return builder.as_markup()