import datetime
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import (
    Vehicle,
    ServiceRecord,
    ServiceItem,
    RecordType,
    MaintenancePlan,
    DocumentNote,
    TyreSet,
)

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])

@router.post("/import")
async def import_backup(data: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_db)):
    """
    Imports a complete backup from either AutoTracker or car-maintenance-app v2.5.
    """
    # 1. Extract Vehicle data
    veh_data = data.get("vehicle") or (data.get("vehicles", [{}])[0] if data.get("vehicles") else {})
    if not veh_data:
        raise HTTPException(status_code=400, detail="В файле бэкапа не найдены данные автомобиля")

    make = veh_data.get("brand") or veh_data.get("make") or "Автомобиль"
    model = veh_data.get("model") or "Модель"
    name = veh_data.get("name") or f"{make} {model}"
    plate = veh_data.get("plate") or veh_data.get("license_plate") or ""
    engine = veh_data.get("engine") or ""
    year = veh_data.get("year") or datetime.datetime.utcnow().year
    vin = veh_data.get("vin") or ""
    current_km = float(veh_data.get("current_km") or veh_data.get("current_odometer") or 0.0)
    engine_hours = float(veh_data.get("current_engine_hours") or 0.0)
    oil_spec = veh_data.get("oil_spec") or ""

    vehicle = Vehicle(
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

    # 2. Extract Trackers / Maintenance Plans
    trackers = data.get("trackers") or veh_data.get("trackers") or []
    plan_map = {}
    for t in trackers:
        plan = MaintenancePlan(
            vehicle_id=vehicle.id,
            tracker_id=t.get("id"),
            title=t.get("name") or "Регламент",
            category=t.get("category") or "Обслуживание",
            brand=t.get("brand") or "",
            spec=t.get("spec") or "",
            article=t.get("article") or "",
            icon=t.get("icon") or "wrench",
            interval_distance=float(t.get("interval_km") or 0) if t.get("interval_km") else None,
            interval_hours=float(t.get("interval_hours") or 0) if t.get("interval_hours") else None,
            interval_months=12 if not t.get("interval_months") else t.get("interval_months"),
            last_service_odometer=0.0,
            last_service_hours=0.0,
            last_service_date=datetime.datetime.utcnow(),
            is_active=t.get("enabled", True),
            notify_before_distance=float(t.get("warn_km") or 500),
            notify_before_hours=float(t.get("warn_hours") or 30),
        )
        db.add(plan)
        await db.flush()
        if t.get("id"):
            plan_map[t.get("id")] = plan

    # 3. Extract Maintenance Records (ТО, Ремонты, Доработки)
    m_records = data.get("maintenance_records") or []
    
    # Group by (to_tag, date, mileage, engine_hours) for combined ТО
    groups = {}
    for r in m_records:
        tag = r.get("to_tag") or "Обслуживание"
        r_date = r.get("date") or "2026-01-01"
        mileage = float(r.get("mileage") or 0.0)
        hours = float(r.get("engine_hours") or 0.0)
        
        # If it's a specific ТО (like ТО-2, ТО-3), group them together
        if tag.startswith("ТО"):
            key = f"{tag}_{r_date}_{mileage}"
        else:
            # Individual items for тюнинг / покупки
            key = f"item_{r.get('id')}_{r_date}"

        if key not in groups:
            groups[key] = []
        groups[key].append(r)

    for key, items_list in groups.items():
        first = items_list[0]
        tag = first.get("to_tag") or "Обслуживание"
        is_service = tag.startswith("ТО")
        r_type = RecordType.SERVICE.value if is_service else RecordType.UPGRADE.value
        
        r_date = datetime.datetime.fromisoformat(first.get("date")) if first.get("date") else datetime.datetime.utcnow()
        mileage = float(first.get("mileage") or 0.0)
        hours = float(first.get("engine_hours") or 0.0)
        
        title = tag if is_service else (first.get("item_name") or tag)
        total_parts = sum(float(it.get("total_price") or 0.0) for it in items_list)
        
        rec = ServiceRecord(
            vehicle_id=vehicle.id,
            record_type=r_type,
            to_tag=tag,
            date=r_date,
            odometer=mileage,
            engine_hours=hours if hours > 0 else None,
            title=title,
            description=first.get("note") or "",
            cost_parts=total_parts,
            cost_labor=0.0,
            total_cost=total_parts,
            store=first.get("store") or "",
            url=first.get("url") or "",
        )
        db.add(rec)
        await db.flush()

        for it in items_list:
            item_entity = ServiceItem(
                service_record_id=rec.id,
                name=it.get("item_name") or "Деталь",
                brand=it.get("brand") or "",
                part_number=it.get("article") or "",
                category=it.get("category") or "part",
                unit=it.get("unit") or "шт",
                quantity=float(it.get("quantity") or 1.0),
                unit_price=float(it.get("price_per_unit") or 0.0),
                total_price=float(it.get("total_price") or 0.0),
                store=it.get("store") or "",
                url=it.get("url") or "",
            )
            db.add(item_entity)

            # Update last baseline for reminders
            it_name_lower = (it.get("item_name") or "").lower()
            for p_id, plan in plan_map.items():
                match_val = (p_id.replace("_", " ")).lower()
                if match_val in it_name_lower or plan.title.lower() in it_name_lower:
                    if mileage >= plan.last_service_odometer:
                        plan.last_service_odometer = mileage
                        plan.last_service_hours = hours
                        plan.last_service_date = r_date

    # 4. Extract Tyre Sets
    tyres = data.get("tyre_sets") or []
    for t in tyres:
        ins_date = datetime.datetime.fromisoformat(t.get("install_date")) if t.get("install_date") else None
        tyre = TyreSet(
            vehicle_id=vehicle.id,
            name=t.get("name") or "Комплект шин",
            season=t.get("season") or "summer",
            size=t.get("size") or "",
            brand_model=t.get("brand_model") or "",
            current_km=float(t.get("current_km") or 0.0),
            tread_depth_mm=float(t.get("tread_depth_mm") or 8.0),
            storage_location=t.get("storage_location") or "",
            is_active=t.get("is_active", False),
            install_date=ins_date,
            install_mileage=float(t.get("install_mileage") or 0.0) if t.get("install_mileage") else None,
            quantity=float(t.get("quantity") or 4.0),
            price_per_unit=float(t.get("price_per_unit") or 0.0),
            total_price=float(t.get("total_price") or 0.0),
        )
        db.add(tyre)

    # 5. Extract Insurances
    insurances = data.get("insurances") or []
    for ins in insurances:
        start_d = datetime.datetime.fromisoformat(ins.get("start_date")) if ins.get("start_date") else None
        end_d = datetime.datetime.fromisoformat(ins.get("end_date")) if ins.get("end_date") else None
        doc = DocumentNote(
            vehicle_id=vehicle.id,
            title=ins.get("name") or "Страховка",
            doc_type=ins.get("type") or "insurance",
            company=ins.get("company") or "",
            document_number=ins.get("policy_number") or "",
            issue_date=start_d,
            expiration_date=end_d,
            price=float(ins.get("price") or 0.0),
            mileage=float(ins.get("mileage") or 0.0) if ins.get("mileage") else None,
            engine_hours=float(ins.get("engine_hours") or 0.0) if ins.get("engine_hours") else None,
            is_active=ins.get("is_active", True),
            notes=ins.get("note") or "",
        )
        db.add(doc)

    await db.commit()

    return {
        "status": "success",
        "vehicle_id": vehicle.id,
        "message": f"Автомобиль {vehicle.make} {vehicle.model} ({vehicle.license_plate}) успешно восстановлен!",
    }
