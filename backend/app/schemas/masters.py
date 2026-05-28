from __future__ import annotations
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field, ConfigDict

class ServiceOut(BaseModel):
    """Услуга мастера для фронта."""
    id: str
    name: str
    price: int
    duration: int
    resource_id: str | None = Field(default=None, validation_alias="resource_id", serialization_alias="resourceId")

    model_config = ConfigDict(from_attributes=True)


class ScheduleOut(BaseModel):
    """Рабочий день мастера для календаря записи."""

    id: int
    day_of_week: int = Field(serialization_alias="dayOfWeek")
    is_enabled: bool = Field(serialization_alias="isEnabled")
    start_time: str = Field(serialization_alias="startTime")
    end_time: str = Field(serialization_alias="endTime")

    model_config = ConfigDict(from_attributes=True)


class ReviewSummaryOut(BaseModel):
    """Короткий отзыв для карточки мастера."""

    id: int
    rating: int
    comment: str | None = None
    client_name: str = Field(serialization_alias="clientName")
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = ConfigDict(from_attributes=True)


class MasterOut(BaseModel):
    """Карта мастера для фронтенда."""
    id: str
    name: str
    username: str | None = None
    telegram_id: int = Field(serialization_alias="telegramId")
    avatar: str
    specialty: str
    rating: float
    review_count: int = Field(serialization_alias="reviewCount")
    recent_reviews: List[ReviewSummaryOut] = Field(default_factory=list, serialization_alias="recentReviews")
    services: List[ServiceOut]
    schedules: List[ScheduleOut] = Field(default_factory=list)
    salon_id: str | None = Field(default=None, serialization_alias="salonId")

    model_config = ConfigDict(from_attributes=True)
