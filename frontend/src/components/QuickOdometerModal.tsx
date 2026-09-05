import React, { useState, useEffect } from 'react';
import { X, Gauge, Plus, Check, RefreshCw } from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../services/api';

interface QuickOdometerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onSuccess: (newOdometer: number) => void;
}

export const QuickOdometerModal: React.FC<QuickOdometerModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}) => {
  if (!isOpen || !vehicle) return null;

  const [odometer, setOdometer] = useState<number>(Math.round(vehicle.current_odometer || 0));
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingStarline, setIsSyncingStarline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOdometer(Math.round(vehicle.current_odometer || 0));
    setError(null);
  }, [vehicle, isOpen]);

  const handleAddKm = (delta: number) => {
    setOdometer((prev) => Math.max(0, prev + delta));
  };

  const handleSyncStarline = async () => {
    if (!vehicle.id) return;
    setIsSyncingStarline(true);
    setError(null);
    try {
      const res = await api.syncVehicleStarLine(vehicle.id);
      if (res.data?.odometer) {
        setOdometer(Math.round(res.data.odometer));
      } else {
        setError('StarLine не вернул данные одометра');
      }
    } catch (err: any) {
      setError(err?.message || 'Не удалось получить данные StarLine');
    } finally {
      setIsSyncingStarline(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (odometer < 0) {
      setError('Пробег не может быть отрицательным');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await api.updateVehicle(vehicle.id, { current_odometer: odometer });
      onSuccess(odometer);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка сохранения пробега');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white dark:bg-dark-850 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-2xl max-w-sm w-full overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-dark-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Обновить пробег
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[190px]">
                {vehicle.make} {vehicle.model} {vehicle.license_plate ? `(${vehicle.license_plate})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-center">
              Текущие показания ({vehicle.distance_unit || 'км'})
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                required
                autoFocus
                value={odometer || ''}
                onChange={(e) => setOdometer(parseInt(e.target.value, 10) || 0)}
                className="w-full text-center text-3xl font-black tracking-tight py-3 px-4 rounded-2xl bg-slate-50 dark:bg-dark-800 border-2 border-sky-500/40 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 text-slate-900 dark:text-white outline-none transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {vehicle.distance_unit || 'км'}
              </span>
            </div>
          </div>

          {/* Quick Increment Buttons */}
          <div>
            <span className="block text-[10px] font-semibold text-slate-400 text-center mb-1.5">
              Быстро прибавить:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[100, 500, 1000, 5000].map((delta) => (
                <button
                  type="button"
                  key={delta}
                  onClick={() => handleAddKm(delta)}
                  className="py-1.5 px-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-slate-200 hover:border-sky-500/50 hover:bg-sky-500/5 transition flex items-center justify-center space-x-0.5"
                >
                  <Plus className="w-3 h-3 text-sky-500" />
                  <span>{delta >= 1000 ? `${delta / 1000}k` : delta}</span>
                </button>
              ))}
            </div>
          </div>

          {/* StarLine sync option if available */}
          {vehicle.telematics_provider === 'starline' && vehicle.starline_token && (
            <button
              type="button"
              onClick={handleSyncStarline}
              disabled={isSyncingStarline}
              className="w-full py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-xs font-bold transition flex items-center justify-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingStarline ? 'animate-spin' : ''}`} />
              <span>{isSyncingStarline ? 'Запрос со StarLine...' : 'Считать со StarLine'}</span>
            </button>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-lg shadow-sky-500/25 active:scale-98 transition flex items-center justify-center space-x-1.5 disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
