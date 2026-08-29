import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models import Vehicle, ServiceRecord, FuelLog, MaintenancePlan, TyreSet, DocumentNote
from app.services.pdf_service import generate_service_booklet_html
from app.services.excel_service import generate_vehicle_excel
from app.services.analytics_service import compute_vehicle_analytics

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/service-booklet/{vehicle_id}")
async def export_service_booklet(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .order_by(ServiceRecord.date.desc())
    )
    service_records = srv_res.scalars().all()

    html_content = generate_service_booklet_html(vehicle, service_records)
    
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": 'inline'}
    )

@router.get("/excel/{vehicle_id}")
async def export_excel(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .order_by(ServiceRecord.date.desc())
    )
    service_records = srv_res.scalars().all()

    fuel_res = await db.execute(
        select(FuelLog)
        .where(FuelLog.vehicle_id == vehicle_id)
        .order_by(FuelLog.date.desc())
    )
    fuel_logs = fuel_res.scalars().all()

    rem_res = await db.execute(
        select(MaintenancePlan)
        .where(MaintenancePlan.vehicle_id == vehicle_id)
    )
    reminders = rem_res.scalars().all()

    ty_res = await db.execute(
        select(TyreSet)
        .where(TyreSet.vehicle_id == vehicle_id)
        .order_by(TyreSet.created_at.desc())
    )
    tyres = ty_res.scalars().all()

    doc_res = await db.execute(
        select(DocumentNote)
        .where(DocumentNote.vehicle_id == vehicle_id)
        .order_by(DocumentNote.created_at.desc())
    )
    documents = doc_res.scalars().all()

    analytics = await compute_vehicle_analytics(db, vehicle)

    excel_bytes = generate_vehicle_excel(vehicle, service_records, fuel_logs, reminders, tyres, documents, analytics)
    
    filename = f"AutoTracker_{vehicle.id}_{vehicle.make}_{vehicle.model}.xlsx"
    encoded_filename = urllib.parse.quote(filename)
    
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
        }
    )
