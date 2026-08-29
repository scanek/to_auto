from typing import List, Optional, Dict
from pydantic import BaseModel

class CategoryCost(BaseModel):
    category: str # "ТО (Service)", "Ремонт (Repairs)", "Тюнинг (Upgrades)", "Топливо (Fuel)", "Документы/Прочее"
    amount: float
    percentage: float

class MonthlyCost(BaseModel):
    month: str # "2024-01"
    service_cost: float
    repair_cost: float
    upgrade_cost: float
    fuel_cost: float
    total_cost: float

class FuelEconomyPoint(BaseModel):
    date: str
    odometer: float
    consumption: float # L/100km or MPG
    unit_price: float
    distance: float

class VehicleAnalytics(BaseModel):
    vehicle_id: int
    total_distance_tracked: float
    total_spend: float
    total_service_spend: float
    total_repair_spend: float
    total_upgrade_spend: float
    total_fuel_spend: float
    cost_per_distance_unit: float # Cost per km
    avg_fuel_consumption: Optional[float] = None # L/100km
    avg_fuel_price: Optional[float] = None # per Liter
    total_fuel_liters: float = 0.0
    
    categories: List[CategoryCost]
    monthly_costs: List[MonthlyCost]
    fuel_trend: List[FuelEconomyPoint]
