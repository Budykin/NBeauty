from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PlatformAdminMeOut(BaseModel):
    is_admin: bool = Field(alias="isAdmin")

    model_config = ConfigDict(populate_by_name=True)


class ConfirmDelete(BaseModel):
    confirm: bool = False


class AdminUserOut(BaseModel):
    tg_id: int = Field(alias="tgId")
    full_name: str = Field(alias="fullName")
    username: Optional[str] = None
    role: str
    rating: float
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AdminSalonOut(BaseModel):
    id: str
    name: str
    owner_id: int = Field(alias="ownerId")
    invite_code: str = Field(alias="inviteCode")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class DeleteImpactOut(BaseModel):
    entity_type: str = Field(alias="entityType")
    entity_id: str = Field(alias="entityId")
    counts: dict[str, int]
    warnings: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class AdminAnalyticsOut(BaseModel):
    totals: dict[str, int]
    appointments_by_status: dict[str, int] = Field(alias="appointmentsByStatus")
    appointments_recent: dict[str, int] = Field(alias="appointmentsRecent")
    average_master_rating: float = Field(alias="averageMasterRating")
    top_masters: list[dict[str, Any]] = Field(alias="topMasters")
    top_salons: list[dict[str, Any]] = Field(alias="topSalons")
    telegram_login_sessions: dict[str, int] = Field(alias="telegramLoginSessions")

    model_config = ConfigDict(populate_by_name=True)
