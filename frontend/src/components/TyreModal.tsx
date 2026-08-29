import React, { useState, useEffect } from 'react';
import { X, Disc } from 'lucide-react';
import { TyreSet, Vehicle } from '../types';

interface TyreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TyreSet>) => Promise<void>;
  tyre?: TyreSet | null;
  vehicle: Vehicle;
}

export const TyreModal: React.FC<TyreModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tyre,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    name: 'Летний комплект',
    season: 'summer' as 'summer' | 'winter',
    size: '225/55 R19',
    brand_model: '',
    current_km: 0,
    tread_depth_mm: 8.0,
    storage_location: 'Гараж',
    is_active: true,
    quantity: 4,
    price_per_unit: 0,
    total_price: 0,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tyre) {
      setFormData({
        name: tyre.name,
        season: tyre.season,
        size: tyre.size || '',
        brand_model: tyre.brand_model || '',
        current_km: tyre.current_km,
        tread_depth_mm: tyre.tread_depth_mm,
        storage_location: tyre.storage_location || '',
        is_active: tyre.is_active,
        quantity: tyre.quantity || 4,
        price_per_unit: tyre.price_per_unit || 0,
        total_price: tyre.total_price || 0,
      });
    } else {
      setFormData({
        name: 'Летний комплект',
        season: 'summer',
        size: '225/55 R19',
        brand_model: '',
        current_km: 0,
        tread_depth_mm: 8.0,
        storage_location: 'Гараж',
        is_active: false,
        quantity: 4,
        price_per_unit: 0,
        total_price: 0,
      });
    }
  }, [tyre, isOpen, vehicle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении комплекта шин');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <Disc className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              {tyre ? 'Редактировать комплект шин' : 'Добавить комплект шин'}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Название комплекта *
              </label>
              <input
                type="text"
                required
                placeholder="Заводской комплект, Зимние шипы..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Сезон *
              </label>
              <select
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value as any })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="summer">☀️ Летние</option>
                <option value="winter">❄️ Зимние</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Размерность (Ш/П RД)
              </label>
              <input
                type="text"
                placeholder="225/55 R19"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Бренд и модель резины
              </label>
              <input
                type="text"
                placeholder="Ikon Tyres Nordman 8, Michelin..."
                value={formData.brand_model}
                onChange={(e) => setFormData({ ...formData, brand_model: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-dark-900 p-3.5 rounded-xl border border-dark-750">
            <div>
              <label className="block text-xs font-semibold text-brand-400 mb-1">
                Пробег на комплекте (км)
              </label>
              <input
                type="number"
                step="any"
                value={formData.current_km}
                onChange={(e) =>
                  setFormData({ ...formData, current_km: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-400 mb-1">
                Остаток протектора (мм)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="15"
                value={formData.tread_depth_mm}
                onChange={(e) =>
                  setFormData({ ...formData, tread_depth_mm: parseFloat(e.target.value) || 8.0 })
                }
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Место хранения
              </label>
              <input
                type="text"
                placeholder="Гараж, Балкон, Шинный отель..."
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Стоимость комплекта ({vehicle.currency})
              </label>
              <input
                type="number"
                step="any"
                placeholder="62820"
                value={formData.total_price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-dark-900 rounded-xl border border-dark-750">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded bg-dark-800 border-dark-700 text-brand-500 focus:ring-0 w-4 h-4"
              />
              <span>Установлен на автомобиль прямо сейчас (Активный)</span>
            </label>
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
              {loading ? 'Сохранение...' : tyre ? 'Сохранить изменения' : 'Добавить комплект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
