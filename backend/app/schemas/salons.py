from __future__ import annotations
from typing import List
from pydantic import BaseModel, Field, ConfigDict

class ResourceOut(BaseModel):
    id: str
    name: str
    salon_id: str = Field(serialization_alias="salonId")
    is_active: bool = Field(serialization_alias="isActive")

    model_config = ConfigDict(from_attributes=True)

class SalonMemberOut(BaseModel):
    id: str
    master_id: str = Field(serialization_alias="masterId")
    master_name: str = Field(serialization_alias="masterName")
    master_avatar: str = Field(serialization_alias="masterAvatar")
    role: str
    joined_at: str = Field(serialization_alias="joinedAt")

    model_config = ConfigDict(from_attributes=True)

class SalonOut(BaseModel):
    id: str
    name: str
    owner_id: str = Field(serialization_alias="ownerId")
    invite_code: str | None = Field(default=None, serialization_alias="inviteCode")
    members: List[SalonMemberOut]
    resources: List[ResourceOut]

    model_config = ConfigDict(from_attributes=True)