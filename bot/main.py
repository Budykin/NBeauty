import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from common.config import settings
from bot.handlers.start import router as start_router

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    logger.info("Starting bot...")

    # Инициализация бота с дефолтным парсингом HTML (для красивого текста)
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )

    # Инициализация диспетчера
    dp = Dispatcher()

    # Подключаем наши роутеры
    dp.include_router(start_router)
    # dp.include_router(master_router) # Сюда будем добавлять новые

    # Удаляем вебхуки (если были) и запускаем поллинг
    await bot.delete_webhook(drop_pending_updates=True)

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())