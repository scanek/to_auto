from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class VehicleBase(BaseModel):
    name: Optional[str] = None
    make: str
    model: str
    year: Optional[int] = None
    engine: Optional[str] = None
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    is_public: bool = False # True = visible to other users (read-only)
    starting_odometer: float = 0.0
    current_odometer: float = 0.0
    current_engine_hours: float = 0.0
    track_engine_hours: bool = True
    purchase_date: Optional[datetime] = None
    oil_spec: Optional[str] = None
    distance_unit: str = "km"
    fuel_unit: str = "L"
    photo_url: Optional[str] = None
    notes: Optional[str] = None

    # Telematics fields
    telematics_provider: Optional[str] = "none"
    starline_device_alias: Optional[str] = None
    starline_last_sync: Optional[datetime] = None
    starline_battery: Optional[float] = None
    starline_fuel_percent: Optional[float] = None
    starline_engine_temp: Optional[float] = None
    telematics_webhook_key: Optional[str] = None
    telematics_auto_sync: bool = False

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    engine: Optional[str] = None
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    is_public: Optional[bool] = None
    starting_odometer: Optional[float] = None
    current_odometer: Optional[float] = None
    current_engine_hours: Optional[float] = None
    track_engine_hours: Optional[bool] = None
    purchase_date: Optional[datetime] = None
    oil_spec: Optional[str] = None
    distance_unit: Optional[str] = None
    fuel_unit: Optional[str] = None
    currency: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class VehicleResponse(VehicleBase):
    id: int
    user_id: Optional[int] = None
    is_owner: bool = True
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Summary metrics for quick view
    total_service_cost: Optional[float] = 0.0
    total_fuel_cost: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    active_reminders_count: Optional[int] = 0
    overdue_reminders_count: Optional[int] = 0
    avg_fuel_consumption: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
