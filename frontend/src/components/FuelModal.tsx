import React, { useState, useEffect } from 'react';
import { X, Fuel } from 'lucide-react';
import { FuelLog, Vehicle } from '../types';

interface FuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<FuelLog>) => Promise<void>;
  log?: FuelLog | null;
  vehicle: Vehicle;
}

export const FuelModal: React.FC<FuelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  log,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    odometer: vehicle.current_odometer || 0,
    fuel_amount: 40,
    total_cost: 2400,
    unit_price: 60,
    is_full_tank: true,
    is_missed: false,
    fuel_grade: 'АИ-95',
    gas_station: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (log) {
      setFormData({
        date: log.date.split('T')[0],
        odometer: log.odometer,
        fuel_amount: log.fuel_amount,
        total_cost: log.total_cost,
        unit_price: log.unit_price,
        is_full_tank: log.is_full_tank,
        is_missed: log.is_missed,
        fuel_grade: log.fuel_grade || 'АИ-95',
        gas_station: log.gas_station || '',
        notes: log.notes || '',
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        odometer: vehicle.current_odometer || 0,
        fuel_amount: 45,
        total_cost: 2700,
        unit_price: 60,
        is_full_tank: true,
        is_missed: false,
        fuel_grade: 'АИ-95',
        gas_station: '',
        notes: '',
      });
    }
  }, [log, isOpen, vehicle]);

  if (!isOpen) return null;

  const handleAmountChange = (amount: number) => {
    const total = amount * formData.unit_price;
    setFormData((prev) => ({
      ...prev,
      fuel_amount: amount,
      total_cost: Math.round(total * 100) / 100,
    }));
  };

  const handleTotalCostChange = (total: number) => {
    const unitPrice = formData.fuel_amount > 0 ? total / formData.fuel_amount : formData.unit_price;
    setFormData((prev) => ({
      ...prev,
      total_cost: total,
      unit_price: Math.round(unitPrice * 100) / 100,
    }));
  };

  const handleUnitPriceChange = (price: number) => {
    const total = formData.fuel_amount * price;
    setFormData((prev) => ({
      ...prev,
      unit_price: price,
      total_cost: Math.round(total * 100) / 100,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        date: new Date(formData.date).toISOString(),
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении заправки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <Fuel className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              {log ? 'Редактировать заправку' : 'Добавить заправку'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дата заправки *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Текущий одометр ({vehicle.distance_unit}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.odometer}
                onChange={(e) =>
                  setFormData({ ...formData, odometer: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-dark-900 p-3.5 rounded-xl border border-dark-750">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Объем ({vehicle.fuel_unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={formData.fuel_amount}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Цена за {vehicle.fuel_unit}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={formData.unit_price}
                onChange={(e) => handleUnitPriceChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-brand-400 mb-1">
                Сумма ({vehicle.currency}) *
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={formData.total_cost}
                onChange={(e) => handleTotalCostChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-dark-850 border border-brand-500/50 rounded-lg px-2.5 py-1.5 text-xs text-brand-400 font-bold focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Марка топлива
              </label>
              <input
                type="text"
                placeholder="АИ-95, АИ-98, ДТ, 100..."
                value={formData.fuel_grade}
                onChange={(e) => setFormData({ ...formData, fuel_grade: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                АЗС / Сеть
              </label>
              <input
                type="text"
                placeholder="Лукойл, Газпромнефть, Teboil..."
                value={formData.gas_station}
                onChange={(e) => setFormData({ ...formData, gas_station: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-dark-900 rounded-xl border border-dark-750">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_full_tank}
                onChange={(e) => setFormData({ ...formData, is_full_tank: e.target.checked })}
                className="rounded bg-dark-800 border-dark-700 text-brand-500 focus:ring-0 w-4 h-4"
              />
              <span>Полный бак (для точного расчета л/100км)</span>
            </label>

            <label className="flex items-center space-x-2 text-xs font-medium text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_missed}
                onChange={(e) => setFormData({ ...formData, is_missed: e.target.checked })}
                className="rounded bg-dark-800 border-dark-700 text-brand-500 focus:ring-0 w-4 h-4"
              />
              <span>Пропустил прошлую</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Заметки
            </label>
            <input
              type="text"
              placeholder="Трасса / Город, кондиционер..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 border-t border-dark-750 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : log ? 'Сохранить изменения' : 'Записать заправку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
