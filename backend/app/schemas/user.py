from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.readonly
    is_active: bool = True


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密碼長度至少需要8個字元")
        if not any(c.isupper() for c in v):
            raise ValueError("密碼需包含至少一個大寫字母")
        if not any(c.islower() for c in v):
            raise ValueError("密碼需包含至少一個小寫字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密碼需包含至少一個數字")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("密碼長度至少需要8個字元")
        if not any(c.isupper() for c in v):
            raise ValueError("密碼需包含至少一個大寫字母")
        if not any(c.islower() for c in v):
            raise ValueError("密碼需包含至少一個小寫字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密碼需包含至少一個數字")
        return v


class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    total: int
    items: list[UserResponse]
