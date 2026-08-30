from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.core.security import decode_access_token

async def verify_vehicle_access(
    db: AsyncSession,
    vehicle_id: int,
    user: Optional[User],
    require_owner: bool = False,
    allow_admin_override: bool = False,
) -> Vehicle:
    """
    Verifies access to a vehicle.
    - If require_owner=True (mutating actions: add record, edit car, delete):
      Requires user to be the real owner. Non-owners (even admins in regular garage mode) receive 403 Forbidden.
    - If require_owner=False (reading actions):
      Allows if vehicle belongs to user OR vehicle is public (is_public=True) OR user is admin.
    - allow_admin_override=True:
      Used exclusively in dedicated admin moderation endpoints.
    """
    res = await db.execute(
        select(Vehicle).options(selectinload(Vehicle.user)).where(Vehicle.id == vehicle_id)
    )
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Автомобиль не найден",
        )

    # Check true ownership
    is_owner = bool(user and vehicle.user_id == user.id) or (vehicle.user_id is None)

    # Admin moderation override (only for specific admin endpoints)
    if allow_admin_override and user and user.role == UserRole.ADMIN:
        return vehicle

    if require_owner:
        if not user or not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только владелец автомобиля может вносить или изменять данные",
            )
        return vehicle

    # For read actions: allow owner OR if vehicle is marked public OR admin
    if is_owner or getattr(vehicle, "is_public", False) or (user and user.role == UserRole.ADMIN):
        return vehicle

    # Otherwise denied
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Автомобиль не найден или у вас нет прав доступа к нему",
    )

async def resolve_user_from_header_or_query(
    authorization: Optional[str],
    query_token: Optional[str],
    db: AsyncSession,
) -> Optional[User]:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif query_token:
        token = query_token.strip()

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None

    try:
        user_id = int(payload["sub"])
        res = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        return res.scalar_one_or_none()
    except Exception:
        return None
