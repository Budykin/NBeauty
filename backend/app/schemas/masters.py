from __future__ import annotations
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

class MasterOut(BaseModel):
    """Карта мастера для фронтенда."""
    id: str
    name: str
    avatar: str
    specialty: str
    rating: float
    review_count: int = Field(serialization_alias="reviewCount")
    services: List[ServiceOut]
    salon_id: str | None = Field(default=None, serialization_alias="salonId")

    model_config = ConfigDict(from_attributes=True)