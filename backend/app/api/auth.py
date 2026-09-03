from fastapi import Request
from app.core.rate_limiter import limiter, get_client_ip
import os
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.setting import Setting
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserChangePassword,
    UserResponse,
    AdminUserResponse,
    TokenResponse,
    SetupStatusResponse,
)
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_optional_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "true").lower() in ("true", "1", "yes")

@router.get("/setup-status", response_model=SetupStatusResponse)
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    """Returns whether any user exists in the database."""
    count_res = await db.execute(select(func.count(User.id)))
    user_count = count_res.scalar() or 0
    return SetupStatusResponse(
        has_users=user_count > 0,
        allow_registration=ALLOW_REGISTRATION or (user_count == 0),
    )

@router.get("/status")
async def get_auth_status(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Backward compatibility for existing /status requests."""
    count_res = await db.execute(select(func.count(User.id)))
    user_count = count_res.scalar() or 0
    return {
        "has_users": user_count > 0,
        "has_pin": user_count > 0,
        "is_authenticated": current_user is not None,
        "user": UserResponse.model_validate(current_user) if current_user else None,
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the current authenticated user profile."""
    return UserResponse.model_validate(current_user)

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, payload: UserCreate, db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)
    limiter.check(f"register:{ip}", max_requests=5, window_seconds=600, error_message="Слишком много регистраций с вашего IP.")
    """Register a new user account. First registered user becomes Admin."""
    count_res = await db.execute(select(func.count(User.id)))
    user_count = count_res.scalar() or 0

    if user_count > 0 and not ALLOW_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Регистрация новых пользователей временно отключена администратором",
        )

    # Check if username exists
    username_clean = payload.username.strip().lower()
    existing_user_res = await db.execute(
        select(User).where(func.lower(User.username) == username_clean)
    )
    if existing_user_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Пользователь с логином '{payload.username}' уже существует",
        )

    # Check email if provided
    email_clean = payload.email.strip().lower() if payload.email else None
    if email_clean:
        existing_email_res = await db.execute(
            select(User).where(func.lower(User.email) == email_clean)
        )
        if existing_email_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Пользователь с email '{payload.email}' уже существует",
            )

    # First user is automatically Admin
    role = UserRole.ADMIN if user_count == 0 else UserRole.USER

    user = User(
        username=payload.username.strip(),
        email=email_clean,
        full_name=payload.full_name.strip() if payload.full_name else payload.username.strip(),
        hashed_password=get_password_hash(payload.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # If first user and there are legacy unassigned vehicles, assign them to this user
    if user_count == 0:
        unassigned_res = await db.execute(select(Vehicle).where(Vehicle.user_id.is_(None)))
        unassigned_vehicles = unassigned_res.scalars().all()
        for v in unassigned_vehicles:
            v.user_id = user.id
        if unassigned_vehicles:
            await db.commit()

    # Generate JWT token
    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role.value})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        message="Аккаунт успешно зарегистрирован",
    )

@router.post("/login", response_model=TokenResponse)
async def login(request: Request, payload: UserLogin, db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)
    limiter.check(f"login:{ip}", max_requests=10, window_seconds=60, error_message="Слишком много попыток входа.")
    """Authenticate with username or email and password."""
    identifier_clean = payload.username.strip().lower()

    res = await db.execute(
        select(User).where(
            or_(
                func.lower(User.username) == identifier_clean,
                func.lower(User.email) == identifier_clean,
            )
        )
    )
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин (email) или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован. Обратитесь к администратору",
        )

    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role.value})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        message="Успешная авторизация",
    )

@router.post("/change-password")
async def change_password(
    payload: UserChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change current user password."""
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль указан неверно",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    return {"message": "Пароль успешно изменен"}

@router.delete("/me")
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allows authenticated user to delete their own account and all associated data."""
    # Delete all vehicles of this user
    vehicles_res = await db.execute(select(Vehicle).where(Vehicle.user_id == current_user.id))
    vehicles = vehicles_res.scalars().all()
    for v in vehicles:
        await db.delete(v)

    await db.delete(current_user)
    await db.commit()
    return {"message": "Ваш аккаунт и все связанные автомобили успешно удалены"}

@router.get("/users", response_model=list[AdminUserResponse])
async def get_all_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: list all registered users with their vehicle counts."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )

    users_res = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = users_res.scalars().all()

    result = []
    for u in users:
        v_count_res = await db.execute(
            select(func.count(Vehicle.id)).where(Vehicle.user_id == u.id)
        )
        count = v_count_res.scalar() or 0
        u_dict = {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "updated_at": u.updated_at,
            "vehicles_count": count,
        }
        result.append(AdminUserResponse(**u_dict))

    return result

@router.delete("/users/{user_id}")
async def delete_user_by_admin(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: delete a user by ID and all their vehicles/records."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Администратор не может удалить свой собственный аккаунт через эту панель",
        )

    target_user_res = await db.execute(select(User).where(User.id == user_id))
    target_user = target_user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Delete target user's vehicles
    vehicles_res = await db.execute(select(Vehicle).where(Vehicle.user_id == target_user.id))
    vehicles = vehicles_res.scalars().all()
    for v in vehicles:
        await db.delete(v)

    username = target_user.username
    await db.delete(target_user)
    await db.commit()

    return {"message": f"Пользователь '{username}' и все его автомобили успешно удалены"}

from pydantic import BaseModel

class SystemAnnouncementPayload(BaseModel):
    is_active: bool = False
    title: Optional[str] = "Технические работы"
    text: Optional[str] = ""
    type: Optional[str] = "warning"  # 'warning' | 'danger' | 'info' | 'success'

@router.get("/announcement")
async def get_system_announcement(
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint to get the current system announcement (if active)."""
    res = await db.execute(select(Setting).where(Setting.key == "system_announcement"))
    setting = res.scalars().first()
    if not setting or not setting.value:
        return {
            "is_active": False,
            "title": "Технические работы",
            "text": "",
            "type": "warning",
            "updated_at": None,
        }
    try:
        data = json.loads(setting.value)
        return data
    except Exception:
        return {
            "is_active": False,
            "title": "Технические работы",
            "text": "",
            "type": "warning",
            "updated_at": None,
        }

@router.put("/announcement")
async def update_system_announcement(
    payload: SystemAnnouncementPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: update system announcement banner on the main page."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )

    res = await db.execute(select(Setting).where(Setting.key == "system_announcement"))
    setting = res.scalars().first()
    import datetime
    now_str = datetime.datetime.utcnow().isoformat() + "Z"

    data = {
        "is_active": payload.is_active,
        "title": (payload.title or "Технические работы").strip(),
        "text": (payload.text or "").strip(),
        "type": payload.type or "warning",
        "updated_at": now_str,
        "updated_by": current_user.username,
    }

    if not setting:
        setting = Setting(key="system_announcement", value=json.dumps(data, ensure_ascii=False))
        db.add(setting)
    else:
        setting.value = json.dumps(data, ensure_ascii=False)

    await db.commit()
    return {
        "status": "success",
        "message": "Объявление успешно обновлено",
        "data": data,
    }
