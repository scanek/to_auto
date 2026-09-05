import React, { useState } from 'react';
import { Plus, Fuel, Gauge, Wrench, Receipt, Sparkles } from 'lucide-react';
import { Vehicle } from '../types';

interface QuickActionFabProps {
  vehicle: Vehicle | null;
  onAddFuel: () => void;
  onUpdateOdometer: () => void;
  onAddService: () => void;
  onAddExpense: () => void;
}

export const QuickActionFab: React.FC<QuickActionFabProps> = ({
  vehicle,
  onAddFuel,
  onUpdateOdometer,
  onAddService,
  onAddExpense,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!vehicle) return null;

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <>
      {/* Backdrop overlay when speed-dial is expanded */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-6 right-5 z-40 flex flex-col items-end print:hidden select-none">
        {/* Speed-dial items stack */}
        {isOpen && (
          <div className="flex flex-col items-end space-y-3 mb-3 animate-slide-up">
            {/* 1. Заправка (Fuel) */}
            <div
              onClick={() => handleAction(onAddFuel)}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform">
                ⛽ Заправить авто
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform"
                title="Заправить авто"
              >
                <Fuel className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Пробег (Odometer) */}
            <div
              onClick={() => handleAction(onUpdateOdometer)}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform">
                🛣️ Обновить пробег
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform"
                title="Обновить одометр"
              >
                <Gauge className="w-5 h-5" />
              </button>
            </div>

            {/* 3. Запись ТО (Service) */}
            <div
              onClick={() => handleAction(onAddService)}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform">
                🔧 Запись ТО
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform"
                title="Запись технического обслуживания"
              >
                <Wrench className="w-5 h-5" />
              </button>
            </div>

            {/* 4. Расход / Ремонт (Expense) */}
            <div
              onClick={() => handleAction(onAddExpense)}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform">
                💰 Расход / Ремонт
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform"
                title="Добавить расход или ремонт"
              >
                <Receipt className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Floating Action Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Быстрые действия"
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-xl shadow-brand-500/30 active:scale-95 transition-all duration-300 ${
            isOpen
              ? 'bg-slate-800 text-white rotate-45 scale-105'
              : 'bg-gradient-to-tr from-brand-600 to-indigo-600 text-white hover:scale-105'
          }`}
        >
          <Plus className="w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300" />
        </button>
      </div>
    </>
  );
};
