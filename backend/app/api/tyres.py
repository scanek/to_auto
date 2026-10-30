import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.tyre import TyreSet
from app.models.service import ServiceRecord, ServiceItem
from app.schemas.tyre import (
    TyreSetCreate,
    TyreSetUpdate,
    TyreSetResponse,
    TyreRotatePayload,
    TyreActivatePayload,
)
from app.core.security import get_current_user, get_optional_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/tyres", tags=["Tyres & Wheels"])

@router.get("", response_model=List[TyreSetResponse])
async def get_tyre_sets(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    query = select(TyreSet).where(TyreSet.vehicle_id == vehicle_id).order_by(TyreSet.created_at.desc())
    result = await db.execute(query)
    tyres = result.scalars().all()
    return [TyreSetResponse.model_validate(t) for t in tyres]

@router.post("", response_model=TyreSetResponse, status_code=status.HTTP_201_CREATED)
async def create_tyre_set(
    payload: TyreSetCreate,
    vehicle_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    data = payload.model_dump()
    if data["is_active"]:
        # Deactivate all other tyres for this vehicle
        others_res = await db.execute(select(TyreSet).where(TyreSet.vehicle_id == vehicle_id))
        for o in others_res.scalars().all():
            o.is_active = False

    tyre = TyreSet(**data, vehicle_id=vehicle_id)
    db.add(tyre)
    await db.commit()
    await db.refresh(tyre)
    return TyreSetResponse.model_validate(tyre)

@router.put("/{tyre_id}", response_model=TyreSetResponse)
async def update_tyre_set(
    tyre_id: int,
    payload: TyreSetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TyreSet).where(TyreSet.id == tyre_id))
    tyre = result.scalar_one_or_none()
    if not tyre:
        raise HTTPException(status_code=404, detail="Комплект шин не найден")

    await verify_vehicle_access(db, tyre.vehicle_id, current_user, require_owner=True)

    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("is_active"):
        # Deactivate others
        others_res = await db.execute(
            select(TyreSet).where(TyreSet.vehicle_id == tyre.vehicle_id, TyreSet.id != tyre.id)
        )
        for o in others_res.scalars().all():
            o.is_active = False

    for key, value in update_data.items():
        setattr(tyre, key, value)

    await db.commit()
    await db.refresh(tyre)
    return TyreSetResponse.model_validate(tyre)

@router.post("/{tyre_id}/activate", response_model=TyreSetResponse)
async def activate_tyre_set(
    tyre_id: int,
    mileage: Optional[float] = Query(None),
    payload: Optional[TyreActivatePayload] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TyreSet).where(TyreSet.id == tyre_id))
    tyre = result.scalar_one_or_none()
    if not tyre:
        raise HTTPException(status_code=404, detail="Комплект шин не найден")

    await verify_vehicle_access(db, tyre.vehicle_id, current_user, require_owner=True)

    others_res = await db.execute(
        select(TyreSet).where(TyreSet.vehicle_id == tyre.vehicle_id)
    )
    for o in others_res.scalars().all():
        o.is_active = (o.id == tyre.id)

    install_date = datetime.datetime.utcnow()
    install_mileage = mileage

    if payload:
        if payload.install_date:
            install_date = payload.install_date
        if payload.install_mileage is not None:
            install_mileage = payload.install_mileage
        if payload.service_cost is not None:
            tyre.service_cost = payload.service_cost
        if payload.storage_cost is not None:
            tyre.storage_cost = payload.storage_cost
        if payload.tread_depth_mm is not None:
            tyre.tread_depth_mm = payload.tread_depth_mm

    tyre.install_date = install_date
    if install_mileage is not None:
        tyre.install_mileage = install_mileage

    # Optional: Automatically create a ServiceRecord for seasonal tire change expense
    if payload and payload.create_service_record and (payload.service_cost or 0) > 0:
        cost_service = float(payload.service_cost or 0.0)
        cost_storage = float(payload.storage_cost or 0.0)
        total_rec_cost = cost_service + cost_storage
        season_title = "Зимний" if tyre.season == "winter" else "Летний"
        rec_title = f"Сезонный шиномонтаж ({season_title} комплект)"
        rec_desc = f"Сезонная смена резины на комплект «{tyre.name}»."
        if tyre.brand_model or tyre.size:
            rec_desc += f" {tyre.brand_model or ''} {tyre.size or ''}."

        srv_record = ServiceRecord(
            vehicle_id=tyre.vehicle_id,
            record_type="service",
            to_tag="Шиномонтаж",
            date=install_date,
            odometer=install_mileage if install_mileage is not None else 0.0,
            title=rec_title,
            description=rec_desc,
            cost_labor=cost_service,
            cost_parts=cost_storage,
            total_cost=total_rec_cost,
            store=tyre.storage_location or "Шиномонтаж",
            notes=f"Остаток протектора: {tyre.tread_depth_mm} мм.",
        )
        db.add(srv_record)
        await db.flush()

        labor_item = ServiceItem(
            service_record_id=srv_record.id,
            name="Сезонный шиномонтаж и балансировка",
            category="labor",
            quantity=1.0,
            unit="компл",
            unit_price=cost_service,
            total_price=cost_service,
        )
        db.add(labor_item)

        if cost_storage > 0:
            storage_item = ServiceItem(
                service_record_id=srv_record.id,
                name="Сезонное хранение шин",
                category="part",
                quantity=1.0,
                unit="сезон",
                unit_price=cost_storage,
                total_price=cost_storage,
            )
            db.add(storage_item)

    await db.commit()
    await db.refresh(tyre)
    return TyreSetResponse.model_validate(tyre)

