from __future__ import annotations

from sqlalchemy import BigInteger

from backend.main import app
from common.models import Appointment, AppointmentStatus, ClientNote, GuestClient, Review, Salon, User


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


def test_guest_client_related_models_match_database_shape():
    assert isinstance(GuestClient.__table__.columns["id"].type, BigInteger)
    assert GuestClient.__table__.columns["telephone_number"].nullable is False
    assert isinstance(ClientNote.__table__.columns["guest_client_id"].type, BigInteger)
    assert isinstance(Appointment.__table__.columns["guest_client_id"].type, BigInteger)

    guest_client_fk = next(iter(Appointment.__table__.columns["guest_client_id"].foreign_keys))
    assert guest_client_fk.ondelete == "SET NULL"
    appointment_constraints = {
        constraint.name: str(constraint.sqltext)
        for constraint in Appointment.__table__.constraints
        if getattr(constraint, "sqltext", None) is not None
    }
    assert (
        appointment_constraints["chk_appointments_client_xor_guest"]
        == "NOT (client_id IS NOT NULL AND guest_client_id IS NOT NULL)"
    )


def test_salon_invite_code_is_database_owned_business_logic():
    assert "invite_code" in Salon.__table__.columns
    assert Salon.__table__.columns["invite_code"].default is None


def test_crud_routes_are_registered():
    paths = {route.path for route in app.routes}

    assert "/api/bookings/create" in paths
    assert "/api/clients/my" in paths
    assert "/api/clients/guest" in paths
    assert "/api/clients/guest/{guest_client_id}" in paths
    assert "/api/reviews/" in paths
    assert "/api/salons/create" in paths
    assert "/api/appointments/{appointment_id}/confirm" in paths
    assert "/api/appointments/{appointment_id}/complete" in paths
