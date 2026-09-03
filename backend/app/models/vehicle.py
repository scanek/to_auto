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
    track_engine_hours = Column(Boolean, default=True, nullable=False)
    purchase_date = Column(DateTime, nullable=True) # Дата покупки / начала эксплуатации
    oil_spec = Column(String(200), nullable=True) # e.g. "SAE 0W-20 SP / C5 (4.2 - 4.5 л)"
    distance_unit = Column(String(10), default="km") # "km" or "mi"
    fuel_unit = Column(String(10), default="L")
    fuel_tank_capacity = Column(Float, default=55.0, nullable=True) # Объем бака в литрах # "L" or "gal"
    currency = Column(String(10), default="RUB") # "RUB", "USD", "EUR", etc.
    photo_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    # Telematics (StarLine S96 / CAN OBD / Webhooks)
    telematics_provider = Column(String(50), default="none")
    starline_user_id = Column(String(100), nullable=True)
    starline_device_id = Column(String(100), nullable=True)
    starline_device_alias = Column(String(100), nullable=True)
    starline_token = Column(String(500), nullable=True)
    starline_last_sync = Column(DateTime, nullable=True)
    starline_battery = Column(Float, nullable=True)
    starline_fuel_percent = Column(Float, nullable=True)
    starline_engine_temp = Column(Float, nullable=True)
    starline_interior_temp = Column(Float, nullable=True) # Температура салона
    starline_balance = Column(Float, nullable=True)
    starline_is_armed = Column(Boolean, nullable=True)
    starline_is_running = Column(Boolean, nullable=True) # Двигатель заведен / заглушен
    starline_is_handbrake = Column(Boolean, nullable=True) # Ручной тормоз
    starline_is_doors_closed = Column(Boolean, nullable=True) # Двери/периметр закрыты
    starline_gsm_level = Column(Integer, nullable=True) # Качество связи GSM
    starline_gps_lat = Column(Float, nullable=True) # GPS/LBS широта
    starline_gps_lon = Column(Float, nullable=True) # GPS/LBS долгота
    starline_gps_type = Column(String(20), default="gps") # 'gps' или 'lbs' (сотовые вышки)
    starline_is_spoofed = Column(Boolean, default=False) # Обнаружена подмена/глушение GPS
    telematics_auto_sync = Column(Boolean, default=False)
    starline_auto_sync_interval_minutes = Column(Integer, default=60, nullable=True) # Интервал автообновления в минутах (0 = отключено, 30, 60, 120, 240, 720, 1440)
    telematics_webhook_key = Column(String(100), nullable=True, unique=True, index=True)
    
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
