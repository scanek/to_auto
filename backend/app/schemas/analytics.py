from typing import List, Optional
from pydantic import BaseModel

class CategoryCost(BaseModel):
    category: str
    amount: float
    percentage: float

class MonthlyCost(BaseModel):
    month: str
    service_cost: float
    repair_cost: float
    upgrade_cost: float
    fuel_cost: float
    tyre_cost: float = 0.0
    document_cost: float = 0.0
    total_cost: float

class FuelEconomyPoint(BaseModel):
    date: str
    odometer: float
    consumption: float
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
    total_tyre_spend: float = 0.0
    total_document_spend: float = 0.0
    cost_per_distance_unit: float
    avg_fuel_consumption: Optional[float] = None
    avg_fuel_price: Optional[float] = None
    total_fuel_liters: float = 0.0
    
    categories: List[CategoryCost]
    monthly_costs: List[MonthlyCost]
    fuel_trend: List[FuelEconomyPoint]