@router.delete("/{tyre_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tyre_set(
    tyre_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TyreSet).where(TyreSet.id == tyre_id))
    tyre = result.scalar_one_or_none()
    if not tyre:
        raise HTTPException(status_code=404, detail="Комплект шин не найден")

    await verify_vehicle_access(db, tyre.vehicle_id, current_user, require_owner=True)
    await db.delete(tyre)
    await db.commit()
    return None

@router.post("/{tyre_id}/rotate", response_model=TyreSetResponse)
async def rotate_tyre_set(
    tyre_id: int,
    payload: TyreRotatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TyreSet).where(TyreSet.id == tyre_id))
    tyre = result.scalar_one_or_none()
    if not tyre:
        raise HTTPException(status_code=404, detail="Комплект шин не найден")

    await verify_vehicle_access(db, tyre.vehicle_id, current_user, require_owner=True)

    tyre.last_rotation_km = payload.current_odometer

    if payload.swap_tpms and (tyre.tpms_fl_id or tyre.tpms_fr_id or tyre.tpms_rl_id or tyre.tpms_rr_id):
        old_fl = tyre.tpms_fl_id
        old_fr = tyre.tpms_fr_id
        old_rl = tyre.tpms_rl_id
        old_rr = tyre.tpms_rr_id

        pattern = payload.drive_type.lower()
        if pattern == "fwd":
            # Forward cross: Front to same rear, rear cross to opposite front
            tyre.tpms_rl_id = old_fl
            tyre.tpms_rr_id = old_fr
            tyre.tpms_fl_id = old_rr
            tyre.tpms_fr_id = old_rl
        elif pattern in ("awd", "4wd", "rwd"):
            # Rearward cross: Rear to same front, front cross to opposite rear
            tyre.tpms_fl_id = old_rl
            tyre.tpms_fr_id = old_rr
            tyre.tpms_rl_id = old_fr
            tyre.tpms_rr_id = old_fl
        else:
            # Directional: front and rear swap on same side
            tyre.tpms_fl_id = old_rl
            tyre.tpms_rl_id = old_fl
            tyre.tpms_fr_id = old_rr
            tyre.tpms_rr_id = old_fr

    await db.commit()
    await db.refresh(tyre)
    return TyreSetResponse.model_validate(tyre)
