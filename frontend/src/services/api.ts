import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  DocumentNote,
  VehicleAnalytics,
  TyreSet,
  TyreRotatePayload,
  PublicBookletData,
  VehicleConsumable,
  User,
  AdminUser,
  VinDecodeResult,
  AuthResponse,
  SetupStatus,
} from '../types';
import { offlineStorage, QueuedAction } from './offlineStorage';
import { localDB } from './localDatabase';
import { Capacitor } from '@capacitor/core';

export const isNativeApp = (): boolean => {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
};

export const getApiBase = (): string => {
  const custom = localDB.getServerUrl();
  if (custom && !localDB.isStandalone()) {
    return `${custom}/api/v1`;
  }
  return '/api/v1';
};

const API_BASE = {
  toString: () => getApiBase(),
};

export function getAuthToken(): string | null {
  return localStorage.getItem('autotracker_admin_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('autotracker_admin_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('autotracker_admin_token');
}

/**
 * Enhanced request with timeout and offline-first fallback.
 */
async function request<T>(
  url: string,
  options?: RequestInit,
  offlineConfig?: {
    cacheKey?: string;
    description?: string;
    entityType?: QueuedAction['entityType'];
    fallbackMock?: () => T;
  }
): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isGet = method === 'GET';
  const cacheKey = offlineConfig?.cacheKey || url;

  // 1. If GET request: Try network first, fallback to offline cache
  if (isGet) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      let fetchUrl = url;
      const srvUrl = localDB.getServerUrl();
      if (srvUrl && !localDB.isStandalone() && url.startsWith('/api/v1')) {
        fetchUrl = `${srvUrl}${url}`;
      }

      const res = await fetch(fetchUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.detail) {
            errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch {}
        throw new Error(errorMsg);
      }

      offlineStorage.setOnline(true);
      const data: T = await res.json();
      await offlineStorage.setCache(cacheKey, data);
      return data;
    } catch (err: any) {
      const isNetworkError =
        !navigator.onLine ||
        err.name === 'AbortError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError');

      if (isNetworkError) {
        console.warn(`[Offline Mode] Network request failed for ${url}, reading from offline cache...`, err);
        offlineStorage.setOnline(false);
        const cached = await offlineStorage.getCache<T>(cacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }
        if (offlineConfig?.fallbackMock) {
          return offlineConfig.fallbackMock();
        }
      }
      throw err;
    }
  }

  // 2. If mutating request (POST, PUT, DELETE): Try network, enqueue on offline
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let postFetchUrl = url;
    const postSrvUrl = localDB.getServerUrl();
    if (postSrvUrl && !localDB.isStandalone() && url.startsWith('/api/v1')) {
      postFetchUrl = `${postSrvUrl}${url}`;
    }

    const res = await fetch(postFetchUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        const errorBody = await res.text();
        if (errorBody) errorMsg = errorBody;
      }
      throw new Error(errorMsg);
    }

    offlineStorage.setOnline(true);

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  } catch (err: any) {
    // If it's a network/connection error, enqueue for background sync
    const isNetworkError =
      !navigator.onLine ||
      err.name === 'AbortError' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError') ||
      err.message?.includes('Network request failed');

    if (isNetworkError) {
      console.warn(`[Offline Mode] Connection lost. Enqueueing ${method} ${url} for background sync.`);
      offlineStorage.setOnline(false);

      const bodyData = options?.body ? JSON.parse(options.body as string) : undefined;
      await offlineStorage.enqueueAction({
        method: method as any,
        url,
        body: bodyData,
        description: offlineConfig?.description || `${method} ${url}`,
        entityType: offlineConfig?.entityType,
      });

      // Optimistic simulated mock return
      if (offlineConfig?.fallbackMock) {
        return offlineConfig.fallbackMock();
      }
      return (bodyData || { id: Date.now(), ...bodyData }) as T;
    }

    throw err;
  }
}

