from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

from bot.keyboards.webapp import get_webapp_keyboard
from common.config import settings  # Предполагаю, что у тебя есть общий файл настроек

router = Router(name="start_router")


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обработчик команды /start."""

    # Ссылка на твой фронтенд (например, https://tvoysite.vercel.app)
    # В локальной разработке может быть https://твоя-ngrok-ссылка
    webapp_url = settings.frontend_url

    welcome_text = (
        f"Привет, {message.from_user.first_name}! 👋\n\n"
        "Добро пожаловать в систему управления салоном красоты. "
        "Нажми кнопку ниже, чтобы открыть приложение."
    )

    await message.answer(
        text=welcome_text,
        reply_markup=get_webapp_keyboard(webapp_url)
    )