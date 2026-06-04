from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from common.phone_numbers import normalize_telephone_number


ClientType = Literal["registered", "guest"]


class ClientListItemOut(BaseModel):
    id: str
    type: ClientType
    full_name: str = Field(alias="fullName")
    telephone_number: str | None = Field(default=None, alias="telephoneNumber")
    note: str = ""
    appointments_count: int = Field(alias="appointmentsCount")
    last_appointment_at: datetime | None = Field(default=None, alias="lastAppointmentAt")

    model_config = ConfigDict(populate_by_name=True)


class ClientAppointmentHistoryItemOut(BaseModel):
    id: int
    service_name: str = Field(alias="serviceName")
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    status: str
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class ClientDetailOut(BaseModel):
    id: str
    type: ClientType
    full_name: str = Field(alias="fullName")
    telephone_number: str | None = Field(default=None, alias="telephoneNumber")
    username: str | None = None
    note: str = ""
    appointments_count: int = Field(alias="appointmentsCount")
    last_appointment_at: datetime | None = Field(default=None, alias="lastAppointmentAt")
    history: list[ClientAppointmentHistoryItemOut] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class GuestClientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255, alias="fullName")
    telephone_number: str = Field(min_length=1, alias="telephoneNumber")
    note: str | None = Field(default=None, max_length=2000)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("telephone_number")
    @classmethod
    def validate_telephone_number(cls, value: str) -> str:
        normalized = normalize_telephone_number(value)
        if normalized is None:
            raise ValueError("Укажи корректный номер телефона")
        return normalized

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class ClientNoteUpdate(BaseModel):
    note: str = Field(default="", max_length=2000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str) -> str:
        return value.strip()
