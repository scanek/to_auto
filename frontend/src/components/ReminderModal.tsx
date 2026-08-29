import React, { useState, useEffect } from 'react';
import { X, CalendarClock } from 'lucide-react';
import { MaintenancePlan, Vehicle } from '../types';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<MaintenancePlan>) => Promise<void>;
  plan?: MaintenancePlan | null;
  vehicle: Vehicle;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  plan,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    category: 'Обслуживание',
    brand: '',
    article: '',
    interval_distance: 7500,
    interval_hours: 250,
    interval_months: 12,
    last_service_odometer: vehicle.current_odometer || 0,
    last_service_hours: vehicle.current_engine_hours || 0,
    last_service_date: new Date().toISOString().split('T')[0],
    is_active: true,
    notify_before_distance: 500,
    notify_before_hours: 30,
    notify_before_days: 14,
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setFormData({
        title: plan.title,
        category: plan.category || 'Обслуживание',
        brand: plan.brand || '',
        article: plan.article || '',
        interval_distance: plan.interval_distance || 0,
        interval_hours: plan.interval_hours || 0,
        interval_months: plan.interval_months || 0,
        last_service_odometer: plan.last_service_odometer,
        last_service_hours: plan.last_service_hours || 0,
        last_service_date: plan.last_service_date ? plan.last_service_date.split('T')[0] : new Date().toISOString().split('T')[0],
        is_active: plan.is_active,
        notify_before_distance: plan.notify_before_distance,
        notify_before_hours: plan.notify_before_hours || 30,
        notify_before_days: plan.notify_before_days,
        notes: plan.notes || '',
      });
    } else {
      setFormData({
        title: '',
        category: 'Обслуживание',
        brand: '',
        article: '',
        interval_distance: 7500,
        interval_hours: 250,
        interval_months: 12,
        last_service_odometer: vehicle.current_odometer || 0,
        last_service_hours: vehicle.current_engine_hours || 0,
        last_service_date: new Date().toISOString().split('T')[0],
        is_active: true,
        notify_before_distance: 500,
        notify_before_hours: 30,
        notify_before_days: 14,
        notes: '',
      });
    }
  }, [plan, isOpen, vehicle]);

  if (!isOpen) return null;

  const quickPresets = [
    { title: 'Моторное масло и фильтр', dist: 7500, hours: 250, months: 12 },
    { title: 'Воздушный и салонный фильтры', dist: 15000, hours: 500, months: 12 },
    { title: 'Свечи зажигания', dist: 30000, hours: 0, months: 24 },
    { title: 'Тормозная жидкость (DOT-4)', dist: 40000, hours: 0, months: 24 },
    { title: 'Масло в коробке (АКПП / РКПП)', dist: 50000, hours: 0, months: 36 },
    { title: 'Антифриз (Охлаждающая жидкость)', dist: 50000, hours: 0, months: 48 },
  ];

  const handleApplyPreset = (p: typeof quickPresets[0]) => {
    setFormData((prev) => ({
      ...prev,
      title: p.title,
      interval_distance: p.dist,
      interval_hours: p.hours,
      interval_months: p.months,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        last_service_date: new Date(formData.last_service_date).toISOString(),
        interval_distance: formData.interval_distance > 0 ? formData.interval_distance : null,
        interval_hours: formData.interval_hours > 0 ? formData.interval_hours : null,
        interval_months: formData.interval_months > 0 ? formData.interval_months : null,
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении регламента');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl transition-colors">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-750">
          <div className="flex items-center space-x-2">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {plan ? 'Редактировать регламент ТО' : 'Новый регламент ТО и износа'}
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
          {!plan && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Быстрые шаблоны регламентов:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickPresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-750 border border-slate-200 dark:border-dark-750 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {p.title.split(' ')[0]} {p.title.split(' ')[1] || ''} ({p.dist / 1000}k км)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Название работы / расходника *
            </label>
            <input
              type="text"
              required
              placeholder="Замена моторного масла, фильтра, свечей..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Бренд расходника (опция)
              </label>
              <input
                type="text"
                placeholder="Лукойл, VIC, Denso..."
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Артикул / Партномер
              </label>
              <input
                type="text"
                placeholder="16510-61A31..."
                value={formData.article}
                onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-dark-900 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Интервал ({vehicle.distance_unit})
              </label>
              <input
                type="number"
                step="any"
                placeholder="7500"
                value={formData.interval_distance || ''}
                onChange={(e) =>
                  setFormData({ ...formData, interval_distance: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                Интервал (м/ч)
              </label>
              <input
                type="number"
                step="any"
                placeholder="250"
                value={formData.interval_hours || ''}
                onChange={(e) =>
                  setFormData({ ...formData, interval_hours: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-cyan-600 dark:text-cyan-400 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Интервал (месяцев)
              </label>
              <input
                type="number"
                placeholder="12"
                value={formData.interval_months || ''}
                onChange={(e) =>
                  setFormData({ ...formData, interval_months: parseInt(e.target.value) || 0 })
                }
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Пробег последнего ТО *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.last_service_odometer}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    last_service_odometer: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Моточасы последнего ТО
              </label>
              <input
                type="number"
                step="any"
                value={formData.last_service_hours || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    last_service_hours: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Дата последнего ТО *
              </label>
              <input
                type="date"
                required
                value={formData.last_service_date}
                onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Примечания / Рекомендации по спецификации
            </label>
            <input
              type="text"
              placeholder="Объем 4.5 л, допуск SP / C5..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
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
              {loading ? 'Сохранение...' : plan ? 'Сохранить изменения' : 'Создать регламент'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
