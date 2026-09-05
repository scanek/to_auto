import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  TyreSet,
  DocumentNote,
  VehicleAnalytics,
  CategoryCost,
  MonthlyCost,
  FuelEconomyPoint,
  User,
} from '../types';

const STORAGE_KEYS = {
  VEHICLES: 'autotracker_local_vehicles',
  SERVICES: 'autotracker_local_services',
  FUEL: 'autotracker_local_fuel',
  REMINDERS: 'autotracker_local_reminders',
  TYRES: 'autotracker_local_tyres',
  DOCUMENTS: 'autotracker_local_documents',
  SETTINGS: 'autotracker_local_settings',
  APP_MODE: 'autotracker_app_mode', // 'standalone' | 'server'
  SERVER_URL: 'autotracker_server_url',
};

export class LocalDatabaseEngine {
  private static instance: LocalDatabaseEngine;

  private constructor() {
    this.ensureInitialized();
  }

  public static getInstance(): LocalDatabaseEngine {
    if (!LocalDatabaseEngine.instance) {
      LocalDatabaseEngine.instance = new LocalDatabaseEngine();
    }
    return LocalDatabaseEngine.instance;
  }

  // ----------------------------------------------------------------
  // Mode & Server Configuration
  // ----------------------------------------------------------------
  public isStandaloneMode(): boolean {
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
    const storedMode = localStorage.getItem(STORAGE_KEYS.APP_MODE);
    if (storedMode) {
      return storedMode === 'standalone';
    }
    // Default to standalone if inside native app or if explicitly set
    return isCapacitor ? true : false;
  }

  public setAppMode(mode: 'standalone' | 'server') {
    localStorage.setItem(STORAGE_KEYS.APP_MODE, mode);
  }

  public getServerUrl(): string {
    return localStorage.getItem(STORAGE_KEYS.SERVER_URL) || window.location.origin;
  }

  public setServerUrl(url: string) {
    localStorage.setItem(STORAGE_KEYS.SERVER_URL, url.replace(/\/+$/, ''));
  }

