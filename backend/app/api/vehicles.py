from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.models.fuel import FuelLog
from app.models.reminder import MaintenancePlan
from app.models.tyre import TyreSet
from app.models.document import DocumentNote
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse
from app.services.reminder_service import compute_reminder_status
from app.core.security import get_current_user

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

async def calculate_vehicle_totals(db: AsyncSession, v: Vehicle, resp: VehicleResponse):
    # Service
    srv_cost_res = await db.execute(
        select(func.sum(ServiceRecord.total_cost)).where(ServiceRecord.vehicle_id == v.id)
    )
    resp.total_service_cost = srv_cost_res.scalar() or 0.0

    # Fuel
    fuel_cost_res = await db.execute(
        select(func.sum(FuelLog.total_cost)).where(FuelLog.vehicle_id == v.id)
    )
    resp.total_fuel_cost = fuel_cost_res.scalar() or 0.0

    # Tyres
    tyre_cost_res = await db.execute(
        select(func.sum(TyreSet.total_price)).where(TyreSet.vehicle_id == v.id)
    )
    tyre_cost = tyre_cost_res.scalar() or 0.0

    # Documents
    doc_cost_res = await db.execute(
        select(func.sum(DocumentNote.price)).where(DocumentNote.vehicle_id == v.id)
    )
    doc_cost = doc_cost_res.scalar() or 0.0

    resp.total_cost = resp.total_service_cost + resp.total_fuel_cost + tyre_cost + doc_cost

    # Reminders status count
    reminders_res = await db.execute(
        select(MaintenancePlan).where(MaintenancePlan.vehicle_id == v.id, MaintenancePlan.is_active == True)
    )
    reminders = reminders_res.scalars().all()
    resp.active_reminders_count = len(reminders)
    resp.overdue_reminders_count = sum(
        1 for r in reminders if compute_reminder_status(r, v)["status"] in ("due_soon", "overdue")
    )

    # Avg fuel consumption
    fuel_logs_res = await db.execute(
        select(func.avg(FuelLog.consumption)).where(
            FuelLog.vehicle_id == v.id, FuelLog.consumption.is_not(None)
        )
    )
    avg_c = fuel_logs_res.scalar()
    resp.avg_fuel_consumption = round(avg_c, 2) if avg_c else None

async def get_user_vehicle_or_404(vehicle_id: int, user: User, db: AsyncSession) -> Vehicle:
    query = select(Vehicle).where(Vehicle.id == vehicle_id)
    if user.role != UserRole.ADMIN:
        query = query.where(or_(Vehicle.user_id == user.id, Vehicle.user_id.is_(None)))
    res = await db.execute(query)
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден или нет доступа")
    return vehicle

@router.get("", response_model=List[VehicleResponse])
async def get_vehicles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get vehicles belonging to the current authenticated user."""
    if current_user.role == UserRole.ADMIN:
        query = select(Vehicle).order_by(Vehicle.created_at.desc())
    else:
        query = select(Vehicle).where(
            or_(Vehicle.user_id == current_user.id, Vehicle.user_id.is_(None))
        ).order_by(Vehicle.created_at.desc())
        
    result = await db.execute(query)
    vehicles = result.scalars().all()
    
    responses = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        await calculate_vehicle_totals(db, v, resp)
        responses.append(resp)

    return responses

@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    payload: VehicleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new vehicle belonging to the current user."""
    data = payload.model_dump()
    if not data.get("current_odometer") and data.get("starting_odometer"):
        data["current_odometer"] = data["starting_odometer"]
    
    vehicle = Vehicle(**data, user_id=current_user.id)
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)

@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a vehicle owned by the current user."""
    vehicle = await get_user_vehicle_or_404(vehicle_id, current_user, db)
    resp = VehicleResponse.model_validate(vehicle)
    await calculate_vehicle_totals(db, vehicle, resp)
    return resp

@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update vehicle owned by the current user."""
    vehicle = await get_user_vehicle_or_404(vehicle_id, current_user, db)
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
    
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete vehicle owned by the current user."""
    vehicle = await get_user_vehicle_or_404(vehicle_id, current_user, db)
    await db.delete(vehicle)
    await db.commit()
    return None
