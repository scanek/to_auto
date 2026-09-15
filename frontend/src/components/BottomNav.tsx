import React, { useState } from 'react';
import {
  LayoutDashboard,
  History,
  Wrench,
  Settings,
  Plus,
  Fuel,
  Gauge,
  Receipt,
  X,
} from 'lucide-react';

export type MobileNavSection = 'dashboard' | 'timeline' | 'parts' | 'settings';

interface BottomNavProps {
  activeSection: MobileNavSection;
  onSelectSection: (section: MobileNavSection) => void;
  attentionCount?: number;
  onAddFuel?: () => void;
  onAddService?: () => void;
  onUpdateOdometer?: () => void;
  onScanReceipt?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeSection,
  onSelectSection,
  attentionCount = 0,
  onAddFuel,
  onAddService,
  onUpdateOdometer,
  onScanReceipt,
}) => {
  const [isQuickOpen, setIsQuickOpen] = useState(false);

  return (
    <>
      {/* Backdrop overlay for Speed-Dial menu */}
      {isQuickOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 animate-fadeIn"
          onClick={() => setIsQuickOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Speed-Dial Menu anchored above central button */}
      {isQuickOpen && (
        <div
          role="dialog"
          aria-label="Меню быстрого добавления"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[290px] p-2.5 bg-white/95 dark:bg-[#0f1626]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-[#27354f]/90 rounded-3xl shadow-2xl space-y-1.5 animate-slide-up"
        >
          <div className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-1.5">
            <span>Быстрое действие</span>
            <button
              type="button"
              onClick={() => setIsQuickOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {onAddFuel && (
            <button
              type="button"
              onClick={() => {
                setIsQuickOpen(false);
                onAddFuel();
              }}
              className="w-full flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-[#1a243b] text-left transition-colors active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white">Заправить авто</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Литры, стоимость, АЗС</div>
              </div>
            </button>
          )}

          {onAddService && (
            <button
              type="button"
              onClick={() => {
                setIsQuickOpen(false);
                onAddService();
              }}
              className="w-full flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-[#1a243b] text-left transition-colors active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-sky-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20 flex-shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white">Запись ТО и работ</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Замена масла, ремонт</div>
              </div>
            </button>
          )}

          {onUpdateOdometer && (
            <button
              type="button"
              onClick={() => {
                setIsQuickOpen(false);
                onUpdateOdometer();
              }}
              className="w-full flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-[#1a243b] text-left transition-colors active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
                <Gauge className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white">Пробег и моточасы</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Быстрое обновление</div>
              </div>
            </button>
          )}

          {onScanReceipt && (
            <button
              type="button"
              onClick={() => {
                setIsQuickOpen(false);
                onScanReceipt();
              }}
              className="w-full flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-[#1a243b] text-left transition-colors active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 flex-shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white">Скан чека (OCR)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Распознать с фото чека</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (5 columns with central raised + button) */}
      <nav
        aria-label="Мобильная навигация"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-[#090d16]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-[#27354f]/80 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.5)] pb-safe transition-colors"
      >
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1 relative items-center">
          {/* 1. Дашборд */}
          <button
            onClick={() => onSelectSection('dashboard')}
            className="relative flex flex-col items-center justify-center py-1 select-none active:scale-95 transition-transform"
            type="button"
          >
            {activeSection === 'dashboard' && (
              <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-brand-500 to-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.7)] animate-fadeIn" />
            )}
            <LayoutDashboard
              className={`w-5 h-5 transition-all duration-200 ${
                activeSection === 'dashboard'
                  ? 'text-brand-500 dark:text-brand-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.4)] scale-110'
                  : 'text-slate-400 dark:text-slate-400'
              }`}
            />
            <span
              className={`text-[10px] tracking-tight mt-1 transition-colors ${
                activeSection === 'dashboard'
                  ? 'font-bold text-brand-600 dark:text-brand-400'
                  : 'font-medium text-slate-500 dark:text-slate-400'
              }`}
            >
              Дашборд
            </span>
          </button>

          {/* 2. Журнал */}
          <button
            onClick={() => onSelectSection('timeline')}
            className="relative flex flex-col items-center justify-center py-1 select-none active:scale-95 transition-transform"
            type="button"
          >
            {activeSection === 'timeline' && (
              <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-brand-500 to-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.7)] animate-fadeIn" />
            )}
            <History
              className={`w-5 h-5 transition-all duration-200 ${
                activeSection === 'timeline'
                  ? 'text-brand-500 dark:text-brand-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.4)] scale-110'
                  : 'text-slate-400 dark:text-slate-400'
              }`}
            />
            <span
              className={`text-[10px] tracking-tight mt-1 transition-colors ${
                activeSection === 'timeline'
                  ? 'font-bold text-brand-600 dark:text-brand-400'
                  : 'font-medium text-slate-500 dark:text-slate-400'
              }`}
            >
              Журнал
            </span>
          </button>

          {/* 3. Central Raised + Action Button */}
          <div className="relative flex flex-col items-center justify-center select-none">
            <button
              type="button"
              onClick={() => setIsQuickOpen(!isQuickOpen)}
              className={`-mt-5 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white dark:border-[#090d16] text-white active:scale-90 transition-all duration-300 ${
                isQuickOpen
                  ? 'bg-gradient-to-tr from-rose-500 to-pink-600 shadow-rose-500/40 rotate-45'
                  : 'bg-gradient-to-tr from-brand-500 via-sky-500 to-brand-400 shadow-brand-500/40 hover:scale-105'
              }`}
              aria-label="Быстрое добавление"
              title="Быстрое действие"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-400 mt-0.5 leading-none">
              {isQuickOpen ? 'Закрыть' : 'Добавить'}
            </span>
          </div>

          {/* 4. Запчасти */}
          <button
            onClick={() => onSelectSection('parts')}
            className="relative flex flex-col items-center justify-center py-1 select-none active:scale-95 transition-transform"
            type="button"
          >
            {activeSection === 'parts' && (
              <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-brand-500 to-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.7)] animate-fadeIn" />
            )}
            <div className="relative">
              <Wrench
                className={`w-5 h-5 transition-all duration-200 ${
                  activeSection === 'parts'
                    ? 'text-brand-500 dark:text-brand-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.4)] scale-110'
                    : 'text-slate-400 dark:text-slate-400'
                }`}
              />
              {attentionCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center shadow-sm shadow-rose-500/50">
                  {attentionCount > 9 ? '9+' : attentionCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] tracking-tight mt-1 transition-colors ${
                activeSection === 'parts'
                  ? 'font-bold text-brand-600 dark:text-brand-400'
                  : 'font-medium text-slate-500 dark:text-slate-400'
              }`}
            >
              Запчасти
            </span>
          </button>

          {/* 5. Настройки */}
          <button
            onClick={() => onSelectSection('settings')}
            className="relative flex flex-col items-center justify-center py-1 select-none active:scale-95 transition-transform"
            type="button"
          >
            {activeSection === 'settings' && (
              <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-brand-500 to-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.7)] animate-fadeIn" />
            )}
            <Settings
              className={`w-5 h-5 transition-all duration-200 ${
                activeSection === 'settings'
                  ? 'text-brand-500 dark:text-brand-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.4)] scale-110'
                  : 'text-slate-400 dark:text-slate-400'
              }`}
            />
            <span
              className={`text-[10px] tracking-tight mt-1 transition-colors ${
                activeSection === 'settings'
                  ? 'font-bold text-brand-600 dark:text-brand-400'
                  : 'font-medium text-slate-500 dark:text-slate-400'
              }`}
            >
              Настройки
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

