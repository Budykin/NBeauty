import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from aiogram import Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import Message
from sqlalchemy import select

from bot.keyboards.webapp import get_webapp_keyboard
from common.config import settings
from common.db import async_session_factory
from common.login_sessions import complete_login_session, expire_login_session_if_needed
from common.models import LoginSessionStatus, TelegramLoginSession
from common.telegram_users import upsert_telegram_user

router = Router(name="start_router")
logger = logging.getLogger(__name__)


def build_webapp_url(base_url: str) -> str:
    split_url = urlsplit(base_url)
    query_params = dict(parse_qsl(split_url.query, keep_blank_values=True))

    # Telegram Mini Apps aggressively cache the same URL.
    # Bump this marker when we need users to receive a fresh build.
    query_params["v"] = "20260415-client-only"

    return urlunsplit(split_url._replace(query=urlencode(query_params)))


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(message: Message, command: CommandObject):
    """Обработка deep-link для dev-авторизации."""

    args = (command.args or "").strip()
    if not args.startswith("login_"):
        await cmd_start(message)
        return

    login_token = args.removeprefix("login_")

    async with async_session_factory() as session:
        try:
            result = await session.execute(
                select(TelegramLoginSession).where(TelegramLoginSession.token == login_token)
            )
            login_session = result.scalar_one_or_none()

            if login_session is None:
                await message.answer("Сессия входа не найдена. Вернись в приложение и запроси новую.")
                return

            if expire_login_session_if_needed(login_session) or login_session.status == LoginSessionStatus.EXPIRED:
                await session.commit()
                await message.answer("Сессия входа устарела. Вернись в приложение и запроси новую.")
                return

            if login_session.status == LoginSessionStatus.COMPLETED:
                await message.answer("Этот вход уже подтверждён. Можешь вернуться в браузер.")
                return

            user = await upsert_telegram_user(
                session,
                tg_id=message.from_user.id,
                full_name=message.from_user.full_name,
                username=message.from_user.username,
            )
            await complete_login_session(session, login_session, user)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Failed to complete Telegram login session")
            await message.answer("Не удалось завершить вход. Попробуй ещё раз из приложения.")
            return

    await message.answer(
        "Вход подтверждён. Вернись в браузер с приложением, авторизация завершится автоматически."
    )


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обработчик команды /start."""

    # Ссылка на твой фронтенд (например, https://tvoysite.vercel.app)
    # В локальной разработке может быть https://твоя-ngrok-ссылка
    webapp_url = build_webapp_url(settings.webapp_url)

    welcome_text = (
        f"Привет, {message.from_user.first_name}! 👋\n\n"
        "Добро пожаловать в систему управления салоном красоты. "
        "Нажми кнопку ниже, чтобы открыть приложение."
    )

    await message.answer(
        text=welcome_text,
        reply_markup=get_webapp_keyboard(webapp_url)
    )
