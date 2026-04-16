from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic import AliasChoices, AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Глобальные настройки проекта, общие для backend и бота."""

    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

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
    telegram_bot_url: str = Field(
        default="https://t.me/test_bot",
        validation_alias=AliasChoices("TELEGRAM_BOT_URL", "FRONTEND_URL"),
    )

    # CORS
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
        ],
        alias="CORS_ORIGINS",
    )

    # Локальные frontend/dev-переменные могут жить в общем .env,
    # поэтому принимаем их здесь как необязательные, чтобы бот не падал.
    next_public_api_url: str | None = Field(default=None, alias="NEXT_PUBLIC_API_URL")
    backend_internal_url: str | None = Field(default=None, alias="BACKEND_INTERNAL_URL")
    allowed_dev_origins: str | None = Field(default=None, alias="ALLOWED_DEV_ORIGINS")

@lru_cache
def get_settings() -> Settings:
    """Кешированный доступ к настройкам, чтобы не перечитывать .env."""

    return Settings()  # type: ignore[call-arg]


settings = get_settings()
