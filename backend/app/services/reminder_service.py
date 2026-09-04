import datetime
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.reminder import MaintenancePlan
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord, ServiceItem

TRANSMISSION_KEYWORDS = [
    "коробк", "трансмисс", "ркпп", "кпп", "акпп", "мкпп", "dct", "7dct", "dctf", "atf", "cvt",
    "вариатор", "редуктор", "раздатк", "дифференциал", "75w-90", "75w-80", "sp-iv", "ws"
]

MATCH_RULES = {
    "engine_oil": ["масло моторное", "моторн", "двс", "engine oil", "0w-20", "5w-30", "5w-40", "0w-30", "zic", "genesis", "lukoil", "лукойл"],
    "oil_filter": ["маслян", "1012010mk01", "c-933", "c933", "масляный"],
    "air_filter": ["воздуш", "af162", "1109190-mk01", "воздушный"],
    "cabin_filter": ["салон", "cn1305k", "8104020-mk01", "салонный", "угольн"],
    "drain_washer": ["кольц", "2151323001", "21513-23001", "пробк", "шайб"],
    "spark_plugs": ["свеч", "3707010-ne01", "hu10a80p", "зажигани"],
    "antifreeze": ["антифриз", "ож", "58888973218", "felix", "dragon", "охлажд"],
    "brake_fluid": ["тормозн", "тормоз", "dot-4"],
    "dct_fluid": TRANSMISSION_KEYWORDS,
}

def is_item_match_for_plan(plan: MaintenancePlan, item: ServiceItem) -> bool:
    it_name = (item.name or "").lower()
    it_art = (item.part_number or "").lower()
    it_brand = (item.brand or "").lower()
    plan_title = (plan.title or "").lower()
    tracker_id = (plan.tracker_id or "").lower()

    # If plan has an exact article
    if plan.article and len(plan.article) >= 4 and (plan.article.lower() in it_art or plan.article.lower() in it_name):
        return True

    # Check transmission oil match rule
    is_transmission_plan = (tracker_id == "dct_fluid") or any(kw in plan_title for kw in ["коробк", "трансмисс", "кпп", "акпп", "ркпп", "dct", "вариатор", "cvt", "atf", "редуктор"])
    is_engine_oil_plan = (tracker_id == "engine_oil") or ("моторн" in plan_title) or ("масло" in plan_title and not is_transmission_plan)

    # If this is a transmission plan, ONLY match if item explicitly mentions transmission/gearbox keywords
    if is_transmission_plan:
        return any(kw in it_name or kw in it_art or kw in it_brand for kw in TRANSMISSION_KEYWORDS)

    # If this is an engine oil plan, make sure item is NOT transmission oil
    if is_engine_oil_plan:
        if any(kw in it_name or kw in it_art or kw in it_brand for kw in TRANSMISSION_KEYWORDS):
            return False
        if any(kw in it_name or kw in it_art or kw in it_brand for kw in MATCH_RULES["engine_oil"]) or ("масло" in it_name and "трансмисс" not in it_name and "коробк" not in it_name and "кпп" not in it_name):
            return True

    # Tracker ID keywords match
    keywords = MATCH_RULES.get(tracker_id, [])
    for kw in keywords:
        if kw in it_name or kw in it_art or kw in it_brand:
            return True

    # Fallback to title keywords (excluding ambiguous stop words)
    stop_words = {"масло", "замена", "жидкость", "фильтр", "фильтры", "смазка"}
    title_words = [w for w in plan_title.split() if len(w) > 3 and not w.startswith("(") and w not in stop_words]
    for tw in title_words:
        if tw in it_name:
            return True

    return False

async def sync_reminder_baselines(db: AsyncSession, vehicle_id: int):
    """
    Synchronizes reminders with the most recent service records in the database.
    """
    # Fetch all records with items
    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .order_by(ServiceRecord.odometer.desc(), ServiceRecord.date.desc())
    )
    records = srv_res.scalars().all()

    # Fetch all plans
    plan_res = await db.execute(
        select(MaintenancePlan).where(MaintenancePlan.vehicle_id == vehicle_id)
    )
    plans = plan_res.scalars().all()

    for plan in plans:
        # If plan already has last_service_odometer > 0, we still check if there is a later service
        best_record = None
        for r in records:
            matched = False
            for it in r.items:
                if is_item_match_for_plan(plan, it):
                    matched = True
                    break
            if matched:
                best_record = r
                break

        if best_record:
            if best_record.odometer > (plan.last_service_odometer or 0.0):
                plan.last_service_odometer = best_record.odometer
                plan.last_service_hours = best_record.engine_hours or plan.last_service_hours or 0.0
                plan.last_service_date = best_record.date

    await db.commit()

def compute_reminder_status(plan: MaintenancePlan, vehicle: Vehicle) -> Dict[str, Any]:
    now = datetime.datetime.utcnow()
    current_odometer = vehicle.current_odometer or 0.0
    current_hours = vehicle.current_engine_hours or 0.0

    # Distance calculation
    due_odometer = None
    remaining_distance = None
    distance_progress = 0.0

    if plan.interval_distance and plan.interval_distance > 0:
        due_odometer = (plan.last_service_odometer or 0.0) + plan.interval_distance
        remaining_distance = due_odometer - current_odometer
        passed_dist = current_odometer - (plan.last_service_odometer or 0.0)
        distance_progress = (passed_dist / plan.interval_distance) * 100.0

    # Engine Hours calculation
    due_hours = None
    remaining_hours = None
    hours_progress = 0.0

    if plan.interval_hours and plan.interval_hours > 0:
        due_hours = (plan.last_service_hours or 0.0) + plan.interval_hours
        remaining_hours = due_hours - current_hours
        passed_hours = current_hours - (plan.last_service_hours or 0.0)
        hours_progress = (passed_hours / plan.interval_hours) * 100.0

    # Time / Date calculation
    due_date = None
    remaining_days = None
    time_progress = 0.0

    if plan.interval_months and plan.interval_months > 0:
        days_interval = int(plan.interval_months * 30.44)
        base_date = plan.last_service_date or now
        due_date = base_date + datetime.timedelta(days=days_interval)
        delta = due_date - now
        remaining_days = delta.days
        passed_days = (now - base_date).days
        time_progress = (passed_days / max(days_interval, 1)) * 100.0

    # Hybrid status determination
    is_overdue = False
    is_due_soon = False

    if remaining_distance is not None:
        if remaining_distance <= 0:
            is_overdue = True
        elif remaining_distance <= (plan.notify_before_distance or 500.0):
            is_due_soon = True

    if remaining_hours is not None:
        if remaining_hours <= 0:
            is_overdue = True
        elif remaining_hours <= (plan.notify_before_hours or 30.0):
            is_due_soon = True

    if remaining_days is not None:
        if remaining_days <= 0:
            is_overdue = True
        elif remaining_days <= (plan.notify_before_days or 14):
            is_due_soon = True

    if is_overdue:
        status = "overdue"
    elif is_due_soon:
        status = "due_soon"
    else:
        status = "ok"

    progress = max(0.0, min(100.0, max(distance_progress, hours_progress, time_progress)))

    return {
        "due_odometer": due_odometer,
        "due_hours": due_hours,
        "due_date": due_date,
        "remaining_distance": remaining_distance,
        "remaining_hours": remaining_hours,
        "remaining_days": remaining_days,
        "status": status,
        "is_overdue": is_overdue,
        "is_due_soon": is_due_soon,
        "progress_percentage": round(progress, 1),
    }
