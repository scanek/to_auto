import datetime
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.models.tyre import TyreSet
from app.models.consumable import VehicleConsumable
from app.models.user import User
from app.services.pdf_service import generate_service_booklet_html
from app.services.auth_helper import verify_vehicle_access
from app.core.security import get_current_user

router = APIRouter(tags=["Public Booklet"])

class PublicBookletSettings(BaseModel):
    enabled: bool
    show_costs: bool = False
    regenerate_token: bool = False

@router.get("/public/booklet/{token}")
async def get_public_service_booklet(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Publicly accessible, read-only vehicle service booklet by unique secret token.
    Strips sensitive personal/owner information and conditionally filters costs.
    """
    res = await db.execute(
        select(Vehicle)
        .where(Vehicle.public_booklet_token == token, Vehicle.public_booklet_enabled == True)
    )
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сервисная книжка не найдена или доступ ограничен владельцем."
        )

    # Load service records with items
    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle.id)
        .order_by(ServiceRecord.date.desc(), ServiceRecord.odometer.desc(), ServiceRecord.id.desc())
    )
    service_records = srv_res.scalars().all()

    # Load tyre sets
    tyre_res = await db.execute(
        select(TyreSet)
        .where(TyreSet.vehicle_id == vehicle.id)
        .order_by(TyreSet.is_active.desc(), TyreSet.season.asc())
    )
    tyre_sets = tyre_res.scalars().all()

    # Load consumables
    cons_res = await db.execute(
        select(VehicleConsumable)
        .where(VehicleConsumable.vehicle_id == vehicle.id)
        .order_by(VehicleConsumable.order_index.asc(), VehicleConsumable.id.asc())
    )
    consumables = cons_res.scalars().all()

    # Public telematics status
    is_telematics_verified = bool(
        vehicle.telematics_provider in ("starline", "can_obd", "webhook")
        and vehicle.starline_last_sync is not None
    )

    # Format service records
    formatted_records = []
    for r in service_records:
        items_data = []
        if r.items:
            for it in r.items:
                items_data.append({
                    "name": it.name,
                    "brand": it.brand,
                    "part_number": it.part_number,
                    "quantity": it.quantity,
                    "unit": it.unit,
                    "unit_price": it.unit_price if vehicle.public_show_costs else None,
                    "total_price": it.total_price if vehicle.public_show_costs else None,
                })

        formatted_records.append({
            "id": r.id,
            "date": r.date.strftime("%Y-%m-%d") if r.date else None,
            "odometer": r.odometer,
            "engine_hours": r.engine_hours,
            "record_type": r.record_type,
            "to_tag": r.to_tag,
            "title": r.title,
            "description": r.description or r.notes,
            "parts_cost": r.parts_cost if vehicle.public_show_costs else None,
            "labor_cost": r.labor_cost if vehicle.public_show_costs else None,
            "total_cost": r.total_cost if vehicle.public_show_costs else None,
            "items": items_data,
        })

    # Format tyre sets
    formatted_tyres = []
    for t in tyre_sets:
        formatted_tyres.append({
            "id": t.id,
            "name": t.name,
            "season": t.season,
            "brand_model": t.brand_model,
            "size": t.size,
            "year": t.year,
            "dot_code": t.dot_code,
            "is_active": t.is_active,
            "current_km": t.current_km,
            "tread_depth_mm": t.tread_depth_mm,
            "has_separate_rims": t.has_separate_rims,
            "rims_brand_model": t.rims_brand_model,
            "rims_size": t.rims_size,
            "tpms_sensors": t.tpms_sensors,
            "tpms_frequency": t.tpms_frequency,
            "tpms_pressure_bar": t.tpms_pressure_bar,
            "tpms_fl_id": t.tpms_fl_id,
            "tpms_fr_id": t.tpms_fr_id,
            "tpms_rl_id": t.tpms_rl_id,
            "tpms_rr_id": t.tpms_rr_id,
            "last_rotation_km": t.last_rotation_km,
            "rotation_interval_km": t.rotation_interval_km,
            "is_directional": t.is_directional,
            "total_price": t.total_price if vehicle.public_show_costs else None,
        })

    # Format consumables
    formatted_consumables = []
    for c in consumables:
        formatted_consumables.append({
            "id": c.id,
            "category": c.category,
            "name": c.name,
            "specification": c.specification,
            "oem_part_number": c.oem_part_number,
            "aftermarket_parts": c.aftermarket_parts,
            "replacement_interval": c.replacement_interval,
            "notes": c.notes,
        })

    return {
        "vehicle": {
            "make": vehicle.make,
            "model": vehicle.model,
            "year": vehicle.year,
            "license_plate": vehicle.license_plate,
            "vin": vehicle.vin,
            "body_type": vehicle.body_type,
            "fuel_type": vehicle.fuel_type,
            "transmission": vehicle.transmission,
            "drive_type": vehicle.drive_type or "fwd",
            "color": vehicle.color,
            "current_odometer": vehicle.current_odometer,
            "distance_unit": vehicle.distance_unit,
            "current_engine_hours": vehicle.current_engine_hours,
            "oil_spec": vehicle.oil_spec,
            "currency": vehicle.currency,
            "telematics_verified": is_telematics_verified,
            "last_telematics_sync": vehicle.starline_last_sync.strftime("%d.%m.%Y %H:%M") if vehicle.starline_last_sync else None,
            "public_show_costs": vehicle.public_show_costs,
        },
        "service_records": formatted_records,
        "tyres": formatted_tyres,
        "consumables": formatted_consumables,
        "public_show_costs": vehicle.public_show_costs,
    }

@router.get("/public/booklet/{token}/print")
async def get_public_service_booklet_print(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Renders standalone printable HTML booklet for public view.
    """
    res = await db.execute(
        select(Vehicle)
        .where(Vehicle.public_booklet_token == token, Vehicle.public_booklet_enabled == True)
    )
    vehicle = res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сервисная книжка не найдена или доступ ограничен владельцем."
        )

    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle.id)
        .order_by(ServiceRecord.date.asc(), ServiceRecord.odometer.asc())
    )
    service_records = srv_res.scalars().all()

    tyre_res = await db.execute(
        select(TyreSet)
        .where(TyreSet.vehicle_id == vehicle.id)
        .order_by(TyreSet.season.asc(), TyreSet.name.asc())
    )
    tyre_sets = tyre_res.scalars().all()

    cons_res = await db.execute(
        select(VehicleConsumable)
        .where(VehicleConsumable.vehicle_id == vehicle.id)
        .order_by(VehicleConsumable.order_index.asc())
    )
    consumables = cons_res.scalars().all()

    html_content = generate_service_booklet_html(
        vehicle,
        service_records,
        tyres=tyre_sets,
        consumables=consumables,
        hide_costs=not vehicle.public_show_costs
    )

    return Response(
        content=html_content,
        media_type="text/html",
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff"
        }
    )

@router.post("/vehicles/{vehicle_id}/public-booklet")
async def update_public_booklet_settings(
    vehicle_id: int,
    settings: PublicBookletSettings,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Toggle public booklet sharing, regenerate public token and toggle cost visibility.
    Only the vehicle owner can change these settings.
    """
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    if settings.regenerate_token or not vehicle.public_booklet_token:
        vehicle.public_booklet_token = secrets.token_urlsafe(16)

    vehicle.public_booklet_enabled = settings.enabled
    vehicle.public_show_costs = settings.show_costs

    await db.commit()
    await db.refresh(vehicle)

    return {
        "enabled": vehicle.public_booklet_enabled,
        "show_costs": vehicle.public_show_costs,
        "public_token": vehicle.public_booklet_token,
    }