export const api = {
  // -------------------------------------------------------------
  // Auth & Permissions
  // -------------------------------------------------------------
  getSetupStatus: async () => {
    if (localDB.isStandalone()) {
      return { has_users: true, allow_registration: false };
    }
    return request<SetupStatus>(`${API_BASE}/auth/setup-status`, undefined, {
      fallbackMock: () => ({ has_users: true, allow_registration: true }),
    });
  },
  getMe: async () => {
    if (localDB.isStandalone()) {
      return {
        id: 1,
        username: 'standalone_user',
        full_name: 'Пользователь (Офлайн)',
        role: 'admin' as const,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return request<User>(`${API_BASE}/auth/me`, undefined, {
      cacheKey: 'current_user',
    });
  },
  register: (data: { username: string; email?: string; password: string; full_name?: string }) =>
    request<AuthResponse>(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (data: { username: string; password: string }) =>
    request<AuthResponse>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  changePassword: (data: { old_password: string; new_password: string }) =>
    request<{ message: string }>(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteMe: () =>
    request<{ message: string }>(`${API_BASE}/auth/me`, {
      method: 'DELETE',
    }),
  getAdminUsers: () =>
    request<AdminUser[]>(`${API_BASE}/auth/users`, undefined, {
      cacheKey: 'admin_users_list',
    }),
  deleteAdminUser: (userId: number) =>
    request<{ message: string }>(`${API_BASE}/auth/users/${userId}`, {
      method: 'DELETE',
    }),
  forgotPassword: (identifier: string) =>
    request<{
      status: string;
      channel: 'telegram' | 'telegram_bot_link' | 'email' | 'admin_only';
      message: string;
      bot_url?: string;
      masked_destination?: string;
    }>(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),
  resetPassword: (data: { identifier: string; code: string; new_password: string }) =>
    request<AuthResponse>(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adminResetPassword: (userId: number, new_password: string) =>
    request<{ status: string; message: string }>(`${API_BASE}/auth/admin/reset-password/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),
  adminUnlinkTelegram: (userId: number) =>
    request<{ status: string; message: string }>(`${API_BASE}/auth/admin/unlink-telegram/${userId}`, {
      method: 'POST',
    }),

  // -------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------
  decodeVin: (vin: string) =>
    request<VinDecodeResult>(`${API_BASE}/vehicles/decode-vin/${encodeURIComponent(vin)}`),
  getVehicles: async () => {
    if (localDB.isStandalone()) {
      return localDB.getVehicles();
    }
    return request<Vehicle[]>(`${API_BASE}/vehicles`, undefined, {
      cacheKey: 'vehicles_list',
      fallbackMock: () => localDB.getVehicles(),
    });
  },
  getAdminAllVehicles: async () => {
    if (localDB.isStandalone()) {
      return localDB.getVehicles();
    }
    return request<Vehicle[]>(`${API_BASE}/vehicles/admin/all`, undefined, {
      cacheKey: 'admin_vehicles_all',
      fallbackMock: () => localDB.getVehicles(),
    });
  },
  deleteAdminVehicle: async (vehicleId: number) => {
    if (localDB.isStandalone()) {
      return localDB.deleteVehicle(vehicleId);
    }
    return request<void>(`${API_BASE}/vehicles/admin/${vehicleId}`, {
      method: 'DELETE',
    });
  },
  getVehicle: async (id: number) => {
    if (localDB.isStandalone()) {
      const v = await localDB.getVehicle(id);
      if (!v) throw new Error('Автомобиль не найден');
      return v;
    }
    return request<Vehicle>(`${API_BASE}/vehicles/${id}`, undefined, {
      cacheKey: `vehicle_${id}`,
      fallbackMock: async () => {
        const v = await localDB.getVehicle(id);
        if (!v) throw new Error('Автомобиль не найден');
        return v;
      },
    });
  },
  createVehicle: async (data: Partial<Vehicle>) => {
    if (localDB.isStandalone()) {
      return localDB.createVehicle(data);
    }
    const res = await request<Vehicle>(
      `${API_BASE}/vehicles`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление автомобиля ${data.make || ''} ${data.model || ''}`,
        entityType: 'vehicle',
        fallbackMock: () => localDB.createVehicle(data),
      }
    );
    await localDB.createVehicle(res).catch(() => {});
    return res;
  },
  updateVehicle: async (id: number, data: Partial<Vehicle>) => {
    if (localDB.isStandalone()) {
      return localDB.updateVehicle(id, data);
    }
    const res = await request<Vehicle>(
      `${API_BASE}/vehicles/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление автомобиля #${id}`,
        entityType: 'vehicle',
        fallbackMock: () => localDB.updateVehicle(id, data),
      }
    );
    await localDB.updateVehicle(id, data).catch(() => {});
    return res;
  },
  deleteVehicle: async (id: number) => {
    if (localDB.isStandalone()) {
      return localDB.deleteVehicle(id);
    }
    await request<void>(
      `${API_BASE}/vehicles/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление автомобиля #${id}`,
        entityType: 'vehicle',
      }
    );
    await localDB.deleteVehicle(id).catch(() => {});
  },

  // -------------------------------------------------------------
  // Service Records
  // -------------------------------------------------------------
  getServiceRecords: async (vehicleId: number, recordType?: string) => {
    if (localDB.isStandalone()) {
      return localDB.getServiceRecords(vehicleId, recordType);
    }
    const query = recordType ? `?vehicle_id=${vehicleId}&record_type=${encodeURIComponent(recordType)}` : `?vehicle_id=${vehicleId}`;
    return request<ServiceRecord[]>(`${API_BASE}/service-records${query}`, undefined, {
      cacheKey: `service_records_${vehicleId}_${recordType || 'all'}`,
      fallbackMock: () => localDB.getServiceRecords(vehicleId, recordType),
    });
  },
  createServiceRecord: async (vehicleId: number, data: Partial<ServiceRecord>) => {
    if (localDB.isStandalone()) {
      return localDB.createServiceRecord(vehicleId, data);
    }
    const res = await request<ServiceRecord>(
      `${API_BASE}/service-records?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Запись ТО: ${data.title || 'Обслуживание'}`,
        entityType: 'service',
        fallbackMock: () => localDB.createServiceRecord(vehicleId, data),
      }
    );
    await localDB.createServiceRecord(vehicleId, res).catch(() => {});
    return res;
  },
  updateServiceRecord: async (id: number, data: Partial<ServiceRecord>) => {
    if (localDB.isStandalone()) {
      return localDB.updateServiceRecord(id, data);
    }
    const res = await request<ServiceRecord>(
      `${API_BASE}/service-records/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление записи ТО #${id}`,
        entityType: 'service',
        fallbackMock: () => localDB.updateServiceRecord(id, data),
      }
    );
    await localDB.updateServiceRecord(id, data).catch(() => {});
    return res;
  },
  deleteServiceRecord: async (id: number) => {
    if (localDB.isStandalone()) {
      return localDB.deleteServiceRecord(id);
    }
    await request<void>(
      `${API_BASE}/service-records/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление записи ТО #${id}`,
        entityType: 'service',
      }
    );
    await localDB.deleteServiceRecord(id).catch(() => {});
  },

  // -------------------------------------------------------------
  // Fuel Logs
  // -------------------------------------------------------------
  getFuelLogs: async (vehicleId: number) => {
    if (localDB.isStandalone()) {
      return localDB.getFuelLogs(vehicleId);
    }
    return request<FuelLog[]>(`${API_BASE}/fuel-logs?vehicle_id=${vehicleId}`, undefined, {
      cacheKey: `fuel_logs_${vehicleId}`,
      fallbackMock: () => localDB.getFuelLogs(vehicleId),
    });
  },
  createFuelLog: async (vehicleId: number, data: Partial<FuelLog>) => {
    if (localDB.isStandalone()) {
      return localDB.createFuelLog(vehicleId, data);
    }
    const res = await request<FuelLog>(
      `${API_BASE}/fuel-logs?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Заправка ${data.fuel_amount || 0} л (${data.total_cost || 0} ₽)`,
        entityType: 'fuel',
        fallbackMock: () => localDB.createFuelLog(vehicleId, data),
      }
    );
    await localDB.createFuelLog(vehicleId, res).catch(() => {});
    return res;
  },
  updateFuelLog: async (id: number, data: Partial<FuelLog>) => {
    if (localDB.isStandalone()) {
      return localDB.updateFuelLog(id, data);
    }
    const res = await request<FuelLog>(
      `${API_BASE}/fuel-logs/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление заправки #${id}`,
        entityType: 'fuel',
        fallbackMock: () => localDB.updateFuelLog(id, data),
      }
    );
    await localDB.updateFuelLog(id, data).catch(() => {});
    return res;
  },
  deleteFuelLog: async (id: number) => {
    if (localDB.isStandalone()) {
      return localDB.deleteFuelLog(id);
    }
    await request<void>(
      `${API_BASE}/fuel-logs/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление заправки #${id}`,
        entityType: 'fuel',
      }
    );
    await localDB.deleteFuelLog(id).catch(() => {});
  },

  // -------------------------------------------------------------
  // Reminders / Maintenance Planner
  // -------------------------------------------------------------
  getReminders: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/reminders`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<MaintenancePlan[]>(url.pathname + url.search, undefined, {
      cacheKey: `reminders_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createReminder: (vehicleId: number, data: Partial<MaintenancePlan>) =>
    request<MaintenancePlan>(
      `${API_BASE}/reminders?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Регламент: ${data.title || ''}`,
        entityType: 'reminder',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as MaintenancePlan),
      }
    ),
  updateReminder: (id: number, data: Partial<MaintenancePlan>) =>
    request<MaintenancePlan>(
      `${API_BASE}/reminders/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление регламента #${id}`,
        entityType: 'reminder',
        fallbackMock: () => ({ id, ...data } as MaintenancePlan),
      }
    ),
  deleteReminder: (id: number) =>
    request<void>(
      `${API_BASE}/reminders/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление регламента #${id}`,
        entityType: 'reminder',
      }
    ),
  applyDefaultReminders: (vehicleId: number) =>
    request<MaintenancePlan[]>(
      `${API_BASE}/reminders/apply-default-pack?vehicle_id=${vehicleId}`,
      { method: 'POST' }
    ),
  markReminderDone: (id: number, odo?: number, hours?: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/reminders/${id}/mark-done`);
    if (odo !== undefined) url.searchParams.set('odometer', String(odo));
    if (hours !== undefined) url.searchParams.set('hours', String(hours));
    return request<MaintenancePlan>(
      url.pathname + url.search,
      { method: 'POST' },
      {
        description: `Выполнение регламента #${id}`,
        entityType: 'reminder',
      }
    );
  },

  // -------------------------------------------------------------
  // Documents & Insurance
  // -------------------------------------------------------------
  getDocuments: async (vehicleId: number) => {
    if (localDB.isStandalone()) {
      return localDB.getDocuments(vehicleId);
    }
    return request<DocumentNote[]>(`${API_BASE}/documents?vehicle_id=${vehicleId}`, undefined, {
      cacheKey: `documents_${vehicleId}`,
      fallbackMock: () => localDB.getDocuments(vehicleId),
    });
  },
  createDocument: async (vehicleId: number, data: Partial<DocumentNote>) => {
    if (localDB.isStandalone()) {
      return localDB.createDocument(vehicleId, data);
    }
    const res = await request<DocumentNote>(
      `${API_BASE}/documents?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Документ: ${data.title || ''}`,
        entityType: 'document',
        fallbackMock: () => localDB.createDocument(vehicleId, data),
      }
    );
    await localDB.createDocument(vehicleId, res).catch(() => {});
    return res;
  },
  updateDocument: async (id: number, data: Partial<DocumentNote>) => {
    if (localDB.isStandalone()) {
      return localDB.updateDocument(id, data);
    }
    const res = await request<DocumentNote>(
      `${API_BASE}/documents/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление документа #${id}`,
        entityType: 'document',
        fallbackMock: () => localDB.updateDocument(id, data),
      }
    );
    await localDB.updateDocument(id, data).catch(() => {});
    return res;
  },
  deleteDocument: async (id: number) => {
    if (localDB.isStandalone()) {
      return localDB.deleteDocument(id);
    }
    await request<void>(
      `${API_BASE}/documents/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление документа #${id}`,
        entityType: 'document',
      }
    );
    await localDB.deleteDocument(id).catch(() => {});
  },

  // -------------------------------------------------------------
  // Tyres & Wheels
  // -------------------------------------------------------------
  getTyreSets: async (vehicleId: number) => {
    if (localDB.isStandalone()) {
      return localDB.getTyreSets(vehicleId);
    }
    return request<TyreSet[]>(`${API_BASE}/tyres?vehicle_id=${vehicleId}`, undefined, {
      cacheKey: `tyres_${vehicleId}`,
      fallbackMock: () => localDB.getTyreSets(vehicleId),
    });
  },
  createTyreSet: async (vehicleId: number, data: Partial<TyreSet>) => {
    if (localDB.isStandalone()) {
      return localDB.createTyreSet(vehicleId, data);
    }
    const res = await request<TyreSet>(
      `${API_BASE}/tyres?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Комплект шин: ${data.name || ''}`,
        entityType: 'tyre',
        fallbackMock: () => localDB.createTyreSet(vehicleId, data),
      }
    );
    await localDB.createTyreSet(vehicleId, res).catch(() => {});
    return res;
  },
  updateTyreSet: async (id: number, data: Partial<TyreSet>) => {
    if (localDB.isStandalone()) {
      return localDB.updateTyreSet(id, data);
    }
    const res = await request<TyreSet>(
      `${API_BASE}/tyres/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление комплекта шин #${id}`,
        entityType: 'tyre',
        fallbackMock: () => localDB.updateTyreSet(id, data),
      }
    );
    await localDB.updateTyreSet(id, data).catch(() => {});
    return res;
  },
  deleteTyreSet: async (id: number) => {
    if (localDB.isStandalone()) {
      return localDB.deleteTyreSet(id);
    }
    await request<void>(
      `${API_BASE}/tyres/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление комплекта шин #${id}`,
        entityType: 'tyre',
      }
    );
    await localDB.deleteTyreSet(id).catch(() => {});
  },
  activateTyreSet: (id: number, mileage?: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/tyres/${id}/activate`);
    if (mileage !== undefined) url.searchParams.set('mileage', String(mileage));
    return request<TyreSet>(
      url.pathname + url.search,
      { method: 'POST' },
      {
        description: `Смена комплекта шин #${id}`,
        entityType: 'tyre',
      }
    );
  },
  rotateTyreSet: (id: number, payload: TyreRotatePayload) =>
    request<TyreSet>(
      `${API_BASE}/tyres/${id}/rotate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        description: `Ротация шин #${id}`,
        entityType: 'tyre',
      }
    ),

  // -------------------------------------------------------------
  // Consumables & Specifications (Шпаргалка ТО)
  // -------------------------------------------------------------
  getConsumables: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/consumables`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<VehicleConsumable[]>(url.pathname + url.search, undefined, {
      cacheKey: `consumables_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createConsumable: (vehicleId: number, data: Partial<VehicleConsumable>) =>
    request<VehicleConsumable>(
      `${API_BASE}/consumables?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление расходника: ${data.name || 'Расходник'}`,
        entityType: 'other',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as VehicleConsumable),
      }
    ),
  prefillConsumablesTemplate: (vehicleId: number) =>
    request<VehicleConsumable[]>(
      `${API_BASE}/consumables/template?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
      },
      {
        description: `Заполнение стандартного шаблона расходников`,
        entityType: 'other',
        fallbackMock: () => [],
      }
    ),
  updateConsumable: (id: number, data: Partial<VehicleConsumable>) =>
    request<VehicleConsumable>(
      `${API_BASE}/consumables/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление расходника #${id}`,
        entityType: 'other',
        fallbackMock: () => ({ id, ...data } as VehicleConsumable),
      }
    ),
  deleteConsumable: (id: number) =>
    request<void>(
      `${API_BASE}/consumables/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление расходника #${id}`,
        entityType: 'other',
      }
    ),

  // -------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------
  getAnalytics: (vehicleId: number) =>
    request<VehicleAnalytics>(`${API_BASE}/analytics/${vehicleId}`, undefined, {
      cacheKey: `analytics_${vehicleId}`,
      fallbackMock: () => ({
        vehicle_id: vehicleId,
        total_distance_tracked: 0,
        total_spend: 0,
        total_service_spend: 0,
        total_repair_spend: 0,
        total_upgrade_spend: 0,
        total_fuel_spend: 0,
        total_tyre_spend: 0,
        total_document_spend: 0,
        cost_per_distance_unit: 0,
        avg_fuel_consumption: null,
        avg_fuel_price: null,
        total_fuel_liters: 0,
        categories: [],
        monthly_costs: [],
        fuel_trend: [],
      }),
    }),

  // -------------------------------------------------------------
  // File Upload
  // -------------------------------------------------------------
  uploadFile: async (
    file: File,
    params?: {
      vehicleId?: number;
      serviceRecordId?: number;
      fuelLogId?: number;
      documentId?: number;
    }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = new URL(`${window.location.origin}${API_BASE}/uploads`);
    if (params?.vehicleId) url.searchParams.set('vehicle_id', String(params.vehicleId));
    if (params?.serviceRecordId)
      url.searchParams.set('service_record_id', String(params.serviceRecordId));
    if (params?.fuelLogId) url.searchParams.set('fuel_log_id', String(params.fuelLogId));
    if (params?.documentId) url.searchParams.set('document_id', String(params.documentId));

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url.pathname + url.search, {
      method: 'POST',
      body: formData,
      headers,
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }
    return res.json();
  },
  uploadPhoto: (file: File) => api.uploadFile(file),

  // -------------------------------------------------------------
  // Backup & Export
  // -------------------------------------------------------------
  importBackup: async (data: any) => {
    if (localDB.isStandalone()) {
      return localDB.importBackup(data);
    }
    try {
      const res = await request<{ message: string; vehicle_id: number }>(`${API_BASE}/backup/import`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await localDB.importBackup(data).catch(() => {});
      return res;
    } catch (err) {
      console.warn('Network import failed, importing locally into offline database...', err);
      return localDB.importBackup(data);
    }
  },
  exportVehicleBackupUrl: (vehicleId: number) => {
    const token = getAuthToken();
    return `${API_BASE}/backup/export/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportMyGarageBackupUrl: () => {
    const token = getAuthToken();
    return `${API_BASE}/backup/export-all?scope=mine${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  },
  exportAllBackupUrl: () => {
    const token = getAuthToken();
    return `${API_BASE}/backup/export-all${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportDatabaseUrl: () => {
    const token = getAuthToken();
    return `${API_BASE}/backup/database${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportServiceBookletUrl: (vehicleId: number) => {
    const token = getAuthToken();
    return `${API_BASE}/export/service-booklet/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportExcelUrl: (vehicleId: number) => {
    const token = getAuthToken();
    return `${API_BASE}/export/excel/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  downloadServiceBooklet: async (vehicleId: number) => {
    try {
      const ticketRes = await request<{ ticket: string }>(`${API_BASE}/export/ticket/${vehicleId}`, { method: 'POST' });
      window.open(`${API_BASE}/export/service-booklet/${vehicleId}?ticket=${encodeURIComponent(ticketRes.ticket)}`, '_blank');
    } catch {
      const token = getAuthToken();
      window.open(`${API_BASE}/export/service-booklet/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
    }
  },
  downloadExcelFile: async (vehicleId: number) => {
    try {
      const ticketRes = await request<{ ticket: string }>(`${API_BASE}/export/ticket/${vehicleId}`, { method: 'POST' });
      window.location.href = `${API_BASE}/export/excel/${vehicleId}?ticket=${encodeURIComponent(ticketRes.ticket)}`;
    } catch {
      const token = getAuthToken();
      window.location.href = `${API_BASE}/export/excel/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    }
  },

  // -------------------------------------------------------------
  // Public Digital Service Booklet
  // -------------------------------------------------------------
  getPublicBooklet: (token: string) =>
    request<PublicBookletData>(`${API_BASE}/public/booklet/${token}`),
  updatePublicBookletSettings: (
    vehicleId: number,
    settings: { enabled: boolean; show_costs: boolean; regenerate_token?: boolean }
  ) =>
    request<{ enabled: boolean; show_costs: boolean; public_token: string }>(
      `${API_BASE}/vehicles/${vehicleId}/public-booklet`,
      {
        method: 'POST',
        body: JSON.stringify(settings),
      }
    ),

  // -------------------------------------------------------------
  // Synchronize Offline Queue
  // -------------------------------------------------------------
  syncOfflineQueue: async (): Promise<{ processed: number; failed: number }> => {
    const token = getAuthToken();

    return await offlineStorage.processSyncQueue(async (action) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(action.url, {
        method: action.method,
        headers,
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      if (!res.ok && res.status !== 404) {
        return false;
      }
      return true;
    });
  },
  // --- Telematics & StarLine S96 API ---
  authStarLine: (
    vehicleId: number,
    data: { login: string; password?: string; app_code?: string; app_id?: string; secret?: string; sms_code?: string; captcha_sid?: string; captcha_code?: string }
  ) =>
    request<{ status: string; user_id: string; token: string; devices: any[]; message: string; captcha_sid?: string; captcha_img?: string }>(
      `${API_BASE}/telematics/${vehicleId}/starline/auth`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  connectStarLine: (
    vehicleId: number,
    data: { login: string; token: string; user_id: string; device_id: string; device_alias?: string; auto_sync: boolean }
  ) =>
    request<{ status: string; message: string; sync?: any }>(
      `${API_BASE}/telematics/${vehicleId}/starline/connect`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  syncTelematics: (vehicleId: number) =>
    request<{ status: string; data: any; message: string }>(
      `${API_BASE}/telematics/${vehicleId}/sync`,
      {
        method: 'POST',
      }
    ),

  executeTelematicsCommand: (vehicleId: number, command: string) =>
    request<{ status: string; command: string; message: string }>(
      `${API_BASE}/telematics/${vehicleId}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ command }),
      }
    ),

  disconnectTelematics: (vehicleId: number) =>
    request<{ status: string; message: string }>(
      `${API_BASE}/telematics/${vehicleId}/disconnect`,
      {
        method: 'DELETE',
      }
    ),

  updateTelematicsSettings: (
    vehicleId: number,
    data: { auto_sync_interval_minutes: number; auto_sync?: boolean }
  ) =>
    request<{ status: string; message: string; starline_auto_sync_interval_minutes: number; telematics_auto_sync: boolean }>(
      `${API_BASE}/telematics/${vehicleId}/settings`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),

  // -------------------------------------------------------------
  // System Announcements (Admin)
  // -------------------------------------------------------------
  getSystemAnnouncement: () =>
    request<import('../types').SystemAnnouncement>(`${API_BASE}/auth/announcement`, undefined, {
      fallbackMock: () => ({ is_active: false, title: 'Технические работы', text: '', type: 'warning' }),
    }),

  updateSystemAnnouncement: (data: Partial<import('../types').SystemAnnouncement>) =>
    request<{ status: string; message: string; data: import('../types').SystemAnnouncement }>(
      `${API_BASE}/auth/announcement`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),

  // -------------------------------------------------------------
  // Telegram Bot Integration
  // -------------------------------------------------------------
  getTelegramStatus: () =>
    request<import('../types').TelegramStatus>(`${API_BASE}/telegram/status`),

  unlinkTelegram: () =>
    request<{ message: string }>(`${API_BASE}/telegram/unlink`, {
      method: 'POST',
    }),

  sendTelegramTestMessage: () =>
    request<{ message: string }>(`${API_BASE}/telegram/test-message`, {
      method: 'POST',
    }),

  updateTelegramSettings: (data: Partial<import('../types').TelegramStatus>) =>
    request<{ message: string }>(`${API_BASE}/telegram/settings`, {
      method: 'PUT',
      body: JSON.stringify({
        telegram_notifications_enabled: data.notifications_enabled,
        telegram_notify_reminders: data.notify_reminders,
        telegram_notify_battery: data.notify_battery,
        telegram_notify_documents: data.notify_documents,
      }),
    }),

  getTelegramBotConfig: () =>
    request<import('../types').TelegramBotConfig>(`${API_BASE}/telegram/bot-config`),

  updateTelegramBotConfig: (bot_token: string) =>
    request<{ message: string; bot_username: string; bot_name?: string; is_active: boolean }>(
      `${API_BASE}/telegram/bot-config`,
      {
        method: 'PUT',
        body: JSON.stringify({ bot_token }),
      }
    ),

  resetTelegramBotConfig: () =>
    request<{ message: string; bot_username: string }>(`${API_BASE}/telegram/bot-config`, {
      method: 'DELETE',
    }),

  scanReceipt: async (file: File, apiKey?: string, vehicleId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (apiKey) formData.append('api_key', apiKey);
    if (vehicleId) formData.append('vehicle_id', String(vehicleId));

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/ocr/scan`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Ошибка распознавания документа' }));
      throw new Error(err.detail || 'Не удалось распознать документ');
    }

    return res.json() as Promise<{ success: boolean; data: any }>;
  },
};

export { localDB };
