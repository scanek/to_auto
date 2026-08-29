import { useState, useEffect } from 'react';
import { Vehicle, ServiceRecord, FuelLog, MaintenancePlan, DocumentNote, TyreSet } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Garage } from './pages/Garage';
import { VehicleDetails } from './pages/VehicleDetails';
import { VehicleModal } from './components/VehicleModal';
import { ServiceModal } from './components/ServiceModal';
import { FuelModal } from './components/FuelModal';
import { ReminderModal } from './components/ReminderModal';
import { DocumentModal } from './components/DocumentModal';
import { TyreModal } from './components/TyreModal';
import { ImportBackupModal } from './components/ImportBackupModal';
import { InstallAppModal } from './components/InstallAppModal';

export function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleOpenInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const handleNativeInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    }
  };

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

  const [isTyreModalOpen, setIsTyreModalOpen] = useState(false);
  const [editingTyre, setEditingTyre] = useState<TyreSet | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  // Handlers for Tyre Modal
  const handleOpenTyreModal = (tyre?: TyreSet) => {
    setEditingTyre(tyre || null);
    setIsTyreModalOpen(true);
  };

  const handleSaveTyre = async (data: Partial<TyreSet>) => {
    if (!selectedVehicle) return;
    if (editingTyre) {
      await api.updateTyreSet(editingTyre.id, data);
    } else {
      await api.createTyreSet(selectedVehicle.id, data);
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

  const handleImportSuccess = async (newVehicleId: number) => {
    await loadVehicles();
    const updated = await api.getVehicles();
    const target = updated.find((v) => v.id === newVehicleId);
    if (target) setSelectedVehicle(target);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-dark-900 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <Navbar
        vehicles={vehicles}
        selectedVehicle={selectedVehicle}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSelectVehicle={setSelectedVehicle}
        onAddVehicle={handleOpenAddVehicle}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenInstallModal={handleOpenInstall}
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
            onOpenTyreModal={handleOpenTyreModal}
          />
        ) : (
          <Garage
            vehicles={vehicles}
            onSelectVehicle={setSelectedVehicle}
            onAddVehicle={handleOpenAddVehicle}
            onEditVehicle={handleOpenEditVehicle}
            onDeleteVehicle={handleDeleteVehicle}
            onOpenImportModal={() => setIsImportModalOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isIOS={isIOS}
        onNativeInstall={handleNativeInstall}
      />

      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
        vehicle={editingVehicle}
      />

      <ImportBackupModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
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

          <TyreModal
            isOpen={isTyreModalOpen}
            onClose={() => setIsTyreModalOpen(false)}
            onSave={handleSaveTyre}
            tyre={editingTyre}
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
