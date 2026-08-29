import { useState, useEffect } from 'react';
import { Vehicle, ServiceRecord, FuelLog, MaintenancePlan, DocumentNote } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Garage } from './pages/Garage';
import { VehicleDetails } from './pages/VehicleDetails';
import { VehicleModal } from './components/VehicleModal';
import { ServiceModal } from './components/ServiceModal';
import { FuelModal } from './components/FuelModal';
import { ReminderModal } from './components/ReminderModal';
import { DocumentModal } from './components/DocumentModal';

export function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceModalType, setServiceModalType] = useState<'service' | 'repair' | 'upgrade'>('service');
  const [editingServiceRecord, setEditingServiceRecord] = useState<ServiceRecord | null>(null);

  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLog | null>(null);

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<MaintenancePlan | null>(null);

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentNote | null>(null);

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
      if (selectedVehicle) {
        const updated = data.find((v) => v.id === selectedVehicle.id);
        if (updated) setSelectedVehicle(updated);
      }
    } catch (err) {
      console.error('Failed to load vehicles', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // Handlers for Vehicle Modal
  const handleOpenAddVehicle = () => {
    setEditingVehicle(null);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v);
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (data: Partial<Vehicle>) => {
    if (editingVehicle) {
      const updated = await api.updateVehicle(editingVehicle.id, data);
      await loadVehicles();
      if (selectedVehicle?.id === editingVehicle.id) {
        setSelectedVehicle(updated);
      }
    } else {
      const created = await api.createVehicle(data);
      await loadVehicles();
      setSelectedVehicle(created);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    await api.deleteVehicle(id);
    if (selectedVehicle?.id === id) {
      setSelectedVehicle(null);
    }
    await loadVehicles();
  };

  // Handlers for Service Modal
  const handleOpenServiceModal = (type: 'service' | 'repair' | 'upgrade' = 'service', record?: ServiceRecord) => {
    setServiceModalType(type);
    setEditingServiceRecord(record || null);
    setIsServiceModalOpen(true);
  };

  const handleSaveServiceRecord = async (data: Partial<ServiceRecord>) => {
    if (!selectedVehicle) return;
    if (editingServiceRecord) {
      await api.updateServiceRecord(editingServiceRecord.id, data);
    } else {
      await api.createServiceRecord(selectedVehicle.id, data);
    }
    await loadVehicles();
  };

  // Handlers for Fuel Modal
  const handleOpenFuelModal = (log?: FuelLog) => {
    setEditingFuelLog(log || null);
    setIsFuelModalOpen(true);
  };

  const handleSaveFuelLog = async (data: Partial<FuelLog>) => {
    if (!selectedVehicle) return;
    if (editingFuelLog) {
      await api.updateFuelLog(editingFuelLog.id, data);
    } else {
      await api.createFuelLog(selectedVehicle.id, data);
    }
    await loadVehicles();
  };

  // Handlers for Reminder Modal
  const handleOpenReminderModal = (plan?: MaintenancePlan) => {
    setEditingReminder(plan || null);
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = async (data: Partial<MaintenancePlan>) => {
    if (!selectedVehicle) return;
    if (editingReminder) {
      await api.updateReminder(editingReminder.id, data);
    } else {
      await api.createReminder(selectedVehicle.id, data);
    }
    await loadVehicles();
  };

  // Handlers for Document Modal
  const handleOpenDocModal = (doc?: DocumentNote) => {
    setEditingDoc(doc || null);
    setIsDocModalOpen(true);
  };

  const handleSaveDocument = async (data: Partial<DocumentNote>) => {
    if (!selectedVehicle) return;
    if (editingDoc) {
      await api.updateDocument(editingDoc.id, data);
    } else {
      await api.createDocument(selectedVehicle.id, data);
    }
    await loadVehicles();
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col">
      <Navbar
        vehicles={vehicles}
        selectedVehicle={selectedVehicle}
        onSelectVehicle={setSelectedVehicle}
        onAddVehicle={handleOpenAddVehicle}
      />

      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : selectedVehicle ? (
          <VehicleDetails
            vehicle={selectedVehicle}
            onBack={() => setSelectedVehicle(null)}
            onRefreshVehicle={loadVehicles}
            onOpenServiceModal={handleOpenServiceModal}
            onOpenFuelModal={handleOpenFuelModal}
            onOpenReminderModal={handleOpenReminderModal}
            onOpenDocModal={handleOpenDocModal}
          />
        ) : (
          <Garage
            vehicles={vehicles}
            onSelectVehicle={setSelectedVehicle}
            onAddVehicle={handleOpenAddVehicle}
            onEditVehicle={handleOpenEditVehicle}
            onDeleteVehicle={handleDeleteVehicle}
          />
        )}
      </main>

      {/* Modals */}
      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
        vehicle={editingVehicle}
      />

      {selectedVehicle && (
        <>
          <ServiceModal
            isOpen={isServiceModalOpen}
            onClose={() => setIsServiceModalOpen(false)}
            onSave={handleSaveServiceRecord}
            record={editingServiceRecord}
            vehicle={selectedVehicle}
            defaultType={serviceModalType}
          />

          <FuelModal
            isOpen={isFuelModalOpen}
            onClose={() => setIsFuelModalOpen(false)}
            onSave={handleSaveFuelLog}
            log={editingFuelLog}
            vehicle={selectedVehicle}
          />

          <ReminderModal
            isOpen={isReminderModalOpen}
            onClose={() => setIsReminderModalOpen(false)}
            onSave={handleSaveReminder}
            plan={editingReminder}
            vehicle={selectedVehicle}
          />

          <DocumentModal
            isOpen={isDocModalOpen}
            onClose={() => setIsDocModalOpen(false)}
            onSave={handleSaveDocument}
            doc={editingDoc}
            vehicle={selectedVehicle}
          />
        </>
      )}
    </div>
  );
}

export default App;
