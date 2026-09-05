import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image, ImageOps
import io

from app.core.config import UPLOAD_DIR
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.core.security import get_optional_current_user
from app.services.auth_helper import verify_vehicle_access
from app.services.ocr_service import analyze_receipt_document

router = APIRouter(prefix="/ocr", tags=["OCR / Vision"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

@router.post("/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    vehicle_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Scans a photo or scan of a service order (заказ-наряд) or fuel receipt (чек АЗС).
    Extracts structured fields: date, odometer, vendor, title, description,
    cost_labor, cost_parts, total_cost, fuel info, and itemized spare parts.
    Also saves the uploaded image so it can be directly attached to the record.
    """
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Размер файла превышает лимит 20 МБ"
        )

    # 1. Sanitize & save image to uploads
    ext = Path(file.filename or "receipt.jpg").suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"

    safe_filename = f"ocr_{uuid.uuid4().hex[:12]}{ext}"
    saved_path = UPLOAD_DIR / safe_filename

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(saved_path, format="JPEG", quality=88, optimize=True)
    except Exception:
        # Save raw fallback
        with open(saved_path, "wb") as f:
            f.write(raw_bytes)

    attachment_url = f"/uploads/{safe_filename}"

    # 2. If vehicle_id is passed, verify vehicle exists
    v_data = None
    if vehicle_id:
        res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        v = res.scalar_one_or_none()
        if v:
            v_data = {
                "id": v.id,
                "current_odometer": v.current_odometer,
                "current_engine_hours": v.current_engine_hours,
                "currency": v.currency or "RUB",
                "make": v.make,
                "model": v.model,
            }

    # 3. Analyze document with Vision
    parsed_data = await analyze_receipt_document(raw_bytes, custom_api_key=api_key)
    parsed_data["attachment_url"] = attachment_url
    parsed_data["filename"] = file.filename or safe_filename
    parsed_data["vehicle_context"] = v_data

    return {
        "success": True,
        "data": parsed_data
    }
