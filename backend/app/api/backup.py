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

@router.post("/import")
async def import_backup(
    data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Imports a complete backup from Бортовой Журнал and assigns it to current user.
    """
    try:
        if "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
            target_data = data["data"][0]
        else:
            target_data = data

        veh_data = target_data.get("vehicle") or (target_data.get("vehicles", [{}])[0] if target_data.get("vehicles") else {})
        if not veh_data:
            raise HTTPException(status_code=400, detail="В файле бэкапа не найдены данные автомобиля")

        make = str(veh_data.get("brand") or veh_data.get("make") or "Автомобиль")
        model = str(veh_data.get("model") or "Модель")
        name = str(veh_data.get("name") or f"{make} {model}")
        plate = str(veh_data.get("plate") or veh_data.get("license_plate") or "")
        engine = str(veh_data.get("engine") or "")
        year = int(veh_data.get("year") or datetime.datetime.utcnow().year)
        vin = str(veh_data.get("vin") or "")
        current_km = float(veh_data.get("current_km") or veh_data.get("current_odometer") or 0.0)
        engine_hours = float(veh_data.get("current_engine_hours") or 0.0)
        oil_spec = str(veh_data.get("oil_spec") or "")

        vehicle = Vehicle(
            user_id=current_user.id,
            name=name,
            make=make,
            model=model,
            year=year,
            engine=engine,
            license_plate=plate,
            vin=vin,
            starting_odometer=current_km,
            current_odometer=current_km,
            current_engine_hours=engine_hours,
            oil_spec=oil_spec,
            distance_unit="km",
            fuel_unit="L",
            currency="RUB",
        )
        db.add(vehicle)
        await db.flush()

        # Extract Trackers
        trackers = target_data.get("trackers") or veh_data.get("trackers") or []
        for t in trackers:
            plan = MaintenancePlan(
                vehicle_id=vehicle.id,
                tracker_id=str(t.get("id") or ""),
                title=str(t.get("name") or t.get("title") or "Регламент"),
                category=str(t.get("category") or "Обслуживание"),
                brand=str(t.get("brand") or ""),
                spec=str(t.get("spec") or ""),
                article=str(t.get("article") or ""),
                icon=str(t.get("icon") or "wrench"),
                interval_distance=float(t.get("interval_km") or t.get("interval_distance") or 0) if (t.get("interval_km") or t.get("interval_distance")) else None,
                interval_hours=float(t.get("interval_hours") or 0) if t.get("interval_hours") else None,
                interval_months=12 if not t.get("interval_months") else int(t.get("interval_months")),
                last_service_odometer=float(t.get("last_service_odometer") or 0.0),
                last_service_hours=float(t.get("last_service_hours") or 0.0),
                last_service_date=datetime.datetime.utcnow(),
                is_active=bool(t.get("enabled", t.get("is_active", True))),
                notify_before_distance=float(t.get("warn_km") or t.get("notify_before_distance") or 500),
                notify_before_hours=float(t.get("warn_hours") or t.get("notify_before_hours") or 30),
                notify_before_days=int(t.get("warn_days") or t.get("notify_before_days") or 14),
                notes=str(t.get("notes") or ""),
            )
            db.add(plan)
        await db.flush()

        # Extract Service Records
        native_records = target_data.get("service_records") or []
        if native_records:
            for s in native_records:
                raw_date = s.get("date")
                try:
                    r_date = datetime.datetime.fromisoformat(raw_date) if raw_date else datetime.datetime.utcnow()
                except Exception:
                    r_date = datetime.datetime.utcnow()

                rec = ServiceRecord(
                    vehicle_id=vehicle.id,
                    record_type=str(s.get("record_type") or "service"),
                    to_tag=s.get("to_tag"),
                    date=r_date,
                    odometer=float(s.get("odometer") or 0.0),
                    engine_hours=float(s.get("engine_hours")) if s.get("engine_hours") else None,
                    title=str(s.get("title") or "Обслуживание"),
                    description=str(s.get("description") or ""),
                    cost_labor=float(s.get("cost_labor") or 0.0),
                    cost_parts=float(s.get("cost_parts") or 0.0),
                    total_cost=float(s.get("total_cost") or 0.0),
                    store=str(s.get("store") or ""),
                    url=str(s.get("url") or ""),
                    notes=str(s.get("notes") or ""),
                )
                db.add(rec)
                await db.flush()

                for it in (s.get("items") or []):
                    item_entity = ServiceItem(
                        service_record_id=rec.id,
                        name=str(it.get("name") or "Деталь"),
                        brand=str(it.get("brand") or ""),
                        part_number=str(it.get("part_number") or it.get("article") or ""),
                        category=str(it.get("category") or "part"),
                        unit=str(it.get("unit") or "шт"),
                        quantity=float(it.get("quantity") or 1.0),
                        unit_price=float(it.get("unit_price") or 0.0),
                        total_price=float(it.get("total_price") or 0.0),
                        store=str(it.get("store") or ""),
                        url=str(it.get("url") or ""),
                    )
                    db.add(item_entity)
        else:
            m_records = target_data.get("maintenance_records") or []
            groups = {}
            for r in m_records:
                tag = str(r.get("to_tag") or "Обслуживание")
                r_date = str(r.get("date") or "2026-01-01")
                mileage = float(r.get("mileage") or 0.0)

                if tag.startswith("ТО"):
                    key = f"{tag}_{r_date}_{mileage}"
                else:
                    key = f"item_{r.get('id')}_{r_date}"

                if key not in groups:
                    groups[key] = []
                groups[key].append(r)

            for key, items_list in groups.items():
                first = items_list[0]
                tag = str(first.get("to_tag") or "Обслуживание")
                is_service = tag.startswith("ТО")
                r_type = RecordType.SERVICE.value if is_service else RecordType.UPGRADE.value
                
                raw_date = first.get("date")
                try:
                    r_date = datetime.datetime.fromisoformat(raw_date) if raw_date else datetime.datetime.utcnow()
                except Exception:
                    r_date = datetime.datetime.utcnow()

                mileage = float(first.get("mileage") or 0.0)
                hours = float(first.get("engine_hours") or 0.0)
                title = tag if is_service else str(first.get("item_name") or tag)
                total_parts = sum(float(it.get("total_price") or 0.0) for it in items_list)
                
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

                for it in items_list:
                    item_entity = ServiceItem(
                        service_record_id=rec.id,
                        name=str(it.get("item_name") or "Деталь"),
                        brand=str(it.get("brand") or ""),
                        part_number=str(it.get("article") or ""),
                        category=str(it.get("category") or "part"),
                        unit=str(it.get("unit") or "шт"),
                        quantity=float(it.get("quantity") or 1.0),
                        unit_price=float(it.get("price_per_unit") or 0.0),
                        total_price=float(it.get("total_price") or 0.0),
                        store=str(it.get("store") or ""),
                        url=str(it.get("url") or ""),
                    )
                    db.add(item_entity)

        # Extract Fuel Logs
        fuel_logs = target_data.get("fuel_logs") or []
        for f in fuel_logs:
            raw_date = f.get("date")
            try:
                f_date = datetime.datetime.fromisoformat(raw_date) if raw_date else datetime.datetime.utcnow()
            except Exception:
                f_date = datetime.datetime.utcnow()

            fuel_log = FuelLog(
                vehicle_id=vehicle.id,
                date=f_date,
                odometer=float(f.get("odometer") or 0.0),
                fuel_amount=float(f.get("fuel_amount") or 0.0),
                total_cost=float(f.get("total_cost") or 0.0),
                unit_price=float(f.get("unit_price") or 0.0),
                is_full_tank=bool(f.get("is_full_tank", True)),
                is_missed=bool(f.get("is_missed", False)),
                fuel_grade=str(f.get("fuel_grade") or ""),
                gas_station=str(f.get("gas_station") or ""),
                notes=str(f.get("notes") or ""),
            )
            db.add(fuel_log)

        # Extract Tyre Sets
        tyres = target_data.get("tyre_sets") or []
        for t in tyres:
            ins_date = None
            if t.get("install_date"):
                try:
                    ins_date = datetime.datetime.fromisoformat(t.get("install_date"))
                except Exception:
                    ins_date = None

            tyre = TyreSet(
                vehicle_id=vehicle.id,
                name=str(t.get("name") or "Комплект шин"),
                season=str(t.get("season") or "summer"),
                size=str(t.get("size") or ""),
                brand_model=str(t.get("brand_model") or ""),
                current_km=float(t.get("current_km") or 0.0),
                tread_depth_mm=float(t.get("tread_depth_mm") or 8.0),
                storage_location=str(t.get("storage_location") or ""),
                is_active=bool(t.get("is_active", False)),
                install_date=ins_date,
                install_mileage=float(t.get("install_mileage") or 0.0) if t.get("install_mileage") else None,
                quantity=float(t.get("quantity") or 4.0),
                price_per_unit=float(t.get("price_per_unit") or 0.0),
                total_price=float(t.get("total_price") or 0.0),
            )
            db.add(tyre)

        # Extract Insurances / Documents
        documents = target_data.get("documents") or target_data.get("insurances") or []
        for doc_item in documents:
            start_d = None
            if doc_item.get("issue_date") or doc_item.get("start_date"):
                try:
                    start_d = datetime.datetime.fromisoformat(doc_item.get("issue_date") or doc_item.get("start_date"))
                except Exception:
                    start_d = None

            end_d = None
            if doc_item.get("expiration_date") or doc_item.get("end_date"):
                try:
                    end_d = datetime.datetime.fromisoformat(doc_item.get("expiration_date") or doc_item.get("end_date"))
                except Exception:
                    end_d = None

            doc = DocumentNote(
                vehicle_id=vehicle.id,
                title=str(doc_item.get("title") or doc_item.get("name") or "Страховка"),
                doc_type=str(doc_item.get("doc_type") or doc_item.get("type") or "insurance"),
                company=str(doc_item.get("company") or ""),
                document_number=str(doc_item.get("document_number") or doc_item.get("policy_number") or ""),
                issue_date=start_d,
                expiration_date=end_d,
                price=float(doc_item.get("price") or 0.0),
                mileage=float(doc_item.get("mileage") or 0.0) if doc_item.get("mileage") else None,
                engine_hours=float(doc_item.get("engine_hours") or 0.0) if doc_item.get("engine_hours") else None,
                is_active=bool(doc_item.get("is_active", True)),
                notes=str(doc_item.get("notes") or doc_item.get("note") or ""),
            )
            db.add(doc)

        await db.commit()

        return {
            "status": "success",
            "vehicle_id": vehicle.id,
            "message": f"Автомобиль {vehicle.make} {vehicle.model} ({vehicle.license_plate or 'без номера'}) успешно восстановлен в ваш гараж!",
        }
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления бэкапа: {str(e)}")
