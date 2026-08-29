import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    tracker_id = Column(String(50), nullable=True) # e.g. "engine_oil", "oil_filter"
    title = Column(String(200), nullable=False) # e.g. "Моторное масло (0W-20)"
    category = Column(String(50), default="Обслуживание") # "Двигатель", "Фильтры", "Трансмиссия", etc.
    description = Column(Text, nullable=True)
    
    # Specifications & Articles
    brand = Column(String(100), nullable=True) # e.g. "Лукойл Genesis ARMORTECH JP 0W-20"
    spec = Column(String(200), nullable=True) # e.g. "SAE 0W-20 SP / C5 (4.2 - 4.5 л)"
    article = Column(String(100), nullable=True) # e.g. "1658134508"
    icon = Column(String(50), default="droplet") # droplet, disc, wrench, zap, thermometer, etc.
    
    # Intervals
    interval_distance = Column(Float, nullable=True) # e.g. 7500 km
    interval_months = Column(Integer, nullable=True) # e.g. 12 months
    interval_hours = Column(Float, nullable=True) # e.g. 250 моточасов
    
    # Last done baseline
    last_service_odometer = Column(Float, default=0.0)
    last_service_hours = Column(Float, default=0.0) # Моточасы при последней замене
    last_service_date = Column(DateTime, default=datetime.datetime.utcnow)
    
    is_active = Column(Boolean, default=True)
    notify_before_distance = Column(Float, default=500.0) # Warn when 500 km remain
    notify_before_days = Column(Integer, default=14) # Warn when 14 days remain
    notify_before_hours = Column(Float, default=30.0) # Warn when 30 hours remain
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="reminders")
