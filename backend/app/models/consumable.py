import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.core.datetime_utils import utc_now_naive

class VehicleConsumable(Base):
    __tablename__ = "vehicle_consumables"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), default="engine", nullable=False) # engine, filters, transmission, brakes, cooling, electrical, wipers, other
    name = Column(String(100), nullable=False) # e.g. "Масляный фильтр ДВС", "Масло моторное"
    specification = Column(String(255), nullable=True) # e.g. "SAE 0W-20 SP / C5, 4.2 л", "650 мм + 425 мм"
    oem_part_number = Column(String(100), nullable=True) # e.g. "1017100-M01"
    aftermarket_parts = Column(String(255), nullable=True) # e.g. "Mann W 7053, Filtron OP641/2"
    replacement_interval = Column(String(100), nullable=True) # e.g. "Каждые 7 500 км или 250 мч"
    notes = Column(Text, nullable=True) # e.g. "Момент затяжки 25 Нм. Шайба пробки: 1004104-M01"
    order_index = Column(Integer, default=0)

    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="consumables")
