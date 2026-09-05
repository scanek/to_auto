import React, { useState, useEffect } from 'react';
import { X, Wrench, Sparkles, Tag, ShieldCheck, Clock, FileText, Check } from 'lucide-react';
import { VehicleConsumable, Vehicle } from '../types';

interface ConsumableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<VehicleConsumable>) => Promise<void>;
  consumable?: VehicleConsumable | null;
  vehicle: Vehicle;
}

const CATEGORIES = [
  { id: 'engine', label: 'Двигатель и масло', icon: '🛢️', desc: 'Масло ДВС, ремни, прокладки' },
  { id: 'filters', label: 'Фильтры', icon: '🌪️', desc: 'Масляный, воздушный, салонный, топливный' },
  { id: 'transmission', label: 'Трансмиссия и КПП', icon: '⚙️', desc: 'Масло АКПП, редукторы, сцепление' },
  { id: 'brakes', label: 'Тормоза', icon: '🛑', desc: 'Колодки, диски, тормозная жидкость' },
  { id: 'cooling', label: 'Охлаждение', icon: '❄️', desc: 'Антифриз, помпа, термостат' },
  { id: 'electrical', label: 'Электрика и свечи', icon: '⚡', desc: 'Свечи, аккумулятор, лампы' },
  { id: 'wipers', label: 'Щетки дворников', icon: '🌧️', desc: 'Передние и задние стеклоочистители' },
  { id: 'other', label: 'Другое', icon: '📦', desc: 'Подвеска, кузов, аксессуары' },
];

const SUGGESTIONS: Record<string, string[]> = {
  engine: ['Масло моторное', 'Ремень приводной / генератора', 'Ремень / цепь ГРМ', 'Ролик натяжителя', 'Прокладка клапанной крышки'],
  filters: ['Масляный фильтр ДВС', 'Воздушный фильтр ДВС', 'Салонный фильтр (угольный)', 'Топливный фильтр'],
  transmission: ['Масло в коробку (АКПП/DCT/CVT)', 'Фильтр АКПП', 'Масло в редуктор', 'Масло в раздаточную коробку'],
  brakes: ['Передние тормозные колодки', 'Задние тормозные колодки', 'Тормозная жидкость', 'Передние тормозные диски', 'Задние тормозные диски'],
  cooling: ['Антифриз (ОЖ)', 'Водяной насос (помпа)', 'Термостат', 'Крышка расширительного бачка'],
  electrical: ['Свечи зажигания', 'Аккумуляторная батарея (АКБ)', 'Катушка зажигания', 'Лампы ближнего света', 'Лампы ПТФ'],
  wipers: ['Щетки стеклоочистителя (комплект)', 'Щетка стеклоочистителя задняя'],
  other: ['Стойки стабилизатора', 'Сайлентблоки рычагов', 'Амортизаторы передние', 'Амортизаторы задние'],
};

export const ConsumableModal: React.FC<ConsumableModalProps> = ({
  isOpen,
  onClose,
  onSave,
  consumable,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    category: 'engine' as VehicleConsumable['category'],
    name: '',
    specification: '',
    oem_part_number: '',
    aftermarket_parts: '',
    replacement_interval: '',
    notes: '',
    order_index: 0,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (consumable) {
      setFormData({
        category: consumable.category,
        name: consumable.name || '',
        specification: consumable.specification || '',
        oem_part_number: consumable.oem_part_number || '',
        aftermarket_parts: consumable.aftermarket_parts || '',
        replacement_interval: consumable.replacement_interval || '',
        notes: consumable.notes || '',
        order_index: consumable.order_index || 0,
      });
    } else {
      setFormData({
        category: 'engine',
        name: '',
        specification: vehicle.oil_spec || '',
        oem_part_number: '',
        aftermarket_parts: '',
        replacement_interval: 'Каждые 7 500 км или 250 мч',
        notes: '',
        order_index: 0,
      });
    }
  }, [consumable, isOpen, vehicle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setLoading(true);
      await onSave({
        ...formData,
        name: formData.name.trim(),
        oem_part_number: formData.oem_part_number.trim() || null,
        specification: formData.specification.trim() || null,
        aftermarket_parts: formData.aftermarket_parts.trim() || null,
        replacement_interval: formData.replacement_interval.trim() || null,
        notes: formData.notes.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentSuggestions = SUGGESTIONS[formData.category] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-dark-750 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-750">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {consumable ? 'Редактировать расходник' : 'Добавить расходник в паспорт'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Category selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Категория
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = formData.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.id as any })}
                    className={`flex items-center space-x-1.5 p-2 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-slate-200 dark:border-dark-750 hover:bg-slate-50 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Название расходника / узла *
              </label>
              <span className="text-[10px] text-slate-400">Нажмите на подсказку</span>
            </div>
            <input
              type="text"
              required
              placeholder="Например: Масляный фильтр ДВС"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
            />
            {currentSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currentSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFormData({ ...formData, name: sug })}
                    className="text-[10.5px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-dark-800 hover:bg-brand-500/10 hover:text-brand-500 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-750 transition"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* OEM Part Number & Specification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Оригинальный артикул (OEM)
              </label>
              <input
                type="text"
                placeholder="1017100-M01"
                value={formData.oem_part_number}
                onChange={(e) => setFormData({ ...formData, oem_part_number: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500 uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Спецификация / параметры
              </label>
              <input
                type="text"
                placeholder="SAE 0W-20 SP, 4.2 л..."
                value={formData.specification}
                onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
          </div>

          {/* Aftermarket parts (Аналоги) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Проверенные аналоги (через запятую)
            </label>
            <input
              type="text"
              placeholder="Mann W 7053, Filtron OP641/2, Bosch 0451103316..."
              value={formData.aftermarket_parts}
              onChange={(e) => setFormData({ ...formData, aftermarket_parts: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
            />
            <p className="text-[10.5px] text-slate-400 mt-1">
              Каждый артикул можно будет найти в 1 клик на Exist, Autodoc, Ozon и др.
            </p>
          </div>

          {/* Replacement Interval */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Регламент / Интервал замены
            </label>
            <input
              type="text"
              placeholder="Каждые 7 500 км или 250 моточасов"
              value={formData.replacement_interval}
              onChange={(e) => setFormData({ ...formData, replacement_interval: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Заметки и нюансы (моменты затяжки, заправочные объемы)
            </label>
            <textarea
              rows={2}
              placeholder="Шайба пробки поддона: 1004104-M01. Затягивать моментом 25 Нм..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-dark-750">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 active:scale-95 rounded-xl shadow-md shadow-brand-500/25 transition disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : consumable ? 'Сохранить изменения' : 'Добавить расходник'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
