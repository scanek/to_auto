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
    const vehicles = this.load<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
    if (vehicles.length === 0) {
      const defaultVehicle: Vehicle = {
        id: 1,
        make: 'Мой Автомобиль',
        model: 'Седан / Кроссовер',
        year: new Date().getFullYear(),
        starting_odometer: 0,
        current_odometer: 15000,
        current_engine_hours: 350,
        distance_unit: 'km',
        fuel_unit: 'L',
        fuel_tank_capacity: 55,
        currency: '₽',
        created_at: this.nowIso(),
        updated_at: this.nowIso(),
        notes: 'Локальный автомобиль в автономном приложении',
        is_owner: true,
      };

      this.save(STORAGE_KEYS.VEHICLES, [defaultVehicle]);

      // Seed standard maintenance plan
      const defaultReminders: MaintenancePlan[] = [
        {
          id: 1,
          vehicle_id: 1,
          title: 'Моторное масло и фильтр',
          category: 'Двигатель',
          interval_distance: 7500,
          interval_months: 12,
          interval_hours: 250,
          last_service_odometer: 10000,
          last_service_hours: 230,
          last_service_date: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
          is_active: true,
          notify_before_distance: 500,
          notify_before_days: 14,
          notify_before_hours: 20,
          created_at: this.nowIso(),
          status: 'ok',
          progress_percentage: 66,
        },
        {
          id: 2,
          vehicle_id: 1,
          title: 'Воздушный фильтр двигателя',
          category: 'Фильтры',
          interval_distance: 15000,
          interval_months: 12,
          interval_hours: null,
          last_service_odometer: 0,
          last_service_hours: 0,
          last_service_date: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString(),
          is_active: true,
          notify_before_distance: 1000,
          notify_before_days: 30,
          notify_before_hours: 0,
          created_at: this.nowIso(),
          status: 'due_soon',
          progress_percentage: 95,
        },
        {
          id: 3,
          vehicle_id: 1,
          title: 'Салонный фильтр (Кондиционер)',
          category: 'Фильтры',
          interval_distance: 10000,
          interval_months: 12,
          interval_hours: null,
          last_service_odometer: 0,
          last_service_hours: 0,
          last_service_date: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString(),
          is_active: true,
          notify_before_distance: 500,
          notify_before_days: 14,
          notify_before_hours: 0,
          created_at: this.nowIso(),
          status: 'overdue',
          progress_percentage: 100,
        },
      ];

      this.save(STORAGE_KEYS.REMINDERS, defaultReminders);
    }
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
  // Full Backup Export / Import
  // ----------------------------------------------------------------
  public exportFullBackup(): string {
    const backup = {
      version: '2.8.2-standalone',
      exported_at: this.nowIso(),
      vehicles: this.load(STORAGE_KEYS.VEHICLES, []),
      services: this.load(STORAGE_KEYS.SERVICES, []),
      fuel: this.load(STORAGE_KEYS.FUEL, []),
      reminders: this.load(STORAGE_KEYS.REMINDERS, []),
      tyres: this.load(STORAGE_KEYS.TYRES, []),
      documents: this.load(STORAGE_KEYS.DOCUMENTS, []),
    };

    return JSON.stringify(backup, null, 2);
  }

  public importFullBackup(jsonContent: string): boolean {
    try {
      const data = JSON.parse(jsonContent);
      if (Array.isArray(data.vehicles)) {
        this.save(STORAGE_KEYS.VEHICLES, data.vehicles);
        if (Array.isArray(data.services)) this.save(STORAGE_KEYS.SERVICES, data.services);
        if (Array.isArray(data.fuel)) this.save(STORAGE_KEYS.FUEL, data.fuel);
        if (Array.isArray(data.reminders)) this.save(STORAGE_KEYS.REMINDERS, data.reminders);
        if (Array.isArray(data.tyres)) this.save(STORAGE_KEYS.TYRES, data.tyres);
        if (Array.isArray(data.documents)) this.save(STORAGE_KEYS.DOCUMENTS, data.documents);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[LocalDB] Import error:', e);
      return false;
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
