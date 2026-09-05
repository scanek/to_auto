import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Car,
  Settings,
  Smartphone,
  LogIn,
  LogOut,
  ZapOff,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Vehicle, User } from '../types';
import { localDB } from '../services/localDatabase';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  currentUser: User | null;
  isOnline?: boolean;
  pendingSyncCount?: number;
  onSelectVehicle: (v: Vehicle | null) => void;
  onOpenSettingsModal: () => void;
  onOpenInstallModal?: () => void;
  onOpenAuthModal: () => void;
  onAddVehicle: () => void;
  onLogout: () => void;
  onSyncNow?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicle,
  currentUser,
  isOnline = true,
  pendingSyncCount = 0,
  onSelectVehicle,
  onOpenSettingsModal,
  onOpenInstallModal,
  onOpenAuthModal,
  onAddVehicle,
  onLogout,
  onSyncNow,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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
                {currentUser ? `Гараж: ${currentUser.full_name || currentUser.username}` : 'Личный гараж'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
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

          {/* Garage Switcher (Back to Garage button) */}
          {selectedVehicle && (
            <button
              onClick={() => onSelectVehicle(null)}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Вернуться к списку всех авто"
            >
              <Car className="w-3.5 h-3.5 text-brand-500" />
              <span className="hidden sm:inline">Гараж</span>
            </button>
          )}

          {/* Add Vehicle Quick Button */}
          {currentUser && (
            <button
              onClick={onAddVehicle}
              className="flex items-center space-x-1 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
              title="Добавить новый автомобиль"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Авто</span>
            </button>
          )}

                    {/* Install PWA Button (only on web, not native) */}
          {onOpenInstallModal && !localDB.isNative() && (
            <button
              onClick={onOpenInstallModal}
              className="flex items-center space-x-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Установить приложение на телефон или рабочий стол"
            >
              <Smartphone className="w-3.5 h-3.5 text-brand-500" />
              <span className="hidden md:inline">Установить</span>
            </button>
          )}

          {/* Unified Settings & Tools Button */}
          <button
            onClick={onOpenSettingsModal}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Настройки, экспорт, сервисная книжка, бэкап и профиль"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:rotate-45 transition-transform" />
            <span className="hidden sm:inline">Настройки</span>
          </button>

          {/* User Account Button / Menu */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-dark-700 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                title="Личный профиль"
              >
                <div className="w-5 h-5 rounded-lg bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {(currentUser.full_name || currentUser.username).charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline truncate max-w-[100px]">
                  {currentUser.full_name || currentUser.username}
                </span>
                {currentUser.role === 'admin' && (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 hidden sm:inline" />
                )}
              </button>

              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fade-in text-xs">
                    <div className="p-2 border-b border-slate-100 dark:border-dark-750">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.full_name || currentUser.username}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {currentUser.email || `@${currentUser.username}`}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            currentUser.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          }`}
                        >
                          {currentUser.role === 'admin' ? '👑 Администратор' : '👤 Пользователь'}
                        </span>
                      </div>
                    </div>

                    {onOpenInstallModal && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenInstallModal();
                        }}
                        className="w-full flex items-center space-x-2 p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 font-semibold transition-colors text-left"
                      >
                        <Smartphone className="w-4 h-4 text-brand-500" />
                        <span>Установить приложение</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSettingsModal();
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 font-semibold transition-colors text-left"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Панель настроек</span>
                    </button>

                    {!localDB.isStandalone() && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2 p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Выйти из аккаунта</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : !localDB.isStandalone() ? (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-1 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
              title="Войти или зарегистрироваться"
            >
              <LogIn className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Войти</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
