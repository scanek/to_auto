from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class DocumentNoteBase(BaseModel):
    title: str
    doc_type: str = "insurance"
    company: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    price: float = 0.0
    mileage: Optional[float] = None
    engine_hours: Optional[float] = None
    is_active: bool = True
    file_url: Optional[str] = None
    notes: Optional[str] = None

class DocumentNoteCreate(DocumentNoteBase):
    pass

class DocumentNoteUpdate(BaseModel):
    title: Optional[str] = None
    doc_type: Optional[str] = None
    company: Optional[str] = None
    document_number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    price: Optional[float] = None
    mileage: Optional[float] = None
    engine_hours: Optional[float] = None
    is_active: Optional[bool] = None
    file_url: Optional[str] = None
    notes: Optional[str] = None

class DocumentNoteResponse(DocumentNoteBase):
    id: int
    vehicle_id: int
    created_at: datetime
    is_expired: bool = False
    days_until_expiration: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)
