from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class FuelLogBase(BaseModel):
    date: datetime
    odometer: float
    fuel_amount: float
    total_cost: float
    unit_price: float
    is_full_tank: bool = True
    is_missed: bool = False
    fuel_grade: Optional[str] = None
    gas_station: Optional[str] = None
    notes: Optional[str] = None

class FuelLogCreate(FuelLogBase):
    pass

class FuelLogUpdate(BaseModel):
    date: Optional[datetime] = None
    odometer: Optional[float] = None
    fuel_amount: Optional[float] = None
    total_cost: Optional[float] = None
    unit_price: Optional[float] = None
    is_full_tank: Optional[bool] = None
    is_missed: Optional[bool] = None
    fuel_grade: Optional[str] = None
    gas_station: Optional[str] = None
    notes: Optional[str] = None

class FuelLogResponse(FuelLogBase):
    id: int
    vehicle_id: int
    consumption: Optional[float] = None
    distance_traveled: Optional[float] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
