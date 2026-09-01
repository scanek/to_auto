import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  DocumentNote,
  VehicleAnalytics,
  TyreSet,
  User,
  AdminUser,
  AuthResponse,
  SetupStatus,
} from '../types';
import { offlineStorage, QueuedAction } from './offlineStorage';

const API_BASE = '/api/v1';

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

      const res = await fetch(url, {
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

    const res = await fetch(url, {
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
  getSetupStatus: () =>
    request<SetupStatus>(`${API_BASE}/auth/setup-status`, undefined, {
      fallbackMock: () => ({ has_users: true, allow_registration: true }),
    }),
  getMe: () =>
    request<User>(`${API_BASE}/auth/me`, undefined, {
      cacheKey: 'current_user',
    }),
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

  // -------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------
  getVehicles: () =>
    request<Vehicle[]>(`${API_BASE}/vehicles`, undefined, {
      cacheKey: 'vehicles_list',
      fallbackMock: () => [],
    }),
  getAdminAllVehicles: () =>
    request<Vehicle[]>(`${API_BASE}/vehicles/admin/all`, undefined, {
      cacheKey: 'admin_vehicles_all',
    }),
  deleteAdminVehicle: (vehicleId: number) =>
    request<void>(`${API_BASE}/vehicles/admin/${vehicleId}`, {
      method: 'DELETE',
    }),
  getVehicle: (id: number) =>
    request<Vehicle>(`${API_BASE}/vehicles/${id}`, undefined, {
      cacheKey: `vehicle_${id}`,
    }),
  createVehicle: (data: Partial<Vehicle>) =>
    request<Vehicle>(
      `${API_BASE}/vehicles`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление автомобиля ${data.make || ''} ${data.model || ''}`,
        entityType: 'vehicle',
        fallbackMock: () => ({ id: Date.now(), ...data } as Vehicle),
      }
    ),
  updateVehicle: (id: number, data: Partial<Vehicle>) =>
    request<Vehicle>(
      `${API_BASE}/vehicles/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление автомобиля #${id}`,
        entityType: 'vehicle',
        fallbackMock: () => ({ id, ...data } as Vehicle),
      }
    ),
  deleteVehicle: (id: number) =>
    request<void>(
      `${API_BASE}/vehicles/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление автомобиля #${id}`,
        entityType: 'vehicle',
      }
    ),

  // -------------------------------------------------------------
  // Service Records
  // -------------------------------------------------------------
  getServiceRecords: (vehicleId: number, recordType?: string) => {
    const url = new URL(`${window.location.origin}${API_BASE}/service-records`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    if (recordType) url.searchParams.set('record_type', recordType);
    const key = `service_records_${vehicleId}_${recordType || 'all'}`;
    return request<ServiceRecord[]>(url.pathname + url.search, undefined, {
      cacheKey: key,
      fallbackMock: () => [],
    });
  },
  createServiceRecord: (vehicleId: number, data: Partial<ServiceRecord>) =>
    request<ServiceRecord>(
      `${API_BASE}/service-records?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Запись ТО: ${data.title || 'Обслуживание'}`,
        entityType: 'service',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as ServiceRecord),
      }
    ),
  updateServiceRecord: (id: number, data: Partial<ServiceRecord>) =>
    request<ServiceRecord>(
      `${API_BASE}/service-records/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление записи ТО #${id}`,
        entityType: 'service',
        fallbackMock: () => ({ id, ...data } as ServiceRecord),
      }
    ),
  deleteServiceRecord: (id: number) =>
    request<void>(
      `${API_BASE}/service-records/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление записи ТО #${id}`,
        entityType: 'service',
      }
    ),

  // -------------------------------------------------------------
  // Fuel Logs
  // -------------------------------------------------------------
  getFuelLogs: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/fuel-logs`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<FuelLog[]>(url.pathname + url.search, undefined, {
      cacheKey: `fuel_logs_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createFuelLog: (vehicleId: number, data: Partial<FuelLog>) =>
    request<FuelLog>(
      `${API_BASE}/fuel-logs?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Заправка ${data.fuel_amount || 0} л (${data.total_cost || 0} ₽)`,
        entityType: 'fuel',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as FuelLog),
      }
    ),
  updateFuelLog: (id: number, data: Partial<FuelLog>) =>
    request<FuelLog>(
      `${API_BASE}/fuel-logs/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление заправки #${id}`,
        entityType: 'fuel',
        fallbackMock: () => ({ id, ...data } as FuelLog),
      }
    ),
  deleteFuelLog: (id: number) =>
    request<void>(
      `${API_BASE}/fuel-logs/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление заправки #${id}`,
        entityType: 'fuel',
      }
    ),

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
  getDocuments: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/documents`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<DocumentNote[]>(url.pathname + url.search, undefined, {
      cacheKey: `documents_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createDocument: (vehicleId: number, data: Partial<DocumentNote>) =>
    request<DocumentNote>(
      `${API_BASE}/documents?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Документ: ${data.title || ''}`,
        entityType: 'document',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as DocumentNote),
      }
    ),
  updateDocument: (id: number, data: Partial<DocumentNote>) =>
    request<DocumentNote>(
      `${API_BASE}/documents/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление документа #${id}`,
        entityType: 'document',
        fallbackMock: () => ({ id, ...data } as DocumentNote),
      }
    ),
  deleteDocument: (id: number) =>
    request<void>(
      `${API_BASE}/documents/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление документа #${id}`,
        entityType: 'document',
      }
    ),

  // -------------------------------------------------------------
  // Tyres & Wheels
  // -------------------------------------------------------------
  getTyreSets: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/tyres`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<TyreSet[]>(url.pathname + url.search, undefined, {
      cacheKey: `tyres_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createTyreSet: (vehicleId: number, data: Partial<TyreSet>) =>
    request<TyreSet>(
      `${API_BASE}/tyres?vehicle_id=${vehicleId}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Комплект шин: ${data.name || ''}`,
        entityType: 'tyre',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as TyreSet),
      }
    ),
  updateTyreSet: (id: number, data: Partial<TyreSet>) =>
    request<TyreSet>(
      `${API_BASE}/tyres/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление комплекта шин #${id}`,
        entityType: 'tyre',
        fallbackMock: () => ({ id, ...data } as TyreSet),
      }
    ),
  deleteTyreSet: (id: number) =>
    request<void>(
      `${API_BASE}/tyres/${id}`,
      { method: 'DELETE' },
      {
        description: `Удаление комплекта шин #${id}`,
        entityType: 'tyre',
      }
    ),
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
  importBackup: (data: any) =>
    request<{ message: string; vehicle_id: number }>(`${API_BASE}/backup/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  exportVehicleBackupUrl: (vehicleId: number) => {
    const token = getAuthToken();
    return `${API_BASE}/backup/export/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportAllBackupUrl: () => {
    const token = getAuthToken();
    return `${API_BASE}/backup/export-all${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportServiceBookletUrl: (vehicleId: number) => {
    const token = getAuthToken();
    return `${API_BASE}/export/service-booklet/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  exportExcelUrl: (vehicleId: number) => {
    const token = getAuthToken();
    return `${API_BASE}/export/excel/${vehicleId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

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
    data: { login: string; password?: string; app_code?: string; app_id?: string; secret?: string; sms_code?: string }
  ) =>
    request<{ status: string; user_id: string; token: string; devices: any[]; message: string }>(
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

  disconnectTelematics: (vehicleId: number) =>
    request<{ status: string; message: string }>(
      `${API_BASE}/telematics/${vehicleId}/disconnect`,
      {
        method: 'DELETE',
      }
    ),
};
