from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class MaintenancePlanBase(BaseModel):
    title: str
    tracker_id: Optional[str] = None
    category: Optional[str] = "Обслуживание"
    description: Optional[str] = None
    brand: Optional[str] = None
    spec: Optional[str] = None
    article: Optional[str] = None
    icon: Optional[str] = "droplet"
    
    interval_distance: Optional[float] = None
    interval_months: Optional[int] = None
    interval_hours: Optional[float] = None
    
    last_service_odometer: float = 0.0
    last_service_hours: float = 0.0
    last_service_date: datetime
    
    is_active: bool = True
    notify_before_distance: float = 500.0
    notify_before_days: int = 14
    notify_before_hours: float = 30.0
    notes: Optional[str] = None

class MaintenancePlanCreate(MaintenancePlanBase):
    pass

class MaintenancePlanUpdate(BaseModel):
    title: Optional[str] = None
    tracker_id: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    spec: Optional[str] = None
    article: Optional[str] = None
    icon: Optional[str] = None
    interval_distance: Optional[float] = None
    interval_months: Optional[int] = None
    interval_hours: Optional[float] = None
    last_service_odometer: Optional[float] = None
    last_service_hours: Optional[float] = None
    last_service_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    notify_before_distance: Optional[float] = None
    notify_before_days: Optional[int] = None
    notify_before_hours: Optional[float] = None
    notes: Optional[str] = None

class MaintenancePlanResponse(MaintenancePlanBase):
    id: int
    vehicle_id: int
    created_at: datetime

    # Calculated properties
    due_odometer: Optional[float] = None
    due_hours: Optional[float] = None
    due_date: Optional[datetime] = None
    remaining_distance: Optional[float] = None
    remaining_hours: Optional[float] = None
    remaining_days: Optional[int] = None
    status: str = "ok" # "ok", "due_soon", "overdue"
    progress_percentage: float = 0.0

    model_config = ConfigDict(from_attributes=True)
