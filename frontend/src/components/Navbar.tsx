import React from 'react';
import {
  BookOpen,
  Plus,
  Car,
  UploadCloud,
  Sun,
  Moon,
  Smartphone,
  Lock,
  Unlock,
  Github,
  ZapOff,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { Vehicle } from '../types';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  theme: 'dark' | 'light';
  isAuthenticated: boolean;
  isOnline?: boolean;
  pendingSyncCount?: number;
  isNotificationsEnabled?: boolean;
  onToggleTheme: () => void;
  onSelectVehicle: (v: Vehicle | null) => void;
  onAddVehicle: () => void;
  onOpenImportModal: () => void;
  onOpenInstallModal: () => void;
  onOpenPinModal: () => void;
  onOpenNotificationModal?: () => void;
  onSyncNow?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicle,
  theme,
  isAuthenticated,
  isOnline = true,
  pendingSyncCount = 0,
  isNotificationsEnabled = false,
  onToggleTheme,
  onSelectVehicle,
  onAddVehicle,
  onOpenImportModal,
  onOpenInstallModal,
  onOpenPinModal,
  onOpenNotificationModal,
  onSyncNow,
}) => {
  const currentCar = selectedVehicle;
  const carTitle = currentCar ? `${currentCar.make} ${currentCar.model}` : '';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border-b border-slate-200 dark:border-dark-800 transition-colors shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Logo & Dynamic Brand Name */}
        <div
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0 flex-1 sm:flex-initial"
          onClick={() => onSelectVehicle(null)}
          title="На главную в гараж"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-md shadow-brand-500/20 text-white font-bold text-base sm:text-xl flex-shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight truncate">
                Бортовой Журнал
              </span>
            </div>
            {carTitle ? (
              <span className="text-[11px] sm:text-xs text-brand-600 dark:text-brand-400 font-semibold truncate block">
                {carTitle}
              </span>
            ) : (
              <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-normal truncate block">
                Автомобиля
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
          {/* Offline / Pending Sync Badges */}
          {!isOnline && (
            <div
              className="flex items-center space-x-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg text-[10px] font-bold"
              title="Приложение работает в автономном режиме без подключения к интернету"
            >
              <ZapOff className="w-3 h-3 text-amber-500" />
              <span className="hidden sm:inline">Офлайн</span>
            </div>
          )}

          {pendingSyncCount > 0 && (
            <button
              onClick={onSyncNow}
              className="flex items-center space-x-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-2 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95"
              title={`${pendingSyncCount} записей ждут отправки на сервер. Нажмите для синхронизации`}
            >
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
              <span>{pendingSyncCount}</span>
            </button>
          )}

          {/* Owner / Guest Mode Lock Button */}
          <button
            onClick={onOpenPinModal}
            className={`flex items-center space-x-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] font-semibold transition-all shadow-sm ${
              isAuthenticated
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            }`}
            title={isAuthenticated ? 'Режим владельца активен (нажмите для смены PIN или блокировки)' : 'Режим гостя (нажмите для входа владельца)'}
          >
            {isAuthenticated ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="hidden md:inline">Владелец</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="hidden md:inline">Войти</span>
              </>
            )}
          </button>

          {/* Compact Install App Button */}
          <button
            onClick={onOpenInstallModal}
            className="flex items-center space-x-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] font-semibold transition-all shadow-sm"
            title="Установить приложение на телефон или рабочий стол"
          >
            <Smartphone className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
            <span className="hidden sm:inline">Приложение</span>
          </button>

          {/* Notification Settings Button */}
          {onOpenNotificationModal && (
            <button
              onClick={onOpenNotificationModal}
              className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl border transition-all relative ${
                isNotificationsEnabled
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-dark-700'
              }`}
              title="Настройки Push-уведомлений о регламентах ТО"
            >
              <Bell className="w-4 h-4" />
              {isNotificationsEnabled && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              )}
            </button>
          )}

          {/* Theme Toggle (Sun / Moon) */}
          <button
            onClick={onToggleTheme}
            className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 transition-colors"
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* GitHub Repository Link */}
          <a
            href="https://github.com/scanek/to_auto"
            target="_blank"
            rel="noreferrer"
            className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 transition-colors flex items-center justify-center"
            title="GitHub репозиторий проекта (scanek/to_auto)"
          >
            <Github className="w-4 h-4 text-slate-700 dark:text-slate-300 hover:text-brand-500" />
          </a>

          {vehicles.length > 0 && (
            <div className="flex items-center bg-slate-100 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-lg sm:rounded-xl p-0.5">
              <button
                onClick={() => onSelectVehicle(null)}
                className={`px-2 py-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-medium transition-all ${
                  !selectedVehicle
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Перейти в гараж"
              >
                <div className="flex items-center space-x-1">
                  <Car className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Гараж ({vehicles.length})</span>
                </div>
              </button>
            </div>
          )}

          {/* Backup & Restore Button (Visible only to authenticated owner) */}
          {isAuthenticated && (
            <button
              onClick={onOpenImportModal}
              className="flex items-center space-x-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-sm"
              title="Резервное копирование: Экспорт и Импорт базы в JSON"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="hidden md:inline">Бэкап</span>
            </button>
          )}

          {/* Add Vehicle Button (Visible only to authenticated owner) */}
          {isAuthenticated && (
            <button
              onClick={onAddVehicle}
              className="flex items-center space-x-1 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
              title="Добавить новый автомобиль"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Авто</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
