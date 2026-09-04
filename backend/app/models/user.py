import enum
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.core.datetime_utils import utc_now_naive

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Telegram Integration
    telegram_chat_id = Column(String(100), nullable=True, index=True)
    telegram_username = Column(String(100), nullable=True)
    telegram_auth_token = Column(String(100), nullable=True, unique=True, index=True)
    telegram_notifications_enabled = Column(Boolean, default=True, nullable=False)
    telegram_notify_reminders = Column(Boolean, default=True, nullable=False)
    telegram_notify_battery = Column(Boolean, default=True, nullable=False)
    telegram_notify_documents = Column(Boolean, default=True, nullable=False)
    telegram_last_battery_alert = Column(DateTime, nullable=True)
    telegram_last_reminder_alert = Column(DateTime, nullable=True)
    telegram_last_document_alert = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utc_now_naive, nullable=False)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False)

    vehicles = relationship("Vehicle", back_populates="user", cascade="all, delete-orphan")
