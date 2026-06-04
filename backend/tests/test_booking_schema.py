from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.schemas.bookings import BookingCreate


def test_booking_create_accepts_registered_client_payload():
    payload = BookingCreate.model_validate(
        {
            "masterId": 10,
            "serviceId": 20,
            "startTime": "2026-06-05T10:00:00+03:00",
            "clientId": 30,
        }
    )

    assert payload.client_id == 30
    assert payload.guest_client_id is None


def test_booking_create_accepts_guest_client_payload():
    payload = BookingCreate.model_validate(
        {
            "masterId": 10,
            "serviceId": 20,
            "startTime": "2026-06-05T10:00:00+03:00",
            "guestClientId": 40,
        }
    )

    assert payload.client_id is None
    assert payload.guest_client_id == 40


@pytest.mark.parametrize(
    "payload",
    [
        {
            "masterId": 10,
            "serviceId": 20,
            "startTime": "2026-06-05T10:00:00+03:00",
        },
        {
            "masterId": 10,
            "serviceId": 20,
            "startTime": "2026-06-05T10:00:00+03:00",
            "clientId": 30,
            "guestClientId": 40,
        },
    ],
)
def test_booking_create_requires_exactly_one_client_target(payload: dict[str, object]):
    with pytest.raises(ValidationError):
        BookingCreate.model_validate(payload)
