from __future__ import annotations

from backend.main import app
from common.models import Appointment, AppointmentStatus, Review, Salon, User


def test_models_match_dump_removed_columns():
    assert "review_count" not in User.__table__.columns
    assert "master_id" not in Review.__table__.columns
    assert "client_id" not in Review.__table__.columns
    assert "appointment_id" in Review.__table__.columns


def test_appointment_status_values_match_postgres_check():
    assert {status.value for status in AppointmentStatus} == {
        "pending",
        "confirmed",
        "upcoming",
        "cancelled",
        "completed",
    }
    assert "status" in Appointment.__table__.columns


def test_salon_invite_code_is_database_owned_business_logic():
    assert "invite_code" in Salon.__table__.columns
    assert Salon.__table__.columns["invite_code"].default is None


def test_crud_routes_are_registered():
    paths = {route.path for route in app.routes}

    assert "/api/bookings/create" in paths
    assert "/api/reviews/" in paths
    assert "/api/salons/create" in paths
    assert "/api/appointments/{appointment_id}/confirm" in paths
    assert "/api/appointments/{appointment_id}/complete" in paths
