from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.core.security import get_password_hash
from app.core.deps import CurrentUser, AdminUser

router = APIRouter(prefix="/users", tags=["使用者管理"])


@router.get("", response_model=UserListResponse, summary="取得所有使用者（管理員）")
async def list_users(
    current_user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(default=0, ge=0, description="略過筆數"),
    limit: int = Query(default=20, ge=1, le=100, description="每頁筆數"),
    role: Optional[UserRole] = Query(default=None, description="依角色篩選"),
    is_active: Optional[bool] = Query(default=None, description="依啟用狀態篩選"),
):
    query = select(User)
    count_query = select(func.count(User.id))

    if role is not None:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset(skip).limit(limit).order_by(User.id)
    result = await db.execute(query)
    users = result.scalars().all()

    return UserListResponse(total=total, items=list(users))


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="建立新使用者（管理員）")
async def create_user(
    user_data: UserCreate,
    current_user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"電子郵件 {user_data.email} 已被使用",
        )

    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user


@router.get("/{user_id}", response_model=UserResponse, summary="取得指定使用者（管理員）")
async def get_user(
    user_id: int,
    current_user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該使用者")
    return user


@router.put("/{user_id}", response_model=UserResponse, summary="更新使用者資料（管理員）")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該使用者")

    # Prevent disabling yourself
    if user_id == current_user.id and user_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法停用自己的帳號",
        )

    # Check email uniqueness
    if user_data.email and user_data.email != user.email:
        result2 = await db.execute(select(User).where(User.email == user_data.email))
        if result2.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"電子郵件 {user_data.email} 已被使用",
            )

    update_fields = user_data.model_dump(exclude_unset=True)
    if "password" in update_fields:
        user.hashed_password = get_password_hash(update_fields.pop("password"))
    for field, value in update_fields.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="刪除使用者（管理員）")
async def delete_user(
    user_id: int,
    current_user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法刪除自己的帳號",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該使用者")

    await db.delete(user)
