import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False) # e.g. "Замена моторного масла и фильтра"
    description = Column(Text, nullable=True)
    
    # Intervals
    interval_distance = Column(Float, nullable=True) # e.g. 7500 or 10000 km
    interval_months = Column(Integer, nullable=True) # e.g. 12 months
    
    # Last done baseline
    last_service_odometer = Column(Float, default=0.0)
    last_service_date = Column(DateTime, default=datetime.datetime.utcnow)
    
    is_active = Column(Boolean, default=True)
    notify_before_distance = Column(Float, default=500.0) # Warn when 500 km remain
    notify_before_days = Column(Integer, default=14) # Warn when 14 days remain
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="reminders")
