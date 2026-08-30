import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.session import Base

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    is_public = Column(Boolean, default=False, nullable=False) # True = visible to all users
    name = Column(String(100), nullable=True) # Custom nickname e.g. "Changan CS55 Plus"
    make = Column(String(100), nullable=False) # e.g. Changan
    model = Column(String(100), nullable=False) # e.g. CS55 Plus
    year = Column(Integer, nullable=True)
    engine = Column(String(100), nullable=True) # e.g. "1.5T 7DCT"
    license_plate = Column(String(50), nullable=True)
    vin = Column(String(50), nullable=True)
    starting_odometer = Column(Float, default=0.0)
    current_odometer = Column(Float, default=0.0)
    current_engine_hours = Column(Float, default=0.0) # Моточасы
    purchase_date = Column(DateTime, nullable=True) # Дата покупки / начала эксплуатации
    oil_spec = Column(String(200), nullable=True) # e.g. "SAE 0W-20 SP / C5 (4.2 - 4.5 л)"
    distance_unit = Column(String(10), default="km") # "km" or "mi"
    fuel_unit = Column(String(10), default="L") # "L" or "gal"
    currency = Column(String(10), default="RUB") # "RUB", "USD", "EUR", etc.
    photo_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="vehicles")
    service_records = relationship("ServiceRecord", back_populates="vehicle", cascade="all, delete-orphan", order_by="desc(ServiceRecord.date)")
    fuel_logs = relationship("FuelLog", back_populates="vehicle", cascade="all, delete-orphan", order_by="desc(FuelLog.date)")
    reminders = relationship("MaintenancePlan", back_populates="vehicle", cascade="all, delete-orphan")
    documents = relationship("DocumentNote", back_populates="vehicle", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="vehicle", cascade="all, delete-orphan")
    tyre_sets = relationship("TyreSet", back_populates="vehicle", cascade="all, delete-orphan")
