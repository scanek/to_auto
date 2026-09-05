import { useState, useEffect, useCallback } from 'react';
import { Vehicle, ServiceRecord, FuelLog, MaintenancePlan, DocumentNote, TyreSet, User, SystemAnnouncement } from './types';
import { api, removeAuthToken } from './services/api';
import { offlineStorage } from './services/offlineStorage';
import { notificationService } from './services/notificationService';
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
import { AuthModal } from './components/AuthModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { SettingsModal } from './components/SettingsModal';
import { Github, ZapOff, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Info, X } from 'lucide-react';

export function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  // Authentication state (Multi-User)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Offline & Synchronization state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // System Announcement Banner state
  const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null);
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState<boolean>(false);

  const loadAnnouncement = useCallback(async () => {
    try {
      const data = await api.getSystemAnnouncement();
      setAnnouncement(data);
      if (data && data.is_active && data.text) {
        const lastDismissed = sessionStorage.getItem('dismissed_announcement_time');
        if (lastDismissed && lastDismissed === (data.updated_at || 'dismissed')) {
          setIsAnnouncementDismissed(true);
        } else {
          setIsAnnouncementDismissed(false);
        }
      }
    } catch (err) {
      console.error('Failed to load system announcement', err);
    }
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
      if (selectedVehicle) {
        const updated = data.find((v) => v.id === selectedVehicle.id);
        if (updated) {
          setSelectedVehicle({ ...updated, updated_at: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.error('Failed to load vehicles', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem('autotracker_admin_token');
    if (token) {
      try {
        const user = await api.getMe();
        setCurrentUser(user);
        setIsAuthenticated(true);
        await Promise.all([loadVehicles(), loadAnnouncement()]);
        return;
      } catch (err) {
        console.warn('Invalid or expired token', err);
        removeAuthToken();
      }
    }

    setCurrentUser(null);
    setIsAuthenticated(false);
    await Promise.all([loadVehicles(), loadAnnouncement()]);
    setLoading(false);
  }, [loadAnnouncement]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Listen to custom announcement update event from Admin modal
  useEffect(() => {
    const handleUpdate = () => {
      loadAnnouncement();
    };
    window.addEventListener('system_announcement_updated', handleUpdate);
    return () => window.removeEventListener('system_announcement_updated', handleUpdate);
  }, [loadAnnouncement]);

  // Subscribe to Offline Storage Engine events
  useEffect(() => {
    const unsubscribe = offlineStorage.subscribe((online, count) => {
      setIsOnline(online);
      setPendingSyncCount(count);
    });
    return unsubscribe;
  }, []);

  // Theme state ('dark' | 'light') - Default is 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
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

  // Update page title dynamically
  useEffect(() => {
    if (selectedVehicle) {
      document.title = `Бортовой Журнал Автомобиля ${selectedVehicle.make} ${selectedVehicle.model}`;
    } else {
      document.title = 'Бортовой Журнал Автомобиля';
    }
  }, [selectedVehicle]);

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

  // Manual & Automatic Sync Handler
  const handleSyncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncToast({
        message: '⚠️ Нет подключения к интернету для синхронизации',
        type: 'warning',
      });
      return;
    }

    try {
      const { processed, failed } = await api.syncOfflineQueue();
      if (processed > 0) {
        setSyncToast({
          message: `Синхронизировано ${processed} ${processed === 1 ? 'действие' : 'действий'} с сервером!`,
          type: 'success',
        });
        await loadVehicles();
      } else if (failed > 0) {
        setSyncToast({
          message: `⚠️ Не удалось отправить ${failed} действий. Повторим при следующем подключении`,
          type: 'warning',
        });
      }
    } catch {
      setSyncToast({
        message: '⚠️ Ошибка синхронизации с сервером',
        type: 'warning',
      });
    } finally {
      setTimeout(() => setSyncToast(null), 4000);
    }
  }, [selectedVehicle]);

  // Online / Offline Window Events
  useEffect(() => {
    const handleOnlineEvent = () => {
      offlineStorage.setOnline(true);
      handleSyncOfflineQueue();
    };

    const handleOfflineEvent = () => {
      offlineStorage.setOnline(false);
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, [handleSyncOfflineQueue]);

  // Auth Handlers
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    loadVehicles();
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setVehicles([]);
    setSelectedVehicle(null);
    setIsAuthModalOpen(true);
  };

  // Handlers for Vehicle Modal
  const handleOpenAddVehicle = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
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
        setSelectedVehicle({ ...updated, updated_at: new Date().toISOString() });
      }
    } else {
      const created = await api.createVehicle(data);
      await loadVehicles();
      setSelectedVehicle(created);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (confirm('Вы уверены, что хотите удалить этот автомобиль и всю его историю?')) {
      await api.deleteVehicle(id);
      if (selectedVehicle?.id === id) {
        setSelectedVehicle(null);
      }
      await loadVehicles();
    }
  };

  // Handlers for Service Modal
  const handleOpenServiceModal = (type: 'service' | 'repair' | 'upgrade' = 'service', record?: ServiceRecord) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
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
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
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
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
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
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
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
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
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
    const data = await api.getVehicles();
    const found = data.find((v) => v.id === newVehicleId);
    if (found) {
      setSelectedVehicle(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-slate-100 transition-colors flex flex-col selection:bg-brand-500 selection:text-white">
      <Navbar
        vehicles={vehicles}
        selectedVehicle={selectedVehicle}
        currentUser={currentUser}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        onSelectVehicle={setSelectedVehicle}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onAddVehicle={handleOpenAddVehicle}
        onLogout={handleLogout}
        onSyncNow={handleSyncOfflineQueue}
      />

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 px-4 py-2 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <ZapOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              <strong>Автономный режим (Офлайн)</strong> — все изменения сохраняются на телефоне и будут автоматически отправлены на сервер при подключении.
            </span>
          </div>
          {pendingSyncCount > 0 && (
            <span className="bg-amber-500/20 px-2 py-0.5 rounded text-[11px] font-bold">
              В очереди: {pendingSyncCount}
            </span>
          )}
        </div>
      )}

      {/* Sync Notification Toast */}
      {syncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 shadow-2xl rounded-2xl p-3.5 flex items-center space-x-2.5 text-xs font-bold animate-slide-up">
          {syncToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0" />
          )}
          <span className="text-slate-800 dark:text-slate-200">{syncToast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full">
        {/* System Announcement Banner (e.g. Server Maintenance, Updates) */}
        {announcement && announcement.is_active && announcement.text && !isAnnouncementDismissed && (
          <div
            className={`mb-4 sm:mb-5 p-3.5 sm:p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-sm animate-fadeIn ${
              announcement.type === 'danger'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
                : announcement.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
                : announcement.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-950 dark:text-sky-200'
            }`}
          >
            <div className="flex items-start space-x-3 min-w-0">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  announcement.type === 'danger'
                    ? 'bg-rose-500 text-white'
                    : announcement.type === 'warning'
                    ? 'bg-amber-500 text-white'
                    : announcement.type === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-sky-500 text-white'
                }`}
              >
                {announcement.type === 'danger' ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : announcement.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : announcement.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Info className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                {announcement.title && (
                  <div className="font-extrabold text-xs sm:text-sm tracking-tight mb-0.5">
                    {announcement.title}
                  </div>
                )}
                <div className="text-xs font-medium leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
                  {announcement.text}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setIsAnnouncementDismissed(true);
                sessionStorage.setItem('dismissed_announcement_time', announcement.updated_at || 'dismissed');
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition flex-shrink-0"
              title="Скрыть объявление на время сессии"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Загрузка данных гаража...</p>
          </div>
        ) : selectedVehicle ? (
          <VehicleDetails
            vehicle={selectedVehicle}
            onBack={() => setSelectedVehicle(null)}
            onEditVehicle={() => handleOpenEditVehicle(selectedVehicle)}
            onDeleteVehicle={() => handleDeleteVehicle(selectedVehicle.id)}
            onOpenServiceModal={handleOpenServiceModal}
            onOpenFuelModal={handleOpenFuelModal}
            onOpenReminderModal={handleOpenReminderModal}
            onOpenDocModal={handleOpenDocModal}
            onOpenTyreModal={handleOpenTyreModal}
            onRefreshVehicle={loadVehicles}
            isAuthenticated={isAuthenticated}
          />
        ) : (
          <Garage
            vehicles={vehicles}
            onSelectVehicle={setSelectedVehicle}
            onAddVehicle={handleOpenAddVehicle}
            onEditVehicle={handleOpenEditVehicle}
            onDeleteVehicle={handleDeleteVehicle}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenServiceModal={(type) => {
              if (vehicles.length > 0) {
                setSelectedVehicle(vehicles[0]);
                handleOpenServiceModal(type);
              }
            }}
            onOpenFuelModal={() => {
              if (vehicles.length > 0) {
                setSelectedVehicle(vehicles[0]);
                handleOpenFuelModal();
              }
            }}
            onOpenReminderModal={() => {
              if (vehicles.length > 0) {
                setSelectedVehicle(vehicles[0]);
                handleOpenReminderModal();
              }
            }}
            isAuthenticated={isAuthenticated}
          />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isNotificationsEnabled={notificationService.areNotificationsEnabled()}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenInstallModal={handleOpenInstall}
        onAddVehicle={handleOpenAddVehicle}
        vehicles={vehicles}
        selectedVehicle={selectedVehicle}
        onLogout={handleLogout}
        onRefreshVehicles={loadVehicles}
        onSelectVehicle={setSelectedVehicle}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        currentUser={currentUser}
      />

      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isIOS={isIOS}
        hasNativePrompt={!!deferredPrompt}
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
        vehicles={vehicles}
        selectedVehicle={selectedVehicle}
        currentUser={currentUser}
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

      {/* Single Unified Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-dark-800 bg-white/60 dark:bg-dark-900/60 backdrop-blur-sm py-3.5 px-3 sm:px-6 mt-auto text-center transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span>Бортовой Журнал</span>
            <span>•</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Разработчик: <strong className="font-bold">Александр Щеголев</strong>
            </span>
            <span>•</span>
            <a
              href="https://github.com/scanek/to_auto"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 font-bold bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-dark-700 transition-all shadow-sm active:scale-95"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold border border-brand-500/25 shadow-sm">
              Версия программы: v2.8.2
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
