from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common import async_session_factory, settings
from common.appointments import auto_complete_due_appointments

from backend.app.api import appointments as appointments_router
from backend.app.api import auth as auth_router
from backend.app.api import bookings as bookings_router
from backend.app.api import clients as clients_router
from backend.app.api import masters as masters_router
from backend.app.api import platform_admin as platform_admin_router
from backend.app.api import profile as profile_router
from backend.app.api import resources as resources_router
from backend.app.api import reviews as reviews_router
from backend.app.api import salon_actions as salon_actions_router
from backend.app.api import salons as salons_router
from backend.app.api import schedules as schedules_router
from backend.app.api import services as services_router


logger = logging.getLogger(__name__)
AUTO_COMPLETE_INTERVAL_SECONDS = 30


async def _auto_complete_due_appointments_loop() -> None:
    while True:
        try:
            async with async_session_factory() as session:
                completed_count = await auto_complete_due_appointments(session)
                if completed_count:
                    await session.commit()
                else:
                    await session.rollback()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Failed to auto-complete due appointments")

        await asyncio.sleep(AUTO_COMPLETE_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_auto_complete_due_appointments_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def create_app() -> FastAPI:
    """Фабрика приложения FastAPI."""

    app = FastAPI(
        title="NBeauty API",
        version="0.1.0",
        lifespan=lifespan,
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
    app.include_router(clients_router.router, prefix="/api/clients", tags=["clients"])
    app.include_router(services_router.router, prefix="/api/services", tags=["services"])
    app.include_router(schedules_router.router, prefix="/api/schedules", tags=["schedules"])
    app.include_router(appointments_router.router, prefix="/api/appointments", tags=["appointments"])
    app.include_router(resources_router.router, prefix="/api", tags=["resources"])
    app.include_router(reviews_router.router, prefix="/api/reviews", tags=["reviews"])
    app.include_router(platform_admin_router.router, prefix="/api/platform-admin", tags=["platform-admin"])

    @app.get("/health", tags=["health"])
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
