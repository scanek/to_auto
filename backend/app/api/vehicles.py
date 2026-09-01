from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from collections import defaultdict

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

async def batch_populate_vehicles_totals(db: AsyncSession, vehicles: list[Vehicle], responses: list[VehicleResponse]):
    """
    High-performance batch aggregation that eliminates N+1 SQL queries.
    Replaces 6*N queries with exactly 5 batch queries using GROUP BY.
    """
    if not vehicles:
        return

    v_ids = [v.id for v in vehicles]
    resp_map = {r.id: r for r in responses}
    vehicle_map = {v.id: v for v in vehicles}

    # 1. Batch Service Costs
    srv_rows = (await db.execute(
        select(
            ServiceRecord.vehicle_id,
            ServiceRecord.total_cost,
            ServiceRecord.cost_parts,
            ServiceRecord.cost_labor
        ).where(ServiceRecord.vehicle_id.in_(v_ids))
    )).all()
    
    srv_totals = defaultdict(float)
    for vid, total, parts, labor in srv_rows:
        srv_totals[vid] += max(total or 0.0, (parts or 0.0) + (labor or 0.0))

    # 2. Batch Fuel Costs & Avg Consumption
    fuel_rows = (await db.execute(
        select(
            FuelLog.vehicle_id,
            func.sum(FuelLog.total_cost),
            func.avg(FuelLog.consumption)
        )
        .where(FuelLog.vehicle_id.in_(v_ids))
        .group_by(FuelLog.vehicle_id)
    )).all()
    
    fuel_totals = {vid: (tot or 0.0) for vid, tot, _ in fuel_rows}
    fuel_avgs = {vid: (round(avg_c, 2) if avg_c else None) for vid, _, avg_c in fuel_rows}

    # 3. Batch Tyre Costs
    tyre_rows = (await db.execute(
        select(TyreSet.vehicle_id, func.sum(TyreSet.total_price))
        .where(TyreSet.vehicle_id.in_(v_ids))
        .group_by(TyreSet.vehicle_id)
    )).all()
    tyre_totals = {vid: (tot or 0.0) for vid, tot in tyre_rows}

    # 4. Batch Document Costs
    doc_rows = (await db.execute(
        select(DocumentNote.vehicle_id, func.sum(DocumentNote.price))
        .where(DocumentNote.vehicle_id.in_(v_ids))
        .group_by(DocumentNote.vehicle_id)
    )).all()
    doc_totals = {vid: (tot or 0.0) for vid, tot in doc_rows}

    # 5. Batch Active Reminders & Status Calculation
    reminders = (await db.execute(
        select(MaintenancePlan)
        .where(MaintenancePlan.vehicle_id.in_(v_ids), MaintenancePlan.is_active == True)
    )).scalars().all()
    
    rem_groups = defaultdict(list)
    for r in reminders:
        rem_groups[r.vehicle_id].append(r)

    # Assign aggregated metrics to responses in O(1)
    for vid, resp in resp_map.items():
        v = vehicle_map.get(vid)
        srv_cost = srv_totals[vid]
        fuel_cost = fuel_totals.get(vid, 0.0)
        tyre_cost = tyre_totals.get(vid, 0.0)
        doc_cost = doc_totals.get(vid, 0.0)

        resp.total_service_cost = srv_cost
        resp.total_fuel_cost = fuel_cost
        resp.total_cost = srv_cost + fuel_cost + tyre_cost + doc_cost
        resp.avg_fuel_consumption = fuel_avgs.get(vid)

        active_rems = rem_groups[vid]
        resp.active_reminders_count = len(active_rems)
        if v:
            resp.overdue_reminders_count = sum(
                1 for r in active_rems if compute_reminder_status(r, v)["status"] in ("due_soon", "overdue")
            )
        else:
            resp.overdue_reminders_count = 0

@router.get("", response_model=List[VehicleResponse])
async def get_vehicles(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get vehicles with batch aggregation that eliminates N+1 SQL queries."""
    if not current_user:
        query = (
            select(Vehicle)
            .options(selectinload(Vehicle.user))
            .where(Vehicle.is_public == True)
            .order_by(Vehicle.created_at.desc())
        )
        result = await db.execute(query)
        vehicles = result.scalars().all()
        responses = []
        for v in vehicles:
            resp = VehicleResponse.model_validate(v)
            resp.is_owner = False
            if v.user:
                resp.owner_name = v.user.full_name or v.user.username
            responses.append(resp)
        await batch_populate_vehicles_totals(db, vehicles, responses)
        return responses

    query = (
        select(Vehicle)
        .options(selectinload(Vehicle.user))
        .where(or_(Vehicle.user_id == current_user.id, Vehicle.is_public == True))
        .order_by(Vehicle.created_at.desc())
    )
    result = await db.execute(query)
    vehicles = result.scalars().all()

    responses = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        resp.is_owner = (v.user_id == current_user.id)
        if v.user:
            resp.owner_name = v.user.full_name or v.user.username
        responses.append(resp)

    await batch_populate_vehicles_totals(db, vehicles, responses)
    return responses

@router.get("/admin/all", response_model=list[VehicleResponse])
async def get_all_vehicles_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: list ALL vehicles across all users."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )
    
    query = (
        select(Vehicle)
        .options(selectinload(Vehicle.user))
        .order_by(Vehicle.created_at.desc())
    )
    result = await db.execute(query)
    vehicles = result.scalars().all()

    responses = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        resp.is_owner = (v.user_id == current_user.id)
        if v.user:
            resp.owner_name = v.user.full_name or v.user.username
        responses.append(resp)

    await batch_populate_vehicles_totals(db, vehicles, responses)
    return responses

@router.delete("/admin/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle_admin(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: delete any vehicle."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ разрешен только администраторам",
        )
    
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Автомобиль не найден",
        )
    
    await db.delete(vehicle)
    await db.commit()
    return None

@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    resp = VehicleResponse.model_validate(vehicle)
    resp.is_owner = bool(current_user and vehicle.user_id == current_user.id)
    if vehicle.user:
        resp.owner_name = vehicle.user.full_name or vehicle.user.username
    await batch_populate_vehicles_totals(db, [vehicle], [resp])
    return resp

@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_in: VehicleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = Vehicle(**vehicle_in.model_dump(), user_id=current_user.id)
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    resp = VehicleResponse.model_validate(vehicle)
    resp.is_owner = True
    resp.owner_name = current_user.full_name or current_user.username
    await batch_populate_vehicles_totals(db, [vehicle], [resp])
    return resp

@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    update_data = vehicle_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)
    await db.commit()
    await db.refresh(vehicle)
    resp = VehicleResponse.model_validate(vehicle)
    resp.is_owner = True
    resp.owner_name = current_user.full_name or current_user.username
    await batch_populate_vehicles_totals(db, [vehicle], [resp])
    return resp

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    await db.delete(vehicle)
    await db.commit()
    return None
