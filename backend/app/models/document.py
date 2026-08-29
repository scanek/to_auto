import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.session import Base

class DocumentNote(Base):
    __tablename__ = "document_notes"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False) # e.g. "КАСКО", "ОСАГО"
    doc_type = Column(String(50), default="insurance") # "insurance", "inspection", "registration", "warranty", "note"
    company = Column(String(100), nullable=True) # e.g. "Тинькофф"
    document_number = Column(String(100), nullable=True) # e.g. "8786611907"
    issue_date = Column(DateTime, nullable=True)
    expiration_date = Column(DateTime, nullable=True)
    price = Column(Float, default=0.0) # Стоимость полиса
    mileage = Column(Float, nullable=True) # Пробег при оформлении
    engine_hours = Column(Float, nullable=True) # Моточасы при оформлении
    is_active = Column(Boolean, default=True)
    file_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="documents")
    attachments = relationship("Attachment", back_populates="document", cascade="all, delete-orphan")
