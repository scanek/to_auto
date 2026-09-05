import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  User as UserIcon,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  BookOpen,
  UploadCloud,
  Plus,
  Smartphone,
  Sun,
  Moon,
  Bell,
  LogOut,
  Trash2,
  AlertTriangle,
  KeyRound,
  ShieldAlert,
  Users,
  Car,
  Lock,
  Globe,
  RefreshCw,
  Megaphone,
  Info,
  CheckCircle2,
  Eye,
  EyeOff,
  Bot,
  Send,
  ExternalLink,
  Database,
} from 'lucide-react';
import { User, AdminUser, Vehicle, TelegramBotConfig } from '../types';
import { api, removeAuthToken } from '../services/api';
import { localDB } from '../services/localDatabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isNotificationsEnabled: boolean;
  onOpenNotificationModal: () => void;
  onOpenImportModal: () => void;
  onOpenInstallModal: () => void;
  onAddVehicle: () => void;
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  onLogout: () => void;
  onRefreshVehicles: () => Promise<void>;
  onSelectVehicle: (v: Vehicle | null) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme,
  onToggleTheme,
  isNotificationsEnabled,
  onOpenNotificationModal,
  onOpenImportModal,
  onOpenInstallModal,
  onAddVehicle,
  vehicles,
  selectedVehicle,
  onLogout,
  onRefreshVehicles,
  onSelectVehicle,
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'profile' | 'admin'>('tools');

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Admin users state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminVehicles, setAdminVehicles] = useState<Vehicle[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'vehicles' | 'announcement' | 'telegram' | 'backup'>('users');
  const [adminMsg, setAdminMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Admin announcement state
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('Технические работы');
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementType, setAnnouncementType] = useState<'warning' | 'danger' | 'info' | 'success'>('warning');
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);

  // Admin Telegram Bot Config State
  const [botConfig, setBotConfig] = useState<TelegramBotConfig | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [showBotToken, setShowBotToken] = useState(false);
  const [isSavingBotToken, setIsSavingBotToken] = useState(false);
  const [botTokenMsg, setBotTokenMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Mobile / Standalone Server Sync State
  const [serverUrlInput, setServerUrlInput] = useState(localDB.getServerUrl() || '');
  const [isStandalone, setIsStandalone] = useState(localDB.isStandalone());
  const [serverSyncMsg, setServerSyncMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isTestingServer, setIsTestingServer] = useState(false);

  const handleSaveServer = async () => {
    if (!serverUrlInput.trim()) {
      localDB.setServerUrl(null);
      localDB.setAppMode('standalone');
      setIsStandalone(true);
      setServerSyncMsg({ text: 'Установлен полностью автономный режим (без сервера)', type: 'success' });
      return;
    }
    setIsTestingServer(true);
    setServerSyncMsg(null);
    try {
      let target = serverUrlInput.trim().replace(/\/+$/, '');
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'https://' + target;
      }
      const testRes = await fetch(`${target}/api/v1/auth/setup-status`, { method: 'GET' });
      if (!testRes.ok) {
        throw new Error(`Сервер ответил с кодом HTTP ${testRes.status}`);
      }
      localDB.setServerUrl(target);
      localDB.setAppMode('synced');
      setIsStandalone(false);
      setServerSyncMsg({ text: 'Связь с сервером успешно установлена!', type: 'success' });
    } catch (err: any) {
      setServerSyncMsg({ text: `Не удалось подключиться к серверу: ${err.message}`, type: 'error' });
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleSetStandalone = () => {
    localDB.setAppMode('standalone');
    localDB.setServerUrl(null);
    setServerUrlInput('');
    setIsStandalone(true);
    setServerSyncMsg({ text: 'Включен автономный режим. Все данные хранятся локально на телефоне.', type: 'success' });
  };

  const handleExportJson = async () => {
    if (localDB.isStandalone()) {
      const jsonStr = await localDB.exportAllBackup();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `autotracker_backup_${dateStr}.json`;
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      window.location.href = api.exportAllBackupUrl();
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isOpen && isAdmin && activeTab === 'admin') {
      loadAdminData();
    }
  }, [isOpen, activeTab, isAdmin]);

  const loadBotConfig = async () => {
    try {
      const cfg = await api.getTelegramBotConfig();
      setBotConfig(cfg);
      if (cfg.bot_token) {
        setBotTokenInput(cfg.bot_token);
      }
    } catch (e) {
      console.error('Failed to load bot config', e);
    }
  };

  const handleSaveBotToken = async () => {
    if (!botTokenInput.trim()) {
      setBotTokenMsg({ text: 'Введите токен от @BotFather', type: 'error' });
      return;
    }
    setIsSavingBotToken(true);
    setBotTokenMsg(null);
    try {
      const res = await api.updateTelegramBotConfig(botTokenInput.trim());
      setBotTokenMsg({ text: res.message, type: 'success' });
      await loadBotConfig();
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Ошибка проверки токена бота';
      setBotTokenMsg({ text: errMsg, type: 'error' });
    } finally {
      setIsSavingBotToken(false);
    }
  };

  const handleResetBotToken = async () => {
    if (!window.confirm('Сбросить токен бота к значению по умолчанию?')) return;
    setIsSavingBotToken(true);
    setBotTokenMsg(null);
    try {
      const res = await api.resetTelegramBotConfig();
      setBotTokenMsg({ text: res.message, type: 'success' });
      await loadBotConfig();
    } catch (err: any) {
      setBotTokenMsg({ text: 'Ошибка сброса настроек токена', type: 'error' });
    } finally {
      setIsSavingBotToken(false);
    }
  };

  const loadAdminData = async () => {
    setLoadingAdminData(true);
    try {
      try {
        const usersData = await api.getAdminUsers();
        setAdminUsers(usersData || []);
      } catch (err: any) {
        console.error('Failed to load admin users', err);
      }
      try {
        const vehiclesData = await api.getAdminAllVehicles();
        setAdminVehicles(vehiclesData || []);
      } catch (err: any) {
        console.error('Failed to load admin vehicles', err);
      }
      try {
        const annData = await api.getSystemAnnouncement();
        if (annData) {
          setAnnouncementActive(annData.is_active || false);
          setAnnouncementTitle(annData.title || 'Технические работы');
          setAnnouncementText(annData.text || '');
          setAnnouncementType(annData.type || 'warning');
        }
      } catch (err: any) {
        console.error('Failed to load announcement', err);
      }
      try {
        await loadBotConfig();
      } catch (err: any) {
        console.error('Failed to load bot config', err);
      }
    } finally {
      setLoadingAdminData(false);
    }
  };

  const handleSaveAnnouncement = async (activeState?: boolean) => {
    setIsSavingAnnouncement(true);
    setAdminMsg(null);
    const shouldBeActive = activeState !== undefined ? activeState : announcementActive;
    try {
      const res = await api.updateSystemAnnouncement({
        is_active: shouldBeActive,
        title: announcementTitle,
        text: announcementText,
        type: announcementType,
      });
      setAnnouncementActive(shouldBeActive);
      setAdminMsg({ text: res.message || 'Объявление успешно сохранено', type: 'success' });
      // Notify parent/app to update live banner
      window.dispatchEvent(new CustomEvent('system_announcement_updated'));
    } catch (err: any) {
      setAdminMsg({ text: err.message || 'Ошибка сохранения объявления', type: 'error' });
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    try {
      const res = await api.changePassword({ old_password: oldPassword, new_password: newPassword });
      setPasswordMsg({ text: res.message || 'Пароль успешно изменен', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setIsChangingPassword(false);
    } catch (err: any) {
      setPasswordMsg({ text: err.message || 'Ошибка смены пароля', type: 'error' });
    }
  };

  const handleDeleteSelf = async () => {
    if (!confirm('Вы ДЕЙСТВИТЕЛЬНО хотите удалить свой аккаунт? Все ваши автомобили, записи ТО и файлы будут БЕЗВОЗВРАТНО удалены!')) {
      return;
    }
    try {
      await api.deleteMe();
      removeAuthToken();
      onClose();
      onLogout();
      alert('Ваш аккаунт успешно удален.');
    } catch (err: any) {
      alert(`Ошибка при удалении: ${err.message}`);
    }
  };

  const handleDeleteUserByAdmin = async (userId: number, username: string) => {
    if (!confirm(`Удалить пользователя "${username}" и ВСЕ его автомобили и данные?`)) {
      return;
    }
    try {
      const res = await api.deleteAdminUser(userId);
      setAdminMsg({ text: res.message, type: 'success' });
      await loadAdminData();
      await onRefreshVehicles();
    } catch (err: any) {
      setAdminMsg({ text: err.message || 'Ошибка удаления пользователя', type: 'error' });
    }
  };

  const handleDeleteVehicleByAdmin = async (vehicleId: number, carName: string) => {
    if (!confirm(`Принудительно удалить автомобиль "${carName}"?`)) {
      return;
    }
    try {
      await api.deleteAdminVehicle(vehicleId);
      setAdminMsg({ text: `Автомобиль "${carName}" успешно удален`, type: 'success' });
      await loadAdminData();
      await onRefreshVehicles();
    } catch (err: any) {
      setAdminMsg({ text: err.message || 'Ошибка удаления авто', type: 'error' });
    }
  };

  const currentVehicleToExport = selectedVehicle || vehicles[0] || null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-dark-750 flex items-center justify-between bg-slate-50/70 dark:bg-dark-900/50 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Настройки и инструменты
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Управление аккаунтом, сервисные функции и администрирование
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-1 border-b border-slate-100 dark:border-dark-750 flex space-x-1.5 bg-slate-50/40 dark:bg-dark-900/30 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'tools'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-dark-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Инструменты & Экспорт</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-dark-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Мой профиль</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>👑 Админ-панель</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Tools & Exports */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              {/* Quick Exports Grid */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Выгрузка данных и отчеты
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Excel Export */}
                  {currentVehicleToExport ? (
                    <a
                      href={api.exportExcelUrl(currentVehicleToExport.id)}
                      download
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition flex items-center space-x-3 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Экспорт в Excel (.xlsx)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {currentVehicleToExport.make} {currentVehicleToExport.model}
                        </div>
                      </div>
                    </a>
                  ) : null}

                  {/* PDF Service Booklet */}
                  {currentVehicleToExport ? (
                    <a
                      href={api.exportServiceBookletUrl(currentVehicleToExport.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-blue-500/40 hover:bg-blue-500/5 transition flex items-center space-x-3 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Сервисная книжка (PDF)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          Печать полной истории ТО
                        </div>
                      </div>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Backup & System Data */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {currentUser?.role === 'admin' ? 'Резервное копирование' : 'Резервная копия гаража'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={handleExportJson}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-brand-500/40 hover:bg-brand-500/5 transition flex items-center space-x-3 group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {localDB.isStandalone() ? 'Экспорт бэкапа (JSON)' : (currentUser?.role === 'admin' ? 'Экспорт всей базы (JSON)' : 'Экспорт моего гаража (JSON)')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {localDB.isStandalone() ? 'Сохранить все данные с устройства' : (currentUser?.role === 'admin' ? 'Все пользователи и авто' : 'Сохранить мои авто и историю ТО')}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenImportModal();
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition flex items-center space-x-3 group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Восстановление из JSON
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Импортировать файл бэкапа
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Standalone / Server Sync Mode */}
              <div className="space-y-3 p-4 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">{isStandalone ? '📱' : '🌐'}</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {isStandalone ? 'Автономный режим (Offline)' : 'Подключение к веб-серверу'}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isStandalone
                          ? 'Данные хранятся локально на этом устройстве без отправки в интернет'
                          : `Синхронизация с сервером: ${localDB.getServerUrl()}`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isStandalone ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'}`}>
                    {isStandalone ? 'Локально' : 'Онлайн'}
                  </span>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-dark-700/60">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Адрес удаленного сервера (опционально):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder="https://autotracker.my-domain.ru"
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSaveServer}
                        disabled={isTestingServer}
                        className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        {isTestingServer ? 'Проверка...' : 'Сохранить'}
                      </button>
                      {!isStandalone && (
                        <button
                          onClick={handleSetStandalone}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-dark-700 dark:hover:bg-dark-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
                        >
                          Офлайн
                        </button>
                      )}
                    </div>
                  </div>
                  {serverSyncMsg && (
                    <div className={`text-[11px] p-2 rounded-lg ${serverSyncMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'}`}>
                      {serverSyncMsg.text}
                    </div>
                  )}
                </div>
              </div>

              {/* App & Actions */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Быстрые действия
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      onClose();
                      onAddVehicle();
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-brand-500/40 hover:bg-brand-500/5 transition flex items-center space-x-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Добавить новый автомобиль
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Создать карточку авто
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenInstallModal();
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-purple-500/40 hover:bg-purple-500/5 transition flex items-center space-x-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Установить приложение (PWA)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        На телефон или рабочий стол
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Theme & Notifications */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Интерфейс и уведомления
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={onToggleTheme}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:bg-slate-100 dark:hover:bg-dark-800 transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Тема оформления</div>
                        <div className="text-[11px] text-slate-500">
                          {theme === 'dark' ? 'Темная тема включена' : 'Светлая тема включена'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-brand-500">Сменить</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenNotificationModal();
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:bg-slate-100 dark:hover:bg-dark-800 transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Push-уведомления</div>
                        <div className="text-[11px] text-slate-500">
                          {isNotificationsEnabled ? 'Напоминания активны' : 'Настроить регламенты'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-brand-500">Настроить</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: My Profile & Security */}
          {activeTab === 'profile' && currentUser && (
            <div className="space-y-6">
              {/* User Profile Card */}
              <div className="bg-slate-50 dark:bg-dark-800/70 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center font-extrabold text-lg">
                      {currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {currentUser.full_name || currentUser.username}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">@{currentUser.username}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                    {currentUser.role === 'admin' ? '👑 Администратор' : '👤 Пользователь'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-dark-750/70">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Email</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {currentUser.email || 'Не указан'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Дата регистрации</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {new Date(currentUser.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Change Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Безопасность
                  </h3>
                  {!isChangingPassword && (
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="text-xs font-bold text-brand-500 hover:underline flex items-center space-x-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Изменить пароль</span>
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <form onSubmit={handleChangePassword} className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 p-4 rounded-2xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Текущий пароль
                        </label>
                        <input
                          type="password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Новый пароль
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsChangingPassword(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-sm"
                      >
                        Сохранить пароль
                      </button>
                    </div>
                  </form>
                )}

                {passwordMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium flex items-center space-x-2 ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    }`}
                  >
                    <span>{passwordMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Logout and Danger Zone */}
              <div className="pt-4 border-t border-slate-200 dark:border-dark-750 space-y-3">
                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти из аккаунта</span>
                </button>

                {/* Self Account Deletion */}
                <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Опасная зона</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Удаление аккаунта приведет к безвозвратному стиранию всех ваших автомобилей, истории ТО, заправок и файлов.
                  </p>
                  <button
                    onClick={handleDeleteSelf}
                    className="flex items-center space-x-1.5 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-500/30 px-3 py-1.5 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить мой аккаунт</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Admin Panel */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-5">
              {/* Admin subtabs */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-1.5 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setAdminSubTab('users')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      adminSubTab === 'users'
                        ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    Пользователи ({adminUsers.length})
                  </button>
                  <button
                    onClick={() => setAdminSubTab('vehicles')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      adminSubTab === 'vehicles'
                        ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5 inline mr-1" />
                    Реестр авто ({adminVehicles.length})
                  </button>
                  <button
                    onClick={() => setAdminSubTab('announcement')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      adminSubTab === 'announcement'
                        ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Megaphone className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                    Объявление {announcementActive && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-0.5 animate-pulse" />}
                  </button>
                  <button
                    onClick={() => setAdminSubTab('telegram')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      adminSubTab === 'telegram'
                        ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5 inline mr-1 text-sky-500" />
                    Telegram-бот
                  </button>
                  <button
                    onClick={() => setAdminSubTab('backup')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      adminSubTab === 'backup'
                        ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                    Бэкапы
                  </button>
                </div>

                <button
                  onClick={loadAdminData}
                  disabled={loadingAdminData}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition"
                  title="Обновить данные"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAdminData ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {adminMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    adminMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}
                >
                  {adminMsg.text}
                </div>
              )}

              {/* Subtab: Users List */}
              {adminSubTab === 'users' && (
                <div className="space-y-2.5">
                  <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="bg-slate-50 dark:bg-dark-800 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-dark-750">
                          <tr>
                            <th className="p-3">Пользователь</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Авто</th>
                            <th className="p-3">Роль</th>
                            <th className="p-3 text-right">Действие</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-dark-750 text-slate-700 dark:text-slate-300">
                          {adminUsers.map((u) => {
                            const isCurrent = u.id === currentUser.id;
                            return (
                              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/50">
                                <td className="p-3">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {u.full_name || u.username}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                                </td>
                                <td className="p-3 text-slate-500">{u.email || '—'}</td>
                                <td className="p-3 font-mono font-bold">
                                  <span className="bg-slate-100 dark:bg-dark-800 px-2 py-0.5 rounded text-brand-600 dark:text-brand-400">
                                    {u.vehicles_count} авто
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      u.role === 'admin'
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                        : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    {u.role === 'admin' ? 'Администратор' : 'Пользователь'}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {!isCurrent ? (
                                    <button
                                      onClick={() => handleDeleteUserByAdmin(u.id, u.username)}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                                      title="Удалить пользователя и все его данные"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Вы</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab: All Vehicles Registry */}
              {adminSubTab === 'vehicles' && (
                <div className="space-y-2.5">
                  <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs min-w-[550px]">
                        <thead className="bg-slate-50 dark:bg-dark-800 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-dark-750">
                          <tr>
                            <th className="p-3">Автомобиль</th>
                            <th className="p-3">Владелец</th>
                            <th className="p-3">Пробег</th>
                            <th className="p-3">Видимость</th>
                            <th className="p-3 text-right">Модерация</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-dark-750 text-slate-700 dark:text-slate-300">
                          {adminVehicles.map((v) => (
                            <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/50">
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {v.make} {v.model}
                                </div>
                                {v.license_plate && (
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {v.license_plate}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">
                                @{v.owner_name || 'Неизвестно'}
                              </td>
                              <td className="p-3 font-mono">
                                {Math.round(v.current_odometer).toLocaleString('ru-RU')} {v.distance_unit}
                              </td>
                              <td className="p-3">
                                {v.is_public ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Публичный
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-800 text-slate-500">
                                    Личный
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteVehicleByAdmin(v.id, `${v.make} ${v.model}`)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                                  title="Принудительно удалить авто"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab: Announcement Management */}
              {adminSubTab === 'announcement' && (
                <div className="space-y-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-750">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Megaphone className="w-4 h-4 text-amber-500" />
                        <span>Баннер объявлений на главной странице</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Оповещение о технических работах, важных обновлениях или новостях для всех пользователей.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={announcementActive}
                        onChange={(e) => setAnnouncementActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-dark-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300 hidden sm:inline">
                        {announcementActive ? 'Активно' : 'Выключено'}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Тип объявления
                        </label>
                        <select
                          value={announcementType}
                          onChange={(e) => setAnnouncementType(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                        >
                          <option value="warning">🟡 Предупреждение (Тех. работы)</option>
                          <option value="danger">🔴 Срочно / Критично (Авария / Сервер)</option>
                          <option value="info">🔵 Информация (Обновление / Новость)</option>
                          <option value="success">🟢 Успех / Завершено</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Заголовок баннера
                        </label>
                        <input
                          type="text"
                          placeholder="Например: Технические работы на сервере"
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Текст сообщения *
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Например: 05.09 с 02:00 до 04:00 по МСК запланированы технические работы на сервере. Сервис может быть временно недоступен."
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Live Preview */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Предпросмотр баннера на главной:
                      </span>
                      <div
                        className={`p-3.5 rounded-2xl border flex items-start space-x-3 text-xs shadow-sm ${
                          announcementType === 'danger'
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-950 dark:text-rose-200'
                            : announcementType === 'warning'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                            : announcementType === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                            : 'bg-sky-500/15 border-sky-500/40 text-sky-950 dark:text-sky-200'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            announcementType === 'danger'
                              ? 'bg-rose-500 text-white'
                              : announcementType === 'warning'
                              ? 'bg-amber-500 text-white'
                              : announcementType === 'success'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-sky-500 text-white'
                          }`}
                        >
                          {announcementType === 'danger' ? (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          ) : announcementType === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : announcementType === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Info className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          {announcementTitle && (
                            <div className="font-extrabold text-xs tracking-tight mb-0.5">
                              {announcementTitle}
                            </div>
                          )}
                          <div className="leading-relaxed whitespace-pre-line">
                            {announcementText || 'Текст объявления...'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleSaveAnnouncement(true)}
                        disabled={isSavingAnnouncement || !announcementText.trim()}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isSavingAnnouncement ? 'Сохранение...' : 'Опубликовать объявление'}</span>
                      </button>

                      {announcementActive && (
                        <button
                          type="button"
                          onClick={() => handleSaveAnnouncement(false)}
                          disabled={isSavingAnnouncement}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition"
                        >
                          Снять с публикации
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab: Telegram Bot Settings */}
              {adminSubTab === 'telegram' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-dark-750">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-sky-500/20">
                          ✈️
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            Telegram-бот (@{botConfig?.bot_username || 'to_scanek_bot'})
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Управление токеном и подключением бота к системе
                          </p>
                        </div>
                      </div>
                      <div>
                        {botConfig?.is_active ? (
                          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Активен: @{botConfig.bot_username}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/25 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>Не настроен / Ошибка</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {botConfig?.status_detail && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-dark-800 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
                        {botConfig.status_detail}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        HTTP API Token бота (от @BotFather):
                      </label>
                      <div className="relative">
                        <input
                          type={showBotToken ? 'text' : 'password'}
                          value={botTokenInput}
                          onChange={(e) => setBotTokenInput(e.target.value)}
                          placeholder="8868283738:AAG3Dh994OcZ1SxHjRuWekoJQgH4vhkZXyA"
                          className="w-full text-xs font-mono px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBotToken(!showBotToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSavingBotToken}
                        onClick={handleSaveBotToken}
                        className="px-4 py-2 bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-sky-500/20 transition"
                      >
                        {isSavingBotToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        <span>Сохранить и применить токен</span>
                      </button>

                      {botConfig?.is_custom_token && (
                        <button
                          type="button"
                          disabled={isSavingBotToken}
                          onClick={handleResetBotToken}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition"
                          title="Сбросить токен к дефолтному из .env"
                        >
                          Сбросить к умолчанию
                        </button>
                      )}
                    </div>

                    {botTokenMsg && (
                      <div
                        className={`text-xs p-3 rounded-xl font-medium ${
                          botTokenMsg.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                        }`}
                      >
                        {botTokenMsg.text}
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-dark-800/80 p-3.5 rounded-xl border border-slate-200/60 dark:border-dark-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-sky-500" />
                        <span>Инструкция по созданию и смене своего Telegram-бота:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Откройте официального бота <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-500 underline font-bold">@BotFather</a> в Telegram.</li>
                        <li>Отправьте команду <code>/newbot</code> и задайте имя и юзернейм для вашего нового бота.</li>
                        <li>Скопируйте сгенерированный HTTP API токен и вставьте в поле выше.</li>
                        <li>Нажмите кнопку <b>«Сохранить и применить токен»</b>.</li>
                        <li>Сервер мгновенно проверит токен, определит юзернейм нового бота и без перезагрузки переключит отправку и прием команд на вашего нового бота!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab: Admin Database Backups */}
              {adminSubTab === 'backup' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-dark-750">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-500/20">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            Резервное копирование всей базы данных
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Полное сохранение всех пользователей, системных настроек, автомобилей и записей ТО
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25">
                        Только для Администратора
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card 1: SQLite .db file */}
                      <div className="border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Database className="w-4 h-4 text-emerald-500" />
                              База данных SQLite (.db)
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                              ACID Snapshot
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Горячий бинарный снимок файла <code className="font-mono text-emerald-600 dark:text-emerald-400">autotracker.db</code> без блокировок. Содержит 100% данных системы: пользователей, хэши паролей, автомобили, сервисные записи, заправки, шины, страховки и системные настройки.
                          </p>
                        </div>

                        <a
                          href={api.exportDatabaseUrl()}
                          className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                        >
                          <Download className="w-4 h-4" />
                          <span>Скачать файл autotracker.db</span>
                        </a>
                      </div>

                      {/* Card 2: JSON Dump */}
                      <div className="border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <UploadCloud className="w-4 h-4 text-brand-500" />
                              Полный JSON-дамп базы
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-500/20 text-brand-600 dark:text-brand-400">
                              JSON Backup
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Структурированный текстовый архив всех пользователей, настроек и гаражей всех пользователей со всеми записями. Удобен для выборочного восстановления и переноса данных через веб-интерфейс.
                          </p>
                        </div>

                        <a
                          href={api.exportAllBackupUrl()}
                          className="w-full flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-brand-600/20"
                        >
                          <Download className="w-4 h-4" />
                          <span>Скачать полный JSON архив</span>
                        </a>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-dark-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-dark-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="text-slate-600 dark:text-slate-400">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block sm:inline mr-1">
                          Нужно восстановить данные?
                        </span>
                        Используйте мастер импорта бэкапа для восстановления автомобилей или всей базы из сохраненного JSON-файла.
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenImportModal();
                        }}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-dark-700 dark:hover:bg-dark-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs transition whitespace-nowrap active:scale-95"
                      >
                        Открыть мастер импорта
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
