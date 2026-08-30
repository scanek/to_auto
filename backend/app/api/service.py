from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord, ServiceItem, RecordType
from app.models.reminder import MaintenancePlan
from app.schemas.service import ServiceRecordCreate, ServiceRecordUpdate, ServiceRecordResponse
from app.core.security import get_current_user, get_optional_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/service-records", tags=["Service Records"])

@router.get("", response_model=List[ServiceRecordResponse])
async def get_service_records(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    record_type: Optional[str] = Query(None, description="Фильтр по типу: service, repair, upgrade"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)

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
async def create_service_record(
    payload: ServiceRecordCreate,
    vehicle_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    
    data = payload.model_dump(exclude={"items"})
    items_data = payload.items or []

    # Calculate costs from items
    items_parts_cost = sum(
        (it.total_price if it.total_price is not None and it.total_price > 0 else (it.quantity * it.unit_price))
        for it in items_data if it.category != "labor"
    )
    items_labor_cost = sum(
        (it.total_price if it.total_price is not None and it.total_price > 0 else (it.quantity * it.unit_price))
        for it in items_data if it.category == "labor"
    )

    if items_parts_cost > 0 and (not data.get("cost_parts") or data.get("cost_parts") == 0.0):
        data["cost_parts"] = items_parts_cost
    if items_labor_cost > 0 and (not data.get("cost_labor") or data.get("cost_labor") == 0.0):
        data["cost_labor"] = items_labor_cost

    calc_total = (data.get("cost_parts") or 0.0) + (data.get("cost_labor") or 0.0)
    if calc_total > 0:
        if not data.get("total_cost") or data.get("total_cost") == 0.0 or data.get("total_cost") < calc_total:
            data["total_cost"] = calc_total

    record = ServiceRecord(**data, vehicle_id=vehicle_id)
    db.add(record)
    await db.flush()

    for it in items_data:
        it_dict = it.model_dump()
        if not it_dict.get("total_price") or it_dict.get("total_price") == 0:
            it_dict["total_price"] = (it_dict.get("quantity") or 1.0) * (it_dict.get("unit_price") or 0.0)
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
async def get_service_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.id == record_id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    await verify_vehicle_access(db, record.vehicle_id, current_user)
    
    resp = ServiceRecordResponse.model_validate(record)
    resp.attachments_count = len(record.attachments)
    return resp

@router.put("/{record_id}", response_model=ServiceRecordResponse)
async def update_service_record(
    record_id: int,
    payload: ServiceRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ServiceRecord)
        .where(ServiceRecord.id == record_id)
        .options(selectinload(ServiceRecord.items), selectinload(ServiceRecord.attachments))
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    await verify_vehicle_access(db, record.vehicle_id, current_user, require_owner=True)
    
    update_data = payload.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        setattr(record, key, value)
    
    if payload.items is not None:
        # Calculate parts & labor sum from payload items
        items_parts_cost = sum(
            (it.total_price if it.total_price is not None and it.total_price > 0 else (it.quantity * it.unit_price))
            for it in payload.items if it.category != "labor"
        )
        items_labor_cost = sum(
            (it.total_price if it.total_price is not None and it.total_price > 0 else (it.quantity * it.unit_price))
            for it in payload.items if it.category == "labor"
        )

        if items_parts_cost > 0:
            if not record.cost_parts or record.cost_parts == 0.0 or "cost_parts" not in update_data or record.cost_parts < items_parts_cost:
                record.cost_parts = items_parts_cost
        elif not payload.items and "cost_parts" not in update_data:
            record.cost_parts = 0.0

        if items_labor_cost > 0:
            if not record.cost_labor or record.cost_labor == 0.0 or "cost_labor" not in update_data:
                record.cost_labor = items_labor_cost

        # Reassign items cleanly via ORM
        new_items = []
        for it in payload.items:
            it_dict = it.model_dump()
            if not it_dict.get("total_price") or it_dict.get("total_price") == 0:
                it_dict["total_price"] = (it_dict.get("quantity") or 1.0) * (it_dict.get("unit_price") or 0.0)
            new_items.append(ServiceItem(**it_dict))
        record.items = new_items

    # Synchronize total_cost
    calc_total = (record.cost_parts or 0.0) + (record.cost_labor or 0.0)
    if calc_total > 0:
        if not record.total_cost or record.total_cost == 0.0 or "total_cost" not in update_data or record.total_cost < calc_total:
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
async def delete_service_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ServiceRecord).where(ServiceRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    await verify_vehicle_access(db, record.vehicle_id, current_user, require_owner=True)
    await db.delete(record)
    await db.commit()
    return None