  // ----------------------------------------------------------------
  // Persistence Helpers
  // ----------------------------------------------------------------
  private load<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private save<T>(key: string, data: T) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`[LocalDB] Error saving to ${key}:`, e);
    }
  }

  private nextId(items: { id: number }[]): number {
    return items.reduce((max, it) => (it.id > max ? it.id : max), 0) + 1;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  // ----------------------------------------------------------------
  // Initialization & Seeding
  // ----------------------------------------------------------------
  private ensureInitialized() {
    // Clean initial state: no dummy vehicles or sample records are seeded by default.
    // The user starts with an empty garage and can create a car or restore from backup.
  }

  // ----------------------------------------------------------------
  // Current User Mock
  // ----------------------------------------------------------------
  public getCurrentUser(): User {
    return {
      id: 1,
      username: 'offline_user',
      full_name: 'Владелец автомобиля',
      role: 'admin',
      is_active: true,
      created_at: this.nowIso(),
      updated_at: this.nowIso(),
    };
  }

  // ----------------------------------------------------------------
  // Vehicles CRUD
  // ----------------------------------------------------------------
  public async getVehicles(): Promise<Vehicle[]> {
    const vehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    const services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
    const fuels = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);

    return vehicles.map((v) => {
      const vServices = services.filter((s) => s.vehicle_id === v.id);
      const vFuels = fuels.filter((f) => f.vehicle_id === v.id);
      const vReminders = reminders.filter((r) => r.vehicle_id === v.id && r.is_active);

      const total_service_cost = vServices.reduce((sum, s) => sum + (s.total_cost || 0), 0);
      const total_fuel_cost = vFuels.reduce((sum, f) => sum + (f.total_cost || 0), 0);
      const total_cost = total_service_cost + total_fuel_cost;

      let overdue_reminders_count = 0;
      let active_reminders_count = vReminders.length;

      vReminders.forEach((r) => {
        const enriched = this.enrichReminder(r, v.current_odometer, v.current_engine_hours);
        if (enriched.status === 'overdue') overdue_reminders_count++;
      });

      return {
        ...v,
        total_service_cost,
        total_fuel_cost,
        total_cost,
        active_reminders_count,
        overdue_reminders_count,
        is_owner: true,
      };
    });
  }

  public async getVehicle(id: number): Promise<Vehicle | null> {
    const vehicles = await this.getVehicles();
    return vehicles.find((v) => v.id === id) || null;
  }

  public async createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const vehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    const newVehicle: Vehicle = {
      id: this.nextId(vehicles),
      make: data.make || 'Марка',
      model: data.model || 'Модель',
      year: data.year || new Date().getFullYear(),
      engine: data.engine || '',
      license_plate: data.license_plate || '',
      vin: data.vin || '',
      starting_odometer: data.starting_odometer || 0,
      current_odometer: data.current_odometer || data.starting_odometer || 0,
      current_engine_hours: data.current_engine_hours || 0,
      track_engine_hours: data.track_engine_hours || false,
      purchase_date: data.purchase_date || '',
      oil_spec: data.oil_spec || '',
      distance_unit: data.distance_unit || 'km',
      fuel_unit: data.fuel_unit || 'L',
      fuel_tank_capacity: data.fuel_tank_capacity || 50,
      currency: data.currency || '₽',
      photo_url: data.photo_url || '',
      notes: data.notes || '',
      created_at: this.nowIso(),
      updated_at: this.nowIso(),
      is_owner: true,
    };

    vehicles.push(newVehicle);
    this.save(STORAGE_KEYS.VEHICLES, vehicles);
    return newVehicle;
  }

  public async updateVehicle(id: number, data: Partial<Vehicle>): Promise<Vehicle> {
    const vehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error('Vehicle not found');

    const updated: Vehicle = {
      ...vehicles[idx],
      ...data,
      id,
      updated_at: this.nowIso(),
    };

    vehicles[idx] = updated;
    this.save(STORAGE_KEYS.VEHICLES, vehicles);
    return updated;
  }

  public async deleteVehicle(id: number): Promise<boolean> {
    let vehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    vehicles = vehicles.filter((v) => v.id !== id);
    this.save(STORAGE_KEYS.VEHICLES, vehicles);

    this.save(
      STORAGE_KEYS.SERVICES,
      this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []).filter((s) => s.vehicle_id !== id)
    );
    this.save(
      STORAGE_KEYS.FUEL,
      this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []).filter((f) => f.vehicle_id !== id)
    );
    this.save(
      STORAGE_KEYS.REMINDERS,
      this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []).filter((r) => r.vehicle_id !== id)
    );
    this.save(
      STORAGE_KEYS.TYRES,
      this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []).filter((t) => t.vehicle_id !== id)
    );
    this.save(
      STORAGE_KEYS.DOCUMENTS,
      this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []).filter((d) => d.vehicle_id !== id)
    );

    return true;
  }

  // ----------------------------------------------------------------
  // Services CRUD
  // ----------------------------------------------------------------
  public async getServices(vehicleId: number): Promise<ServiceRecord[]> {
    const services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
    return services
      .filter((s) => s.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public async createService(data: Partial<ServiceRecord>): Promise<ServiceRecord> {
    const services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
    const newService: ServiceRecord = {
      id: this.nextId(services),
      vehicle_id: data.vehicle_id!,
      record_type: data.record_type || 'service',
      to_tag: data.to_tag || '',
      date: data.date || this.nowIso().slice(0, 10),
      odometer: data.odometer || 0,
      engine_hours: data.engine_hours || null,
      title: data.title || 'ТО / Ремонт',
      description: data.description || '',
      cost_labor: data.cost_labor || 0,
      cost_parts: data.cost_parts || 0,
      total_cost: (data.cost_labor || 0) + (data.cost_parts || 0),
      store: data.store || '',
      url: data.url || '',
      notes: data.notes || '',
      created_at: this.nowIso(),
      items: data.items || [],
      attachments_count: 0,
    };

    services.push(newService);
    this.save(STORAGE_KEYS.SERVICES, services);

    if (newService.odometer > 0) {
      const v = await this.getVehicle(newService.vehicle_id);
      if (v && newService.odometer > v.current_odometer) {
        await this.updateVehicle(v.id, { current_odometer: newService.odometer });
      }
    }

    return newService;
  }

  public async updateService(id: number, data: Partial<ServiceRecord>): Promise<ServiceRecord> {
    const services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
    const idx = services.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Service record not found');

    const total_cost =
      data.cost_labor !== undefined || data.cost_parts !== undefined
        ? (data.cost_labor ?? services[idx].cost_labor ?? 0) + (data.cost_parts ?? services[idx].cost_parts ?? 0)
        : data.total_cost ?? services[idx].total_cost;

    const updated: ServiceRecord = {
      ...services[idx],
      ...data,
      id,
      total_cost,
    };

    services[idx] = updated;
    this.save(STORAGE_KEYS.SERVICES, services);
    return updated;
  }

  public async deleteService(id: number): Promise<boolean> {
    let services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
    services = services.filter((s) => s.id !== id);
    this.save(STORAGE_KEYS.SERVICES, services);
    return true;
  }

  // ----------------------------------------------------------------
  // Fuel Logs CRUD & Consumption Calculation
  // ----------------------------------------------------------------
  public async getFuelLogs(vehicleId: number): Promise<FuelLog[]> {
    const fuels = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
    const vFuels = fuels
      .filter((f) => f.vehicle_id === vehicleId)
      .sort((a, b) => a.odometer - b.odometer);

    let prevFullOdo: number | null = null;
    let accumulatedFuel = 0;

    const enriched = vFuels.map((f) => {
      let distance_traveled: number | null = null;
      let consumption: number | null = null;

      accumulatedFuel += f.fuel_amount;

      if (f.is_full_tank && !f.is_missed && prevFullOdo !== null) {
        distance_traveled = f.odometer - prevFullOdo;
        if (distance_traveled > 0) {
          consumption = Number(((accumulatedFuel / distance_traveled) * 100).toFixed(2));
        }
        accumulatedFuel = 0;
      }

      if (f.is_full_tank) {
        prevFullOdo = f.odometer;
      }

      return {
        ...f,
        distance_traveled,
        consumption,
      };
    });

    return enriched.reverse();
  }

  public async createFuelLog(data: Partial<FuelLog>): Promise<FuelLog> {
    const fuels = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
    const newFuel: FuelLog = {
      id: this.nextId(fuels),
      vehicle_id: data.vehicle_id!,
      date: data.date || this.nowIso().slice(0, 10),
      odometer: data.odometer || 0,
      fuel_amount: data.fuel_amount || 0,
      total_cost: data.total_cost || 0,
      unit_price:
        data.unit_price || (data.fuel_amount ? Number((data.total_cost! / data.fuel_amount).toFixed(2)) : 0),
      is_full_tank: data.is_full_tank !== undefined ? data.is_full_tank : true,
      is_missed: data.is_missed || false,
      fuel_grade: data.fuel_grade || 'АИ-95',
      gas_station: data.gas_station || '',
      notes: data.notes || '',
      created_at: this.nowIso(),
    };

    fuels.push(newFuel);
    this.save(STORAGE_KEYS.FUEL, fuels);

    if (newFuel.odometer > 0) {
      const v = await this.getVehicle(newFuel.vehicle_id);
      if (v && newFuel.odometer > v.current_odometer) {
        await this.updateVehicle(v.id, { current_odometer: newFuel.odometer });
      }
    }

    return newFuel;
  }

  public async updateFuelLog(id: number, data: Partial<FuelLog>): Promise<FuelLog> {
    const fuels = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
    const idx = fuels.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error('Fuel log not found');

    const updated: FuelLog = {
      ...fuels[idx],
      ...data,
      id,
    };

    fuels[idx] = updated;
    this.save(STORAGE_KEYS.FUEL, fuels);
    return updated;
  }

  public async deleteFuelLog(id: number): Promise<boolean> {
    let fuels = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
    fuels = fuels.filter((f) => f.id !== id);
    this.save(STORAGE_KEYS.FUEL, fuels);
    return true;
  }

  // ----------------------------------------------------------------
  // Reminders / Maintenance Plans
  // ----------------------------------------------------------------
  public async getReminders(vehicleId: number): Promise<MaintenancePlan[]> {
    const vehicle = await this.getVehicle(vehicleId);
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
    const vReminders = reminders.filter((r) => r.vehicle_id === vehicleId);

    const curOdo = vehicle?.current_odometer || 0;
    const curHours = vehicle?.current_engine_hours || 0;

    return vReminders.map((r) => this.enrichReminder(r, curOdo, curHours));
  }

  private enrichReminder(r: MaintenancePlan, currentOdo: number, currentHours: number): MaintenancePlan {
    let due_odometer: number | null = null;
    let remaining_distance: number | null = null;
    let distProgress = 0;

    if (r.interval_distance && r.interval_distance > 0) {
      due_odometer = r.last_service_odometer + r.interval_distance;
      remaining_distance = due_odometer - currentOdo;
      const distTraveled = currentOdo - r.last_service_odometer;
      distProgress = Math.min(100, Math.max(0, (distTraveled / r.interval_distance) * 100));
    }

    let due_hours: number | null = null;
    let remaining_hours: number | null = null;
    let hoursProgress = 0;

    if (r.interval_hours && r.interval_hours > 0) {
      due_hours = r.last_service_hours + r.interval_hours;
      remaining_hours = due_hours - currentHours;
      const hoursTraveled = currentHours - r.last_service_hours;
      hoursProgress = Math.min(100, Math.max(0, (hoursTraveled / r.interval_hours) * 100));
    }

    let due_date: string | null = null;
    let remaining_days: number | null = null;
    let daysProgress = 0;

    if (r.interval_months && r.interval_months > 0 && r.last_service_date) {
      const lastDate = new Date(r.last_service_date);
      const targetDate = new Date(lastDate);
      targetDate.setMonth(targetDate.getMonth() + r.interval_months);
      due_date = targetDate.toISOString().slice(0, 10);

      const msDiff = targetDate.getTime() - Date.now();
      remaining_days = Math.ceil(msDiff / (1000 * 3600 * 24));

      const totalDays = r.interval_months * 30.5;
      const passedDays = (Date.now() - lastDate.getTime()) / (1000 * 3600 * 24);
      daysProgress = Math.min(100, Math.max(0, (passedDays / totalDays) * 100));
    }

    const progress_percentage = Math.max(distProgress, hoursProgress, daysProgress);

    let status: 'ok' | 'due_soon' | 'overdue' = 'ok';
    const isDistOverdue = remaining_distance !== null && remaining_distance <= 0;
    const isHoursOverdue = remaining_hours !== null && remaining_hours <= 0;
    const isDaysOverdue = remaining_days !== null && remaining_days <= 0;

    const isDistSoon =
      remaining_distance !== null && remaining_distance <= (r.notify_before_distance || 500);
    const isHoursSoon = remaining_hours !== null && remaining_hours <= (r.notify_before_hours || 20);
    const isDaysSoon = remaining_days !== null && remaining_days <= (r.notify_before_days || 14);

    if (isDistOverdue || isHoursOverdue || isDaysOverdue) {
      status = 'overdue';
    } else if (isDistSoon || isHoursSoon || isDaysSoon) {
      status = 'due_soon';
    }

    return {
      ...r,
      due_odometer,
      remaining_distance,
      due_hours,
      remaining_hours,
      due_date,
      remaining_days,
      progress_percentage: Number(progress_percentage.toFixed(1)),
      status,
    };
  }

  public async createReminder(data: Partial<MaintenancePlan>): Promise<MaintenancePlan> {
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
    const newReminder: MaintenancePlan = {
      id: this.nextId(reminders),
      vehicle_id: data.vehicle_id!,
      title: data.title || 'Регламент ТО',
      category: data.category || 'Общее',
      description: data.description || '',
      brand: data.brand || '',
      spec: data.spec || '',
      article: data.article || '',
      icon: data.icon || 'Wrench',
      interval_distance: data.interval_distance || null,
      interval_months: data.interval_months || null,
      interval_hours: data.interval_hours || null,
      last_service_odometer: data.last_service_odometer || 0,
      last_service_hours: data.last_service_hours || 0,
      last_service_date: data.last_service_date || this.nowIso().slice(0, 10),
      is_active: data.is_active !== undefined ? data.is_active : true,
      notify_before_distance: data.notify_before_distance || 500,
      notify_before_days: data.notify_before_days || 14,
      notify_before_hours: data.notify_before_hours || 20,
      notes: data.notes || '',
      created_at: this.nowIso(),
      status: 'ok',
      progress_percentage: 0,
    };

    reminders.push(newReminder);
    this.save(STORAGE_KEYS.REMINDERS, reminders);
    return newReminder;
  }

  public async updateReminder(id: number, data: Partial<MaintenancePlan>): Promise<MaintenancePlan> {
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
    const idx = reminders.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Reminder not found');

    const updated: MaintenancePlan = {
      ...reminders[idx],
      ...data,
      id,
    };

    reminders[idx] = updated;
    this.save(STORAGE_KEYS.REMINDERS, reminders);
    return updated;
  }

  public async completeReminder(
    id: number,
    completionData: {
      date?: string;
      odometer?: number;
      engine_hours?: number | null;
      create_service_record?: boolean;
      cost_labor?: number;
      cost_parts?: number;
      notes?: string;
    }
  ): Promise<MaintenancePlan> {
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
    const idx = reminders.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Reminder not found');

    const rem = reminders[idx];
    const date = completionData.date || this.nowIso().slice(0, 10);
    const odometer = completionData.odometer ?? rem.last_service_odometer;
    const hours = completionData.engine_hours ?? rem.last_service_hours;

    rem.last_service_date = date;
    rem.last_service_odometer = odometer;
    rem.last_service_hours = hours;
    this.save(STORAGE_KEYS.REMINDERS, reminders);

    if (completionData.create_service_record) {
      await this.createService({
        vehicle_id: rem.vehicle_id,
        record_type: 'service',
        title: `ТО: ${rem.title}`,
        date,
        odometer,
        engine_hours: hours,
        cost_labor: completionData.cost_labor || 0,
        cost_parts: completionData.cost_parts || 0,
        notes: completionData.notes || `Выполнено по регламенту ${rem.title}`,
      });
    }

    return rem;
  }

  public async deleteReminder(id: number): Promise<boolean> {
    let reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
    reminders = reminders.filter((r) => r.id !== id);
    this.save(STORAGE_KEYS.REMINDERS, reminders);
    return true;
  }

  // ----------------------------------------------------------------
  // Tyres CRUD
  // ----------------------------------------------------------------
  public async getTyres(vehicleId: number): Promise<TyreSet[]> {
    const tyres = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []);
    return tyres.filter((t) => t.vehicle_id === vehicleId);
  }

  public async createTyre(data: Partial<TyreSet>): Promise<TyreSet> {
    const tyres = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []);
    const newTyre: TyreSet = {
      id: this.nextId(tyres),
      vehicle_id: data.vehicle_id!,
      name: data.name || 'Комплект шин',
      season: data.season || 'summer',
      size: data.size || '',
      brand_model: data.brand_model || '',
      current_km: data.current_km || 0,
      tread_depth_mm: data.tread_depth_mm || 8.0,
      storage_location: data.storage_location || 'Гараж',
      is_active: data.is_active || false,
      install_date: data.install_date || '',
      install_mileage: data.install_mileage || 0,
      purchase_date: data.purchase_date || '',
      dot_code: data.dot_code || '',
      has_separate_rims: data.has_separate_rims || false,
      rims_brand_model: data.rims_brand_model || '',
      rims_size: data.rims_size || '',
      rims_purchase_date: data.rims_purchase_date || '',
      rims_price: data.rims_price || 0,
      tpms_sensors: data.tpms_sensors || '',
      quantity: data.quantity || 4,
      price_per_unit: data.price_per_unit || 0,
      total_price: data.total_price || (data.quantity || 4) * (data.price_per_unit || 0),
      created_at: this.nowIso(),
    };

    if (newTyre.is_active) {
      tyres.forEach((t) => {
        if (t.vehicle_id === newTyre.vehicle_id) t.is_active = false;
      });
    }

    tyres.push(newTyre);
    this.save(STORAGE_KEYS.TYRES, tyres);
    return newTyre;
  }

  public async updateTyre(id: number, data: Partial<TyreSet>): Promise<TyreSet> {
    const tyres = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []);
    const idx = tyres.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Tyre set not found');

    if (data.is_active) {
      tyres.forEach((t) => {
        if (t.vehicle_id === tyres[idx].vehicle_id) t.is_active = false;
      });
    }

    const updated: TyreSet = {
      ...tyres[idx],
      ...data,
      id,
    };

    tyres[idx] = updated;
    this.save(STORAGE_KEYS.TYRES, tyres);
    return updated;
  }

  public async activateTyre(id: number, mileage?: number): Promise<TyreSet> {
    return this.updateTyre(id, {
      is_active: true,
      install_date: this.nowIso().slice(0, 10),
      install_mileage: mileage,
    });
  }

  public async deleteTyre(id: number): Promise<boolean> {
    let tyres = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []);
    tyres = tyres.filter((t) => t.id !== id);
    this.save(STORAGE_KEYS.TYRES, tyres);
    return true;
  }

  // ----------------------------------------------------------------
  // Documents CRUD
  // ----------------------------------------------------------------
  public async getDocuments(vehicleId: number): Promise<DocumentNote[]> {
    const docs = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []);
    return docs
      .filter((d) => d.vehicle_id === vehicleId)
      .map((d) => {
        let is_expired = false;
        let days_until_expiration: number | null = null;
        if (d.expiration_date) {
          const exp = new Date(d.expiration_date).getTime();
          const msDiff = exp - Date.now();
          days_until_expiration = Math.ceil(msDiff / (1000 * 3600 * 24));
          is_expired = days_until_expiration <= 0;
        }
        return {
          ...d,
          is_expired,
          days_until_expiration,
        };
      });
  }

  public async createDocument(data: Partial<DocumentNote>): Promise<DocumentNote> {
    const docs = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []);
    const newDoc: DocumentNote = {
      id: this.nextId(docs),
      vehicle_id: data.vehicle_id!,
      title: data.title || 'Документ',
      doc_type: data.doc_type || 'insurance_osago',
      company: data.company || '',
      document_number: data.document_number || '',
      issue_date: data.issue_date || '',
      expiration_date: data.expiration_date || '',
      price: data.price || 0,
      mileage: data.mileage || null,
      engine_hours: data.engine_hours || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      file_url: data.file_url || '',
      notes: data.notes || '',
      created_at: this.nowIso(),
    };

    docs.push(newDoc);
    this.save(STORAGE_KEYS.DOCUMENTS, docs);
    return newDoc;
  }

  public async updateDocument(id: number, data: Partial<DocumentNote>): Promise<DocumentNote> {
    const docs = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []);
    const idx = docs.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error('Document not found');

    const updated: DocumentNote = {
      ...docs[idx],
      ...data,
      id,
    };

    docs[idx] = updated;
    this.save(STORAGE_KEYS.DOCUMENTS, docs);
    return updated;
  }

  public async deleteDocument(id: number): Promise<boolean> {
    let docs = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs = docs.filter((d) => d.id !== id);
    this.save(STORAGE_KEYS.DOCUMENTS, docs);
    return true;
  }

  // ----------------------------------------------------------------
  // Analytics & TCO Engine
  // ----------------------------------------------------------------
  public async getAnalytics(vehicleId: number): Promise<VehicleAnalytics> {
    const vehicle = await this.getVehicle(vehicleId);
    const services = await this.getServices(vehicleId);
    const fuels = await this.getFuelLogs(vehicleId);
    const tyres = await this.getTyres(vehicleId);
    const docs = await this.getDocuments(vehicleId);

    const total_service_spend = services
      .filter((s) => s.record_type === 'service')
      .reduce((sum, s) => sum + (s.total_cost || 0), 0);

    const total_repair_spend = services
      .filter((s) => s.record_type === 'repair')
      .reduce((sum, s) => sum + (s.total_cost || 0), 0);

    const total_upgrade_spend = services
      .filter((s) => s.record_type === 'upgrade')
      .reduce((sum, s) => sum + (s.total_cost || 0), 0);

    const total_fuel_spend = fuels.reduce((sum, f) => sum + (f.total_cost || 0), 0);
    const total_tyre_spend = tyres.reduce((sum, t) => sum + (t.total_price || 0) + (t.rims_price || 0), 0);
    const total_document_spend = docs.reduce((sum, d) => sum + (d.price || 0), 0);

    const total_spend =
      total_service_spend +
      total_repair_spend +
      total_upgrade_spend +
      total_fuel_spend +
      total_tyre_spend +
      total_document_spend;

    const total_fuel_liters = Number(fuels.reduce((sum, f) => sum + (f.fuel_amount || 0), 0).toFixed(2));
    const avg_fuel_price = total_fuel_liters > 0 ? Number((total_fuel_spend / total_fuel_liters).toFixed(2)) : 0;

    const startOdo = vehicle?.starting_odometer || 0;
    const curOdo = vehicle?.current_odometer || 0;
    const total_distance_tracked = Math.max(0, curOdo - startOdo);

    const cost_per_distance_unit =
      total_distance_tracked > 0 ? Number((total_spend / total_distance_tracked).toFixed(2)) : 0;

    const fuel_cost_per_distance =
      total_distance_tracked > 0 ? Number((total_fuel_spend / total_distance_tracked).toFixed(2)) : 0;

    const service_cost_per_distance =
      total_distance_tracked > 0
        ? Number(((total_service_spend + total_repair_spend) / total_distance_tracked).toFixed(2))
        : 0;

    const validConsumptions = fuels
      .map((f) => f.consumption)
      .filter((c): c is number => typeof c === 'number' && c > 0);

    const avg_fuel_consumption =
      validConsumptions.length > 0
        ? Number((validConsumptions.reduce((a, b) => a + b, 0) / validConsumptions.length).toFixed(2))
        : null;

    const categories: CategoryCost[] = [
      { category: 'Топливо', amount: total_fuel_spend, percentage: 0 },
      { category: 'Регламентное ТО', amount: total_service_spend, percentage: 0 },
      { category: 'Ремонты', amount: total_repair_spend, percentage: 0 },
      { category: 'Тюнинг и доработки', amount: total_upgrade_spend, percentage: 0 },
      { category: 'Шины и диски', amount: total_tyre_spend, percentage: 0 },
      { category: 'Страховки и документы', amount: total_document_spend, percentage: 0 },
    ]
      .filter((c) => c.amount > 0)
      .map((c) => ({
        ...c,
        percentage: total_spend > 0 ? Number(((c.amount / total_spend) * 100).toFixed(1)) : 0,
      }));

    const monthlyMap: Record<string, MonthlyCost> = {};

    const addCost = (
      dateStr: string,
      field: keyof Omit<MonthlyCost, 'month' | 'total_cost'>,
      amount: number
    ) => {
      if (!dateStr || amount <= 0) return;
      const month = dateStr.slice(0, 7);
      if (!monthlyMap[month]) {
        monthlyMap[month] = {
          month,
          service_cost: 0,
          repair_cost: 0,
          upgrade_cost: 0,
          fuel_cost: 0,
          tyre_cost: 0,
          document_cost: 0,
          total_cost: 0,
        };
      }
      monthlyMap[month][field] += amount;
      monthlyMap[month].total_cost += amount;
    };

    services.forEach((s) => {
      if (s.record_type === 'service') addCost(s.date, 'service_cost', s.total_cost || 0);
      else if (s.record_type === 'repair') addCost(s.date, 'repair_cost', s.total_cost || 0);
      else if (s.record_type === 'upgrade') addCost(s.date, 'upgrade_cost', s.total_cost || 0);
    });

    fuels.forEach((f) => addCost(f.date, 'fuel_cost', f.total_cost || 0));
    tyres.forEach((t) => {
      const date = t.purchase_date || t.created_at || '';
      addCost(date, 'tyre_cost', (t.total_price || 0) + (t.rims_price || 0));
    });
    docs.forEach((d) => addCost(d.issue_date || d.created_at || '', 'document_cost', d.price || 0));

    const monthly_costs = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    const fuel_trend: FuelEconomyPoint[] = fuels
      .filter((f) => f.consumption !== null && f.consumption !== undefined && f.consumption > 0)
      .map((f) => ({
        date: f.date,
        odometer: f.odometer,
        consumption: f.consumption!,
        unit_price: f.unit_price,
        distance: f.distance_traveled || 0,
      }))
      .reverse();

    return {
      vehicle_id: vehicleId,
      total_distance_tracked,
      total_spend,
      total_service_spend,
      total_repair_spend,
      total_upgrade_spend,
      total_fuel_spend,
      total_tyre_spend,
      total_document_spend,
      cost_per_distance_unit,
      fuel_cost_per_distance,
      service_cost_per_distance,
      avg_fuel_consumption,
      avg_fuel_price,
      total_fuel_liters,
      categories,
      monthly_costs,
      fuel_trend,
    };
  }

  // ----------------------------------------------------------------
  // Full Backup Export / Import (Universal Web & Standalone Compatibility)
  // ----------------------------------------------------------------
  public exportVehicleBackup(vehicleId: number): string {
    const vehicle = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []).find((v) => v.id === vehicleId);
    if (!vehicle) return '{}';
    const services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []).filter((s) => s.vehicle_id === vehicleId);
    const fuel_logs = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []).filter((f) => f.vehicle_id === vehicleId);
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []).filter((r) => r.vehicle_id === vehicleId);
    const tyre_sets = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []).filter((t) => t.vehicle_id === vehicleId);
    const documents = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []).filter((d) => d.vehicle_id === vehicleId);

    const payload = {
      version: '1.0',
      exported_at: this.nowIso(),
      app: 'Бортовой Журнал',
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        engine: vehicle.engine,
        license_plate: vehicle.license_plate,
        vin: vehicle.vin,
        starting_odometer: vehicle.starting_odometer,
        current_odometer: vehicle.current_odometer,
        current_engine_hours: vehicle.current_engine_hours,
        oil_spec: vehicle.oil_spec,
        notes: vehicle.notes,
        photo_url: vehicle.photo_url,
        distance_unit: vehicle.distance_unit,
        fuel_unit: vehicle.fuel_unit,
        currency: vehicle.currency,
        fuel_tank_capacity: vehicle.fuel_tank_capacity,
      },
      trackers: reminders.map((p) => ({
        id: String(p.id),
        name: p.title,
        category: p.category,
        brand: p.brand,
        spec: p.spec,
        article: p.article,
        icon: p.icon,
        interval_km: p.interval_distance,
        interval_hours: p.interval_hours,
        interval_months: p.interval_months,
        last_service_odometer: p.last_service_odometer,
        last_service_hours: p.last_service_hours,
        last_service_date: p.last_service_date,
        enabled: p.is_active,
        warn_km: p.notify_before_distance,
        warn_hours: p.notify_before_hours,
        warn_days: p.notify_before_days,
        notes: p.notes,
      })),
      service_records: services,
      fuel_logs: fuel_logs,
      tyre_sets: tyre_sets,
      documents: documents,
    };

    return JSON.stringify(payload, null, 2);
  }

  public exportFullBackup(): string {
    const vehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    const services = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
    const fuel = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
    const reminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
    const tyres = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []);
    const documents = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []);

    const allData = vehicles.map((v) => {
      const vServices = services.filter((s) => s.vehicle_id === v.id);
      const vFuel = fuel.filter((f) => f.vehicle_id === v.id);
      const vReminders = reminders.filter((r) => r.vehicle_id === v.id);
      const vTyres = tyres.filter((t) => t.vehicle_id === v.id);
      const vDocs = documents.filter((d) => d.vehicle_id === v.id);

      return {
        vehicle: {
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          engine: v.engine,
          license_plate: v.license_plate,
          vin: v.vin,
          starting_odometer: v.starting_odometer,
          current_odometer: v.current_odometer,
          current_engine_hours: v.current_engine_hours,
          oil_spec: v.oil_spec,
          notes: v.notes,
          photo_url: v.photo_url,
          distance_unit: v.distance_unit,
          fuel_unit: v.fuel_unit,
          currency: v.currency,
          fuel_tank_capacity: v.fuel_tank_capacity,
        },
        trackers: vReminders.map((p) => ({
          id: String(p.id),
          name: p.title,
          category: p.category,
          brand: p.brand,
          spec: p.spec,
          article: p.article,
          icon: p.icon,
          interval_km: p.interval_distance,
          interval_hours: p.interval_hours,
          interval_months: p.interval_months,
          last_service_odometer: p.last_service_odometer,
          last_service_hours: p.last_service_hours,
          last_service_date: p.last_service_date,
          enabled: p.is_active,
          warn_km: p.notify_before_distance,
          warn_hours: p.notify_before_hours,
          warn_days: p.notify_before_days,
          notes: p.notes,
        })),
        service_records: vServices,
        fuel_logs: vFuel,
        tyre_sets: vTyres,
        documents: vDocs,
      };
    });

    const backup = {
      version: '1.0',
      exported_at: this.nowIso(),
      app: 'Бортовой Журнал',
      vehicles_count: allData.length,
      data: allData,
      vehicles,
      services,
      fuel,
      reminders,
      tyres,
      documents,
    };

    return JSON.stringify(backup, null, 2);
  }

  public importFullBackup(dataOrString: any): { success: boolean; vehicle_id?: number; error?: string } {
    try {
      let payload = dataOrString;
      if (typeof dataOrString === 'string') {
        payload = JSON.parse(dataOrString);
      }
      if (!payload || typeof payload !== 'object') {
        return { success: false, error: 'Некорректный формат JSON' };
      }

      const existingVehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
      const existingServices = this.load<ServiceRecord[]>(STORAGE_KEYS.SERVICES, []);
      const existingFuel = this.load<FuelLog[]>(STORAGE_KEYS.FUEL, []);
      const existingReminders = this.load<MaintenancePlan[]>(STORAGE_KEYS.REMINDERS, []);
      const existingTyres = this.load<TyreSet[]>(STORAGE_KEYS.TYRES, []);
      const existingDocs = this.load<DocumentNote[]>(STORAGE_KEYS.DOCUMENTS, []);

      let importedVehicleId: number | undefined;

      // Case A: Standalone flat format
      if (Array.isArray(payload.vehicles) && !payload.vehicle && !payload.data) {
        if (payload.vehicles.length === 0) {
          return { success: false, error: 'В файле резервной копии не найдены автомобили' };
        }

        const idMap = new Map<number, number>();

        for (const v of payload.vehicles) {
          const newId = this.nextId(existingVehicles);
          idMap.set(v.id, newId);
          const curKm = Number(v.current_odometer ?? v.current_km ?? 0);
          const newV: Vehicle = {
            ...v,
            id: newId,
            make: v.make || v.brand || 'Марка',
            model: v.model || 'Модель',
            year: Number(v.year || new Date().getFullYear()),
            current_odometer: curKm,
            starting_odometer: Number(v.starting_odometer ?? curKm),
            current_engine_hours: Number(v.current_engine_hours || 0),
            is_owner: true,
          };
          existingVehicles.push(newV);
          if (!importedVehicleId) importedVehicleId = newId;
        }

        if (Array.isArray(payload.services)) {
          for (const s of payload.services) {
            const targetVehicleId = idMap.get(s.vehicle_id) || importedVehicleId || 1;
            existingServices.push({
              ...s,
              id: this.nextId(existingServices),
              vehicle_id: targetVehicleId,
              odometer: Number(s.odometer ?? s.mileage ?? 0),
              engine_hours: s.engine_hours ? Number(s.engine_hours) : null,
              cost_labor: Number(s.cost_labor || 0),
              cost_parts: Number(s.cost_parts || 0),
              total_cost: Number(s.total_cost ?? (Number(s.cost_labor || 0) + Number(s.cost_parts || 0))),
            });
          }
        }

        if (Array.isArray(payload.fuel)) {
          for (const f of payload.fuel) {
            const targetVehicleId = idMap.get(f.vehicle_id) || importedVehicleId || 1;
            existingFuel.push({
              ...f,
              id: this.nextId(existingFuel),
              vehicle_id: targetVehicleId,
              odometer: Number(f.odometer ?? f.mileage ?? 0),
              fuel_amount: Number(f.fuel_amount || 0),
              unit_price: Number(f.unit_price || 0),
              total_cost: Number(f.total_cost || 0),
            });
          }
        }

        if (Array.isArray(payload.reminders)) {
          for (const r of payload.reminders) {
            const targetVehicleId = idMap.get(r.vehicle_id) || importedVehicleId || 1;
            existingReminders.push({
              ...r,
              id: this.nextId(existingReminders),
              vehicle_id: targetVehicleId,
              title: r.title || r.name || 'Регламент',
              category: r.category || 'Обслуживание',
              interval_distance: r.interval_distance !== undefined ? r.interval_distance : (r.interval_km !== undefined ? r.interval_km : null),
              last_service_odometer: Number(r.last_service_odometer || 0),
            });
          }
        }

        if (Array.isArray(payload.tyres)) {
          for (const t of payload.tyres) {
            const targetVehicleId = idMap.get(t.vehicle_id) || importedVehicleId || 1;
            existingTyres.push({
              ...t,
              id: this.nextId(existingTyres),
              vehicle_id: targetVehicleId,
            });
          }
        }

        if (Array.isArray(payload.documents)) {
          for (const d of payload.documents) {
            const targetVehicleId = idMap.get(d.vehicle_id) || importedVehicleId || 1;
            existingDocs.push({
              ...d,
              id: this.nextId(existingDocs),
              vehicle_id: targetVehicleId,
            });
          }
        }

        this.save(STORAGE_KEYS.VEHICLES, existingVehicles);
        this.save(STORAGE_KEYS.SERVICES, existingServices);
        this.save(STORAGE_KEYS.FUEL, existingFuel);
        this.save(STORAGE_KEYS.REMINDERS, existingReminders);
        this.save(STORAGE_KEYS.TYRES, existingTyres);
        this.save(STORAGE_KEYS.DOCUMENTS, existingDocs);

        return { success: true, vehicle_id: importedVehicleId };
      }

      // Case B & C: Web Backup Structure (Single Vehicle or Multi-Vehicle package)
      const vehiclePackages: any[] = [];
      if (Array.isArray(payload.data) && payload.data.length > 0) {
        vehiclePackages.push(...payload.data);
      } else if (payload.vehicle || (Array.isArray(payload.vehicles) && payload.vehicles.length > 0)) {
        vehiclePackages.push(payload);
      } else {
        return { success: false, error: 'В файле не обнаружены данные автомобиля' };
      }

      for (const pkg of vehiclePackages) {
        const vRaw = pkg.vehicle || (Array.isArray(pkg.vehicles) ? pkg.vehicles[0] : pkg);
        if (!vRaw) continue;

        const newId = this.nextId(existingVehicles);
        if (!importedVehicleId) importedVehicleId = newId;

        const make = String(vRaw.brand || vRaw.make || 'Марка');
        const model = String(vRaw.model || 'Модель');
        const curKm = Number(vRaw.current_km ?? vRaw.current_odometer ?? 0);
        const curHours = Number(vRaw.current_engine_hours || 0);

        const newVehicle: Vehicle = {
          id: newId,
          make,
          model,
          year: Number(vRaw.year || new Date().getFullYear()),
          engine: String(vRaw.engine || ''),
          license_plate: String(vRaw.plate || vRaw.license_plate || ''),
          vin: String(vRaw.vin || ''),
          starting_odometer: Number(vRaw.starting_odometer ?? curKm),
          current_odometer: curKm,
          current_engine_hours: curHours,
          oil_spec: String(vRaw.oil_spec || ''),
          notes: String(vRaw.notes || ''),
          photo_url: String(vRaw.photo_url || ''),
          distance_unit: String(vRaw.distance_unit || 'km'),
          fuel_unit: String(vRaw.fuel_unit || 'L'),
          currency: String(vRaw.currency || '₽'),
          fuel_tank_capacity: Number(vRaw.fuel_tank_capacity || 55),
          created_at: vRaw.created_at || this.nowIso(),
          updated_at: vRaw.updated_at || this.nowIso(),
          is_owner: true,
        };
        existingVehicles.push(newVehicle);

        // Reminders / Trackers
        const trackersRaw = pkg.trackers || pkg.reminders || vRaw.trackers || [];
        for (const t of trackersRaw) {
          const plan: MaintenancePlan = {
            id: this.nextId(existingReminders),
            vehicle_id: newId,
            title: String(t.name || t.title || 'Регламент ТО'),
            category: String(t.category || 'Обслуживание'),
            brand: String(t.brand || ''),
            spec: String(t.spec || ''),
            article: String(t.article || ''),
            icon: String(t.icon || 'wrench'),
            interval_distance: t.interval_distance !== undefined ? t.interval_distance : (t.interval_km !== undefined ? t.interval_km : null),
            interval_hours: t.interval_hours !== undefined ? t.interval_hours : null,
            interval_months: t.interval_months !== undefined ? t.interval_months : 12,
            last_service_odometer: Number(t.last_service_odometer || 0),
            last_service_hours: Number(t.last_service_hours || 0),
            last_service_date: t.last_service_date || null,
            is_active: t.is_active !== undefined ? Boolean(t.is_active) : (t.enabled !== undefined ? Boolean(t.enabled) : true),
            notify_before_distance: Number(t.notify_before_distance ?? t.warn_km ?? 500),
            notify_before_days: Number(t.notify_before_days ?? t.warn_days ?? 14),
            notify_before_hours: Number(t.notify_before_hours ?? t.warn_hours ?? 20),
            notes: String(t.notes || ''),
            created_at: t.created_at || this.nowIso(),
          };
          existingReminders.push(plan);
        }

        // Service Records
        const sRecords = pkg.service_records || pkg.services || [];
        if (sRecords.length > 0) {
          for (const s of sRecords) {
            const sRec: ServiceRecord = {
              id: this.nextId(existingServices),
              vehicle_id: newId,
              record_type: String(s.record_type || 'service') as any,
              to_tag: s.to_tag || null,
              date: s.date ? new Date(s.date).toISOString() : this.nowIso(),
              odometer: Number(s.odometer ?? s.mileage ?? 0),
              engine_hours: s.engine_hours ? Number(s.engine_hours) : null,
              title: String(s.title || 'Обслуживание'),
              description: String(s.description || ''),
              cost_labor: Number(s.cost_labor || 0),
              cost_parts: Number(s.cost_parts || 0),
              total_cost: Number(s.total_cost ?? (Number(s.cost_labor || 0) + Number(s.cost_parts || 0))),
              store: String(s.store || ''),
              url: String(s.url || ''),
              notes: String(s.notes || ''),
              items: (s.items || []).map((it: any, idx: number) => ({
                id: it.id || idx + 1,
                name: String(it.name || it.item_name || 'Деталь'),
                brand: String(it.brand || ''),
                part_number: String(it.part_number || it.article || ''),
                category: String(it.category || 'part') as any,
                unit: String(it.unit || 'шт'),
                quantity: Number(it.quantity || 1),
                unit_price: Number(it.unit_price || it.price_per_unit || 0),
                total_price: Number(it.total_price || 0),
                store: String(it.store || ''),
                url: String(it.url || ''),
              })),
              created_at: s.created_at || this.nowIso(),
            };
            existingServices.push(sRec);
          }
        } else if (Array.isArray(pkg.maintenance_records)) {
          for (const m of pkg.maintenance_records) {
            const sRec: ServiceRecord = {
              id: this.nextId(existingServices),
              vehicle_id: newId,
              record_type: (m.to_tag && m.to_tag.startsWith('ТО')) ? 'service' : 'upgrade',
              to_tag: m.to_tag || null,
              date: m.date ? new Date(m.date).toISOString() : this.nowIso(),
              odometer: Number(m.mileage ?? m.odometer ?? 0),
              engine_hours: m.engine_hours ? Number(m.engine_hours) : null,
              title: String(m.item_name || m.to_tag || 'Обслуживание'),
              description: String(m.note || ''),
              cost_labor: 0,
              cost_parts: Number(m.total_price || 0),
              total_cost: Number(m.total_price || 0),
              store: String(m.store || ''),
              url: String(m.url || ''),
              notes: '',
              items: [
                {
                  id: 1,
                  name: String(m.item_name || 'Деталь'),
                  brand: String(m.brand || ''),
                  part_number: String(m.article || ''),
                  category: 'part',
                  unit: String(m.unit || 'шт'),
                  quantity: Number(m.quantity || 1),
                  unit_price: Number(m.price_per_unit || 0),
                  total_price: Number(m.total_price || 0),
                  store: String(m.store || ''),
                  url: String(m.url || ''),
                },
              ],
              created_at: this.nowIso(),
            };
            existingServices.push(sRec);
          }
        }

        // Fuel Logs
        const fLogs = pkg.fuel_logs || pkg.fuel || [];
        for (const f of fLogs) {
          const fLog: FuelLog = {
            id: this.nextId(existingFuel),
            vehicle_id: newId,
            date: f.date ? new Date(f.date).toISOString() : this.nowIso(),
            odometer: Number(f.odometer ?? f.mileage ?? 0),
            fuel_amount: Number(f.fuel_amount || 0),
            unit_price: Number(f.unit_price || 0),
            total_cost: Number(f.total_cost || 0),
            is_full_tank: f.is_full_tank !== undefined ? Boolean(f.is_full_tank) : true,
            is_missed: Boolean(f.is_missed),
            gas_station: String(f.gas_station || ''),
            fuel_grade: String(f.fuel_grade || ''),
            notes: String(f.notes || ''),
            created_at: f.created_at || this.nowIso(),
          };
          existingFuel.push(fLog);
        }

        // Tyre Sets
        const tSets = pkg.tyre_sets || pkg.tyres || [];
        for (const ty of tSets) {
          const tyreItem: TyreSet = {
            id: this.nextId(existingTyres),
            vehicle_id: newId,
            name: String(ty.name || 'Комплект шин'),
            season: String(ty.season || 'summer') as any,
            size: String(ty.size || ''),
            brand_model: String(ty.brand_model || ''),
            current_km: Number(ty.current_km || 0),
            tread_depth_mm: Number(ty.tread_depth_mm ?? 8),
            storage_location: String(ty.storage_location || ''),
            is_active: Boolean(ty.is_active),
            install_date: ty.install_date || null,
            install_mileage: ty.install_mileage ? Number(ty.install_mileage) : null,
            quantity: Number(ty.quantity || 4),
            price_per_unit: Number(ty.price_per_unit || 0),
            total_price: Number(ty.total_price || 0),
            rims_name: ty.rims_name || null,
            rims_price: Number(ty.rims_price || 0),
            created_at: ty.created_at || this.nowIso(),
          };
          existingTyres.push(tyreItem);
        }

        // Documents
        const dList = pkg.documents || pkg.insurances || [];
        for (const doc of dList) {
          const docItem: DocumentNote = {
            id: this.nextId(existingDocs),
            vehicle_id: newId,
            title: String(doc.title || doc.name || 'Документ'),
            doc_type: String(doc.doc_type || doc.type || 'other') as any,
            company: String(doc.company || ''),
            document_number: String(doc.document_number || doc.policy_number || ''),
            issue_date: doc.issue_date || doc.start_date || null,
            expiration_date: doc.expiration_date || doc.end_date || null,
            price: Number(doc.price || 0),
            mileage: doc.mileage ? Number(doc.mileage) : null,
            engine_hours: doc.engine_hours ? Number(doc.engine_hours) : null,
            is_active: doc.is_active !== undefined ? Boolean(doc.is_active) : true,
            notes: String(doc.notes || doc.note || ''),
            created_at: doc.created_at || this.nowIso(),
          };
          existingDocs.push(docItem);
        }
      }

      this.save(STORAGE_KEYS.VEHICLES, existingVehicles);
      this.save(STORAGE_KEYS.SERVICES, existingServices);
      this.save(STORAGE_KEYS.FUEL, existingFuel);
      this.save(STORAGE_KEYS.REMINDERS, existingReminders);
      this.save(STORAGE_KEYS.TYRES, existingTyres);
      this.save(STORAGE_KEYS.DOCUMENTS, existingDocs);

      return { success: true, vehicle_id: importedVehicleId };
    } catch (e: any) {
      console.error('[LocalDB] Import error:', e);
      return { success: false, error: e?.message || 'Ошибка импорта бэкапа' };
    }
  }

  public resetAllData() {
    localStorage.removeItem(STORAGE_KEYS.VEHICLES);
    localStorage.removeItem(STORAGE_KEYS.SERVICES);
    localStorage.removeItem(STORAGE_KEYS.FUEL);
    localStorage.removeItem(STORAGE_KEYS.REMINDERS);
    localStorage.removeItem(STORAGE_KEYS.TYRES);
    localStorage.removeItem(STORAGE_KEYS.DOCUMENTS);
    this.ensureInitialized();
  }
}

export const localDb = LocalDatabaseEngine.getInstance();

