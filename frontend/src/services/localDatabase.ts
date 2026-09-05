/**
 * Local Database Storage Engine for Standalone / Offline Android App
 * Provides 100% autonomous operation without any remote server.
 * Supports full CRUD for Vehicles, Services, Fuel, Reminders, Tyres, Documents, Consumables,
 * as well as direct JSON backup import & export.
 */

import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  TyreSet,
  DocumentNote,
  VehicleConsumable,
  VehicleAnalytics,
  TyreRotatePayload,
} from '../types';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'autotracker_standalone_db';
const DB_VERSION = 2;

const STORES = {
  VEHICLES: 'vehicles',
  SERVICE_RECORDS: 'service_records',
  FUEL_LOGS: 'fuel_logs',
  REMINDERS: 'reminders',
  TYRES: 'tyres',
  DOCUMENTS: 'documents',
  CONSUMABLES: 'consumables',
  SETTINGS: 'settings',
};

class LocalDatabaseEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: any) => {
        const db: IDBDatabase = e.target.result;
        Object.values(STORES).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            if (storeName === STORES.SETTINGS) {
              db.createObjectStore(storeName, { keyPath: 'key' });
            } else {
              const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
              if (storeName !== STORES.VEHICLES) {
                store.createIndex('vehicle_id', 'vehicle_id', { unique: false });
              }
            }
          }
        });
      };

      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });

    return this.dbPromise;
  }

  // Generic helpers
  public async getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async getByVehicleId<T>(storeName: string, vehicleId: number): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index('vehicle_id');
      const req = index.getAll(vehicleId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async putItem<T>(storeName: string, item: T): Promise<number | string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result as any);
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteItem(storeName: string, id: number | string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getNextId(storeName: string): Promise<number> {
    const all = await this.getAllFromStore<{ id?: number }>(storeName);
    let max = 0;
    all.forEach((item) => {
      if (typeof item.id === 'number' && item.id > max) max = item.id;
    });
    return max + 1;
  }

  // -------------------------------------------------------------
  // Settings & Server Connection
  // -------------------------------------------------------------
  public getServerUrl(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('autotracker_server_url') || null;
  }

  public setServerUrl(url: string | null) {
    if (typeof localStorage === 'undefined') return;
    if (url && url.trim()) {
      let clean = url.trim().replace(/\/\+$/, '');
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
      localStorage.setItem('autotracker_server_url', clean);
    } else {
      localStorage.removeItem('autotracker_server_url');
    }
  }

  public isNative(): boolean {
    return typeof window !== 'undefined' && Capacitor.isNativePlatform();
  }

  public isStandalone(): boolean {
    if (typeof window === 'undefined') return true;
    const serverUrl = this.getServerUrl();
    const mode = localStorage.getItem('autotracker_app_mode');
    if (mode === 'standalone') return true;
    if (mode === 'synced' && serverUrl) return false;
    // On native Android: default to standalone if no server configured
    if (this.isNative()) {
      return !serverUrl;
    }
    // On web browser: if user manually set standalone mode or if running from file
    return !serverUrl && window.location.protocol === 'file:';
  }

  public setAppMode(mode: 'standalone' | 'synced') {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('autotracker_app_mode', mode);
  }

  // -------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------
  public async getVehicles(): Promise<Vehicle[]> {
    const vehicles = await this.getAllFromStore<Vehicle>(STORES.VEHICLES);
    for (const v of vehicles) {
      const services = await this.getByVehicleId<ServiceRecord>(STORES.SERVICE_RECORDS, v.id);
      const fuel = await this.getByVehicleId<FuelLog>(STORES.FUEL_LOGS, v.id);
      const reminders = await this.getByVehicleId<MaintenancePlan>(STORES.REMINDERS, v.id);

      v.total_service_cost = services.reduce((acc, s) => acc + (s.total_cost || 0), 0);
      v.total_fuel_cost = fuel.reduce((acc, f) => acc + (f.total_cost || 0), 0);
      v.total_cost = (v.total_service_cost || 0) + (v.total_fuel_cost || 0);

      v.active_reminders_count = reminders.filter((r) => r.is_active !== false).length;
      v.overdue_reminders_count = 0;
    }
    return vehicles;
  }

  public async getVehicle(id: number): Promise<Vehicle | null> {
    const vehicles = await this.getVehicles();
    return vehicles.find((v) => v.id === id) || null;
  }

  public async createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const nextId = data.id || (await this.getNextId(STORES.VEHICLES));
    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      id: nextId,
      name: data.name || `${data.make || ''} ${data.model || ''}`.trim() || 'Мой автомобиль',
      make: data.make || '',
      model: data.model || '',
      year: data.year || new Date().getFullYear(),
      engine: data.engine || '',
      license_plate: data.license_plate || '',
      vin: data.vin || '',
      starting_odometer: Number(data.starting_odometer) || 0,
      current_odometer: Number(data.current_odometer) || Number(data.starting_odometer) || 0,
      current_engine_hours: Number(data.current_engine_hours) || 0,
      track_engine_hours: !!data.track_engine_hours,
      distance_unit: data.distance_unit || 'км',
      fuel_unit: data.fuel_unit || 'л',
      currency: data.currency || '₽',
      oil_spec: data.oil_spec || '',
      drive_type: data.drive_type || 'fwd',
      photo_url: data.photo_url || '',
      notes: data.notes || '',
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
      is_owner: true,
      is_public: !!data.is_public,
    };
    await this.putItem(STORES.VEHICLES, vehicle);
    return vehicle;
  }

  public async updateVehicle(id: number, data: Partial<Vehicle>): Promise<Vehicle> {
    const existing = await this.getVehicle(id);
    if (!existing) throw new Error(`Автомобиль #${id} не найден`);

    const updated: Vehicle = {
      ...existing,
      ...data,
      id,
      updated_at: new Date().toISOString(),
    };
    await this.putItem(STORES.VEHICLES, updated);
    return updated;
  }

  public async deleteVehicle(id: number): Promise<void> {
    await this.deleteItem(STORES.VEHICLES, id);
    const storesToDelete = [
      STORES.SERVICE_RECORDS,
      STORES.FUEL_LOGS,
      STORES.REMINDERS,
      STORES.TYRES,
      STORES.DOCUMENTS,
      STORES.CONSUMABLES,
    ];
    for (const storeName of storesToDelete) {
      const items = await this.getByVehicleId<{ id: number }>(storeName, id);
      for (const item of items) {
        await this.deleteItem(storeName, item.id);
      }
    }
  }

  // -------------------------------------------------------------
  // Service Records
  // -------------------------------------------------------------
  public async getServiceRecords(vehicleId: number, recordType?: string): Promise<ServiceRecord[]> {
    const records = await this.getByVehicleId<ServiceRecord>(STORES.SERVICE_RECORDS, vehicleId);
    let filtered = records;
    if (recordType) {
      filtered = records.filter((r) => r.record_type === recordType);
    }
    return filtered.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.odometer || 0) - (a.odometer || 0);
    });
  }

  public async createServiceRecord(vehicleId: number, data: Partial<ServiceRecord>): Promise<ServiceRecord> {
    const nextId = data.id || (await this.getNextId(STORES.SERVICE_RECORDS));
    const total_cost = (Number(data.cost_labor) || 0) + (Number(data.cost_parts) || 0);
    const record: ServiceRecord = {
      id: nextId,
      vehicle_id: vehicleId,
      record_type: data.record_type || 'service',
      to_tag: data.to_tag || '',
      date: data.date || new Date().toISOString().split('T')[0],
      odometer: Number(data.odometer) || 0,
      engine_hours: data.engine_hours ? Number(data.engine_hours) : null,
      title: data.title || 'Техническое обслуживание',
      description: data.description || '',
      cost_labor: Number(data.cost_labor) || 0,
      cost_parts: Number(data.cost_parts) || 0,
      total_cost,
      store: data.store || '',
      url: data.url || '',
      notes: data.notes || '',
      created_at: data.created_at || new Date().toISOString(),
      items: data.items || [],
      attachments_count: (data.items || []).length,
    };
    await this.putItem(STORES.SERVICE_RECORDS, record);

    const vehicle = await this.getVehicle(vehicleId);
    if (vehicle) {
      let updatedOdo = vehicle.current_odometer;
      let updatedHours = vehicle.current_engine_hours;
      if (record.odometer > updatedOdo) updatedOdo = record.odometer;
      if (record.engine_hours && record.engine_hours > updatedHours) updatedHours = record.engine_hours;
      if (updatedOdo !== vehicle.current_odometer || updatedHours !== vehicle.current_engine_hours) {
        await this.updateVehicle(vehicleId, {
          current_odometer: updatedOdo,
          current_engine_hours: updatedHours,
        });
      }
    }

    return record;
  }

  public async updateServiceRecord(id: number, data: Partial<ServiceRecord>): Promise<ServiceRecord> {
    const all = await this.getAllFromStore<ServiceRecord>(STORES.SERVICE_RECORDS);
    const existing = all.find((s) => s.id === id);
    const total_cost = (Number(data.cost_labor) || 0) + (Number(data.cost_parts) || 0);
    const updated: ServiceRecord = {
      ...(existing || {} as any),
      ...data,
      id,
      total_cost,
    };
    await this.putItem(STORES.SERVICE_RECORDS, updated);
    return updated;
  }

  public async deleteServiceRecord(id: number): Promise<void> {
    await this.deleteItem(STORES.SERVICE_RECORDS, id);
  }

  // -------------------------------------------------------------
  // Fuel Logs
  // -------------------------------------------------------------
  public async getFuelLogs(vehicleId: number): Promise<FuelLog[]> {
    const logs = await this.getByVehicleId<FuelLog>(STORES.FUEL_LOGS, vehicleId);
    return logs.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.odometer || 0) - (a.odometer || 0);
    });
  }

  public async createFuelLog(vehicleId: number, data: Partial<FuelLog>): Promise<FuelLog> {
    const nextId = data.id || (await this.getNextId(STORES.FUEL_LOGS));
    const fuelAmount = Number(data.fuel_amount) || 0;
    const unitPrice = Number(data.unit_price) || 0;
    const totalCost = Number(data.total_cost) || fuelAmount * unitPrice;

    const log: FuelLog = {
      id: nextId,
      vehicle_id: vehicleId,
      date: data.date || new Date().toISOString().split('T')[0],
      odometer: Number(data.odometer) || 0,
      fuel_amount: fuelAmount,
      total_cost: totalCost,
      unit_price: unitPrice,
      is_full_tank: data.is_full_tank ?? true,
      is_missed: data.is_missed ?? false,
      fuel_grade: data.fuel_grade || '',
      gas_station: data.gas_station || '',
      notes: data.notes || '',
      created_at: data.created_at || new Date().toISOString(),
    };
    await this.putItem(STORES.FUEL_LOGS, log);

    const vehicle = await this.getVehicle(vehicleId);
    if (vehicle && log.odometer > vehicle.current_odometer) {
      await this.updateVehicle(vehicleId, { current_odometer: log.odometer });
    }

    return log;
  }

  public async updateFuelLog(id: number, data: Partial<FuelLog>): Promise<FuelLog> {
    const all = await this.getAllFromStore<FuelLog>(STORES.FUEL_LOGS);
    const existing = all.find((f) => f.id === id);
    const updated: FuelLog = {
      ...(existing || {} as any),
      ...data,
      id,
    };
    await this.putItem(STORES.FUEL_LOGS, updated);
    return updated;
  }

  public async deleteFuelLog(id: number): Promise<void> {
    await this.deleteItem(STORES.FUEL_LOGS, id);
  }

  // -------------------------------------------------------------
  // Maintenance Reminders / Plans
  // -------------------------------------------------------------
  public async getReminders(vehicleId: number): Promise<MaintenancePlan[]> {
    return this.getByVehicleId<MaintenancePlan>(STORES.REMINDERS, vehicleId);
  }

  public async createReminder(vehicleId: number, data: Partial<MaintenancePlan>): Promise<MaintenancePlan> {
    const nextId = data.id || (await this.getNextId(STORES.REMINDERS));
    const plan: MaintenancePlan = {
      id: nextId,
      vehicle_id: vehicleId,
      tracker_id: data.tracker_id || `custom_${Date.now()}`,
      title: data.title || 'Регламентная работа',
      category: data.category || 'general',
      description: data.description || '',
      brand: data.brand || '',
      spec: data.spec || '',
      article: data.article || '',
      icon: data.icon || 'wrench',
      interval_distance: data.interval_distance ?? 10000,
      interval_hours: data.interval_hours ?? null,
      interval_months: data.interval_months ?? 12,
      last_service_odometer: data.last_service_odometer ?? null,
      last_service_hours: data.last_service_hours ?? null,
      last_service_date: data.last_service_date ?? null,
      notify_before_distance: data.notify_before_distance ?? 1000,
      notify_before_hours: data.notify_before_hours ?? 20,
      notify_before_days: data.notify_before_days ?? 30,
      is_active: data.is_active ?? true,
      notes: data.notes || '',
    };
    await this.putItem(STORES.REMINDERS, plan);
    return plan;
  }

  public async updateReminder(id: number, data: Partial<MaintenancePlan>): Promise<MaintenancePlan> {
    const all = await this.getAllFromStore<MaintenancePlan>(STORES.REMINDERS);
    const existing = all.find((r) => r.id === id);
    const updated: MaintenancePlan = {
      ...(existing || {} as any),
      ...data,
      id,
    };
    await this.putItem(STORES.REMINDERS, updated);
    return updated;
  }

  public async deleteReminder(id: number): Promise<void> {
    await this.deleteItem(STORES.REMINDERS, id);
  }

  public async toggleReminder(id: number, is_active: boolean): Promise<MaintenancePlan> {
    return this.updateReminder(id, { is_active });
  }

  public async applyDefaultReminders(vehicleId: number): Promise<MaintenancePlan[]> {
    const defaults = [
      { title: 'Моторное масло и масляный фильтр', interval_distance: 8000, interval_months: 12, icon: 'droplet', category: 'engine' },
      { title: 'Салонный фильтр (кондиционера)', interval_distance: 10000, interval_months: 12, icon: 'wind', category: 'cabin' },
      { title: 'Воздушный фильтр двигателя', interval_distance: 15000, interval_months: 12, icon: 'filter', category: 'engine' },
      { title: 'Тормозная жидкость', interval_distance: 40000, interval_months: 24, icon: 'alert-triangle', category: 'brakes' },
      { title: 'Охлаждающая жидкость (антифриз)', interval_distance: 60000, interval_months: 36, icon: 'thermometer', category: 'cooling' },
      { title: 'Масло в коробке передач (КПП)', interval_distance: 50000, interval_months: 36, icon: 'settings', category: 'transmission' },
      { title: 'Свечи зажигания', interval_distance: 30000, interval_months: 24, icon: 'zap', category: 'ignition' },
    ];
    const created: MaintenancePlan[] = [];
    for (const d of defaults) {
      created.push(await this.createReminder(vehicleId, d));
    }
    return created;
  }

  public async markReminderDone(id: number, odo?: number, hours?: number): Promise<MaintenancePlan> {
    const all = await this.getAllFromStore<MaintenancePlan>(STORES.REMINDERS);
    const plan = all.find((r) => r.id === id);
    if (!plan) throw new Error('Регламент не найден');

    const v = await this.getVehicle(plan.vehicle_id);
    const currentOdo = odo !== undefined ? odo : v ? v.current_odometer : 0;
    const currentHours = hours !== undefined ? hours : v ? v.current_engine_hours : 0;

    return this.updateReminder(id, {
      last_service_odometer: currentOdo,
      last_service_hours: currentHours,
      last_service_date: new Date().toISOString().split('T')[0],
    });
  }

  // -------------------------------------------------------------
  // Tyres & TPMS
  // -------------------------------------------------------------
  public async getTyreSets(vehicleId: number): Promise<TyreSet[]> {
    return this.getByVehicleId<TyreSet>(STORES.TYRES, vehicleId);
  }

  public async createTyreSet(vehicleId: number, data: Partial<TyreSet>): Promise<TyreSet> {
    const nextId = data.id || (await this.getNextId(STORES.TYRES));
    const tyre: TyreSet = {
      id: nextId,
      vehicle_id: vehicleId,
      name: data.name || 'Комплект шин',
      season: data.season || 'summer',
      size: data.size || '',
      brand_model: data.brand_model || '',
      current_km: Number(data.current_km) || 0,
      tread_depth_mm: data.tread_depth_mm ?? 8.0,
      storage_location: data.storage_location || '',
      is_active: data.is_active ?? false,
      install_date: data.install_date || null,
      install_mileage: data.install_mileage || null,
      has_separate_rims: data.has_separate_rims ?? false,
      rims_brand_model: data.rims_brand_model || '',
      rims_size: data.rims_size || '',
      rims_price: Number(data.rims_price) || 0,
      tpms_sensors: data.tpms_sensors ?? false,
      tpms_has_sensors: data.tpms_has_sensors ?? false,
      tpms_frequency: data.tpms_frequency || '433 MHz',
      tpms_brand: data.tpms_brand || '',
      tpms_pressure_bar: Number(data.tpms_pressure_bar) || 2.2,
      tpms_fl_id: data.tpms_fl_id || '',
      tpms_fr_id: data.tpms_fr_id || '',
      tpms_rl_id: data.tpms_rl_id || '',
      tpms_rr_id: data.tpms_rr_id || '',
      quantity: Number(data.quantity) || 4,
      price_per_unit: Number(data.price_per_unit) || 0,
      total_price: Number(data.total_price) || 0,
    };
    await this.putItem(STORES.TYRES, tyre);
    return tyre;
  }

  public async updateTyreSet(id: number, data: Partial<TyreSet>): Promise<TyreSet> {
    const all = await this.getAllFromStore<TyreSet>(STORES.TYRES);
    const existing = all.find((t) => t.id === id);
    const updated: TyreSet = {
      ...(existing || {} as any),
      ...data,
      id,
    };
    await this.putItem(STORES.TYRES, updated);
    return updated;
  }

  public async deleteTyreSet(id: number): Promise<void> {
    await this.deleteItem(STORES.TYRES, id);
  }

  public async rotateTyreSet(id: number, payload: TyreRotatePayload): Promise<TyreSet> {
    const all = await this.getAllFromStore<TyreSet>(STORES.TYRES);
    const existing = all.find((t) => t.id === id);
    if (!existing) throw new Error('Комплект шин не найден');

    const updated: TyreSet = {
      ...existing,
      tpms_fl_id: payload.fl,
      tpms_fr_id: payload.fr,
      tpms_rl_id: payload.rl,
      tpms_rr_id: payload.rr,
    };
    await this.putItem(STORES.TYRES, updated);
    return updated;
  }

  // -------------------------------------------------------------
  // Documents & Insurances
  // -------------------------------------------------------------
  public async getDocuments(vehicleId: number): Promise<DocumentNote[]> {
    return this.getByVehicleId<DocumentNote>(STORES.DOCUMENTS, vehicleId);
  }

  public async createDocument(vehicleId: number, data: Partial<DocumentNote>): Promise<DocumentNote> {
    const nextId = data.id || (await this.getNextId(STORES.DOCUMENTS));
    const doc: DocumentNote = {
      id: nextId,
      vehicle_id: vehicleId,
      title: data.title || 'Документ',
      doc_type: data.doc_type || 'insurance',
      company: data.company || '',
      document_number: data.document_number || '',
      issue_date: data.issue_date || null,
      expiration_date: data.expiration_date || null,
      price: Number(data.price) || 0,
      mileage: data.mileage ? Number(data.mileage) : null,
      engine_hours: data.engine_hours ? Number(data.engine_hours) : null,
      is_active: data.is_active ?? true,
      notes: data.notes || '',
    };
    await this.putItem(STORES.DOCUMENTS, doc);
    return doc;
  }

  public async updateDocument(id: number, data: Partial<DocumentNote>): Promise<DocumentNote> {
    const all = await this.getAllFromStore<DocumentNote>(STORES.DOCUMENTS);
    const existing = all.find((d) => d.id === id);
    const updated: DocumentNote = {
      ...(existing || {} as any),
      ...data,
      id,
    };
    await this.putItem(STORES.DOCUMENTS, updated);
    return updated;
  }

  public async deleteDocument(id: number): Promise<void> {
    await this.deleteItem(STORES.DOCUMENTS, id);
  }

  // -------------------------------------------------------------
  // Consumables Passport
  // -------------------------------------------------------------
  public async getConsumables(vehicleId: number): Promise<VehicleConsumable[]> {
    const items = await this.getByVehicleId<VehicleConsumable>(STORES.CONSUMABLES, vehicleId);
    return items.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  public async createConsumable(vehicleId: number, data: Partial<VehicleConsumable>): Promise<VehicleConsumable> {
    const nextId = data.id || (await this.getNextId(STORES.CONSUMABLES));
    const item: VehicleConsumable = {
      id: nextId,
      vehicle_id: vehicleId,
      category: data.category || 'other',
      name: data.name || '',
      specification: data.specification || '',
      oem_part_number: data.oem_part_number || '',
      aftermarket_parts: data.aftermarket_parts || '',
      replacement_interval: data.replacement_interval || '',
      notes: data.notes || '',
      order_index: data.order_index ?? 0,
    };
    await this.putItem(STORES.CONSUMABLES, item);
    return item;
  }

  public async updateConsumable(id: number, data: Partial<VehicleConsumable>): Promise<VehicleConsumable> {
    const all = await this.getAllFromStore<VehicleConsumable>(STORES.CONSUMABLES);
    const existing = all.find((c) => c.id === id);
    const updated: VehicleConsumable = {
      ...(existing || {} as any),
      ...data,
      id,
    };
    await this.putItem(STORES.CONSUMABLES, updated);
    return updated;
  }

  public async deleteConsumable(id: number): Promise<void> {
    await this.deleteItem(STORES.CONSUMABLES, id);
  }

  public async prefillConsumablesTemplate(vehicleId: number): Promise<VehicleConsumable[]> {
    const templates = [
      { category: 'Моторное масло', name: 'Спецификация масла двигателя', specification: '5W-30 / 5W-40 ACEA A3/B4', replacement_interval: '8 000 - 10 000 км' },
      { category: 'Масляный фильтр', name: 'Фильтр очистки масла', oem_part_number: '', replacement_interval: 'С каждой заменой масла' },
      { category: 'Воздушный фильтр', name: 'Фильтр впускного тракта', oem_part_number: '', replacement_interval: '15 000 км' },
      { category: 'Салонный фильтр', name: 'Фильтр кондиционера / салона', oem_part_number: '', replacement_interval: '10 000 - 15 000 км' },
      { category: 'Тормозная жидкость', name: 'DOT 4 / DOT 4 Class 6', specification: 'DOT 4', replacement_interval: '2 года / 40 000 км' },
      { category: 'Охлаждающая жидкость', name: 'Антифриз (G12+ / G12++)', specification: 'G12+', replacement_interval: '3-5 лет / 60 000 км' },
      { category: 'Свечи зажигания', name: 'Иридиевые / платиновые свечи', oem_part_number: '', replacement_interval: '30 000 - 60 000 км' },
    ];
    const created: VehicleConsumable[] = [];
    for (let i = 0; i < templates.length; i++) {
      created.push(await this.createConsumable(vehicleId, { ...templates[i], order_index: i }));
    }
    return created;
  }

  // -------------------------------------------------------------
  // Vehicle Analytics
  // -------------------------------------------------------------
  public async getAnalytics(vehicleId: number): Promise<VehicleAnalytics> {
    const vehicle = await this.getVehicle(vehicleId);
    const services = await this.getServiceRecords(vehicleId);
    const fuel = await this.getFuelLogs(vehicleId);

    const total_service_cost = services.reduce((acc, s) => acc + (s.total_cost || 0), 0);
    const total_fuel_cost = fuel.reduce((acc, f) => acc + (f.total_cost || 0), 0);
    const total_expenses = total_service_cost + total_fuel_cost;

    const startOdo = vehicle?.starting_odometer || 0;
    const currentOdo = vehicle?.current_odometer || startOdo;
    const total_mileage = Math.max(0, currentOdo - startOdo);
    const cost_per_km = total_mileage > 0 ? total_expenses / total_mileage : 0;

    const total_fuel_liters = fuel.reduce((acc, f) => acc + (f.fuel_amount || 0), 0);
    const avg_fuel_consumption = total_mileage > 0 ? (total_fuel_liters / total_mileage) * 100 : null;

    return {
      total_expenses,
      total_service_cost,
      total_fuel_cost,
      total_mileage,
      cost_per_km,
      avg_fuel_consumption,
      monthly_expenses: [],
      category_breakdown: [],
    };
  }

  // -------------------------------------------------------------
  // Backup Import & Export Engine
  // -------------------------------------------------------------
  public async importBackup(data: any): Promise<{ success: boolean; vehicle_id: number; message: string }> {
    if (!data) throw new Error('Пустые данные бэкапа');

    let packages: any[] = [];
    if (Array.isArray(data.data) && data.data.length > 0) {
      packages = data.data;
    } else if (data.vehicle) {
      packages = [data];
    } else if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
      const flatVehicles = data.vehicles;
      const flatServices = data.services || data.service_records || [];
      const flatFuel = data.fuel || data.fuel_logs || [];
      const flatReminders = data.reminders || data.trackers || [];
      const flatTyres = data.tyres || data.tyre_sets || [];
      const flatDocs = data.documents || data.insurances || [];
      const flatConsumables = data.consumables || [];
      const single = flatVehicles.length === 1;

      for (const v of flatVehicles) {
        const vid = v.id;
        packages.push({
          vehicle: v,
          service_records: flatServices.filter((s: any) => single || s.vehicle_id === vid),
          fuel_logs: flatFuel.filter((f: any) => single || f.vehicle_id === vid),
          trackers: flatReminders.filter((r: any) => single || r.vehicle_id === vid),
          tyre_sets: flatTyres.filter((t: any) => single || t.vehicle_id === vid),
          documents: flatDocs.filter((d: any) => single || d.vehicle_id === vid),
          consumables: flatConsumables.filter((c: any) => single || c.vehicle_id === vid),
        });
      }
    } else if (data.make || data.model || data.name) {
      packages = [{ vehicle: data, trackers: data.trackers || data.reminders || [] }];
    } else {
      throw new Error('Некорректная структура файла бэкапа AutoTracker');
    }

    let firstVehicleId = 0;
    let importedVehiclesCount = 0;

    for (const pkg of packages) {
      const vData = pkg.vehicle || {};
      const newVehicle = await this.createVehicle({
        name: vData.name,
        make: vData.make || '',
        model: vData.model || '',
        year: vData.year ? Number(vData.year) : undefined,
        engine: vData.engine || '',
        license_plate: vData.license_plate || '',
        vin: vData.vin || '',
        starting_odometer: Number(vData.starting_odometer) || 0,
        current_odometer: Number(vData.current_odometer) || Number(vData.starting_odometer) || 0,
        current_engine_hours: Number(vData.current_engine_hours) || 0,
        track_engine_hours: !!vData.track_engine_hours,
        oil_spec: vData.oil_spec || '',
        distance_unit: vData.distance_unit || 'км',
        fuel_unit: vData.fuel_unit || 'л',
        currency: vData.currency || '₽',
        photo_url: vData.photo_url || '',
        notes: vData.notes || '',
        drive_type: vData.drive_type || 'fwd',
      });

      if (!firstVehicleId) firstVehicleId = newVehicle.id;
      importedVehiclesCount++;

      // 1. Service Records
      const sList = pkg.service_records || pkg.maintenance_records || [];
      for (const s of sList) {
        await this.createServiceRecord(newVehicle.id, {
          record_type: s.record_type || 'service',
          to_tag: s.to_tag || '',
          date: s.date ? s.date.split('T')[0] : new Date().toISOString().split('T')[0],
          odometer: Number(s.odometer) || 0,
          engine_hours: s.engine_hours ? Number(s.engine_hours) : null,
          title: s.title || 'Техническое обслуживание',
          description: s.description || '',
          cost_labor: Number(s.cost_labor) || 0,
          cost_parts: Number(s.cost_parts) || 0,
          store: s.store || '',
          url: s.url || '',
          notes: s.notes || '',
          items: s.items || [],
        });
      }

      // 2. Fuel Logs
      const fList = pkg.fuel_logs || pkg.fuel || [];
      for (const f of fList) {
        await this.createFuelLog(newVehicle.id, {
          date: f.date ? f.date.split('T')[0] : new Date().toISOString().split('T')[0],
          odometer: Number(f.odometer) || 0,
          fuel_amount: Number(f.fuel_amount) || 0,
          total_cost: Number(f.total_cost) || 0,
          unit_price: Number(f.unit_price) || 0,
          is_full_tank: f.is_full_tank ?? true,
          is_missed: f.is_missed ?? false,
          fuel_grade: f.fuel_grade || '',
          gas_station: f.gas_station || '',
          notes: f.notes || '',
        });
      }

      // 3. Maintenance Trackers / Reminders
      const rList = pkg.trackers || pkg.reminders || [];
      for (const r of rList) {
        await this.createReminder(newVehicle.id, {
          tracker_id: r.id || r.tracker_id || `tracker_${Date.now()}`,
          title: r.name || r.title || 'Регламент',
          category: r.category || 'general',
          brand: r.brand || '',
          spec: r.spec || '',
          article: r.article || '',
          icon: r.icon || 'wrench',
          interval_distance: r.interval_km ?? r.interval_distance ?? 10000,
          interval_hours: r.interval_hours ?? null,
          interval_months: r.interval_months ?? 12,
          last_service_odometer: r.last_service_odometer ?? null,
          last_service_hours: r.last_service_hours ?? null,
          last_service_date: r.last_service_date ? r.last_service_date.split('T')[0] : null,
          notify_before_distance: r.warn_km ?? r.notify_before_distance ?? 1000,
          notify_before_hours: r.warn_hours ?? r.notify_before_hours ?? 20,
          notify_before_days: r.warn_days ?? r.notify_before_days ?? 30,
          is_active: r.enabled ?? r.is_active ?? true,
          notes: r.notes || '',
        });
      }

      // 4. Tyre Sets
      const tList = pkg.tyre_sets || pkg.tyres || [];
      for (const t of tList) {
        await this.createTyreSet(newVehicle.id, {
          name: t.name || 'Комплект шин',
          season: t.season || 'summer',
          size: t.size || '',
          brand_model: t.brand_model || '',
          current_km: Number(t.current_km) || 0,
          tread_depth_mm: Number(t.tread_depth_mm) || 8.0,
          storage_location: t.storage_location || '',
          is_active: t.is_active ?? false,
          install_date: t.install_date ? t.install_date.split('T')[0] : null,
          install_mileage: t.install_mileage ? Number(t.install_mileage) : null,
          has_separate_rims: t.has_separate_rims ?? false,
          rims_brand_model: t.rims_brand_model || '',
          rims_size: t.rims_size || '',
          rims_price: Number(t.rims_price) || 0,
          tpms_sensors: t.tpms_sensors ?? false,
          tpms_has_sensors: t.tpms_has_sensors ?? false,
          tpms_frequency: t.tpms_frequency || '433 MHz',
          tpms_brand: t.tpms_brand || '',
          tpms_pressure_bar: Number(t.tpms_pressure_bar) || 2.2,
          tpms_fl_id: t.tpms_fl_id || '',
          tpms_fr_id: t.tpms_fr_id || '',
          tpms_rl_id: t.tpms_rl_id || '',
          tpms_rr_id: t.tpms_rr_id || '',
          quantity: Number(t.quantity) || 4,
          price_per_unit: Number(t.price_per_unit) || 0,
          total_price: Number(t.total_price) || 0,
        });
      }

      // 5. Documents
      const dList = pkg.documents || pkg.insurances || [];
      for (const d of dList) {
        await this.createDocument(newVehicle.id, {
          title: d.title || 'Документ',
          doc_type: d.doc_type || 'insurance',
          company: d.company || '',
          document_number: d.document_number || '',
          issue_date: d.issue_date ? d.issue_date.split('T')[0] : null,
          expiration_date: d.expiration_date ? d.expiration_date.split('T')[0] : null,
          price: Number(d.price) || 0,
          mileage: d.mileage ? Number(d.mileage) : null,
          engine_hours: d.engine_hours ? Number(d.engine_hours) : null,
          is_active: d.is_active ?? true,
          notes: d.notes || '',
        });
      }

      // 6. Consumables
      const cList = pkg.consumables || [];
      for (let i = 0; i < cList.length; i++) {
        await this.createConsumable(newVehicle.id, { ...cList[i], order_index: i });
      }
    }

    return {
      success: true,
      vehicle_id: firstVehicleId,
      message: `Успешно импортировано автомобилей: ${importedVehiclesCount}`,
    };
  }

  public async exportAllBackup(): Promise<string> {
    const vehicles = await this.getVehicles();
    const allData = [];

    for (const v of vehicles) {
      const services = await this.getServiceRecords(v.id);
      const fuel = await this.getFuelLogs(v.id);
      const reminders = await this.getReminders(v.id);
      const tyres = await this.getTyreSets(v.id);
      const docs = await this.getDocuments(v.id);
      const consumables = await this.getConsumables(v.id);

      allData.push({
        vehicle: v,
        service_records: services,
        fuel_logs: fuel,
        trackers: reminders.map((r) => ({
          id: r.tracker_id || String(r.id),
          name: r.title,
          category: r.category,
          brand: r.brand,
          spec: r.spec,
          article: r.article,
          icon: r.icon,
          interval_km: r.interval_distance,
          interval_hours: r.interval_hours,
          interval_months: r.interval_months,
          last_service_odometer: r.last_service_odometer,
          last_service_hours: r.last_service_hours,
          last_service_date: r.last_service_date,
          enabled: r.is_active,
          warn_km: r.notify_before_distance,
          warn_hours: r.notify_before_hours,
          warn_days: r.notify_before_days,
          notes: r.notes,
        })),
        tyre_sets: tyres,
        documents: docs,
        consumables: consumables,
      });
    }

    const payload = {
      version: '1.0',
      type: 'standalone_app_backup',
      exported_at: new Date().toISOString(),
      app: 'Бортовой Журнал Mobile',
      vehicles_count: allData.length,
      data: allData,
    };

    return JSON.stringify(payload, null, 2);
  }

  public async exportVehicleBackup(vehicleId: number): Promise<string> {
    const v = await this.getVehicle(vehicleId);
    if (!v) throw new Error(`Автомобиль #${vehicleId} не найден`);

    const services = await this.getServiceRecords(v.id);
    const fuel = await this.getFuelLogs(v.id);
    const reminders = await this.getReminders(v.id);
    const tyres = await this.getTyreSets(v.id);
    const docs = await this.getDocuments(v.id);
    const consumables = await this.getConsumables(v.id);

    const payload = {
      version: '1.0',
      app: 'Бортовой Журнал Mobile',
      exported_at: new Date().toISOString(),
      vehicle: v,
      service_records: services,
      fuel_logs: fuel,
      trackers: reminders.map((r) => ({
        id: r.tracker_id || String(r.id),
        name: r.title,
        category: r.category,
        brand: r.brand,
        spec: r.spec,
        article: r.article,
        icon: r.icon,
        interval_km: r.interval_distance,
        interval_hours: r.interval_hours,
        interval_months: r.interval_months,
        last_service_odometer: r.last_service_odometer,
        last_service_hours: r.last_service_hours,
        last_service_date: r.last_service_date,
        enabled: r.is_active,
        warn_km: r.notify_before_distance,
        warn_hours: r.notify_before_hours,
        warn_days: r.notify_before_days,
        notes: r.notes,
      })),
      tyre_sets: tyres,
      documents: docs,
      consumables: consumables,
    };

    return JSON.stringify(payload, null, 2);
  }
}

export const localDB = new LocalDatabaseEngine();
