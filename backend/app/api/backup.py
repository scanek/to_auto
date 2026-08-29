import datetime
import traceback
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
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
    try:
        # 1. Extract Vehicle data
        veh_data = data.get("vehicle") or (data.get("vehicles", [{}])[0] if data.get("vehicles") else {})
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
                tracker_id=str(t.get("id") or ""),
                title=str(t.get("name") or "Регламент"),
                category=str(t.get("category") or "Обслуживание"),
                brand=str(t.get("brand") or ""),
                spec=str(t.get("spec") or ""),
                article=str(t.get("article") or ""),
                icon=str(t.get("icon") or "wrench"),
                interval_distance=float(t.get("interval_km") or 0) if t.get("interval_km") else None,
                interval_hours=float(t.get("interval_hours") or 0) if t.get("interval_hours") else None,
                interval_months=12 if not t.get("interval_months") else int(t.get("interval_months")),
                last_service_odometer=0.0,
                last_service_hours=0.0,
                last_service_date=datetime.datetime.utcnow(),
                is_active=bool(t.get("enabled", True)),
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
            tag = str(r.get("to_tag") or "Обслуживание")
            r_date = str(r.get("date") or "2026-01-01")
            mileage = float(r.get("mileage") or 0.0)
            hours = float(r.get("engine_hours") or 0.0)
            
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

        # 5. Extract Insurances
        insurances = data.get("insurances") or []
        for ins in insurances:
            start_d = None
            if ins.get("start_date"):
                try:
                    start_d = datetime.datetime.fromisoformat(ins.get("start_date"))
                except Exception:
                    start_d = None

            end_d = None
            if ins.get("end_date"):
                try:
                    end_d = datetime.datetime.fromisoformat(ins.get("end_date"))
                except Exception:
                    end_d = None

            doc = DocumentNote(
                vehicle_id=vehicle.id,
                title=str(ins.get("name") or "Страховка"),
                doc_type=str(ins.get("type") or "insurance"),
                company=str(ins.get("company") or ""),
                document_number=str(ins.get("policy_number") or ""),
                issue_date=start_d,
                expiration_date=end_d,
                price=float(ins.get("price") or 0.0),
                mileage=float(ins.get("mileage") or 0.0) if ins.get("mileage") else None,
                engine_hours=float(ins.get("engine_hours") or 0.0) if ins.get("engine_hours") else None,
                is_active=bool(ins.get("is_active", True)),
                notes=str(ins.get("note") or ""),
            )
            db.add(doc)

        await db.commit()

        return {
            "status": "success",
            "vehicle_id": vehicle.id,
            "message": f"Автомобиль {vehicle.make} {vehicle.model} ({vehicle.license_plate}) успешно восстановлен!",
        }
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления бэкапа: {str(e)}")
