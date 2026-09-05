import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.user import UserRole

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=4, max_length=100)

class UserLogin(BaseModel):
    username: str # Can be username or email
    password: str

class UserChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=4)

class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: str = "Успешная авторизация"

class SetupStatusResponse(BaseModel):
    has_users: bool
    allow_registration: bool = True

class AdminUserResponse(UserResponse):
    vehicles_count: int = 0


class ForgotPasswordRequest(BaseModel):
    identifier: str

class ForgotPasswordResponse(BaseModel):
    status: str
    channel: str  # "telegram" | "telegram_bot_link" | "email" | "admin_only"
    message: str
    bot_url: Optional[str] = None
    masked_destination: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    identifier: str
    code: str
    new_password: str = Field(..., min_length=4)

class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=4)
