from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ConsumableBase(BaseModel):
    category: str = "engine" # engine, filters, transmission, brakes, cooling, electrical, wipers, other
    name: str # e.g. "Масляный фильтр ДВС"
    specification: Optional[str] = None # e.g. "SAE 0W-20 SP / C5, 4.2 л"
    oem_part_number: Optional[str] = None # e.g. "1017100-M01"
    aftermarket_parts: Optional[str] = None # e.g. "Mann W 7053, Filtron OP641/2"
    replacement_interval: Optional[str] = None # e.g. "Каждые 7 500 км или 250 мч"
    notes: Optional[str] = None
    order_index: int = 0

class ConsumableCreate(ConsumableBase):
    pass

class ConsumableUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    specification: Optional[str] = None
    oem_part_number: Optional[str] = None
    aftermarket_parts: Optional[str] = None
    replacement_interval: Optional[str] = None
    notes: Optional[str] = None
    order_index: Optional[int] = None

class ConsumableResponse(ConsumableBase):
    id: int
    vehicle_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
