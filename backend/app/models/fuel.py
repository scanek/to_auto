import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    odometer = Column(Float, nullable=False)
    fuel_amount = Column(Float, nullable=False) # Liters or Gallons
    total_cost = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False) # Price per liter
    is_full_tank = Column(Boolean, default=True) # Full to Full tracking
    is_missed = Column(Boolean, default=False) # Missed previous fuel up
    consumption = Column(Float, nullable=True) # Calculated L/100km or MPG
    distance_traveled = Column(Float, nullable=True) # Distance since last fuel-up
    fuel_grade = Column(String(50), nullable=True) # e.g. "АИ-95", "АИ-98", "ДТ"
    gas_station = Column(String(100), nullable=True) # e.g. "Лукойл", "Газпромнефть"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="fuel_logs")
    attachments = relationship("Attachment", back_populates="fuel_log", cascade="all, delete-orphan")
