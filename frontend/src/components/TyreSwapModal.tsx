import React, { useState } from 'react';
import { X, RefreshCw, Calendar, Gauge, Wrench, ShieldCheck, Check } from 'lucide-react';
import { TireIcon } from './TireIcon';
import { TyreSet, Vehicle, TyreActivatePayload } from '../types';
import { useModalA11y } from '../utils/useModalA11y';

interface TyreSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTyre: TyreSet;
  vehicle: Vehicle;
  onConfirm: (payload: TyreActivatePayload) => Promise<void>;
}

export const TyreSwapModal: React.FC<TyreSwapModalProps> = ({
  isOpen,
  onClose,
  targetTyre,
  vehicle,
  onConfirm,
}) => {
  useModalA11y({ isOpen, onClose });

  const todayStr = new Date().toISOString().split('T')[0];

  const [installDate, setInstallDate] = useState<string>(todayStr);
  const [installMileage, setInstallMileage] = useState<number>(
    vehicle.current_odometer || targetTyre.install_mileage || 0
  );
  const [serviceCost, setServiceCost] = useState<number>(targetTyre.service_cost || 3000);
  const [storageCost, setStorageCost] = useState<number>(targetTyre.storage_cost || 0);
  const [treadDepth, setTreadDepth] = useState<number>(targetTyre.tread_depth_mm || 8.0);
  const [createServiceRecord, setCreateServiceRecord] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const isWinter = targetTyre.season === 'winter';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm({
        install_date: installDate ? `${installDate}T12:00:00` : undefined,
        install_mileage: installMileage,
        service_cost: serviceCost,
        storage_cost: storageCost,
        tread_depth_mm: treadDepth,
        create_service_record: createServiceRecord && serviceCost > 0,
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Ошибка при смене комплекта резины');
    } finally {
      setLoading(false);
    }
  };

  const costPresets = [2500, 3000, 3500, 4000, 0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tyre-swap-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-white dark:bg-dark-850 border-t sm:border border-slate-200 dark:border-dark-750 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-dark-750 bg-white/95 dark:bg-dark-850/95 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs ${
              isWinter
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              <RefreshCw className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 id="tyre-swap-modal-title" className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Сезонная смена резины
              </h2>
              <span className="text-[10px] text-slate-400 font-mono block">
                {vehicle.make} {vehicle.model}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Target Tyre Showcase Card */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
            isWinter
              ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20'
              : 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/20'
          }`}>
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isWinter
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-500'
                  : 'bg-amber-500/20 border-amber-500/30 text-amber-500'
              }`}>
                <TireIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    isWinter
                      ? 'bg-blue-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {isWinter ? '❄️ Зимние' : '☀️ Летние'}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {targetTyre.name}
                  </h3>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">
                  {targetTyre.brand_model || 'Шины'} {targetTyre.size && <span className="font-mono text-slate-400">({targetTyre.size})</span>}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 font-mono text-xs">
              <span className="text-[10px] text-slate-400 block font-sans">Пробег шин:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {Math.round(targetTyre.current_km).toLocaleString('ru-RU')} км
              </span>
            </div>
          </div>

          {/* Date & Mileage Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-brand-500" />
                <span>Дата переобувки *</span>
              </label>
              <input
                type="date"
                required
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                <Gauge className="w-3 h-3 text-brand-500" />
                <span>Пробег ({vehicle.distance_unit || 'км'}) *</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={installMileage || ''}
                onChange={(e) => setInstallMileage(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Service Cost & Presets */}
          <div className="space-y-2 bg-slate-50 dark:bg-dark-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Wrench className="w-3.5 h-3.5 text-brand-500" />
                <span>Стоимость услуг шиномонтажа ({vehicle.currency || '₽'})</span>
              </label>
            </div>
            <input
              type="number"
              step="any"
              value={serviceCost || ''}
              onChange={(e) => setServiceCost(parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
            />
            {/* Quick Presets */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">Быстро:</span>
              {costPresets.map((cost) => (
                <button
                  key={cost}
                  type="button"
                  onClick={() => setServiceCost(cost)}
                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 whitespace-nowrap active:scale-95 ${
                    serviceCost === cost
                      ? 'bg-brand-500 text-white border-brand-500 shadow-2xs'
                      : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-700 hover:bg-slate-100'
                  }`}
                >
                  {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
                </button>
              ))}
            </div>
          </div>

          {/* Optional: Storage & Tread Depth */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Хранение шин ({vehicle.currency || '₽'})
              </label>
              <input
                type="number"
                step="any"
                value={storageCost || ''}
                onChange={(e) => setStorageCost(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Протектор (мм)
              </label>
              <input
                type="number"
                step="0.1"
                value={treadDepth || ''}
                onChange={(e) => setTreadDepth(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Expense Auto-Record Toggle */}
          <div className="p-3 bg-slate-50 dark:bg-dark-900/70 rounded-2xl border border-slate-200 dark:border-dark-750 transition">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={createServiceRecord}
                onChange={(e) => setCreateServiceRecord(e.target.checked)}
                disabled={serviceCost <= 0}
                className="mt-0.5 rounded bg-white dark:bg-dark-800 border-slate-300 dark:border-dark-700 text-brand-500 focus:ring-0 w-4 h-4 disabled:opacity-40"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Записать шиномонтаж в историю сервиса (ТО)
                </span>
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                  Создаст запись в сервисной книжке на сумму {(serviceCost + storageCost).toLocaleString('ru-RU')} {vehicle.currency || '₽'} и учтёт её в общей аналитике затрат на автомобиль.
                </span>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-sky-600 hover:from-brand-500 hover:to-sky-500 active:scale-95 shadow-md shadow-brand-500/20 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Переобуваем...' : 'Подтвердить смену резины'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
