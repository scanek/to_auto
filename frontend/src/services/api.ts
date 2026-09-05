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
import { localDb } from './localDatabase';

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

      const data = await res.json();
      await offlineStorage.setCache(cacheKey, data);
      offlineStorage.setOnline(true);
      return data as T;
    } catch (err: any) {
      console.warn(`[Offline Mode] Network failed for GET ${url}. Reading from cache...`, err?.message);
      offlineStorage.setOnline(false);

      const cached = await offlineStorage.getCache<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      if (offlineConfig?.fallbackMock) {
        return offlineConfig.fallbackMock();
      }

      throw err;
    }
  }

  // 2. If mutating request (POST, PUT, DELETE)
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
      } catch {}
      throw new Error(errorMsg);
    }

    offlineStorage.setOnline(true);
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return {} as T;
  } catch (err: any) {
    const isNetworkError =
      !navigator.onLine ||
      err?.name === 'AbortError' ||
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError');

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
  // Mode & Database Access
  // -------------------------------------------------------------
  isStandalone: () => localDb.isStandaloneMode(),
  setStandalone: (val: boolean) => localDb.setAppMode(val ? 'standalone' : 'server'),
  getServerUrl: () => localDb.getServerUrl(),
  setServerUrl: (url: string) => localDb.setServerUrl(url),

  // -------------------------------------------------------------
  // Auth & Permissions
  // -------------------------------------------------------------
  getSetupStatus: () => {
    if (localDb.isStandaloneMode()) {
      return Promise.resolve({ has_users: true, allow_registration: true });
    }
    return request<SetupStatus>(`${API_BASE}/auth/setup-status`, undefined, {
      fallbackMock: () => ({ has_users: true, allow_registration: true }),
    });
  },
  getMe: () => {
    if (localDb.isStandaloneMode()) {
      return Promise.resolve(localDb.getCurrentUser());
    }
    return request<User>(`${API_BASE}/auth/me`, undefined, {
      cacheKey: 'current_user',
    });
  },
  register: (data: { username: string; email?: string; password: string; full_name?: string }) => {
    if (localDb.isStandaloneMode()) {
      const u = localDb.getCurrentUser();
      return Promise.resolve({
        access_token: 'standalone_token',
        token_type: 'bearer',
        user: u,
        message: 'Автономный режим активен',
      });
    }
    return request<AuthResponse>(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  login: (data: { username: string; password: string }) => {
    if (localDb.isStandaloneMode()) {
      const u = localDb.getCurrentUser();
      return Promise.resolve({
        access_token: 'standalone_token',
        token_type: 'bearer',
        user: u,
        message: 'Автономный режим активен',
      });
    }
    return request<AuthResponse>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
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
  getVehicles: () => {
    if (localDb.isStandaloneMode()) {
      return localDb.getVehicles();
    }
    return request<Vehicle[]>(`${API_BASE}/vehicles`, undefined, {
      cacheKey: 'vehicles_list',
      fallbackMock: () => [],
    });
  },
  getAdminAllVehicles: () => {
    if (localDb.isStandaloneMode()) {
      return localDb.getVehicles();
    }
    return request<Vehicle[]>(`${API_BASE}/vehicles/admin/all`, undefined, {
      cacheKey: 'admin_vehicles_all',
    });
  },
  deleteAdminVehicle: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteVehicle(vehicleId).then(() => {});
    }
    return request<void>(`${API_BASE}/vehicles/admin/${vehicleId}`, {
      method: 'DELETE',
    });
  },
  getVehicle: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getVehicle(id) as Promise<Vehicle>;
    }
    return request<Vehicle>(`${API_BASE}/vehicles/${id}`, undefined, {
      cacheKey: `vehicle_${id}`,
    });
  },
  createVehicle: (data: Partial<Vehicle>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.createVehicle(data);
    }
    return request<Vehicle>(
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
    );
  },
  updateVehicle: (id: number, data: Partial<Vehicle>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.updateVehicle(id, data);
    }
    return request<Vehicle>(
      `${API_BASE}/vehicles/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление параметров авто #${id}`,
        entityType: 'vehicle',
      }
    );
  },
  deleteVehicle: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteVehicle(id).then(() => {});
    }
    return request<void>(
      `${API_BASE}/vehicles/${id}`,
      {
        method: 'DELETE',
      },
      {
        description: `Удаление автомобиля #${id}`,
        entityType: 'vehicle',
      }
    );
  },

  // -------------------------------------------------------------
  // Service Records
  // -------------------------------------------------------------
  getServiceRecords: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getServices(vehicleId);
    }
    return request<ServiceRecord[]>(`${API_BASE}/vehicles/${vehicleId}/services`, undefined, {
      cacheKey: `services_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createServiceRecord: (vehicleId: number, data: Partial<ServiceRecord>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.createService({ ...data, vehicle_id: vehicleId });
    }
    return request<ServiceRecord>(
      `${API_BASE}/vehicles/${vehicleId}/services`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление записи ТО/Ремонта "${data.title || ''}"`,
        entityType: 'service',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as ServiceRecord),
      }
    );
  },
  updateServiceRecord: (id: number, data: Partial<ServiceRecord>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.updateService(id, data);
    }
    return request<ServiceRecord>(
      `${API_BASE}/services/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Редактирование записи ТО #${id}`,
        entityType: 'service',
      }
    );
  },
  deleteServiceRecord: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteService(id).then(() => {});
    }
    return request<void>(
      `${API_BASE}/services/${id}`,
      {
        method: 'DELETE',
      },
      {
        description: `Удаление записи ТО #${id}`,
        entityType: 'service',
      }
    );
  },

  // -------------------------------------------------------------
  // Fuel Logs
  // -------------------------------------------------------------
  getFuelLogs: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getFuelLogs(vehicleId);
    }
    return request<FuelLog[]>(`${API_BASE}/vehicles/${vehicleId}/fuel`, undefined, {
      cacheKey: `fuel_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createFuelLog: (vehicleId: number, data: Partial<FuelLog>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.createFuelLog({ ...data, vehicle_id: vehicleId });
    }
    return request<FuelLog>(
      `${API_BASE}/vehicles/${vehicleId}/fuel`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Заправка ${data.fuel_amount || 0} л на сумму ${data.total_cost || 0}`,
        entityType: 'fuel',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as FuelLog),
      }
    );
  },
  updateFuelLog: (id: number, data: Partial<FuelLog>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.updateFuelLog(id, data);
    }
    return request<FuelLog>(
      `${API_BASE}/fuel/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Редактирование заправки #${id}`,
        entityType: 'fuel',
      }
    );
  },
  deleteFuelLog: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteFuelLog(id).then(() => {});
    }
    return request<void>(
      `${API_BASE}/fuel/${id}`,
      {
        method: 'DELETE',
      },
      {
        description: `Удаление заправки #${id}`,
        entityType: 'fuel',
      }
    );
  },

  // -------------------------------------------------------------
  // Maintenance Plans / Reminders
  // -------------------------------------------------------------
  getMaintenancePlans: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getReminders(vehicleId);
    }
    return request<MaintenancePlan[]>(`${API_BASE}/vehicles/${vehicleId}/reminders`, undefined, {
      cacheKey: `reminders_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createMaintenancePlan: (vehicleId: number, data: Partial<MaintenancePlan>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.createReminder({ ...data, vehicle_id: vehicleId });
    }
    return request<MaintenancePlan>(
      `${API_BASE}/vehicles/${vehicleId}/reminders`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление регламента ТО "${data.title || ''}"`,
        entityType: 'reminder',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as MaintenancePlan),
      }
    );
  },
  updateMaintenancePlan: (id: number, data: Partial<MaintenancePlan>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.updateReminder(id, data);
    }
    return request<MaintenancePlan>(
      `${API_BASE}/reminders/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Обновление регламента ТО #${id}`,
        entityType: 'reminder',
      }
    );
  },
  completeMaintenancePlan: (
    id: number,
    data: {
      date?: string;
      odometer?: number;
      engine_hours?: number | null;
      create_service_record?: boolean;
      cost_labor?: number;
      cost_parts?: number;
      notes?: string;
    }
  ) => {
    if (localDb.isStandaloneMode()) {
      return localDb.completeReminder(id, data);
    }
    return request<MaintenancePlan>(
      `${API_BASE}/reminders/${id}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Выполнение регламента ТО #${id}`,
        entityType: 'reminder',
      }
    );
  },
  deleteMaintenancePlan: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteReminder(id).then(() => {});
    }
    return request<void>(
      `${API_BASE}/reminders/${id}`,
      {
        method: 'DELETE',
      },
      {
        description: `Удаление регламента #${id}`,
        entityType: 'reminder',
      }
    );
  },

  // -------------------------------------------------------------
  // Tyre Sets
  // -------------------------------------------------------------
  getTyreSets: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getTyres(vehicleId);
    }
    return request<TyreSet[]>(`${API_BASE}/vehicles/${vehicleId}/tyres`, undefined, {
      cacheKey: `tyres_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createTyreSet: (vehicleId: number, data: Partial<TyreSet>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.createTyre({ ...data, vehicle_id: vehicleId });
    }
    return request<TyreSet>(
      `${API_BASE}/vehicles/${vehicleId}/tyres`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление комплекта шин "${data.name || ''}"`,
        entityType: 'tyre',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as TyreSet),
      }
    );
  },
  updateTyreSet: (id: number, data: Partial<TyreSet>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.updateTyre(id, data);
    }
    return request<TyreSet>(
      `${API_BASE}/tyres/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Редактирование комплекта шин #${id}`,
        entityType: 'tyre',
      }
    );
  },
  activateTyreSet: (id: number, mileage?: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.activateTyre(id, mileage);
    }
    return request<TyreSet>(
      `${API_BASE}/tyres/${id}/activate`,
      {
        method: 'POST',
        body: JSON.stringify({ mileage }),
      },
      {
        description: `Активация комплекта шин #${id}`,
        entityType: 'tyre',
      }
    );
  },
  deleteTyreSet: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteTyre(id).then(() => {});
    }
    return request<void>(
      `${API_BASE}/tyres/${id}`,
      {
        method: 'DELETE',
      },
      {
        description: `Удаление комплекта шин #${id}`,
        entityType: 'tyre',
      }
    );
  },

  // -------------------------------------------------------------
  // Documents
  // -------------------------------------------------------------
  getDocumentNotes: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getDocuments(vehicleId);
    }
    return request<DocumentNote[]>(`${API_BASE}/vehicles/${vehicleId}/documents`, undefined, {
      cacheKey: `documents_${vehicleId}`,
      fallbackMock: () => [],
    });
  },
  createDocumentNote: (vehicleId: number, data: Partial<DocumentNote>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.createDocument({ ...data, vehicle_id: vehicleId });
    }
    return request<DocumentNote>(
      `${API_BASE}/vehicles/${vehicleId}/documents`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      {
        description: `Добавление документа "${data.title || ''}"`,
        entityType: 'document',
        fallbackMock: () => ({ id: Date.now(), vehicle_id: vehicleId, ...data } as DocumentNote),
      }
    );
  },
  updateDocumentNote: (id: number, data: Partial<DocumentNote>) => {
    if (localDb.isStandaloneMode()) {
      return localDb.updateDocument(id, data);
    }
    return request<DocumentNote>(
      `${API_BASE}/documents/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      {
        description: `Редактирование документа #${id}`,
        entityType: 'document',
      }
    );
  },
  deleteDocumentNote: (id: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.deleteDocument(id).then(() => {});
    }
    return request<void>(
      `${API_BASE}/documents/${id}`,
      {
        method: 'DELETE',
      },
      {
        description: `Удаление документа #${id}`,
        entityType: 'document',
      }
    );
  },

  // -------------------------------------------------------------
  // Analytics & Exports
  // -------------------------------------------------------------
  getVehicleAnalytics: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      return localDb.getAnalytics(vehicleId);
    }
    return request<VehicleAnalytics>(`${API_BASE}/vehicles/${vehicleId}/analytics`, undefined, {
      cacheKey: `analytics_${vehicleId}`,
    });
  },
  exportExcelUrl: (vehicleId: number) => `${API_BASE}/vehicles/${vehicleId}/export/excel`,
  exportPdfUrl: (vehicleId: number) => `${API_BASE}/vehicles/${vehicleId}/export/pdf`,
  exportServiceBookletUrl: (vehicleId: number) => `${API_BASE}/vehicles/${vehicleId}/export/pdf`,
  exportVehicleBackupUrl: (vehicleId: number) => {
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/backup/export/${vehicleId}${tokenParam}`;
  },
  exportAllBackupUrl: () => {
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/backup/export-all${tokenParam}`;
  },
  exportBackup: (vehicleId: number) => {
    if (localDb.isStandaloneMode()) {
      const json = localDb.exportVehicleBackup(vehicleId);
      const blob = new Blob([json], { type: 'application/json' });
      return Promise.resolve(blob);
    }
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/backup/export/${vehicleId}`, { headers }).then((res) => {
      if (!res.ok) throw new Error('Backup export failed');
      return res.blob();
    });
  },
  exportFullServerBackup: () => {
    if (localDb.isStandaloneMode()) {
      const json = localDb.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      return Promise.resolve(blob);
    }
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE}/backup/export-all`, { headers }).then((res) => {
      if (!res.ok) throw new Error('Full backup export failed');
      return res.blob();
    });
  },
  importBackup: async (parsedDataOrFile: any) => {
    if (localDb.isStandaloneMode()) {
      let payload = parsedDataOrFile;
      if (parsedDataOrFile instanceof File) {
        const text = await parsedDataOrFile.text();
        payload = JSON.parse(text);
      } else if (typeof parsedDataOrFile === 'string') {
        payload = JSON.parse(parsedDataOrFile);
      }
      const res = localDb.importFullBackup(payload);
      if (!res.success) {
        throw new Error(res.error || 'Некорректная структура файла резервной копии');
      }
      return {
        status: 'success',
        vehicle_id: res.vehicle_id || 1,
        message: 'Данные успешно импортированы',
      };
    }

    // Server mode
    let payload = parsedDataOrFile;
    if (parsedDataOrFile instanceof File) {
      const text = await parsedDataOrFile.text();
      payload = JSON.parse(text);
    } else if (typeof parsedDataOrFile === 'string') {
      payload = JSON.parse(parsedDataOrFile);
    }

    return request<{ status: string; vehicle_id: number; message: string }>(
      `${API_BASE}/backup/import`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        description: 'Импорт резервной копии JSON',
      }
    );
  },

  // -------------------------------------------------------------
  // Offline Sync Queue Management
  // -------------------------------------------------------------
  getPendingQueueCount: () => offlineStorage.getPendingQueueCount(),
  getPendingQueue: () => offlineStorage.getQueue(),
  syncOfflineQueue: async () => {
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
};
