import React, { useState } from 'react';
import { Plus, Fuel, Gauge, Wrench, Receipt } from 'lucide-react';
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
          aria-hidden="true"
        />
      )}

      {/* FAB Container - high z-index (z-50) so it's strictly above backdrops and bottom bars */}
      <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-50 flex flex-col items-end print:hidden select-none touch-manipulation pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
        {/* Speed-dial items stack */}
        {isOpen && (
          <div className="flex flex-col items-end space-y-3 mb-3 animate-slide-up">
            {/* 1. Заправка (Fuel) */}
            <button
              type="button"
              onClick={() => handleAction(onAddFuel)}
              className="flex items-center space-x-2.5 cursor-pointer group focus:outline-none"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform pointer-events-none">
                ⛽ Заправить авто
              </span>
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform pointer-events-none"
              >
                <Fuel className="w-5 h-5" />
              </div>
            </button>

            {/* 2. Пробег (Odometer) */}
            <button
              type="button"
              onClick={() => handleAction(onUpdateOdometer)}
              className="flex items-center space-x-2.5 cursor-pointer group focus:outline-none"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform pointer-events-none">
                🛣️ Обновить пробег
              </span>
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform pointer-events-none"
              >
                <Gauge className="w-5 h-5" />
              </div>
            </button>

            {/* 3. Запись ТО (Service) */}
            <button
              type="button"
              onClick={() => handleAction(onAddService)}
              className="flex items-center space-x-2.5 cursor-pointer group focus:outline-none"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform pointer-events-none">
                🔧 Запись ТО
              </span>
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform pointer-events-none"
              >
                <Wrench className="w-5 h-5" />
              </div>
            </button>

            {/* 4. Расход / Ремонт (Expense) */}
            <button
              type="button"
              onClick={() => handleAction(onAddExpense)}
              className="flex items-center space-x-2.5 cursor-pointer group focus:outline-none"
            >
              <span className="bg-white dark:bg-dark-800 text-slate-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-dark-700 group-hover:scale-105 transition-transform pointer-events-none">
                💰 Расход / Ремонт
              </span>
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform pointer-events-none"
              >
                <Receipt className="w-5 h-5" />
              </div>
            </button>
          </div>
        )}

        {/* Main Floating Action Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Быстрые действия"
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-brand-500/40 active:scale-95 transition-all duration-300 focus:outline-none ${
            isOpen
              ? 'bg-slate-800 text-white rotate-45 scale-105'
              : 'bg-gradient-to-tr from-brand-600 to-indigo-600 text-white hover:scale-105'
          }`}
        >
          <Plus className="w-7 h-7 transition-transform duration-300" />
        </button>
      </div>
    </>
  );
};
