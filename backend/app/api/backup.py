import datetime
import json
import urllib.parse
import traceback
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Response, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models import (
    User,
    UserRole,
    Vehicle,
    ServiceRecord,
    ServiceItem,
    RecordType,
    MaintenancePlan,
    DocumentNote,
    TyreSet,
    FuelLog,
)
from app.services.reminder_service import is_item_match_for_plan
from app.core.security import get_current_user
from app.services.auth_helper import verify_vehicle_access, resolve_user_from_header_or_query

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])

def serialize_vehicle_dict(vehicle: Vehicle, service_records, fuel_logs, reminders, tyres, documents) -> Dict[str, Any]:
    """Helper to serialize full vehicle entity with all related history."""
    return {
        "vehicle": {
            "id": vehicle.id,
            "name": vehicle.name,
            "make": vehicle.make,
            "model": vehicle.model,
            "year": vehicle.year,
            "engine": vehicle.engine,
            "license_plate": vehicle.license_plate,
            "vin": vehicle.vin,
            "starting_odometer": vehicle.starting_odometer,
            "current_odometer": vehicle.current_odometer,
            "current_engine_hours": vehicle.current_engine_hours,
            "oil_spec": vehicle.oil_spec,
            "is_public": getattr(vehicle, "is_public", False),
            "distance_unit": vehicle.distance_unit,
            "fuel_unit": vehicle.fuel_unit,
            "currency": vehicle.currency,
            "photo_url": vehicle.photo_url,
            "notes": vehicle.notes,
        },
        "trackers": [
            {
                "id": p.tracker_id or str(p.id),
                "name": p.title,
                "category": p.category,
                "brand": p.brand,
                "spec": p.spec,
                "article": p.article,
                "icon": p.icon,
                "interval_km": p.interval_distance,
                "interval_hours": p.interval_hours,
                "interval_months": p.interval_months,
                "last_service_odometer": p.last_service_odometer,
                "last_service_hours": p.last_service_hours,
                "last_service_date": p.last_service_date.isoformat() if p.last_service_date else None,
                "enabled": p.is_active,
                "warn_km": p.notify_before_distance,
                "warn_hours": p.notify_before_hours,
                "warn_days": p.notify_before_days,
                "notes": p.notes,
            }
            for p in reminders
        ],
        "service_records": [
            {
                "id": s.id,
                "date": s.date.isoformat() if s.date else None,
                "odometer": s.odometer,
                "engine_hours": s.engine_hours,
                "record_type": s.record_type,
                "to_tag": s.to_tag,
                "title": s.title,
                "description": s.description,
                "cost_labor": s.cost_labor,
                "cost_parts": s.cost_parts,
                "total_cost": s.total_cost,
                "store": s.store,
                "url": s.url,
                "notes": s.notes,
                "items": [
                    {
                        "name": it.name,
                        "brand": it.brand,
                        "part_number": it.part_number,
                        "category": it.category,
                        "unit": it.unit,
                        "quantity": it.quantity,
                        "unit_price": it.unit_price,
                        "total_price": it.total_price,
                        "store": it.store,
                        "url": it.url,
                    }
                    for it in (s.items or [])
                ],
            }
            for s in service_records
        ],
        "fuel_logs": [
            {
                "id": f.id,
                "date": f.date.isoformat() if f.date else None,
                "odometer": f.odometer,
                "fuel_amount": f.fuel_amount,
                "total_cost": f.total_cost,
                "unit_price": f.unit_price,
                "is_full_tank": f.is_full_tank,
                "is_missed": f.is_missed,
                "fuel_grade": f.fuel_grade,
                "gas_station": f.gas_station,
                "notes": f.notes,
            }
            for f in fuel_logs
        ],
        "tyre_sets": [
            {
                "id": t.id,
                "name": t.name,
                "season": t.season,
                "size": t.size,
                "brand_model": t.brand_model,
                "current_km": t.current_km,
                "tread_depth_mm": t.tread_depth_mm,
                "storage_location": t.storage_location,
                "is_active": t.is_active,
                "install_date": t.install_date.isoformat() if t.install_date else None,
                "install_mileage": t.install_mileage,
                "quantity": t.quantity,
                "price_per_unit": t.price_per_unit,
                "total_price": t.total_price,
            }
            for t in tyres
        ],
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "doc_type": d.doc_type,
                "company": d.company,
                "document_number": d.document_number,
                "issue_date": d.issue_date.isoformat() if d.issue_date else None,
                "expiration_date": d.expiration_date.isoformat() if d.expiration_date else None,
                "price": d.price,
                "mileage": d.mileage,
                "engine_hours": d.engine_hours,
                "is_active": d.is_active,
                "notes": d.notes,
            }
            for d in documents
        ],
    }

