from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.services.pdf_service import generate_service_booklet_html

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/service-booklet/{vehicle_id}", response_class=HTMLResponse)
async def get_service_booklet(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    srv_res = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .options(selectinload(ServiceRecord.items))
        .order_by(ServiceRecord.odometer.asc(), ServiceRecord.date.asc())
    )
    records = srv_res.scalars().all()

    html = generate_service_booklet_html(vehicle, records)
    return HTMLResponse(content=html, status_code=200)
