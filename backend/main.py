from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common import settings

from app.api import auth as auth_router
from app.api import bookings as bookings_router
from app.api import masters as masters_router
from app.api import salons as salons_router


def create_app() -> FastAPI:
    """Фабрика приложения FastAPI."""

    app = FastAPI(
        title="NBeauty API",
        version="0.1.0",
    )

    # CORS для фронтенда (localhost и прод-домен из настроек)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Роутеры
    app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
    app.include_router(masters_router.router, prefix="/api/masters", tags=["masters"])
    app.include_router(salons_router.router, prefix="/api/salons", tags=["salons"])
    app.include_router(bookings_router.router, prefix="/api/bookings", tags=["bookings"])

    return app


app = create_app()

