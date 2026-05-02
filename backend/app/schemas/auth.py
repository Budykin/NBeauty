from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from common.models import LoginSessionStatus, UserRole


class TelegramInitData(BaseModel):
    # Фронт присылает initData, а в питоне мы используем snake_case
    init_data: str = Field(alias="initData")


class AuthResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    token_type: str = Field(serialization_alias="tokenType")
    user_id: int = Field(serialization_alias="userId")
    full_name: str = Field(serialization_alias="fullName")
    username: str | None = None
    avatar: str | None = None
    role: UserRole

    model_config = ConfigDict(populate_by_name=True)


class LoginSessionResponse(BaseModel):
    token: str
    status: LoginSessionStatus
    expires_at: datetime = Field(serialization_alias="expiresAt")
    bot_link: str = Field(serialization_alias="botLink")

    model_config = ConfigDict(populate_by_name=True)


class LoginSessionStatusResponse(BaseModel):
    status: LoginSessionStatus
    expires_at: datetime = Field(serialization_alias="expiresAt")
    bot_link: str = Field(serialization_alias="botLink")
    auth: AuthResponse | None = None

    model_config = ConfigDict(populate_by_name=True)
