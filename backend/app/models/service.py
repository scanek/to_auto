import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
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
    to_tag = Column(String(50), nullable=True) # e.g. "ТО-2", "ТО-3", "Вне ТО", "Тюнинг"
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    odometer = Column(Float, nullable=False)
    engine_hours = Column(Float, nullable=True) # Моточасы при ТО
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cost_labor = Column(Float, default=0.0)
    cost_parts = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    store = Column(String(100), nullable=True) # e.g. "Ozon", "Дилер"
    url = Column(String(500), nullable=True) # Ссылка на товар/магазин
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="service_records")
    items = relationship("ServiceItem", back_populates="service_record", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="service_record", cascade="all, delete-orphan")

class ServiceItem(Base):
    __tablename__ = "service_items"

    id = Column(Integer, primary_key=True, index=True)
    service_record_id = Column(Integer, ForeignKey("service_records.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False) # e.g. "Масло моторное 0W-20"
    brand = Column(String(100), nullable=True) # e.g. "ZIC ZERO 20 0W-20"
    part_number = Column(String(100), nullable=True) # e.g. "376802873"
    category = Column(String(50), default="part") # "part", "labor", "Двигатель", "Фильтры", etc.
    unit = Column(String(20), default="шт") # "л", "шт", "комплект"
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    store = Column(String(100), nullable=True) # e.g. "Ozon", "Дилер"
    url = Column(String(500), nullable=True)

    service_record = relationship("ServiceRecord", back_populates="items")
