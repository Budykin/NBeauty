from pydantic import BaseModel, Field

class TelegramInitData(BaseModel):
    # Фронт присылает initData, а в питоне мы используем snake_case
    init_data: str = Field(alias="initData")

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    full_name: str
    username: str | None = None
    role: str