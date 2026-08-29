export interface Vehicle {
  id: number;
  name?: string;
  make: string;
  model: string;
  year?: number;
  license_plate?: string;
  vin?: string;
  starting_odometer: number;
  current_odometer: number;
  distance_unit: string;
  fuel_unit: string;
  currency: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_service_cost?: number;
  total_fuel_cost?: number;
  total_cost?: number;
  active_reminders_count?: number;
  overdue_reminders_count?: number;
  avg_fuel_consumption?: number | null;
}

export interface ServiceItem {
  id?: number;
  name: string;
  part_number?: string;
  category: string; // 'part' | 'labor'
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ServiceRecord {
  id: number;
  vehicle_id: number;
  record_type: 'service' | 'repair' | 'upgrade';
  date: string;
  odometer: number;
  title: string;
  description?: string;
  cost_labor: number;
  cost_parts: number;
  total_cost: number;
  notes?: string;
  created_at: string;
  items: ServiceItem[];
  attachments_count: number;
}

export interface FuelLog {
  id: number;
  vehicle_id: number;
  date: string;
  odometer: number;
  fuel_amount: number;
  total_cost: number;
  unit_price: number;
  is_full_tank: boolean;
  is_missed: boolean;
  consumption?: number | null;
  distance_traveled?: number | null;
  fuel_grade?: string;
  gas_station?: string;
  notes?: string;
  created_at: string;
}

export interface MaintenancePlan {
  id: number;
  vehicle_id: number;
  title: string;
  description?: string;
  interval_distance?: number | null;
  interval_months?: number | null;
  last_service_odometer: number;
  last_service_date: string;
  is_active: boolean;
  notify_before_distance: number;
  notify_before_days: number;
  notes?: string;
  created_at: string;
  
  // Computed
  due_odometer?: number | null;
  due_date?: string | null;
  remaining_distance?: number | null;
  remaining_days?: number | null;
  status: 'ok' | 'due_soon' | 'overdue';
  progress_percentage: number;
}

export interface DocumentNote {
  id: number;
  vehicle_id: number;
  title: string;
  doc_type: string; // 'insurance' | 'inspection' | 'registration' | 'warranty' | 'note'
  document_number?: string;
  issue_date?: string;
  expiration_date?: string;
  file_url?: string;
  notes?: string;
  created_at: string;
  is_expired?: boolean;
  days_until_expiration?: number | null;
}

export interface CategoryCost {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyCost {
  month: string;
  service_cost: number;
  repair_cost: number;
  upgrade_cost: number;
  fuel_cost: number;
  total_cost: number;
}

export interface FuelEconomyPoint {
  date: string;
  odometer: number;
  consumption: number;
  unit_price: number;
  distance: number;
}

export interface VehicleAnalytics {
  vehicle_id: number;
  total_distance_tracked: number;
  total_spend: number;
  total_service_spend: number;
  total_repair_spend: number;
  total_upgrade_spend: number;
  total_fuel_spend: number;
  cost_per_distance_unit: number;
  avg_fuel_consumption?: number | null;
  avg_fuel_price?: number | null;
  total_fuel_liters: number;
  categories: CategoryCost[];
  monthly_costs: MonthlyCost[];
  fuel_trend: FuelEconomyPoint[];
}
