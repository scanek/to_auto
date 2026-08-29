import React from 'react';
import { Wrench, Plus, Car, UploadCloud, Sun, Moon, Smartphone } from 'lucide-react';
import { Vehicle } from '../types';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSelectVehicle: (v: Vehicle | null) => void;
  onAddVehicle: () => void;
  onOpenImportModal: () => void;
  onOpenInstallModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicle,
  theme,
  onToggleTheme,
  onSelectVehicle,
  onAddVehicle,
  onOpenImportModal,
  onOpenInstallModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border-b border-slate-200 dark:border-dark-800 transition-colors shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Logo */}
        <div
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer flex-shrink-0"
          onClick={() => onSelectVehicle(null)}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-md shadow-brand-500/20 text-white font-bold text-lg sm:text-xl flex-shrink-0">
            <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                AutoTracker
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
                PRO
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">
              Учет ТО и расходов автомобиля
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
          {/* Compact Install App Button */}
          <button
            onClick={onOpenInstallModal}
            className="flex items-center space-x-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] font-semibold transition-all shadow-sm"
            title="Установить приложение на телефон или рабочий стол"
          >
            <Smartphone className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
            <span className="hidden sm:inline">Приложение</span>
          </button>

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

          {/* Import Backup Button */}
          <button
            onClick={onOpenImportModal}
            className="flex items-center space-x-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-sm"
            title="Восстановить историю из бэкапа JSON"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="hidden md:inline">Импорт</span>
          </button>

          {/* Add Vehicle Button */}
          <button
            onClick={onAddVehicle}
            className="flex items-center space-x-1 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
            title="Добавить новый автомобиль"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Авто</span>
          </button>
        </div>
      </div>
    </header>
  );
};
