from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.schemas.analytics import VehicleAnalytics
from app.services.analytics_service import compute_vehicle_analytics

router = APIRouter(prefix="/analytics", tags=["Analytics & Reports"])

@router.get("/{vehicle_id}", response_model=VehicleAnalytics)
async def get_vehicle_analytics(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    analytics = await compute_vehicle_analytics(db, vehicle)
    return analytics
