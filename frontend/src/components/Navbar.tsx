import React from 'react';
import { Wrench, Plus, Car, UploadCloud, Sun, Moon } from 'lucide-react';
import { Vehicle } from '../types';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSelectVehicle: (v: Vehicle | null) => void;
  onAddVehicle: () => void;
  onOpenImportModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicle,
  theme,
  onToggleTheme,
  onSelectVehicle,
  onAddVehicle,
  onOpenImportModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-dark-900/95 backdrop-blur-md border-b border-slate-200 dark:border-dark-800 transition-colors shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectVehicle(null)}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold text-xl flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                AutoTracker
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">Учет ТО и расходов автомобиля</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Theme Toggle (Sun / Moon) */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 transition-colors"
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {vehicles.length > 0 && (
            <div className="flex items-center bg-slate-100 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl p-1">
              <button
                onClick={() => onSelectVehicle(null)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !selectedVehicle
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>Гараж ({vehicles.length})</span>
                </div>
              </button>
              {selectedVehicle && (
                <div className="hidden sm:flex items-center text-xs text-slate-700 dark:text-slate-300 px-2 py-1 bg-white dark:bg-dark-800 rounded-md font-medium border border-slate-200 dark:border-dark-700 ml-1">
                  <span className="text-brand-500 mr-1.5">●</span>
                  {selectedVehicle.name || `${selectedVehicle.make} ${selectedVehicle.model}`}
                </div>
              )}
            </div>
          )}

          {/* Import Backup Button */}
          <button
            onClick={onOpenImportModal}
            className="flex items-center space-x-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Восстановить историю из бэкапа JSON"
          >
            <UploadCloud className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Импорт бэкапа</span>
          </button>

          {/* Add Vehicle Button */}
          <button
            onClick={onAddVehicle}
            className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Добавить авто</span>
          </button>
        </div>
      </div>
    </header>
  );
};
