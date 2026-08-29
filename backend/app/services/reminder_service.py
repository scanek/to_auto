import datetime
from typing import Dict, Any
from app.models.reminder import MaintenancePlan
from app.models.vehicle import Vehicle
from app.schemas.reminder import MaintenancePlanResponse

def compute_reminder_status(plan: MaintenancePlan, vehicle: Vehicle) -> Dict[str, Any]:
    now = datetime.datetime.utcnow()
    current_odometer = vehicle.current_odometer or 0.0

    due_odometer = None
    remaining_distance = None
    distance_progress = 0.0

    if plan.interval_distance and plan.interval_distance > 0:
        due_odometer = plan.last_service_odometer + plan.interval_distance
        remaining_distance = due_odometer - current_odometer
        passed_dist = current_odometer - plan.last_service_odometer
        distance_progress = (passed_dist / plan.interval_distance) * 100.0

    due_date = None
    remaining_days = None
    time_progress = 0.0

    if plan.interval_months and plan.interval_months > 0:
        # Approximate 30.44 days per month
        days_interval = int(plan.interval_months * 30.44)
        due_date = plan.last_service_date + datetime.timedelta(days=days_interval)
        delta = due_date - now
        remaining_days = delta.days
        passed_days = (now - plan.last_service_date).days
        time_progress = (passed_days / max(days_interval, 1)) * 100.0

    # Hybrid status determination
    is_overdue = False
    is_due_soon = False

    if remaining_distance is not None:
        if remaining_distance <= 0:
            is_overdue = True
        elif remaining_distance <= (plan.notify_before_distance or 500.0):
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

    progress = max(0.0, min(100.0, max(distance_progress, time_progress)))

    return {
        "due_odometer": due_odometer,
        "due_date": due_date,
        "remaining_distance": remaining_distance,
        "remaining_days": remaining_days,
        "status": status,
        "progress_percentage": round(progress, 1),
    }
