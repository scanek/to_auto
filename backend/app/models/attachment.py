import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    service_record_id = Column(Integer, ForeignKey("service_records.id", ondelete="CASCADE"), nullable=True, index=True)
    fuel_log_id = Column(Integer, ForeignKey("fuel_logs.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("document_notes.id", ondelete="CASCADE"), nullable=True, index=True)
    
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0) # in bytes
    content_type = Column(String(100), nullable=True) # e.g. image/jpeg, application/pdf
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="attachments")
    service_record = relationship("ServiceRecord", back_populates="attachments")
    fuel_log = relationship("FuelLog", back_populates="attachments")
    document = relationship("DocumentNote", back_populates="attachments")
