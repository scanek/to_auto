from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AttachmentResponse(BaseModel):
    id: int
    vehicle_id: int
    service_record_id: Optional[int] = None
    fuel_log_id: Optional[int] = None
    document_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: int
    content_type: Optional[str] = None
    created_at: datetime
    url: str

    model_config = ConfigDict(from_attributes=True)
