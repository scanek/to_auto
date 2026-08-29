from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class VehicleBase(BaseModel):
    name: Optional[str] = None
    make: str
    model: str
    year: Optional[int] = None
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    starting_odometer: float = 0.0
    current_odometer: float = 0.0
    distance_unit: str = "km"
    fuel_unit: str = "L"
    currency: str = "RUB"
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    vin: Optional[str] = None
    starting_odometer: Optional[float] = None
    current_odometer: Optional[float] = None
    distance_unit: Optional[str] = None
    fuel_unit: Optional[str] = None
    currency: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class VehicleResponse(VehicleBase):
    id: int
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
