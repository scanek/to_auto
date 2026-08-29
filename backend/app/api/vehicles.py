from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.models.fuel import FuelLog
from app.models.reminder import MaintenancePlan
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse
from app.services.reminder_service import compute_reminder_status

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

@router.get("", response_model=List[VehicleResponse])
async def get_vehicles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vehicle).order_by(Vehicle.created_at.desc()))
    vehicles = result.scalars().all()
    
    responses = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        
        # Calculate summary metrics
        srv_cost_res = await db.execute(
            select(func.sum(ServiceRecord.total_cost)).where(ServiceRecord.vehicle_id == v.id)
        )
        resp.total_service_cost = srv_cost_res.scalar() or 0.0

        fuel_cost_res = await db.execute(
            select(func.sum(FuelLog.total_cost)).where(FuelLog.vehicle_id == v.id)
        )
        resp.total_fuel_cost = fuel_cost_res.scalar() or 0.0
        resp.total_cost = resp.total_service_cost + resp.total_fuel_cost

        # Reminders status count
        reminders_res = await db.execute(
            select(MaintenancePlan).where(MaintenancePlan.vehicle_id == v.id, MaintenancePlan.is_active == True)
        )
        reminders = reminders_res.scalars().all()
        active_count = len(reminders)
        overdue_count = 0
        for r in reminders:
            status_data = compute_reminder_status(r, v)
            if status_data["status"] in ("due_soon", "overdue"):
                overdue_count += 1
        
        resp.active_reminders_count = active_count
        resp.overdue_reminders_count = overdue_count

        # Avg fuel consumption
        fuel_logs_res = await db.execute(
            select(func.avg(FuelLog.consumption)).where(
                FuelLog.vehicle_id == v.id, FuelLog.consumption.is_not(None)
            )
        )
        avg_c = fuel_logs_res.scalar()
        resp.avg_fuel_consumption = round(avg_c, 2) if avg_c else None

        responses.append(resp)

    return responses

@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(payload: VehicleCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    if not data.get("current_odometer") and data.get("starting_odometer"):
        data["current_odometer"] = data["starting_odometer"]
    
    vehicle = Vehicle(**data)
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)

@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    resp = VehicleResponse.model_validate(vehicle)
    srv_cost_res = await db.execute(
        select(func.sum(ServiceRecord.total_cost)).where(ServiceRecord.vehicle_id == vehicle.id)
    )
    resp.total_service_cost = srv_cost_res.scalar() or 0.0

    fuel_cost_res = await db.execute(
        select(func.sum(FuelLog.total_cost)).where(FuelLog.vehicle_id == vehicle.id)
    )
    resp.total_fuel_cost = fuel_cost_res.scalar() or 0.0
    resp.total_cost = resp.total_service_cost + resp.total_fuel_cost

    reminders_res = await db.execute(
        select(MaintenancePlan).where(MaintenancePlan.vehicle_id == vehicle.id, MaintenancePlan.is_active == True)
    )
    reminders = reminders_res.scalars().all()
    resp.active_reminders_count = len(reminders)
    resp.overdue_reminders_count = sum(
        1 for r in reminders if compute_reminder_status(r, vehicle)["status"] in ("due_soon", "overdue")
    )
    
    fuel_logs_res = await db.execute(
        select(func.avg(FuelLog.consumption)).where(
            FuelLog.vehicle_id == vehicle.id, FuelLog.consumption.is_not(None)
        )
    )
    avg_c = fuel_logs_res.scalar()
    resp.avg_fuel_consumption = round(avg_c, 2) if avg_c else None

    return resp

@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
    
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    await db.delete(vehicle)
    await db.commit()
    return None
