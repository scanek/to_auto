from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord, ServiceItem, RecordType
from app.models.reminder import MaintenancePlan
from app.schemas.service import ServiceRecordCreate, ServiceRecordUpdate, ServiceRecordResponse

router = APIRouter(prefix="/service-records", tags=["Service Records"])

@router.get("", response_model=List[ServiceRecordResponse])
async def get_service_records(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    record_type: Optional[str] = Query(None, description="Фильтр по типу: service, repair, upgrade"),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ServiceRecord)
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
        .order_by(ServiceRecord.date.desc(), ServiceRecord.odometer.desc())
    )
    if record_type:
        query = query.where(ServiceRecord.record_type == record_type)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    responses = []
    for r in records:
        resp = ServiceRecordResponse.model_validate(r)
        resp.attachments_count = len(r.attachments)
        responses.append(resp)
    return responses

@router.post("", response_model=ServiceRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_service_record(payload: ServiceRecordCreate, vehicle_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    veh_res = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    data = payload.model_dump(exclude={"items"})
    items_data = payload.items or []

    # Calculate costs if items provided
    items_parts_cost = sum(it.total_price or (it.quantity * it.unit_price) for it in items_data if it.category == "part")
    items_labor_cost = sum(it.total_price or (it.quantity * it.unit_price) for it in items_data if it.category == "labor")

    if items_parts_cost > 0 and not data.get("cost_parts"):
        data["cost_parts"] = items_parts_cost
    if items_labor_cost > 0 and not data.get("cost_labor"):
        data["cost_labor"] = items_labor_cost

    calc_total = (data.get("cost_parts") or 0.0) + (data.get("cost_labor") or 0.0)
    if calc_total > 0 and (not data.get("total_cost") or data.get("total_cost") == 0.0):
        data["total_cost"] = calc_total

    record = ServiceRecord(**data, vehicle_id=vehicle_id)
    db.add(record)
    await db.flush()

    for it in items_data:
        it_dict = it.model_dump()
        if not it_dict.get("total_price") or it_dict.get("total_price") == 0:
            it_dict["total_price"] = it_dict["quantity"] * it_dict["unit_price"]
        item = ServiceItem(**it_dict, service_record_id=record.id)
        db.add(item)

    # Update vehicle odometer if record is higher
    if record.odometer > (vehicle.current_odometer or 0.0):
        vehicle.current_odometer = record.odometer

    # If this is a regular service, check if we should update matching maintenance plans
    if record.record_type == RecordType.SERVICE.value:
        plans_res = await db.execute(select(MaintenancePlan).where(MaintenancePlan.vehicle_id == vehicle_id))
        plans = plans_res.scalars().all()
        for p in plans:
            # If reminder title is in record title or description
            if p.title.lower() in record.title.lower() or (record.description and p.title.lower() in record.description.lower()):
                if record.odometer >= p.last_service_odometer:
                    p.last_service_odometer = record.odometer
                    p.last_service_date = record.date

    await db.commit()
    
    # Reload with relations
    res = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.id == record.id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
    )
    saved = res.scalar_one()
    resp = ServiceRecordResponse.model_validate(saved)
    resp.attachments_count = len(saved.attachments)
    return resp

@router.get("/{record_id}", response_model=ServiceRecordResponse)
async def get_service_record(record_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.id == record_id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    resp = ServiceRecordResponse.model_validate(record)
    resp.attachments_count = len(record.attachments)
    return resp

@router.put("/{record_id}", response_model=ServiceRecordResponse)
async def update_service_record(record_id: int, payload: ServiceRecordUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.id == record_id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    update_data = payload.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        setattr(record, key, value)
    
    if payload.items is not None:
        # Replace items
        for old_it in record.items:
            await db.delete(old_it)
        for it in payload.items:
            it_dict = it.model_dump()
            if not it_dict.get("total_price") or it_dict.get("total_price") == 0:
                it_dict["total_price"] = it_dict["quantity"] * it_dict["unit_price"]
            new_item = ServiceItem(**it_dict, service_record_id=record.id)
            db.add(new_item)

    # Recalculate total if requested or needed
    if record.cost_parts or record.cost_labor:
        calc_total = (record.cost_parts or 0.0) + (record.cost_labor or 0.0)
        if not payload.total_cost:
            record.total_cost = calc_total

    await db.commit()
    
    res = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.id == record.id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
    )
    saved = res.scalar_one()
    resp = ServiceRecordResponse.model_validate(saved)
    resp.attachments_count = len(saved.attachments)
    return resp

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_record(record_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ServiceRecord).where(ServiceRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    await db.delete(record)
    await db.commit()
    return None
