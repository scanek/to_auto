import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.reminder import MaintenancePlan
from app.schemas.reminder import MaintenancePlanCreate, MaintenancePlanUpdate, MaintenancePlanResponse
from app.services.reminder_service import compute_reminder_status, sync_reminder_baselines
from app.core.security import require_admin

router = APIRouter(prefix="/reminders", tags=["Maintenance Planner & Reminders"])

@router.get("", response_model=List[MaintenancePlanResponse])
async def get_reminders(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    db: AsyncSession = Depends(get_db),
):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    # Automatically sync reminders with latest service records
    await sync_reminder_baselines(db, vehicle_id)

    query = select(MaintenancePlan).where(MaintenancePlan.vehicle_id == vehicle_id).order_by(MaintenancePlan.created_at.desc())
    result = await db.execute(query)
    plans = result.scalars().all()

    responses = []
    for p in plans:
        resp = MaintenancePlanResponse.model_validate(p)
        computed = compute_reminder_status(p, vehicle)
        for k, v in computed.items():
            setattr(resp, k, v)
        responses.append(resp)

    # Sort by urgency: overdue first, then due_soon, then ok
    priority = {"overdue": 0, "due_soon": 1, "ok": 2}
    responses.sort(key=lambda x: (priority.get(x.status, 2), -x.progress_percentage))
    return responses

@router.post("", response_model=MaintenancePlanResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: MaintenancePlanCreate,
    vehicle_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: bool = Depends(require_admin),
):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    data = payload.model_dump()
    if data.get("last_service_odometer") == 0.0 and vehicle.current_odometer:
        data["last_service_odometer"] = vehicle.current_odometer

    plan = MaintenancePlan(**data, vehicle_id=vehicle_id)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    resp = MaintenancePlanResponse.model_validate(plan)
    computed = compute_reminder_status(plan, vehicle)
    for k, v in computed.items():
        setattr(resp, k, v)
    return resp

@router.put("/{plan_id}", response_model=MaintenancePlanResponse)
async def update_reminder(
    plan_id: int,
    payload: MaintenancePlanUpdate,
    db: AsyncSession = Depends(get_db),
    admin: bool = Depends(require_admin),
):
    result = await db.execute(select(MaintenancePlan).where(MaintenancePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Напоминание не найдено")

    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == plan.vehicle_id))
    vehicle = veh_res.scalar_one()

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plan, key, value)

    await db.commit()
    await db.refresh(plan)

    resp = MaintenancePlanResponse.model_validate(plan)
    computed = compute_reminder_status(plan, vehicle)
    for k, v in computed.items():
        setattr(resp, k, v)
    return resp

@router.post("/{plan_id}/mark-done", response_model=MaintenancePlanResponse)
async def mark_reminder_done(
    plan_id: int,
    odometer: float = Query(None, description="Пробег при выполнении"),
    hours: float = Query(None, description="Моточасы при выполнении"),
    db: AsyncSession = Depends(get_db),
    admin: bool = Depends(require_admin),
):
    """Resets reminder to current odometer and date when completed."""
    result = await db.execute(select(MaintenancePlan).where(MaintenancePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Напоминание не найдено")

    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == plan.vehicle_id))
    vehicle = veh_res.scalar_one()

    done_odo = odometer if odometer is not None else vehicle.current_odometer
    done_hours = hours if hours is not None else vehicle.current_engine_hours

    plan.last_service_odometer = done_odo
    plan.last_service_hours = done_hours or 0.0
    plan.last_service_date = datetime.datetime.utcnow()

    if done_odo > (vehicle.current_odometer or 0.0):
        vehicle.current_odometer = done_odo
    if done_hours and done_hours > (vehicle.current_engine_hours or 0.0):
        vehicle.current_engine_hours = done_hours

    await db.commit()
    await db.refresh(plan)

    resp = MaintenancePlanResponse.model_validate(plan)
    computed = compute_reminder_status(plan, vehicle)
    for k, v in computed.items():
        setattr(resp, k, v)
    return resp

@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    admin: bool = Depends(require_admin),
):
    result = await db.execute(select(MaintenancePlan).where(MaintenancePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Напоминание не найдено")

    await db.delete(plan)
    await db.commit()
    return None
