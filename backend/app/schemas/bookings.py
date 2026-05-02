from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class BookingCreate(BaseModel):
    # Фронтенд присылает данные в camelCase
    master_id: int = Field(alias="masterId")
    service_id: int = Field(alias="serviceId")
    start_time: datetime = Field(alias="startTime")
    # Пока клиент авторизацию не передает в заголовках, будем брать его ID из тела
    client_id: int = Field(alias="clientId")

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
