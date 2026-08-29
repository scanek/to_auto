from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord, RecordType
from app.models.fuel import FuelLog
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

    # Aggregations
    service_spend = 0.0
    repair_spend = 0.0
    upgrade_spend = 0.0
    fuel_spend = 0.0
    total_fuel_liters = 0.0

    monthly_map = defaultdict(lambda: {"service": 0.0, "repair": 0.0, "upgrade": 0.0, "fuel": 0.0})

    for s in service_records:
        cost = s.total_cost or 0.0
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

    total_spend = service_spend + repair_spend + upgrade_spend + fuel_spend
    
    # Distance tracked
    total_dist = max(0.0, (vehicle.current_odometer or 0.0) - (vehicle.starting_odometer or 0.0))
    cost_per_distance = round(total_spend / total_dist, 2) if total_dist > 0 else 0.0

    avg_consumption = round(total_consumption_sum / consumption_count, 2) if consumption_count > 0 else None
    avg_fuel_price = round(fuel_spend / total_fuel_liters, 2) if total_fuel_liters > 0 else None

    # Categories breakdown
    categories = []
    if total_spend > 0:
        if service_spend > 0:
            categories.append(CategoryCost(category="Плановое ТО", amount=service_spend, percentage=round(service_spend/total_spend*100, 1)))
        if repair_spend > 0:
            categories.append(CategoryCost(category="Ремонт", amount=repair_spend, percentage=round(repair_spend/total_spend*100, 1)))
        if upgrade_spend > 0:
            categories.append(CategoryCost(category="Тюнинг / Дооснащение", amount=upgrade_spend, percentage=round(upgrade_spend/total_spend*100, 1)))
        if fuel_spend > 0:
            categories.append(CategoryCost(category="Топливо", amount=fuel_spend, percentage=round(fuel_spend/total_spend*100, 1)))
    
    # Monthly costs sorted by month
    monthly_costs = []
    for month in sorted(monthly_map.keys()):
        data = monthly_map[month]
        total_m = data["service"] + data["repair"] + data["upgrade"] + data["fuel"]
        monthly_costs.append(MonthlyCost(
            month=month,
            service_cost=round(data["service"], 2),
            repair_cost=round(data["repair"], 2),
            upgrade_cost=round(data["upgrade"], 2),
            fuel_cost=round(data["fuel"], 2),
            total_cost=round(total_m, 2),
        ))

    return VehicleAnalytics(
        vehicle_id=vehicle.id,
        total_distance_tracked=round(total_dist, 1),
        total_spend=round(total_spend, 2),
        total_service_spend=round(service_spend, 2),
        total_repair_spend=round(repair_spend, 2),
        total_upgrade_spend=round(upgrade_spend, 2),
        total_fuel_spend=round(fuel_spend, 2),
        cost_per_distance_unit=cost_per_distance,
        avg_fuel_consumption=avg_consumption,
        avg_fuel_price=avg_fuel_price,
        total_fuel_liters=round(total_fuel_liters, 1),
        categories=categories,
        monthly_costs=monthly_costs,
        fuel_trend=fuel_trend,
    )
