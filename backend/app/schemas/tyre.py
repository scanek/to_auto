from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class TyreSetBase(BaseModel):
    name: str
    season: str = "summer" # "summer" or "winter"
    size: Optional[str] = None # "225/55 R19"
    brand_model: Optional[str] = None
    current_km: float = 0.0
    tread_depth_mm: float = 8.0
    storage_location: Optional[str] = None
    is_active: bool = False
    install_date: Optional[datetime] = None
    install_mileage: Optional[float] = None
    purchase_date: Optional[datetime] = None
    dot_code: Optional[str] = None
    has_separate_rims: bool = False
    rims_brand_model: Optional[str] = None
    rims_size: Optional[str] = None
    rims_purchase_date: Optional[datetime] = None
    rims_price: float = 0.0
    tpms_sensors: Optional[str] = None
    quantity: float = 4.0
    price_per_unit: float = 0.0
    total_price: float = 0.0

class TyreSetCreate(TyreSetBase):
    pass

class TyreSetUpdate(BaseModel):
    name: Optional[str] = None
    season: Optional[str] = None
    size: Optional[str] = None
    brand_model: Optional[str] = None
    current_km: Optional[float] = None
    tread_depth_mm: Optional[float] = None
    storage_location: Optional[str] = None
    is_active: Optional[bool] = None
    install_date: Optional[datetime] = None
    install_mileage: Optional[float] = None
    purchase_date: Optional[datetime] = None
    dot_code: Optional[str] = None
    has_separate_rims: Optional[bool] = None
    rims_brand_model: Optional[str] = None
    rims_size: Optional[str] = None
    rims_purchase_date: Optional[datetime] = None
    rims_price: Optional[float] = None
    tpms_sensors: Optional[str] = None
    quantity: Optional[float] = None
    price_per_unit: Optional[float] = None
    total_price: Optional[float] = None

class TyreSetResponse(TyreSetBase):
    id: int
    vehicle_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
