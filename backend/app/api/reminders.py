import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.reminder import MaintenancePlan
from app.schemas.reminder import MaintenancePlanCreate, MaintenancePlanUpdate, MaintenancePlanResponse
from app.services.reminder_service import compute_reminder_status, sync_reminder_baselines
from app.core.security import get_current_user, get_optional_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/reminders", tags=["Maintenance Planner & Reminders"])

@router.get("", response_model=List[MaintenancePlanResponse])
async def get_reminders(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    data = payload.model_dump()
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MaintenancePlan).where(MaintenancePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Напоминание не найдено")

    vehicle = await verify_vehicle_access(db, plan.vehicle_id, current_user, require_owner=True)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resets reminder to current odometer and date when completed."""
    result = await db.execute(select(MaintenancePlan).where(MaintenancePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Напоминание не найдено")

    vehicle = await verify_vehicle_access(db, plan.vehicle_id, current_user, require_owner=True)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MaintenancePlan).where(MaintenancePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Напоминание не найдено")

    await verify_vehicle_access(db, plan.vehicle_id, current_user, require_owner=True)
    await db.delete(plan)
    await db.commit()
    return None


@router.post("/apply-default-pack", response_model=List[MaintenancePlanResponse])
async def apply_default_reminders_pack(
    vehicle_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    # 1. Existing plans
    existing_res = await db.execute(select(MaintenancePlan).where(MaintenancePlan.vehicle_id == vehicle_id))
    existing_plans = existing_res.scalars().all()
    existing_trackers = {p.tracker_id for p in existing_plans if p.tracker_id}
    existing_titles = {p.title.lower() for p in existing_plans}

    default_templates = [
        {
            "tracker_id": "engine_oil",
            "title": "Замена моторного масла и фильтра",
            "category": "Обслуживание ДВС",
            "icon": "droplet",
            "interval_distance": 7500.0,
            "interval_hours": 250.0 if vehicle.track_engine_hours else None,
            "interval_months": 12,
            "notify_before_distance": 500.0,
            "notify_before_hours": 30.0 if vehicle.track_engine_hours else None,
            "notify_before_days": 14,
        },
        {
            "tracker_id": "air_filter",
            "title": "Замена воздушного фильтра ДВС",
            "category": "Фильтры",
            "icon": "wind",
            "interval_distance": 15000.0,
            "interval_months": 12,
            "notify_before_distance": 1000.0,
            "notify_before_days": 14,
        },
        {
            "tracker_id": "cabin_filter",
            "title": "Замена салонного фильтра",
            "category": "Фильтры",
            "icon": "wind",
            "interval_distance": 15000.0,
            "interval_months": 12,
            "notify_before_distance": 1000.0,
            "notify_before_days": 14,
        },
        {
            "tracker_id": "spark_plugs",
            "title": "Замена свечей зажигания",
            "category": "Система зажигания",
            "icon": "zap",
            "interval_distance": 30000.0,
            "interval_months": 36,
            "notify_before_distance": 2000.0,
            "notify_before_days": 30,
        },
        {
            "tracker_id": "gearbox_oil",
            "title": "Замена масла в трансмиссии (КПП/РКПП/АКПП)",
            "category": "Трансмиссия",
            "icon": "cog",
            "interval_distance": 45000.0,
            "interval_months": 36,
            "notify_before_distance": 3000.0,
            "notify_before_days": 30,
        },
        {
            "tracker_id": "brake_fluid",
            "title": "Замена тормозной жидкости",
            "category": "Тормозная система",
            "icon": "shield",
            "interval_distance": 40000.0,
            "interval_months": 24,
            "notify_before_distance": 2000.0,
            "notify_before_days": 30,
        },
        {
            "tracker_id": "coolant",
            "title": "Замена охлаждающей жидкости (Антифриз)",
            "category": "Система охлаждения",
            "icon": "thermometer",
            "interval_distance": 60000.0,
            "interval_months": 48,
            "notify_before_distance": 3000.0,
            "notify_before_days": 30,
        },
    ]

    base_odo = vehicle.starting_odometer if (vehicle.starting_odometer and vehicle.starting_odometer > 0) else 0.0
    base_date = vehicle.purchase_date if vehicle.purchase_date else datetime.datetime.utcnow()

    for tmpl in default_templates:
        if tmpl["tracker_id"] in existing_trackers or tmpl["title"].lower() in existing_titles:
            continue
        plan = MaintenancePlan(
            vehicle_id=vehicle_id,
            tracker_id=tmpl["tracker_id"],
            title=tmpl["title"],
            category=tmpl["category"],
            icon=tmpl["icon"],
            interval_distance=tmpl["interval_distance"],
            interval_hours=tmpl.get("interval_hours"),
            interval_months=tmpl.get("interval_months"),
            notify_before_distance=tmpl["notify_before_distance"],
            notify_before_hours=tmpl.get("notify_before_hours"),
            notify_before_days=tmpl.get("notify_before_days"),
            last_service_odometer=base_odo,
            last_service_date=base_date,
            last_service_hours=0.0,
        )
        db.add(plan)

    await db.commit()

    # Re-sync and return all reminders
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

    priority = {"overdue": 0, "due_soon": 1, "ok": 2}
    responses.sort(key=lambda x: (priority.get(x.status, 2), -x.progress_percentage))
    return responses
