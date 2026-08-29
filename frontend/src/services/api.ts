import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  DocumentNote,
  VehicleAnalytics,
  TyreSet,
} from '../types';

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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || `HTTP error ${res.status}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Auth & Permissions
  getAuthStatus: () =>
    request<{ has_pin: boolean; is_authenticated: boolean }>(`${API_BASE}/auth/status`),
  loginPin: (pin: string) =>
    request<{ token: string; message: string }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  changePin: (data: { old_pin?: string; new_pin: string }) =>
    request<{ token: string; message: string }>(`${API_BASE}/auth/set-pin`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Vehicles
  getVehicles: () => request<Vehicle[]>(`${API_BASE}/vehicles`),
  getVehicle: (id: number) => request<Vehicle>(`${API_BASE}/vehicles/${id}`),
  createVehicle: (data: Partial<Vehicle>) =>
    request<Vehicle>(`${API_BASE}/vehicles`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateVehicle: (id: number, data: Partial<Vehicle>) =>
    request<Vehicle>(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteVehicle: (id: number) =>
    request<void>(`${API_BASE}/vehicles/${id}`, { method: 'DELETE' }),

  // Service Records
  getServiceRecords: (vehicleId: number, recordType?: string) => {
    const url = new URL(`${window.location.origin}${API_BASE}/service-records`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    if (recordType) url.searchParams.set('record_type', recordType);
    return request<ServiceRecord[]>(url.pathname + url.search);
  },
  createServiceRecord: (vehicleId: number, data: Partial<ServiceRecord>) =>
    request<ServiceRecord>(`${API_BASE}/service-records?vehicle_id=${vehicleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateServiceRecord: (id: number, data: Partial<ServiceRecord>) =>
    request<ServiceRecord>(`${API_BASE}/service-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteServiceRecord: (id: number) =>
    request<void>(`${API_BASE}/service-records/${id}`, { method: 'DELETE' }),

  // Fuel Logs
  getFuelLogs: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/fuel-logs`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<FuelLog[]>(url.pathname + url.search);
  },
  createFuelLog: (vehicleId: number, data: Partial<FuelLog>) =>
    request<FuelLog>(`${API_BASE}/fuel-logs?vehicle_id=${vehicleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateFuelLog: (id: number, data: Partial<FuelLog>) =>
    request<FuelLog>(`${API_BASE}/fuel-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteFuelLog: (id: number) =>
    request<void>(`${API_BASE}/fuel-logs/${id}`, { method: 'DELETE' }),

  // Reminders
  getReminders: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/reminders`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<MaintenancePlan[]>(url.pathname + url.search);
  },
  createReminder: (vehicleId: number, data: Partial<MaintenancePlan>) =>
    request<MaintenancePlan>(`${API_BASE}/reminders?vehicle_id=${vehicleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateReminder: (id: number, data: Partial<MaintenancePlan>) =>
    request<MaintenancePlan>(`${API_BASE}/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteReminder: (id: number) =>
    request<void>(`${API_BASE}/reminders/${id}`, { method: 'DELETE' }),
  markReminderDone: (id: number, odo?: number, hours?: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/reminders/${id}/mark-done`);
    if (odo !== undefined) url.searchParams.set('odometer', String(odo));
    if (hours !== undefined) url.searchParams.set('hours', String(hours));
    return request<MaintenancePlan>(url.pathname + url.search, { method: 'POST' });
  },

  // Documents
  getDocuments: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/documents`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<DocumentNote[]>(url.pathname + url.search);
  },
  createDocument: (vehicleId: number, data: Partial<DocumentNote>) =>
    request<DocumentNote>(`${API_BASE}/documents?vehicle_id=${vehicleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDocument: (id: number, data: Partial<DocumentNote>) =>
    request<DocumentNote>(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDocument: (id: number) =>
    request<void>(`${API_BASE}/documents/${id}`, { method: 'DELETE' }),

  // Tyres
  getTyreSets: (vehicleId: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/tyres`);
    url.searchParams.set('vehicle_id', String(vehicleId));
    return request<TyreSet[]>(url.pathname + url.search);
  },
  createTyreSet: (vehicleId: number, data: Partial<TyreSet>) =>
    request<TyreSet>(`${API_BASE}/tyres?vehicle_id=${vehicleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTyreSet: (id: number, data: Partial<TyreSet>) =>
    request<TyreSet>(`${API_BASE}/tyres/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTyreSet: (id: number) =>
    request<void>(`${API_BASE}/tyres/${id}`, { method: 'DELETE' }),
  activateTyreSet: (id: number, mileage?: number) => {
    const url = new URL(`${window.location.origin}${API_BASE}/tyres/${id}/activate`);
    if (mileage !== undefined) url.searchParams.set('mileage', String(mileage));
    return request<TyreSet>(url.pathname + url.search, { method: 'POST' });
  },

  // Analytics
  getAnalytics: (vehicleId: number) =>
    request<VehicleAnalytics>(`${API_BASE}/analytics/${vehicleId}`),

  // File Upload
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

  // Backup & Export
  importBackup: (data: any) =>
    request<{ message: string; vehicle_id: number }>(`${API_BASE}/backup/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
