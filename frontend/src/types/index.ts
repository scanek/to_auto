export interface Vehicle {
  id: number;
  name?: string;
  make: string;
  model: string;
  year?: number;
  engine?: string;
  license_plate?: string;
  vin?: string;
  starting_odometer: number;
  current_odometer: number;
  current_engine_hours: number;
  track_engine_hours?: boolean;
  purchase_date?: string;
  oil_spec?: string;
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
  is_public?: boolean;
  is_owner?: boolean;
  owner_name?: string;
  // Telematics (StarLine S96 / CAN OBD / Webhooks)
  telematics_provider?: 'none' | 'starline' | 'webhook';
  starline_device_alias?: string;
  starline_last_sync?: string;
  starline_battery?: number;
  starline_fuel_percent?: number;
  starline_engine_temp?: number;
  telematics_auto_sync?: boolean;
  telematics_webhook_key?: string;

}

export interface User {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser extends User {
  vehicles_count: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  message: string;
}

export interface SetupStatus {
  has_users: boolean;
  allow_registration: boolean;
}

export interface ServiceItem {
  id?: number;
  name: string;
  brand?: string;
  part_number?: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  store?: string;
  url?: string;
}

export interface ServiceRecord {
  id: number;
  vehicle_id: number;
  record_type: 'service' | 'repair' | 'upgrade';
  to_tag?: string;
  date: string;
  odometer: number;
  engine_hours?: number | null;
  title: string;
  description?: string;
  cost_labor: number;
  cost_parts: number;
  total_cost: number;
  store?: string;
  url?: string;
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
  tracker_id?: string;
  title: string;
  category?: string;
  description?: string;
  brand?: string;
  spec?: string;
  article?: string;
  icon?: string;
  
  interval_distance?: number | null;
  interval_months?: number | null;
  interval_hours?: number | null;
  
  last_service_odometer: number;
  last_service_hours: number;
  last_service_date: string;
  
  is_active: boolean;
  notify_before_distance: number;
  notify_before_days: number;
  notify_before_hours: number;
  notes?: string;
  created_at: string;
  
  due_odometer?: number | null;
  due_hours?: number | null;
  due_date?: string | null;
  remaining_distance?: number | null;
  remaining_hours?: number | null;
  remaining_days?: number | null;
  status: 'ok' | 'due_soon' | 'overdue';
  progress_percentage: number;
}

export interface TyreSet {
  id: number;
  vehicle_id: number;
  name: string;
  season: 'summer' | 'winter';
  size?: string;
  brand_model?: string;
  current_km: number;
  tread_depth_mm: number;
  storage_location?: string;
  is_active: boolean;
  install_date?: string;
  install_mileage?: number | null;
  purchase_date?: string;
  dot_code?: string;
  has_separate_rims?: boolean;
  rims_brand_model?: string;
  rims_size?: string;
  rims_purchase_date?: string;
  rims_price?: number;
  tpms_sensors?: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  created_at: string;
}

export interface DocumentNote {
  id: number;
  vehicle_id: number;
  title: string;
  doc_type: string;
  company?: string;
  document_number?: string;
  issue_date?: string;
  expiration_date?: string;
  price: number;
  mileage?: number | null;
  engine_hours?: number | null;
  is_active: boolean;
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
  tyre_cost: number;
  document_cost: number;
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
  total_tyre_spend: number;
  total_document_spend: number;
  cost_per_distance_unit: number;
  fuel_cost_per_distance?: number;
  service_cost_per_distance?: number;
  avg_fuel_consumption?: number | null;
  avg_fuel_price?: number | null;
  total_fuel_liters: number;
  categories: CategoryCost[];
  monthly_costs: MonthlyCost[];
  fuel_trend: FuelEconomyPoint[];
}
