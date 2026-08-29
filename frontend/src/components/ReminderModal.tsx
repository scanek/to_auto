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
    description: '',
    interval_distance: 8000,
    interval_months: 12,
    last_service_odometer: vehicle.current_odometer || 0,
    last_service_date: new Date().toISOString().split('T')[0],
    is_active: true,
    notify_before_distance: 500,
    notify_before_days: 14,
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setFormData({
        title: plan.title,
        description: plan.description || '',
        interval_distance: plan.interval_distance || 0,
        interval_months: plan.interval_months || 0,
        last_service_odometer: plan.last_service_odometer,
        last_service_date: plan.last_service_date.split('T')[0],
        is_active: plan.is_active,
        notify_before_distance: plan.notify_before_distance,
        notify_before_days: plan.notify_before_days,
        notes: plan.notes || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        interval_distance: 8000,
        interval_months: 12,
        last_service_odometer: vehicle.current_odometer || 0,
        last_service_date: new Date().toISOString().split('T')[0],
        is_active: true,
        notify_before_distance: 500,
        notify_before_days: 14,
        notes: '',
      });
    }
  }, [plan, isOpen, vehicle]);

  if (!isOpen) return null;

  const quickPresets = [
    { title: 'Замена масла в двигателе и фильтра', dist: 7500, months: 12 },
    { title: 'Замена воздушного и салонного фильтра', dist: 15000, months: 12 },
    { title: 'Замена тормозной жидкости', dist: 40000, months: 24 },
    { title: 'Замена масла в АКПП / Вариаторе', dist: 50000, months: 36 },
    { title: 'Замена свечей зажигания', dist: 30000, months: 24 },
    { title: 'Замена охлаждающей жидкости (Антифриз)', dist: 60000, months: 48 },
  ];

  const handleApplyPreset = (p: typeof quickPresets[0]) => {
    setFormData((prev) => ({
      ...prev,
      title: p.title,
      interval_distance: p.dist,
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
        interval_months: formData.interval_months > 0 ? formData.interval_months : null,
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении напоминания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <CalendarClock className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              {plan ? 'Редактировать регламент ТО' : 'Новое напоминание / Регламент ТО'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {!plan && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Быстрые шаблоны регламентов:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickPresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-[11px] bg-dark-900 hover:bg-dark-750 border border-dark-750 text-slate-300 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {p.title.split(' ')[1] || p.title} ({p.dist / 1000}k км)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Название работы *
            </label>
            <input
              type="text"
              required
              placeholder="Замена моторного масла, свечей, ремня ГРМ..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-dark-900 p-3.5 rounded-xl border border-dark-750">
            <div>
              <label className="block text-xs font-semibold text-brand-400 mb-1">
                Интервал по пробегу ({vehicle.distance_unit})
              </label>
              <input
                type="number"
                step="any"
                placeholder="Например: 8000"
                value={formData.interval_distance || ''}
                onChange={(e) =>
                  setFormData({ ...formData, interval_distance: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">0 или пусто — без учета пробега</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-400 mb-1">
                Интервал по времени (месяцев)
              </label>
              <input
                type="number"
                placeholder="Например: 12"
                value={formData.interval_months || ''}
                onChange={(e) =>
                  setFormData({ ...formData, interval_months: parseInt(e.target.value) || 0 })
                }
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">0 или пусто — без учета времени</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Пробег последнего выполнения *
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
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дата последнего выполнения *
              </label>
              <input
                type="date"
                required
                value={formData.last_service_date}
                onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-dark-900/60 p-3 rounded-xl border border-dark-750/70">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Предупреждать за (пробег)
              </label>
              <input
                type="number"
                value={formData.notify_before_distance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notify_before_distance: parseFloat(e.target.value) || 500,
                  })
                }
                className="w-full bg-dark-850 border border-dark-750 rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Предупреждать за (дней)
              </label>
              <input
                type="number"
                value={formData.notify_before_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notify_before_days: parseInt(e.target.value) || 14,
                  })
                }
                className="w-full bg-dark-850 border border-dark-750 rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Примечания / Артикулы рекомендованных расходников
            </label>
            <input
              type="text"
              placeholder="Объем масла 4.2 л, фильтр арт. 90915-10004..."
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
              {loading ? 'Сохранение...' : plan ? 'Сохранить изменения' : 'Создать регламент'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
