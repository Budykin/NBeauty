from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

class BookingCreate(BaseModel):
    # Фронтенд присылает данные в camelCase
    master_id: int = Field(alias="masterId")
    service_id: int = Field(alias="serviceId")
    start_time: datetime = Field(alias="startTime")
    client_id: int | None = Field(default=None, alias="clientId")
    guest_client_id: int | None = Field(default=None, alias="guestClientId")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_client_target(self) -> "BookingCreate":
        has_client_id = self.client_id is not None
        has_guest_client_id = self.guest_client_id is not None

        if has_client_id == has_guest_client_id:
            raise ValueError("Нужно указать либо clientId, либо guestClientId")

        return self

class BookingOut(BaseModel):
    id: str
    master_id: str = Field(serialization_alias="masterId")
    client_id: str = Field(serialization_alias="clientId")
    service_id: str = Field(serialization_alias="serviceId")
    resource_id: str | None = Field(default=None, serialization_alias="resourceId")
    start_time: datetime = Field(serialization_alias="startTime")
    end_time: datetime = Field(serialization_alias="endTime")
    status: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
