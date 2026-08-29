import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class DocumentNote(Base):
    __tablename__ = "document_notes"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False) # e.g. "Полис ОСАГО Ресо"
    doc_type = Column(String(50), default="insurance") # "insurance", "inspection", "registration", "warranty", "note"
    document_number = Column(String(100), nullable=True) # e.g. "ХХХ 0123456789"
    issue_date = Column(DateTime, nullable=True)
    expiration_date = Column(DateTime, nullable=True)
    file_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="documents")
    attachments = relationship("Attachment", back_populates="document", cascade="all, delete-orphan")
