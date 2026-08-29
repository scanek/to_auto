import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
from app.core.config import settings, UPLOAD_DIR
from app.db.session import get_db
from app.models.attachment import Attachment
from app.schemas.attachment import AttachmentResponse

router = APIRouter(prefix="/uploads", tags=["Uploads"])

@router.post("", response_model=AttachmentResponse)
async def upload_file(
    file: UploadFile = File(...),
    vehicle_id: int = Query(...),
    service_record_id: int = Query(None),
    fuel_log_id: int = Query(None),
    document_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Имя файла не указано")

    ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    destination = UPLOAD_DIR / unique_filename

    # Save file async
    file_size = 0
    async with aiofiles.open(destination, "wb") as out_file:
        while content := await file.read(1024 * 1024): # 1MB chunks
            file_size += len(content)
            await out_file.write(content)

    url = f"/uploads/{unique_filename}"

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
    await db.refresh(attachment)

    resp = AttachmentResponse.model_validate(attachment)
    resp.url = url
    return resp
