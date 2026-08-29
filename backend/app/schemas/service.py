from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ServiceItemBase(BaseModel):
    name: str
    brand: Optional[str] = None
    part_number: Optional[str] = None
    category: str = "part"
    unit: str = "шт"
    quantity: float = 1.0
    unit_price: float = 0.0
    total_price: float = 0.0
    store: Optional[str] = None
    url: Optional[str] = None

class ServiceItemCreate(ServiceItemBase):
    pass

class ServiceItemResponse(ServiceItemBase):
    id: int
    service_record_id: int
    model_config = ConfigDict(from_attributes=True)

class ServiceRecordBase(BaseModel):
    record_type: str = "service" # service, repair, upgrade
    to_tag: Optional[str] = None # e.g. "ТО-2", "ТО-3", "Вне ТО", "Тюнинг"
    date: datetime
    odometer: float
    engine_hours: Optional[float] = None
    title: str
    description: Optional[str] = None
    cost_labor: float = 0.0
    cost_parts: float = 0.0
    total_cost: float = 0.0
    store: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None

class ServiceRecordCreate(ServiceRecordBase):
    items: Optional[List[ServiceItemCreate]] = []

class ServiceRecordUpdate(BaseModel):
    record_type: Optional[str] = None
    to_tag: Optional[str] = None
    date: Optional[datetime] = None
    odometer: Optional[float] = None
    engine_hours: Optional[float] = None
    title: Optional[str] = None
    description: Optional[str] = None
    cost_labor: Optional[float] = None
    cost_parts: Optional[float] = None
    total_cost: Optional[float] = None
    store: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[ServiceItemCreate]] = None

class ServiceRecordResponse(ServiceRecordBase):
    id: int
    vehicle_id: int
    created_at: datetime
    items: List[ServiceItemResponse] = []
    attachments_count: int = 0
    model_config = ConfigDict(from_attributes=True)
