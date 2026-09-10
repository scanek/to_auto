from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base

class VisitLog(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    visitor_hash = Column(String(64), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    path = Column(String(255), default="/")
    device_type = Column(String(20), default="desktop") # mobile, tablet, desktop
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", backref="visits", lazy="selectin")

    __table_args__ = (
        Index("ix_visits_hash_created", "visitor_hash", "created_at"),
    )
