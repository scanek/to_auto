import React, { useState, useEffect } from 'react';
import { X, Gauge, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { Vehicle } from '../types';

interface QuickMileageModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  onSave: (odometer: number, engineHours?: number) => Promise<void>;
}

export const QuickMileageModal: React.FC<QuickMileageModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  onSave,
}) => {
  const [odometer, setOdometer] = useState<number>(vehicle.current_odometer || 0);
  const [engineHours, setEngineHours] = useState<number>(vehicle.current_engine_hours || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOdometer(vehicle.current_odometer || 0);
      setEngineHours(vehicle.current_engine_hours || 0);
    }
  }, [isOpen, vehicle]);

  if (!isOpen) return null;

  const odoDiff = odometer - (vehicle.current_odometer || 0);
  const hoursDiff = engineHours - (vehicle.current_engine_hours || 0);
  const trackHours = vehicle.track_engine_hours !== false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(
        odometer,
        trackHours && engineHours > 0 ? engineHours : undefined
      );
      onClose();
    } catch (err) {
      alert('Ошибка при обновлении показателей одометра');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-750 bg-slate-50 dark:bg-dark-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Быстрое обновление пробега
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Current Status Baseline */}
          <div className="bg-slate-50 dark:bg-dark-900/90 border border-slate-200 dark:border-dark-750 p-3 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Текущее значение:</span>
            <div className="flex items-center space-x-2 font-mono font-bold text-slate-900 dark:text-white">
              <span>{Math.round(vehicle.current_odometer || 0).toLocaleString('ru-RU')} {vehicle.distance_unit}</span>
              {trackHours && vehicle.current_engine_hours ? (
                <span className="text-slate-400 dark:text-slate-500">• {vehicle.current_engine_hours} м/ч</span>
              ) : null}
            </div>
          </div>

          {/* New Odometer Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Новый пробег ({vehicle.distance_unit}) *
              </label>
              {odoDiff !== 0 && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  odoDiff > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {odoDiff > 0 ? `+${Math.round(odoDiff).toLocaleString('ru-RU')}` : Math.round(odoDiff).toLocaleString('ru-RU')} {vehicle.distance_unit}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                autoFocus
                value={odometer}
                onChange={(e) => setOdometer(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-3 py-2.5 text-sm sm:text-base text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
              />
              <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* New Engine Hours Input (if enabled) */}
          {trackHours && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Моточасы (м/ч, опция)
                </label>
                {hoursDiff !== 0 && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    hoursDiff > 0 ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {hoursDiff > 0 ? `+${hoursDiff}` : hoursDiff} м/ч
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={engineHours || ''}
                  onChange={(e) => setEngineHours(parseFloat(e.target.value) || 0)}
                  placeholder="Например 850"
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
                />
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-dark-750 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Сохранение...' : 'Обновить пробег'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
