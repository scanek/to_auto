import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  DocumentNote,
  VehicleAnalytics,
} from '../types';

const API_BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
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
  getFuelLogs: (vehicleId: number) =>
    request<FuelLog[]>(`${API_BASE}/fuel-logs?vehicle_id=${vehicleId}`),
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

  // Maintenance Plans / Reminders
  getReminders: (vehicleId: number) =>
    request<MaintenancePlan[]>(`${API_BASE}/reminders?vehicle_id=${vehicleId}`),
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
  markReminderDone: (id: number, odometer?: number) => {
    const url = `${API_BASE}/reminders/${id}/mark-done${odometer ? `?odometer=${odometer}` : ''}`;
    return request<MaintenancePlan>(url, { method: 'POST' });
  },
  deleteReminder: (id: number) =>
    request<void>(`${API_BASE}/reminders/${id}`, { method: 'DELETE' }),

  // Documents
  getDocuments: (vehicleId: number) =>
    request<DocumentNote[]>(`${API_BASE}/documents?vehicle_id=${vehicleId}`),
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

  // Analytics
  getAnalytics: (vehicleId: number) =>
    request<VehicleAnalytics>(`${API_BASE}/analytics/${vehicleId}`),

  // File Upload
  uploadFile: async (file: File, vehicleId: number, serviceRecordId?: number, fuelLogId?: number, documentId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    
    let url = `${API_BASE}/uploads?vehicle_id=${vehicleId}`;
    if (serviceRecordId) url += `&service_record_id=${serviceRecordId}`;
    if (fuelLogId) url += `&fuel_log_id=${fuelLogId}`;
    if (documentId) url += `&document_id=${documentId}`;

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Ошибка загрузки файла');
    return res.json();
  }
};
