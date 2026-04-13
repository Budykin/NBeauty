from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Глобальные настройки проекта, общие для backend и бота."""

    # Бот
    bot_token: str = Field(alias="BOT_TOKEN")

    # База данных
    database_url: AnyUrl = Field(alias="DATABASE_URL")

    # JWT
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expires_in_minutes: int = 60 * 24  # 1 день

    # WebApp / фронтенд
    webapp_url: str = Field(alias="WEBAPP_URL")
    frontend_url: str = Field(alias="FRONTEND_URL", default="https://t.me/test_bot")

    # CORS
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
        ],
        alias="CORS_ORIGINS",
    )

    class Config:
        env_file = os.getenv("ENV_FILE", ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    """Кешированный доступ к настройкам, чтобы не перечитывать .env."""

    return Settings()  # type: ignore[call-arg]


settings = get_settings()

