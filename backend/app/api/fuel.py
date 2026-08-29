from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.fuel import FuelLog
from app.schemas.fuel import FuelLogCreate, FuelLogUpdate, FuelLogResponse
from app.services.fuel_service import recalculate_fuel_logs
from app.core.security import get_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/fuel-logs", tags=["Fuel Logs"])

@router.get("", response_model=List[FuelLogResponse])
async def get_fuel_logs(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user)
    query = select(FuelLog).where(FuelLog.vehicle_id == vehicle_id).order_by(FuelLog.date.desc(), FuelLog.odometer.desc())
    result = await db.execute(query)
    logs = result.scalars().all()
    return [FuelLogResponse.model_validate(f) for f in logs]

@router.post("", response_model=FuelLogResponse, status_code=status.HTTP_201_CREATED)
async def create_fuel_log(
    payload: FuelLogCreate,
    vehicle_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user)

    data = payload.model_dump()
    # If unit_price or total_cost is 0, auto-fill
    if data["unit_price"] == 0 and data["fuel_amount"] > 0 and data["total_cost"] > 0:
        data["unit_price"] = round(data["total_cost"] / data["fuel_amount"], 2)
    elif data["total_cost"] == 0 and data["fuel_amount"] > 0 and data["unit_price"] > 0:
        data["total_cost"] = round(data["fuel_amount"] * data["unit_price"], 2)

    log = FuelLog(**data, vehicle_id=vehicle_id)
    db.add(log)

    if log.odometer > (vehicle.current_odometer or 0.0):
        vehicle.current_odometer = log.odometer

    await db.commit()
    await db.refresh(log)

    # Recalculate fuel economy for all logs
    await recalculate_fuel_logs(db, vehicle_id)
    await db.refresh(log)

    return FuelLogResponse.model_validate(log)

@router.put("/{log_id}", response_model=FuelLogResponse)
async def update_fuel_log(
    log_id: int,
    payload: FuelLogUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FuelLog).where(FuelLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Запись заправки не найдена")

    await verify_vehicle_access(db, log.vehicle_id, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)

    await db.commit()
    await recalculate_fuel_logs(db, log.vehicle_id)
    await db.refresh(log)

    return FuelLogResponse.model_validate(log)

@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fuel_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FuelLog).where(FuelLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Запись заправки не найдена")

    await verify_vehicle_access(db, log.vehicle_id, current_user)
    vehicle_id = log.vehicle_id
    await db.delete(log)
    await db.commit()

    await recalculate_fuel_logs(db, vehicle_id)
    return None
