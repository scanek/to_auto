import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.db.session import Base

class RecordType(str, enum.Enum):
    SERVICE = "service" # Плановое ТО
    REPAIR = "repair"   # Внеплановый ремонт
    UPGRADE = "upgrade" # Тюнинг / Дооснащение

class ServiceRecord(Base):
    __tablename__ = "service_records"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    record_type = Column(String(20), default=RecordType.SERVICE.value, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    odometer = Column(Float, nullable=False)
    title = Column(String(200), nullable=False) # e.g. "ТО-5 (60 000 км)" or "Замена передних колодок"
    description = Column(Text, nullable=True)
    cost_labor = Column(Float, default=0.0)
    cost_parts = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="service_records")
    items = relationship("ServiceItem", back_populates="service_record", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="service_record", cascade="all, delete-orphan")

class ServiceItem(Base):
    __tablename__ = "service_items"

    id = Column(Integer, primary_key=True, index=True)
    service_record_id = Column(Integer, ForeignKey("service_records.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False) # e.g. "Масло моторное 5W-30"
    part_number = Column(String(100), nullable=True) # e.g. "08880-80845"
    category = Column(String(50), default="part") # "part" or "labor"
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)

    service_record = relationship("ServiceRecord", back_populates="items")
