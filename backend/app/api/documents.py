import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.document import DocumentNote
from app.schemas.document import DocumentNoteCreate, DocumentNoteUpdate, DocumentNoteResponse

router = APIRouter(prefix="/documents", tags=["Documents & Notes"])

@router.get("", response_model=List[DocumentNoteResponse])
async def get_documents(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    db: AsyncSession = Depends(get_db),
):
    query = select(DocumentNote).where(DocumentNote.vehicle_id == vehicle_id).order_by(DocumentNote.created_at.desc())
    result = await db.execute(query)
    docs = result.scalars().all()

    now = datetime.datetime.utcnow()
    responses = []
    for d in docs:
        resp = DocumentNoteResponse.model_validate(d)
        if d.expiration_date:
            delta = d.expiration_date - now
            resp.days_until_expiration = delta.days
            resp.is_expired = delta.days < 0
        responses.append(resp)
    return responses

@router.post("", response_model=DocumentNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_document(payload: DocumentNoteCreate, vehicle_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    if not veh_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    doc = DocumentNote(**payload.model_dump(), vehicle_id=vehicle_id)
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    resp = DocumentNoteResponse.model_validate(doc)
    if doc.expiration_date:
        delta = doc.expiration_date - datetime.datetime.utcnow()
        resp.days_until_expiration = delta.days
        resp.is_expired = delta.days < 0
    return resp

@router.put("/{doc_id}", response_model=DocumentNoteResponse)
async def update_document(doc_id: int, payload: DocumentNoteUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DocumentNote).where(DocumentNote.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(doc, key, value)

    await db.commit()
    await db.refresh(doc)

    resp = DocumentNoteResponse.model_validate(doc)
    if doc.expiration_date:
        delta = doc.expiration_date - datetime.datetime.utcnow()
        resp.days_until_expiration = delta.days
        resp.is_expired = delta.days < 0
    return resp

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DocumentNote).where(DocumentNote.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    await db.delete(doc)
    await db.commit()
    return None
