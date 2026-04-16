from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common import settings

from backend.app.api import appointments as appointments_router
from backend.app.api import auth as auth_router
from backend.app.api import bookings as bookings_router
from backend.app.api import masters as masters_router
from backend.app.api import profile as profile_router
from backend.app.api import resources as resources_router
from backend.app.api import salon_actions as salon_actions_router
from backend.app.api import salons as salons_router
from backend.app.api import schedules as schedules_router
from backend.app.api import services as services_router


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
    app.include_router(profile_router.router, prefix="/api", tags=["profile"])
    app.include_router(masters_router.router, prefix="/api/masters", tags=["masters"])
    app.include_router(salons_router.router, prefix="/api/salons", tags=["salons"])
    app.include_router(salon_actions_router.router, prefix="/api/salons", tags=["salon-actions"])
    app.include_router(bookings_router.router, prefix="/api/bookings", tags=["bookings"])
    app.include_router(services_router.router, prefix="/api/services", tags=["services"])
    app.include_router(schedules_router.router, prefix="/api/schedules", tags=["schedules"])
    app.include_router(appointments_router.router, prefix="/api/appointments", tags=["appointments"])
    app.include_router(resources_router.router, prefix="/api", tags=["resources"])

    @app.get("/health", tags=["health"])
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
