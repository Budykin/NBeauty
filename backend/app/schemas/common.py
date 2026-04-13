from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


# ============================================================================
# Профиль пользователя
# ============================================================================

class MeOut(BaseModel):
    """Текущий пользователь."""
    tg_id: int = Field(serialization_alias="tgId")
    full_name: str = Field(serialization_alias="fullName")
    username: Optional[str] = None
    role: str
    avatar: Optional[str] = None
    specialty: Optional[str] = None
    rating: float
    review_count: int = Field(serialization_alias="reviewCount")

    model_config = ConfigDict(from_attributes=True)


class MeUpdate(BaseModel):
    """Обновление профиля."""
    full_name: Optional[str] = Field(default=None, serialization_alias="fullName")
    specialty: Optional[str] = None
    avatar: Optional[str] = None


class BecomeMasterOut(BaseModel):
    """Результат перехода в роль мастера."""
    role: str
    message: str


# ============================================================================
# Салоны
# ============================================================================

class SalonCreate(BaseModel):
    """Создание салона."""
    name: str = Field(min_length=1, max_length=255)


class SalonJoin(BaseModel):
    """Вступление в салон по коду приглашения."""
    invite_code: str = Field(min_length=1, max_length=24, alias="inviteCode")


# ============================================================================
# Услуги
# ============================================================================

class ServiceCreate(BaseModel):
    """Создание услуги."""
    name: str = Field(min_length=1, max_length=255)
    duration: int = Field(gt=0, description="Длительность в минутах")
    price: int = Field(ge=0, description="Цена")
    salon_id: Optional[str] = Field(default=None, alias="salonId")
    resource_id: Optional[int] = Field(default=None, alias="resourceId")


class ServiceUpdate(BaseModel):
    """Обновление услуги."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    duration: Optional[int] = Field(default=None, gt=0)
    price: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = Field(default=None, alias="isActive")
    resource_id: Optional[int] = Field(default=None, alias="resourceId")


class ServiceOut(BaseModel):
    id: int
    name: str
    duration: int
    price: int
    salon_id: Optional[str] = Field(default=None, alias="salonId")
    resource_id: Optional[int] = Field(default=None, alias="resourceId")
    is_active: bool = Field(alias="isActive")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# Расписание
# ============================================================================

class ScheduleCreate(BaseModel):
    """Создание расписания."""
    salon_id: Optional[str] = Field(default=None, alias="salonId")
    day_of_week: int = Field(ge=0, le=6, alias="dayOfWeek")
    is_enabled: bool = Field(default=True, alias="isEnabled")
    start_time: str = Field(alias="startTime", description="Формат: HH:MM")
    end_time: str = Field(alias="endTime", description="Формат: HH:MM")


class ScheduleOut(BaseModel):
    id: int
    salon_id: Optional[str] = Field(default=None, alias="salonId")
    day_of_week: int = Field(alias="dayOfWeek")
    is_enabled: bool = Field(alias="isEnabled")
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# Ресурсы
# ============================================================================

class ResourceCreate(BaseModel):
    """Создание ресурса."""
    name: str = Field(min_length=1, max_length=255)
    is_active: bool = Field(default=True, alias="isActive")


class ResourceUpdate(BaseModel):
    """Обновление ресурса."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    is_active: Optional[bool] = Field(default=None, alias="isActive")


class ResourceOut(BaseModel):
    id: int
    salon_id: str = Field(alias="salonId")
    name: str
    is_active: bool = Field(alias="isActive")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# Слоты (доступное время)
# ============================================================================

class TimeSlotOut(BaseModel):
    """Свободный слот."""
    start: datetime
    end: datetime


# ============================================================================
# Записи
# ============================================================================

class AppointmentOut(BaseModel):
    """Запись на приём."""
    id: int
    salon_id: Optional[str] = Field(default=None, alias="salonId")
    master_id: int = Field(alias="masterId")
    master_name: str = Field(alias="masterName")
    client_id: int = Field(alias="clientId")
    client_name: str = Field(alias="clientName")
    service_name: str = Field(alias="serviceName")
    resource_id: Optional[int] = Field(default=None, alias="resourceId")
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    status: str
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
