from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.models.fuel import FuelLog
from app.models.reminder import MaintenancePlan
from app.models.tyre import TyreSet
from app.models.document import DocumentNote
from app.models.user import User, UserRole
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse
from app.services.reminder_service import compute_reminder_status
from app.services.auth_helper import verify_vehicle_access
from app.core.security import get_current_user, get_optional_current_user

from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

async def calculate_vehicle_totals(db: AsyncSession, v: Vehicle, resp: VehicleResponse):
    # Service
    srv_cost_res = await db.execute(
        select(ServiceRecord.total_cost, ServiceRecord.cost_parts, ServiceRecord.cost_labor).where(ServiceRecord.vehicle_id == v.id)
    )
    srv_records = srv_cost_res.all()
    resp.total_service_cost = sum(
        max(r[0] or 0.0, (r[1] or 0.0) + (r[2] or 0.0)) for r in srv_records
    )

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

@router.get("", response_model=List[VehicleResponse])
async def get_vehicles(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get vehicles. Returns current user's vehicles + public vehicles from other users."""
    if not current_user:
        return []

    # In regular garage view, all users (including admins) see only their own vehicles + other users' public vehicles
    query = (
        select(Vehicle)
        .options(selectinload(Vehicle.user))
        .where(
            or_(
                Vehicle.user_id == current_user.id,
                Vehicle.user_id.is_(None),
                Vehicle.is_public == True,
            )
        )
        .order_by(Vehicle.created_at.desc())
    )
        
    result = await db.execute(query)
    vehicles = result.scalars().all()
    
    responses = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        is_owner = (v.user_id == current_user.id) or (v.user_id is None)
        resp.is_owner = is_owner
        if v.user:
            resp.owner_name = v.user.full_name or v.user.username
        await calculate_vehicle_totals(db, v, resp)
        responses.append(resp)

    return responses

@router.get("/admin/all", response_model=List[VehicleResponse])
async def get_admin_all_vehicles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: returns the complete registry of all vehicles in the platform."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )

    query = select(Vehicle).options(selectinload(Vehicle.user)).order_by(Vehicle.created_at.desc())
    result = await db.execute(query)
    vehicles = result.scalars().all()

    responses = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        resp.is_owner = (v.user_id == current_user.id) or (v.user_id is None)
        if v.user:
            resp.owner_name = v.user.full_name or v.user.username
        await calculate_vehicle_totals(db, v, resp)
        responses.append(resp)

    return responses

@router.delete("/admin/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: forcefully delete any vehicle (moderation)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )

    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True, allow_admin_override=True)
    await db.delete(vehicle)
    await db.commit()
    return None

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
    resp = VehicleResponse.model_validate(vehicle)
    resp.is_owner = True
    resp.owner_name = current_user.full_name or current_user.username
    return resp

@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a vehicle. Allowed for owner, admin, or public vehicles."""
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    resp = VehicleResponse.model_validate(vehicle)
    is_owner = bool(current_user and (vehicle.user_id == current_user.id)) or (vehicle.user_id is None)
    resp.is_owner = is_owner
    if vehicle.user:
        resp.owner_name = vehicle.user.full_name or vehicle.user.username
    await calculate_vehicle_totals(db, vehicle, resp)
    return resp

@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update vehicle. Only owner can update."""
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(vehicle, k, v)
        
    await db.commit()
    await db.refresh(vehicle)
    resp = VehicleResponse.model_validate(vehicle)
    resp.is_owner = True
    resp.owner_name = current_user.full_name or current_user.username
    await calculate_vehicle_totals(db, vehicle, resp)
    return resp

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete vehicle. Only owner can delete."""
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    await db.delete(vehicle)
    await db.commit()
    return None
