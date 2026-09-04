import React, { useState, useEffect } from 'react';
import { X, Disc, Calendar, CircleDot, ShieldCheck, DollarSign } from 'lucide-react';
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
    purchase_date: '',
    dot_code: '',
    current_km: 0,
    tread_depth_mm: 8.0,
    storage_location: 'Гараж',
    is_active: false,
    quantity: 4,
    price_per_unit: 0,
    total_price: 0,
    has_separate_rims: false,
    rims_brand_model: '',
    rims_size: '',
    rims_purchase_date: '',
    rims_price: 0,
    tpms_sensors: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tyre) {
      setFormData({
        name: tyre.name,
        season: tyre.season,
        size: tyre.size || '',
        brand_model: tyre.brand_model || '',
        purchase_date: tyre.purchase_date ? tyre.purchase_date.split('T')[0] : '',
        dot_code: tyre.dot_code || '',
        current_km: tyre.current_km,
        tread_depth_mm: tyre.tread_depth_mm,
        storage_location: tyre.storage_location || '',
        is_active: tyre.is_active,
        quantity: tyre.quantity || 4,
        price_per_unit: tyre.price_per_unit || 0,
        total_price: tyre.total_price || 0,
        has_separate_rims: tyre.has_separate_rims || false,
        rims_brand_model: tyre.rims_brand_model || '',
        rims_size: tyre.rims_size || '',
        rims_purchase_date: tyre.rims_purchase_date ? tyre.rims_purchase_date.split('T')[0] : '',
        rims_price: tyre.rims_price || 0,
        tpms_sensors: tyre.tpms_sensors || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        name: 'Летний комплект',
        season: 'summer',
        size: '225/55 R19',
        brand_model: '',
        purchase_date: today,
        dot_code: '',
        current_km: 0,
        tread_depth_mm: 8.0,
        storage_location: 'Гараж',
        is_active: false,
        quantity: 4,
        price_per_unit: 0,
        total_price: 0,
        has_separate_rims: false,
        rims_brand_model: '',
        rims_size: '',
        rims_purchase_date: today,
        rims_price: 0,
        tpms_sensors: '',
      });
    }
  }, [tyre, isOpen, vehicle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : undefined,
        rims_purchase_date: formData.rims_purchase_date && formData.has_separate_rims ? new Date(formData.rims_purchase_date).toISOString() : undefined,
        current_km: parseFloat(String(formData.current_km)) || 0,
        tread_depth_mm: parseFloat(String(formData.tread_depth_mm)) || 8.0,
        total_price: parseFloat(String(formData.total_price)) || 0,
        rims_price: parseFloat(String(formData.rims_price)) || 0,
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении комплекта шин и дисков');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-750">
          <div className="flex items-center space-x-2">
            <Disc className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {tyre ? 'Редактировать комплект шин и дисков' : 'Добавить комплект шин и колес'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Main Info: Name & Season */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Название комплекта *
              </label>
              <input
                type="text"
                required
                placeholder="Заводской комплект, Зимние шипы..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Сезон *
              </label>
              <select
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-semibold"
              >
                <option value="summer">☀️ Летние шины</option>
                <option value="winter">❄️ Зимние шины</option>
              </select>
            </div>
          </div>

          {/* Section 1: Tyres (Резина) */}
          <div className="bg-slate-50 dark:bg-dark-900/80 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2">
              <Disc className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Параметры и покупка шин (резины)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Бренд и модель резины
                </label>
                <input
                  type="text"
                  placeholder="Ikon Tyres Nordman 8, Michelin, Bridgestone..."
                  value={formData.brand_model}
                  onChange={(e) => setFormData({ ...formData, brand_model: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Размерность шин
                </label>
                <input
                  type="text"
                  placeholder="225/55 R19, 215/65 R16..."
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Дата покупки шин
                </label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Год / DOT код
                </label>
                <input
                  type="text"
                  placeholder="4223, 2023 г..."
                  value={formData.dot_code}
                  onChange={(e) => setFormData({ ...formData, dot_code: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Стоимость резины ({vehicle.currency})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="62820"
                  value={formData.total_price || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Wheel Rims (Колесные диски) */}
          <div className="bg-slate-50 dark:bg-dark-900/80 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <CircleDot className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                  Колесные диски
                </h3>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer flex-shrink-0 select-none">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  На отдельных дисках
                </span>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.has_separate_rims}
                    onChange={(e) => setFormData({ ...formData, has_separate_rims: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-dark-750 peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
                </div>
              </label>
            </div>

            {formData.has_separate_rims && (
              <div className="pt-2 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Модель и бренд дисков
                    </label>
                    <input
                      type="text"
                      placeholder="Литые Skad KL-289, Оригинал Changan..."
                      value={formData.rims_brand_model}
                      onChange={(e) => setFormData({ ...formData, rims_brand_model: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Параметры дисков (Разболтовка, ET, DIA)
                    </label>
                    <input
                      type="text"
                      placeholder="19x7.5J 5x114.3 ET45 DIA67.1..."
                      value={formData.rims_size}
                      onChange={(e) => setFormData({ ...formData, rims_size: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Дата покупки дисков
                    </label>
                    <input
                      type="date"
                      value={formData.rims_purchase_date}
                      onChange={(e) => setFormData({ ...formData, rims_purchase_date: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Стоимость дисков ({vehicle.currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="48000"
                      value={formData.rims_price || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, rims_price: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Датчики TPMS
                    </label>
                    <input
                      type="text"
                      placeholder="Оригинальные 433 МГц..."
                      value={formData.tpms_sensors}
                      onChange={(e) => setFormData({ ...formData, tpms_sensors: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Condition: Wear & Storage */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-dark-900 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Пробег на комплекте (км)
              </label>
              <input
                type="number"
                step="any"
                value={formData.current_km}
                onChange={(e) =>
                  setFormData({ ...formData, current_km: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
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
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
              <div className="mt-1 flex items-center gap-1.5">
                <div className="flex-1 bg-slate-200 dark:bg-dark-750 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      formData.tread_depth_mm >= 7
                        ? 'bg-emerald-500'
                        : formData.tread_depth_mm >= 4
                        ? 'bg-amber-500'
                        : formData.tread_depth_mm >= 2
                        ? 'bg-orange-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (formData.tread_depth_mm / 10) * 100)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold ${
                  formData.tread_depth_mm >= 7
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : formData.tread_depth_mm >= 4
                    ? 'text-amber-600 dark:text-amber-400'
                    : formData.tread_depth_mm >= 2
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formData.tread_depth_mm >= 7
                    ? 'Новые'
                    : formData.tread_depth_mm >= 4
                    ? 'Норма'
                    : formData.tread_depth_mm >= 2
                    ? 'Износ'
                    : 'Замена!'}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Место хранения
              </label>
              <input
                type="text"
                placeholder="Гараж, Балкон, Склад..."
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Active status */}
          <div className="p-3 bg-slate-50 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-750">
            <label className="flex items-center space-x-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded bg-white dark:bg-dark-800 border-slate-300 dark:border-dark-700 text-brand-500 focus:ring-0 w-4 h-4"
              />
              <span>Установлен на автомобиль прямо сейчас (Активный)</span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-dark-750 flex items-center justify-end space-x-3">
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : tyre ? 'Сохранить изменения' : 'Добавить комплект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
