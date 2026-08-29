import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
from app.core.config import UPLOAD_DIR
from app.db.session import get_db
from app.models.user import User
from app.models.attachment import Attachment
from app.core.security import get_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/uploads", tags=["Uploads"])

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

    if vehicle_id:
        await verify_vehicle_access(db, vehicle_id, current_user)

    ext = Path(file.filename).suffix or ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    destination = UPLOAD_DIR / unique_filename

    # Save file async
    file_size = 0
    async with aiofiles.open(destination, "wb") as out_file:
        while content := await file.read(1024 * 1024): # 1MB chunks
            file_size += len(content)
            await out_file.write(content)

    url = f"/uploads/{unique_filename}"

    if vehicle_id:
        attachment = Attachment(
            vehicle_id=vehicle_id,
            service_record_id=service_record_id,
            fuel_log_id=fuel_log_id,
            document_id=document_id,
            file_name=file.filename,
            file_path=str(destination),
            file_size=file_size,
            content_type=file.content_type,
        )
        db.add(attachment)
        await db.commit()

    return {
        "url": url,
        "filename": file.filename,
        "size": file_size,
    }
