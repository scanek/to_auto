import io
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image, ImageOps

from app.core.config import UPLOAD_DIR
from app.db.session import get_db
from app.models.user import User
from app.models.attachment import Attachment
from app.models.service import ServiceRecord
from app.models.fuel import FuelLog
from app.models.document import DocumentNote
from app.core.security import get_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/uploads", tags=["Uploads"])

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB max file size
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

def sanitize_and_process_image(raw_bytes: bytes, original_ext: str) -> tuple[bytes, str, str]:
    """
    Validates image integrity via Pillow, strips EXIF (metadata, GPS),
    and re-encodes into clean bytes to prevent XSS / malicious polyglots.
    Returns: (clean_bytes, safe_ext, content_type)
    """
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img.verify()  # Validate image integrity
        
        # Re-open for actual processing after verify()
        img = Image.open(io.BytesIO(raw_bytes))
        
        # Handle EXIF orientation then strip EXIF completely
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
            
        output_io = io.BytesIO()
        img_format = (img.format or "").upper()
        
        if img_format in ("JPEG", "JPG") or original_ext in (".jpg", ".jpeg"):
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(output_io, format="JPEG", quality=88, optimize=True)
            return output_io.getvalue(), ".jpg", "image/jpeg"
            
        elif img_format == "PNG" or original_ext == ".png":
            img.save(output_io, format="PNG", optimize=True)
            return output_io.getvalue(), ".png", "image/png"
            
        elif img_format == "WEBP" or original_ext == ".webp":
            img.save(output_io, format="WEBP", quality=88, method=4)
            return output_io.getvalue(), ".webp", "image/webp"
            
        else:
            # Default convert other safe formats to JPEG
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(output_io, format="JPEG", quality=88)
            return output_io.getvalue(), ".jpg", "image/jpeg"
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Некорректный или поврежденный файл изображения: {str(e)}"
        )

def validate_pdf_content(raw_bytes: bytes) -> tuple[bytes, str, str]:
    """
    Validates that a PDF file has proper PDF header magic bytes (%PDF-).
    """
    if not raw_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не является валидным PDF документом"
        )
    return raw_bytes, ".pdf", "application/pdf"

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    vehicle_id: Optional[int] = Query(None),
    service_record_id: Optional[int] = Query(None),
    fuel_log_id: Optional[int] = Query(None),
    document_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Имя файла не указано")

    original_ext = Path(file.filename).suffix.lower()
    if original_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый тип файла '{original_ext}'. Разрешены только: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 1. Verify Vehicle Access (Ownership requirement for mutating uploads)
    if vehicle_id:
        await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

        # 2. Strict Cross-Object Ownership Validation
        if service_record_id:
            srv = await db.scalar(select(ServiceRecord).where(ServiceRecord.id == service_record_id))
            if not srv or srv.vehicle_id != vehicle_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Указанная запись ТО не найдена или не принадлежит этому автомобилю"
                )

        if fuel_log_id:
            fuel = await db.scalar(select(FuelLog).where(FuelLog.id == fuel_log_id))
            if not fuel or fuel.vehicle_id != vehicle_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Указанная запись заправки не найдена или не принадлежит этому автомобилю"
                )

        if document_id:
            doc = await db.scalar(select(DocumentNote).where(DocumentNote.id == document_id))
            if not doc or doc.vehicle_id != vehicle_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Указанный документ не найден или не принадлежит этому автомобилю"
                )

    # 3. Read & Check File Size
    raw_content = await file.read()
    if len(raw_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Превышен максимальный размер файла (максимум 15 МБ)"
        )
    if len(raw_content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Загружаемый файл пуст"
        )

    # 4. Process & Sanitize by MIME/Content
    if original_ext == ".pdf":
        clean_bytes, safe_ext, content_type = validate_pdf_content(raw_content)
    else:
        clean_bytes, safe_ext, content_type = sanitize_and_process_image(raw_content, original_ext)

    # 5. Generate secure randomized UUID filename
    unique_filename = f"{uuid.uuid4().hex}{safe_ext}"
    destination = UPLOAD_DIR / unique_filename

    # 6. Write sanitized content to disk
    with open(destination, "wb") as f_out:
        f_out.write(clean_bytes)

    url = f"/uploads/{unique_filename}"
    saved_size = len(clean_bytes)

    # 7. Record Attachment in Database
    if vehicle_id:
        attachment = Attachment(
            vehicle_id=vehicle_id,
            service_record_id=service_record_id,
            fuel_log_id=fuel_log_id,
            document_id=document_id,
            file_name=Path(file.filename).name,
            file_path=str(destination),
            file_size=saved_size,
            content_type=content_type,
        )
        db.add(attachment)
        await db.commit()

    return {
        "url": url,
        "filename": Path(file.filename).name,
        "size": saved_size,
        "content_type": content_type,
    }
