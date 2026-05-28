from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from backend.app.core.auth import require_platform_admin
from backend.main import app


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _Session:
    def __init__(self, value):
        self._value = value

    async def execute(self, _statement):
        return _Result(self._value)


class _User:
    tg_id = 1


def test_platform_admin_routes_are_registered():
    paths = {route.path for route in app.routes}

    assert "/api/platform-admin/me" in paths
    assert "/api/platform-admin/analytics" in paths
    assert "/api/platform-admin/users/{user_id}/delete-impact" in paths
    assert "/api/platform-admin/salons/{salon_id}" in paths


def test_require_platform_admin_rejects_non_admin():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_platform_admin(current_user=_User(), session=_Session(None)))

    assert exc.value.status_code == 403


def test_require_platform_admin_allows_active_admin():
    result = asyncio.run(require_platform_admin(current_user=_User(), session=_Session(object())))

    assert result.tg_id == 1
