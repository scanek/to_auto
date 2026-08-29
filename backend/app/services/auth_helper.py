from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.core.security import decode_access_token

async def verify_vehicle_access(db: AsyncSession, vehicle_id: int, user: Optional[User]) -> Vehicle:
    query = select(Vehicle).where(Vehicle.id == vehicle_id)
    if user and user.role != UserRole.ADMIN:
        query = query.where(or_(Vehicle.user_id == user.id, Vehicle.user_id.is_(None)))
    elif not user:
        # If not authenticated, allow only unassigned demo vehicles if any
        query = query.where(Vehicle.user_id.is_(None))

    res = await db.execute(query)
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Автомобиль не найден или у вас нет прав доступа к нему",
        )
    return vehicle

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
