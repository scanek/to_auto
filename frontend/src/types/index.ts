export interface VinDecodeResult {
  vin: string;
  make: string;
  model: string;
  year?: number | null;
  engine?: string | null;
  displacement?: string | null;
  horsepower?: number | null;
  transmission?: string | null;
  fuel_tank_capacity?: number | null;
  drive_type?: 'fwd' | 'awd' | 'rwd' | string | null;
  fuel_type?: string | null;
  country?: string | null;
  oil_spec?: string | null;
  source: string;
}

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
  fuel_tank_capacity?: number;
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
  starline_interior_temp?: number;
  starline_balance?: number;
  starline_is_armed?: boolean;
  starline_is_running?: boolean;
  starline_is_handbrake?: boolean;
  starline_is_doors_closed?: boolean;
  starline_gsm_level?: number;
  starline_gps_lat?: number;
  starline_gps_lon?: number;
  starline_gps_type?: 'gps' | 'lbs';
  starline_is_spoofed?: boolean;
  telematics_auto_sync?: boolean;
  starline_auto_sync_interval_minutes?: number;
  telematics_webhook_key?: string;
  drive_type?: 'fwd' | 'awd' | 'rwd';
  public_booklet_token?: string | null;
  public_booklet_enabled?: boolean;
  public_show_costs?: boolean;
}

export interface User {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
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
  tpms_has_sensors?: boolean;
  tpms_frequency?: string;
  tpms_brand?: string;
  tpms_pressure_bar?: number | null;
  tpms_fl_id?: string;
  tpms_fr_id?: string;
  tpms_rl_id?: string;
  tpms_rr_id?: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  last_rotation_km?: number | null;
  rotation_interval_km?: number;
  is_directional?: boolean;
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

export interface SystemAnnouncement {
  is_active: boolean;
  title?: string;
  text: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  updated_at?: string;
  updated_by?: string;
}

export interface TelegramStatus {
  is_connected: boolean;
  telegram_username?: string | null;
  telegram_chat_id?: string | null;
  bot_username: string;
  link_url: string;
  notifications_enabled: boolean;
  notify_reminders: boolean;
  notify_battery: boolean;
  notify_documents: boolean;
}

export interface TelegramBotConfig {
  bot_token: string | null;
  bot_username: string;
  bot_name: string | null;
  is_custom_token: boolean;
  is_active: boolean;
  status_detail?: string | null;
}

export interface VehicleConsumable {
  id: number;
  vehicle_id: number;
  category: 'engine' | 'filters' | 'transmission' | 'brakes' | 'cooling' | 'electrical' | 'wipers' | 'other';
  name: string;
  specification?: string | null;
  oem_part_number?: string | null;
  aftermarket_parts?: string | null;
  replacement_interval?: string | null;
  notes?: string | null;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface TyreRotatePayload {
  current_odometer: number;
  swap_tpms: boolean;
  drive_type: 'fwd' | 'awd' | 'rwd' | 'directional';
}

export interface PublicBookletData {
  vehicle: {
    make: string;
    model: string;
    year?: number;
    license_plate?: string;
    vin?: string;
    body_type?: string;
    fuel_type?: string;
    transmission?: string;
    drive_type?: string;
    color?: string;
    current_odometer: number;
    distance_unit: string;
    current_engine_hours?: number | null;
    oil_spec?: string;
    currency: string;
    telematics_verified: boolean;
    last_telematics_sync?: string | null;
    public_show_costs: boolean;
  };
  service_records: Array<{
    id: number;
    date?: string | null;
    odometer: number;
    engine_hours?: number | null;
    record_type: 'service' | 'repair' | 'upgrade';
    to_tag?: string | null;
    title: string;
    description?: string | null;
    parts_cost?: number | null;
    labor_cost?: number | null;
    total_cost?: number | null;
    items?: Array<{
      name: string;
      brand?: string | null;
      part_number?: string | null;
      quantity: number;
      unit: string;
      unit_price?: number | null;
      total_price?: number | null;
    }>;
  }>;
  tyres: Array<{
    id: number;
    name: string;
    season: 'summer' | 'winter';
    brand_model?: string | null;
    size?: string | null;
    year?: number | null;
    dot_code?: string | null;
    is_active: boolean;
    current_km?: number;
    tread_depth_mm?: number;
    has_separate_rims?: boolean;
    rims_brand_model?: string | null;
    rims_size?: string | null;
    tpms_sensors?: string | null;
    tpms_frequency?: string | null;
    tpms_target_pressure_bar?: number | null;
    tpms_fl_id?: string | null;
    tpms_fr_id?: string | null;
    tpms_rl_id?: string | null;
    tpms_rr_id?: string | null;
    last_rotation_km?: number | null;
    rotation_interval_km?: number | null;
    is_directional?: boolean;
    total_price?: number | null;
  }>;
  consumables: VehicleConsumable[];
  public_show_costs: boolean;
}
