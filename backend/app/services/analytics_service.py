from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord, RecordType
from app.models.fuel import FuelLog
from app.models.tyre import TyreSet
from app.models.document import DocumentNote
from app.schemas.analytics import VehicleAnalytics, CategoryCost, MonthlyCost, FuelEconomyPoint

async def compute_vehicle_analytics(session: AsyncSession, vehicle: Vehicle) -> VehicleAnalytics:
    # 1. Fetch all service records
    srv_query = select(ServiceRecord).where(ServiceRecord.vehicle_id == vehicle.id).order_by(ServiceRecord.date.asc())
    srv_result = await session.execute(srv_query)
    service_records = srv_result.scalars().all()

    # 2. Fetch all fuel logs
    fuel_query = select(FuelLog).where(FuelLog.vehicle_id == vehicle.id).order_by(FuelLog.date.asc())
    fuel_result = await session.execute(fuel_query)
    fuel_logs = fuel_result.scalars().all()

    # 3. Fetch all tyre sets
    tyre_query = select(TyreSet).where(TyreSet.vehicle_id == vehicle.id)
    tyre_result = await session.execute(tyre_query)
    tyres = tyre_result.scalars().all()

    # 4. Fetch all documents / insurances
    doc_query = select(DocumentNote).where(DocumentNote.vehicle_id == vehicle.id)
    doc_result = await session.execute(doc_query)
    documents = doc_result.scalars().all()

    # Aggregations
    service_spend = 0.0
    repair_spend = 0.0
    upgrade_spend = 0.0
    fuel_spend = 0.0
    tyre_spend = 0.0
    document_spend = 0.0
    total_fuel_liters = 0.0

    monthly_map = defaultdict(lambda: {"service": 0.0, "repair": 0.0, "upgrade": 0.0, "fuel": 0.0, "tyre": 0.0, "doc": 0.0})

    for s in service_records:
        cost = s.total_cost or 0.0
        calc_min = (s.cost_parts or 0.0) + (s.cost_labor or 0.0)
        if calc_min > cost:
            cost = calc_min
        month_key = s.date.strftime("%Y-%m") if s.date else "Неизвестно"
        
        if s.record_type == RecordType.SERVICE.value:
            service_spend += cost
            monthly_map[month_key]["service"] += cost
        elif s.record_type == RecordType.REPAIR.value:
            repair_spend += cost
            monthly_map[month_key]["repair"] += cost
        elif s.record_type == RecordType.UPGRADE.value:
            upgrade_spend += cost
            monthly_map[month_key]["upgrade"] += cost
        else:
            service_spend += cost
            monthly_map[month_key]["service"] += cost

    fuel_trend = []
    total_consumption_sum = 0.0
    consumption_count = 0

    for f in fuel_logs:
        cost = f.total_cost or 0.0
        fuel_spend += cost
        total_fuel_liters += f.fuel_amount or 0.0
        month_key = f.date.strftime("%Y-%m") if f.date else "Неизвестно"
        monthly_map[month_key]["fuel"] += cost

        if f.consumption and f.consumption > 0:
            total_consumption_sum += f.consumption
            consumption_count += 1
            fuel_trend.append(FuelEconomyPoint(
                date=f.date.strftime("%d.%m.%Y") if f.date else "",
                odometer=f.odometer,
                consumption=f.consumption,
                unit_price=f.unit_price,
                distance=f.distance_traveled or 0.0,
            ))

    for t in tyres:
        cost = t.total_price or 0.0
        if cost > 0:
            tyre_spend += cost
            t_date = t.install_date or t.created_at
            month_key = t_date.strftime("%Y-%m") if t_date else "Неизвестно"
            monthly_map[month_key]["tyre"] += cost

    for d in documents:
        cost = d.price or 0.0
        if cost > 0:
            document_spend += cost
            d_date = d.issue_date or d.created_at
            month_key = d_date.strftime("%Y-%m") if d_date else "Неизвестно"
            monthly_map[month_key]["doc"] += cost

    total_spend = service_spend + repair_spend + upgrade_spend + fuel_spend + tyre_spend + document_spend
    
    # Distance tracked (if vehicle was added at 26636 km and tracked since 0 or same, use effective mileage)
    tracked_dist = max(0.0, (vehicle.current_odometer or 0.0) - (vehicle.starting_odometer or 0.0))
    effective_dist = tracked_dist if tracked_dist > 0 else (vehicle.current_odometer or 0.0)
    cost_per_distance = round(total_spend / effective_dist, 2) if effective_dist > 0 else 0.0

    if consumption_count > 0:
        avg_consumption = round(total_consumption_sum / consumption_count, 2)
    elif total_fuel_liters > 0 and effective_dist > 0:
        candidate = round((total_fuel_liters / effective_dist) * 100.0, 2)
        avg_consumption = candidate if 2.0 <= candidate <= 40.0 else None
    else:
        avg_consumption = None

    avg_fuel_price = round(fuel_spend / total_fuel_liters, 2) if total_fuel_liters > 0 else None

    # Categories breakdown
    categories = []
    if total_spend > 0:
        if service_spend > 0:
            categories.append(CategoryCost(category="Плановое ТО", amount=round(service_spend, 2), percentage=round(service_spend/total_spend*100, 1)))
        if repair_spend > 0:
            categories.append(CategoryCost(category="Ремонт", amount=round(repair_spend, 2), percentage=round(repair_spend/total_spend*100, 1)))
        if upgrade_spend > 0:
            categories.append(CategoryCost(category="Тюнинг & Допы", amount=round(upgrade_spend, 2), percentage=round(upgrade_spend/total_spend*100, 1)))
        if fuel_spend > 0:
            categories.append(CategoryCost(category="Топливо", amount=round(fuel_spend, 2), percentage=round(fuel_spend/total_spend*100, 1)))
        if tyre_spend > 0:
            categories.append(CategoryCost(category="Шины и Колеса", amount=round(tyre_spend, 2), percentage=round(tyre_spend/total_spend*100, 1)))
        if document_spend > 0:
            categories.append(CategoryCost(category="Страхование & Документы", amount=round(document_spend, 2), percentage=round(document_spend/total_spend*100, 1)))
    
    # Monthly costs sorted by month
    monthly_costs = []
    for month in sorted(monthly_map.keys()):
        data = monthly_map[month]
        total_m = data["service"] + data["repair"] + data["upgrade"] + data["fuel"] + data["tyre"] + data["doc"]
        monthly_costs.append(MonthlyCost(
            month=month,
            service_cost=round(data["service"], 2),
            repair_cost=round(data["repair"], 2),
            upgrade_cost=round(data["upgrade"], 2),
            fuel_cost=round(data["fuel"], 2),
            tyre_cost=round(data["tyre"], 2),
            document_cost=round(data["doc"], 2),
            total_cost=round(total_m, 2),
        ))

    return VehicleAnalytics(
        vehicle_id=vehicle.id,
        total_distance_tracked=round(effective_dist, 1),
        total_spend=round(total_spend, 2),
        total_service_spend=round(service_spend, 2),
        total_repair_spend=round(repair_spend, 2),
        total_upgrade_spend=round(upgrade_spend, 2),
        total_fuel_spend=round(fuel_spend, 2),
        total_tyre_spend=round(tyre_spend, 2),
        total_document_spend=round(document_spend, 2),
        cost_per_distance_unit=cost_per_distance,
        avg_fuel_consumption=avg_consumption,
        avg_fuel_price=avg_fuel_price,
        total_fuel_liters=round(total_fuel_liters, 1),
        categories=categories,
        monthly_costs=monthly_costs,
        fuel_trend=fuel_trend,
    )