@router.get("/export/{vehicle_id}")
async def export_vehicle_backup(
    vehicle_id: int,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports a complete JSON backup for a single vehicle owned by user (or by admin).
    """
    user = await resolve_user_from_header_or_query(authorization, token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    # Only owner or admin can export full vehicle backup (contains sensitive data)
    vehicle = await verify_vehicle_access(db, vehicle_id, user, require_owner=True, allow_admin_override=True)

    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .order_by(ServiceRecord.date.asc(), ServiceRecord.odometer.asc())
    )
    service_records = srv_res.scalars().all()

    fuel_res = await db.execute(
        select(FuelLog)
        .where(FuelLog.vehicle_id == vehicle_id)
        .order_by(FuelLog.date.asc(), FuelLog.odometer.asc())
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
    )
    tyres = ty_res.scalars().all()

    doc_res = await db.execute(
        select(DocumentNote)
        .where(DocumentNote.vehicle_id == vehicle_id)
    )
    documents = doc_res.scalars().all()

    backup_payload = serialize_vehicle_dict(vehicle, service_records, fuel_logs, reminders, tyres, documents)
    backup_payload["version"] = "1.0"
    backup_payload["exported_at"] = datetime.datetime.utcnow().isoformat()
    backup_payload["app"] = "Бортовой Журнал"

    json_str = json.dumps(backup_payload, ensure_ascii=False, indent=2)
    date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    clean_car = f"{vehicle.make}_{vehicle.model}".replace(" ", "_")
    filename = f"backup_{clean_car}_{date_str}.json"
    encoded_filename = urllib.parse.quote(filename)

    return Response(
        content=json_str.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{encoded_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        },
    )

@router.get("/export-all")
async def export_all_backup(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports a complete JSON backup of vehicles.
    Admin: exports all vehicles in the database.
    Regular user: exports ONLY vehicles owned by this user.
    """
    user = await resolve_user_from_header_or_query(authorization, token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    if user.role == UserRole.ADMIN:
        query = select(Vehicle).order_by(Vehicle.id.asc())
        filename = f"bortovoi_full_backup_{date_str}.json"
    else:
        query = select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc())
        filename = f"my_garage_backup_{date_str}.json"

    veh_res = await db.execute(query)
    vehicles = veh_res.scalars().all()

    all_data = []
    for vehicle in vehicles:
        srv_res = await db.execute(
            select(ServiceRecord)
            .options(selectinload(ServiceRecord.items))
            .where(ServiceRecord.vehicle_id == vehicle.id)
            .order_by(ServiceRecord.date.asc(), ServiceRecord.odometer.asc())
        )
        service_records = srv_res.scalars().all()

        fuel_res = await db.execute(
            select(FuelLog)
            .where(FuelLog.vehicle_id == vehicle.id)
            .order_by(FuelLog.date.asc(), FuelLog.odometer.asc())
        )
        fuel_logs = fuel_res.scalars().all()

        rem_res = await db.execute(
            select(MaintenancePlan)
            .where(MaintenancePlan.vehicle_id == vehicle.id)
        )
        reminders = rem_res.scalars().all()

        ty_res = await db.execute(
            select(TyreSet)
            .where(TyreSet.vehicle_id == vehicle.id)
        )
        tyres = ty_res.scalars().all()

        doc_res = await db.execute(
            select(DocumentNote)
            .where(DocumentNote.vehicle_id == vehicle.id)
        )
        documents = doc_res.scalars().all()

        all_data.append(serialize_vehicle_dict(vehicle, service_records, fuel_logs, reminders, tyres, documents))

    payload = {
        "version": "1.0",
        "exported_at": datetime.datetime.utcnow().isoformat(),
        "app": "Бортовой Журнал",
        "is_admin_full_backup": bool(user.role == UserRole.ADMIN),
        "vehicles_count": len(all_data),
        "data": all_data,
    }

    json_str = json.dumps(payload, ensure_ascii=False, indent=2)
    encoded_filename = urllib.parse.quote(filename)

    return Response(
        content=json_str.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{encoded_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        },
    )

def safe_parse_datetime(val: Any) -> Optional[datetime.datetime]:
    if not val:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        if isinstance(val, datetime.date) and not isinstance(val, datetime.datetime):
            return datetime.datetime(val.year, val.month, val.day)
        if isinstance(val, datetime.datetime) and val.tzinfo is not None:
            return val.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return val
    s = str(val).strip()
    if not s or s.lower() in ("none", "null"):
        return None
    s_clean = s.replace("Z", "+00:00")
    try:
        dt = datetime.datetime.fromisoformat(s_clean)
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d.%m.%Y", "%d.%m.%Y %H:%M:%S"):
        try:
            return datetime.datetime.strptime(s.split(".")[0], fmt)
        except Exception:
            pass
    return None

def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default

@router.post("/import")
async def import_backup(
    data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Imports a complete backup from Бортовой Журнал and assigns it to current user.
    Supports single-vehicle web backup, multi-vehicle package backup, flat mobile backups,
    and legacy formats.
    """
    try:
        packages = []

        if isinstance(data.get("data"), list) and len(data["data"]) > 0:
            # Multi-vehicle package format (from export-all)
            packages = data["data"]
        elif isinstance(data.get("vehicle"), dict):
            # Single vehicle packaged export
            packages = [data]
        elif isinstance(data.get("vehicles"), list) and len(data["vehicles"]) > 0:
            # Flat format with vehicles array and top-level services/fuel/etc.
            flat_vehicles = data["vehicles"]
            flat_services = data.get("services") or data.get("service_records") or []
            flat_fuel = data.get("fuel") or data.get("fuel_logs") or []
            flat_reminders = data.get("reminders") or data.get("trackers") or []
            flat_tyres = data.get("tyres") or data.get("tyre_sets") or []
            flat_docs = data.get("documents") or data.get("insurances") or []

            single_v = len(flat_vehicles) == 1

            for v in flat_vehicles:
                vid = v.get("id")
                v_services = [s for s in flat_services if single_v or s.get("vehicle_id") == vid]
                v_fuel = [f for f in flat_fuel if single_v or f.get("vehicle_id") == vid]
                v_reminders = [r for r in flat_reminders if single_v or r.get("vehicle_id") == vid]
                v_tyres = [t for t in flat_tyres if single_v or t.get("vehicle_id") == vid]
                v_docs = [d for d in flat_docs if single_v or d.get("vehicle_id") == vid]

                packages.append({
                    "vehicle": v,
                    "service_records": v_services,
                    "fuel_logs": v_fuel,
                    "trackers": v_reminders,
                    "tyre_sets": v_tyres,
                    "documents": v_docs,
                })
        elif isinstance(data, dict) and any(k in data for k in ("brand", "make", "model", "name")):
            packages = [{"vehicle": data, "trackers": data.get("trackers") or data.get("reminders") or []}]
        else:
            raise HTTPException(status_code=400, detail="В файле бэкапа не найдены данные автомобиля")

        if not packages:
            raise HTTPException(status_code=400, detail="В файле бэкапа не найдены данные для импорта")

        first_vehicle_id: Optional[int] = None
        restored_vehicles_count = 0
        total_services_count = 0
        total_fuel_count = 0
        total_trackers_count = 0
        total_tyres_count = 0
        total_docs_count = 0

        for pkg in packages:
            v_raw = pkg.get("vehicle") or (pkg.get("vehicles", [{}])[0] if pkg.get("vehicles") else pkg)
            if not v_raw or not isinstance(v_raw, dict):
                continue

            make = str(v_raw.get("brand") or v_raw.get("make") or "Автомобиль")
            model = str(v_raw.get("model") or "Модель")
            name = str(v_raw.get("name") or f"{make} {model}")
            plate = str(v_raw.get("plate") or v_raw.get("license_plate") or "")
            engine = str(v_raw.get("engine") or "")
            year = safe_int(v_raw.get("year"), datetime.datetime.utcnow().year)
            vin = str(v_raw.get("vin") or "")
            current_km = safe_float(v_raw.get("current_km") or v_raw.get("current_odometer"))
            starting_km = safe_float(v_raw.get("starting_odometer"), current_km)
            engine_hours = safe_float(v_raw.get("current_engine_hours"))
            oil_spec = str(v_raw.get("oil_spec") or "")
            photo_url = str(v_raw.get("photo_url") or "")
            notes = str(v_raw.get("notes") or "")

            vehicle = Vehicle(
                user_id=current_user.id,
                name=name,
                make=make,
                model=model,
                year=year,
                engine=engine,
                license_plate=plate,
                vin=vin,
                starting_odometer=starting_km,
                current_odometer=current_km,
                current_engine_hours=engine_hours,
                oil_spec=oil_spec,
                photo_url=photo_url,
                notes=notes,
                distance_unit=str(v_raw.get("distance_unit") or "km"),
                fuel_unit=str(v_raw.get("fuel_unit") or "L"),
                currency=str(v_raw.get("currency") or "RUB"),
            )
            db.add(vehicle)
            await db.flush()

            if first_vehicle_id is None:
                first_vehicle_id = vehicle.id
            restored_vehicles_count += 1

            # 1. Trackers / Reminders
            trackers = pkg.get("trackers") or pkg.get("reminders") or v_raw.get("trackers") or []
            for t in trackers:
                if not isinstance(t, dict):
                    continue
                last_date = safe_parse_datetime(t.get("last_service_date")) or datetime.datetime.utcnow()
                interval_km = safe_float(t.get("interval_distance") or t.get("interval_km"), 0.0)
                interval_hrs = safe_float(t.get("interval_hours"), 0.0)
                interval_m = safe_int(t.get("interval_months"), 0)

                plan = MaintenancePlan(
                    vehicle_id=vehicle.id,
                    tracker_id=str(t.get("id") or t.get("tracker_id") or ""),
                    title=str(t.get("name") or t.get("title") or "Регламент ТО"),
                    category=str(t.get("category") or "Обслуживание"),
                    brand=str(t.get("brand") or ""),
                    spec=str(t.get("spec") or ""),
                    article=str(t.get("article") or ""),
                    icon=str(t.get("icon") or "wrench"),
                    interval_distance=interval_km if interval_km > 0 else None,
                    interval_hours=interval_hrs if interval_hrs > 0 else None,
                    interval_months=interval_m if interval_m > 0 else None,
                    last_service_odometer=safe_float(t.get("last_service_odometer")),
                    last_service_hours=safe_float(t.get("last_service_hours")),
                    last_service_date=last_date,
                    is_active=bool(t.get("is_active", t.get("enabled", True))),
                    notify_before_distance=safe_float(t.get("notify_before_distance") or t.get("warn_km"), 500.0),
                    notify_before_hours=safe_float(t.get("notify_before_hours") or t.get("warn_hours"), 30.0),
                    notify_before_days=safe_int(t.get("notify_before_days") or t.get("warn_days"), 14),
                    notes=str(t.get("notes") or ""),
                )
                db.add(plan)
                total_trackers_count += 1
            await db.flush()

            # 2. Service Records & Items
            s_records = pkg.get("service_records") or pkg.get("services") or []
            if s_records:
                for s in s_records:
                    if not isinstance(s, dict):
                        continue
                    r_date = safe_parse_datetime(s.get("date")) or datetime.datetime.utcnow()
                    cost_parts = safe_float(s.get("cost_parts"))
                    cost_labor = safe_float(s.get("cost_labor"))
                    total_c = safe_float(s.get("total_cost"), cost_parts + cost_labor)
                    odo = safe_float(s.get("odometer") or s.get("mileage"))
                    eng_hrs = safe_float(s.get("engine_hours"))

                    raw_type = str(s.get("record_type") or "service").lower()
                    rec_type = RecordType.SERVICE.value
                    if "repair" in raw_type or "ремонт" in raw_type:
                        rec_type = RecordType.REPAIR.value
                    elif "upgrade" in raw_type or "тюнинг" in raw_type or "дооснащение" in raw_type:
                        rec_type = RecordType.UPGRADE.value

                    rec = ServiceRecord(
                        vehicle_id=vehicle.id,
                        record_type=rec_type,
                        to_tag=s.get("to_tag"),
                        date=r_date,
                        odometer=odo,
                        engine_hours=eng_hrs if eng_hrs > 0 else None,
                        title=str(s.get("title") or s.get("name") or "Обслуживание"),
                        description=str(s.get("description") or s.get("note") or ""),
                        cost_labor=cost_labor,
                        cost_parts=cost_parts,
                        total_cost=total_c,
                        store=str(s.get("store") or ""),
                        url=str(s.get("url") or ""),
                        notes=str(s.get("notes") or ""),
                    )
                    db.add(rec)
                    await db.flush()
                    total_services_count += 1

                    raw_items = s.get("items") or []
                    if raw_items:
                        for it in raw_items:
                            if not isinstance(it, dict):
                                continue
                            q = safe_float(it.get("quantity"), 1.0)
                            up = safe_float(it.get("unit_price") or it.get("price_per_unit"))
                            tp = safe_float(it.get("total_price"), q * up)
                            item_entity = ServiceItem(
                                service_record_id=rec.id,
                                name=str(it.get("name") or it.get("item_name") or "Деталь"),
                                brand=str(it.get("brand") or ""),
                                part_number=str(it.get("part_number") or it.get("article") or ""),
                                category=str(it.get("category") or "part"),
                                unit=str(it.get("unit") or "шт"),
                                quantity=q,
                                unit_price=up,
                                total_price=tp,
                                store=str(it.get("store") or s.get("store") or ""),
                                url=str(it.get("url") or s.get("url") or ""),
                            )
                            db.add(item_entity)
                    elif cost_parts > 0 or total_c > 0:
                        item_entity = ServiceItem(
                            service_record_id=rec.id,
                            name=str(s.get("title") or "Расходники / Детали"),
                            brand="",
                            part_number="",
                            category="part",
                            unit="комплект",
                            quantity=1.0,
                            unit_price=cost_parts or total_c,
                            total_price=cost_parts or total_c,
                            store=str(s.get("store") or ""),
                            url=str(s.get("url") or ""),
                        )
                        db.add(item_entity)
            elif pkg.get("maintenance_records"):
                m_records = pkg.get("maintenance_records") or []
                groups = {}
                for r in m_records:
                    if not isinstance(r, dict):
                        continue
                    tag = str(r.get("to_tag") or "Обслуживание")
                    r_date_str = str(r.get("date") or "2026-01-01")
                    mileage = safe_float(r.get("mileage") or r.get("odometer"))
                    if tag.startswith("ТО"):
                        key = f"{tag}_{r_date_str}_{mileage}"
                    else:
                        key = f"item_{r.get('id')}_{r_date_str}"
                    if key not in groups:
                        groups[key] = []
                    groups[key].append(r)

                for key, items_list in groups.items():
                    first = items_list[0]
                    tag = str(first.get("to_tag") or "Обслуживание")
                    is_service = tag.startswith("ТО")
                    r_type = RecordType.SERVICE.value if is_service else RecordType.UPGRADE.value
                    r_date = safe_parse_datetime(first.get("date")) or datetime.datetime.utcnow()
                    mileage = safe_float(first.get("mileage") or first.get("odometer"))
                    hours = safe_float(first.get("engine_hours"))
                    title = tag if is_service else str(first.get("item_name") or tag)
                    total_parts = sum(safe_float(it.get("total_price") or (safe_float(it.get("quantity"), 1.0) * safe_float(it.get("price_per_unit")))) for it in items_list)

                    rec = ServiceRecord(
                        vehicle_id=vehicle.id,
                        record_type=r_type,
                        to_tag=tag,
                        date=r_date,
                        odometer=mileage,
                        engine_hours=hours if hours > 0 else None,
                        title=title,
                        description=str(first.get("note") or ""),
                        cost_parts=total_parts,
                        cost_labor=0.0,
                        total_cost=total_parts,
                        store=str(first.get("store") or ""),
                        url=str(first.get("url") or ""),
                    )
                    db.add(rec)
                    await db.flush()
                    total_services_count += 1

                    for it in items_list:
                        q = safe_float(it.get("quantity"), 1.0)
                        up = safe_float(it.get("price_per_unit") or it.get("unit_price"))
                        tp = safe_float(it.get("total_price"), q * up)
                        item_entity = ServiceItem(
                            service_record_id=rec.id,
                            name=str(it.get("item_name") or it.get("name") or "Деталь"),
                            brand=str(it.get("brand") or ""),
                            part_number=str(it.get("article") or it.get("part_number") or ""),
                            category=str(it.get("category") or "part"),
                            unit=str(it.get("unit") or "шт"),
                            quantity=q,
                            unit_price=up,
                            total_price=tp,
                            store=str(it.get("store") or ""),
                            url=str(it.get("url") or ""),
                        )
                        db.add(item_entity)

            # 3. Fuel Logs
            fuel_logs = pkg.get("fuel_logs") or pkg.get("fuel") or []
            for f in fuel_logs:
                if not isinstance(f, dict):
                    continue
                f_date = safe_parse_datetime(f.get("date")) or datetime.datetime.utcnow()
                fuel_amount = safe_float(f.get("fuel_amount") or f.get("liters") or f.get("amount"))
                unit_price = safe_float(f.get("unit_price") or f.get("price_per_unit") or f.get("price"))
                total_cost = safe_float(f.get("total_cost") or f.get("cost"), fuel_amount * unit_price)

                fuel_log = FuelLog(
                    vehicle_id=vehicle.id,
                    date=f_date,
                    odometer=safe_float(f.get("odometer") or f.get("mileage")),
                    fuel_amount=fuel_amount,
                    total_cost=total_cost,
                    unit_price=unit_price,
                    is_full_tank=bool(f.get("is_full_tank", f.get("full_tank", True))),
                    is_missed=bool(f.get("is_missed", False)),
                    fuel_grade=str(f.get("fuel_grade") or f.get("fuel_type") or ""),
                    gas_station=str(f.get("gas_station") or f.get("station") or ""),
                    notes=str(f.get("notes") or f.get("note") or ""),
                )
                db.add(fuel_log)
                total_fuel_count += 1

            # 4. Tyre Sets
            tyres = pkg.get("tyre_sets") or pkg.get("tyres") or []
            for t in tyres:
                if not isinstance(t, dict):
                    continue
                ins_date = safe_parse_datetime(t.get("install_date"))
                ins_odo = safe_float(t.get("install_mileage") or t.get("install_odometer"))
                q = safe_float(t.get("quantity"), 4.0)
                up = safe_float(t.get("price_per_unit"))
                tp = safe_float(t.get("total_price"), q * up)

                tyre = TyreSet(
                    vehicle_id=vehicle.id,
                    name=str(t.get("name") or "Комплект шин"),
                    season=str(t.get("season") or "summer"),
                    size=str(t.get("size") or ""),
                    brand_model=str(t.get("brand_model") or ""),
                    current_km=safe_float(t.get("current_km") or t.get("mileage")),
                    tread_depth_mm=safe_float(t.get("tread_depth_mm"), 8.0),
                    storage_location=str(t.get("storage_location") or ""),
                    is_active=bool(t.get("is_active", False)),
                    install_date=ins_date,
                    install_mileage=ins_odo if ins_odo > 0 else None,
                    quantity=q,
                    price_per_unit=up,
                    total_price=tp,
                )
                db.add(tyre)
                total_tyres_count += 1

            # 5. Documents / Insurances
            documents = pkg.get("documents") or pkg.get("insurances") or []
            for doc_item in documents:
                if not isinstance(doc_item, dict):
                    continue
                start_d = safe_parse_datetime(doc_item.get("issue_date") or doc_item.get("start_date"))
                end_d = safe_parse_datetime(doc_item.get("expiration_date") or doc_item.get("end_date"))
                doc_odo = safe_float(doc_item.get("mileage") or doc_item.get("odometer"))
                doc_hrs = safe_float(doc_item.get("engine_hours"))

                doc = DocumentNote(
                    vehicle_id=vehicle.id,
                    title=str(doc_item.get("title") or doc_item.get("name") or "Документ"),
                    doc_type=str(doc_item.get("doc_type") or doc_item.get("type") or "insurance"),
                    company=str(doc_item.get("company") or ""),
                    document_number=str(doc_item.get("document_number") or doc_item.get("policy_number") or ""),
                    issue_date=start_d,
                    expiration_date=end_d,
                    price=safe_float(doc_item.get("price") or doc_item.get("cost")),
                    mileage=doc_odo if doc_odo > 0 else None,
                    engine_hours=doc_hrs if doc_hrs > 0 else None,
                    is_active=bool(doc_item.get("is_active", True)),
                    notes=str(doc_item.get("notes") or doc_item.get("note") or ""),
                )
                db.add(doc)
                total_docs_count += 1

        await db.commit()

        if restored_vehicles_count == 1:
            msg = f"Автомобиль успешно восстановлен: {total_services_count} ТО/ремонтов, {total_fuel_count} заправок, {total_trackers_count} регламентов, {total_tyres_count} шин, {total_docs_count} документов!"
        else:
            msg = f"Успешно восстановлено автомобилей: {restored_vehicles_count} ({total_services_count} ТО/ремонтов, {total_fuel_count} заправок)!"

        return {
            "status": "success",
            "vehicle_id": first_vehicle_id or 1,
            "message": msg,
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления бэкапа: {str(e)}")
