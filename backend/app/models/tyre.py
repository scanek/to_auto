import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class TyreSet(Base):
    __tablename__ = "tyre_sets"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False) # "Заводской комплект", "Зимние"
    season = Column(String(20), default="summer") # "summer" or "winter"
    size = Column(String(50), nullable=True) # "225/55 R19"
    brand_model = Column(String(100), nullable=True) # "Ikon Tyres Nordman 8"
    current_km = Column(Float, default=0.0)
    tread_depth_mm = Column(Float, default=8.0) # Остаток протектора в мм
    storage_location = Column(String(100), nullable=True) # "Гараж", "Балкон", "Шинный отель"
    is_active = Column(Boolean, default=False) # Установлен ли сейчас на авто
    install_date = Column(DateTime, nullable=True)
    install_mileage = Column(Float, nullable=True)
    purchase_date = Column(DateTime, nullable=True) # Дата покупки шин
    dot_code = Column(String(50), nullable=True) # Год/неделя производства резины (DOT)
    has_separate_rims = Column(Boolean, default=False) # На отдельных дисках
    rims_brand_model = Column(String(100), nullable=True) # Модель дисков
    rims_size = Column(String(50), nullable=True) # Параметры дисков (19x7.5J 5x114.3 ET45)
    rims_purchase_date = Column(DateTime, nullable=True) # Дата покупки дисков
    rims_price = Column(Float, default=0.0) # Стоимость дисков
    tpms_sensors = Column(String(100), nullable=True) # Датчики давления TPMS
    quantity = Column(Float, default=4.0)
    price_per_unit = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="tyre_sets")
