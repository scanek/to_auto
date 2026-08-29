from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import VehicleAnalytics
from app.services.analytics_service import compute_vehicle_analytics
from app.core.security import get_current_user, get_optional_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/analytics", tags=["Analytics & Reports"])

@router.get("/{vehicle_id}", response_model=VehicleAnalytics)
async def get_vehicle_analytics(
    vehicle_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    analytics = await compute_vehicle_analytics(db, vehicle)
    return analytics
