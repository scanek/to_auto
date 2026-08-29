import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True) # Custom nickname e.g. "Семейный кроссовер"
    make = Column(String(100), nullable=False) # e.g. Toyota
    model = Column(String(100), nullable=False) # e.g. RAV4
    year = Column(Integer, nullable=True)
    license_plate = Column(String(50), nullable=True)
    vin = Column(String(50), nullable=True)
    starting_odometer = Column(Float, default=0.0)
    current_odometer = Column(Float, default=0.0)
    distance_unit = Column(String(10), default="km") # "km" or "mi"
    fuel_unit = Column(String(10), default="L") # "L" or "gal"
    currency = Column(String(10), default="RUB") # "RUB", "USD", "EUR", etc.
    photo_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    service_records = relationship("ServiceRecord", back_populates="vehicle", cascade="all, delete-orphan", order_by="desc(ServiceRecord.date)")
    fuel_logs = relationship("FuelLog", back_populates="vehicle", cascade="all, delete-orphan", order_by="desc(FuelLog.date)")
    reminders = relationship("MaintenancePlan", back_populates="vehicle", cascade="all, delete-orphan")
    documents = relationship("DocumentNote", back_populates="vehicle", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="vehicle", cascade="all, delete-orphan")
