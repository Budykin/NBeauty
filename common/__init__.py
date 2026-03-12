"""
Общий пакет для конфигурации, моделей и подключения к БД.

Этот пакет используется как backend-сервисом (FastAPI),
так и ботом (aiogram), чтобы избежать дублирования кода.
"""

from .config import settings
from .db import async_engine, async_session_factory, get_async_session
from .models import Base

__all__ = [
    "settings",
    "async_engine",
    "async_session_factory",
    "get_async_session",
    "Base",
]

