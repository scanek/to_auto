import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.tyre import TyreSet
from app.schemas.tyre import TyreSetCreate, TyreSetUpdate, TyreSetResponse
from app.core.security import get_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/tyres", tags=["Tyres & Wheels"])

@router.get("", response_model=List[TyreSetResponse])
async def get_tyre_sets(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user)
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
    await verify_vehicle_access(db, vehicle_id, current_user)

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

    await verify_vehicle_access(db, tyre.vehicle_id, current_user)

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
    mileage: float = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TyreSet).where(TyreSet.id == tyre_id))
    tyre = result.scalar_one_or_none()
    if not tyre:
        raise HTTPException(status_code=404, detail="Комплект шин не найден")

    await verify_vehicle_access(db, tyre.vehicle_id, current_user)

    others_res = await db.execute(
        select(TyreSet).where(TyreSet.vehicle_id == tyre.vehicle_id)
    )
    for o in others_res.scalars().all():
        o.is_active = (o.id == tyre.id)

    tyre.install_date = datetime.datetime.utcnow()
    if mileage is not None:
        tyre.install_mileage = mileage

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

    await verify_vehicle_access(db, tyre.vehicle_id, current_user)
    await db.delete(tyre)
    await db.commit()
    return None
