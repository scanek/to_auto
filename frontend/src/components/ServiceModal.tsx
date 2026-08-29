import React, { useState, useEffect } from 'react';
import { X, Wrench, Plus, Trash2, Tag } from 'lucide-react';
import { ServiceRecord, ServiceItem, Vehicle } from '../types';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ServiceRecord>) => Promise<void>;
  record?: ServiceRecord | null;
  vehicle: Vehicle;
  defaultType?: 'service' | 'repair' | 'upgrade';
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  record,
  vehicle,
  defaultType = 'service',
}) => {
  const [formData, setFormData] = useState({
    record_type: defaultType as 'service' | 'repair' | 'upgrade',
    date: new Date().toISOString().split('T')[0],
    odometer: vehicle.current_odometer || 0,
    title: '',
    description: '',
    cost_labor: 0,
    cost_parts: 0,
    total_cost: 0,
    notes: '',
  });

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (record) {
      setFormData({
        record_type: record.record_type,
        date: record.date.split('T')[0],
        odometer: record.odometer,
        title: record.title,
        description: record.description || '',
        cost_labor: record.cost_labor || 0,
        cost_parts: record.cost_parts || 0,
        total_cost: record.total_cost || 0,
        notes: record.notes || '',
      });
      setItems(record.items || []);
    } else {
      setFormData({
        record_type: defaultType,
        date: new Date().toISOString().split('T')[0],
        odometer: vehicle.current_odometer || 0,
        title: '',
        description: '',
        cost_labor: 0,
        cost_parts: 0,
        total_cost: 0,
        notes: '',
      });
      setItems([]);
    }
  }, [record, isOpen, vehicle, defaultType]);

  if (!isOpen) return null;

  // Auto-calculate parts cost from items
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        name: '',
        part_number: '',
        category: 'part',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof ServiceItem, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? value : next[index].quantity;
      const u = field === 'unit_price' ? value : next[index].unit_price;
      next[index].total_price = (parseFloat(q) || 0) * (parseFloat(u) || 0);
    }

    setItems(next);

    // Recalculate cost parts
    const partsTotal = next
      .filter((it) => it.category === 'part')
      .reduce((sum, it) => sum + (it.total_price || 0), 0);
    const laborTotal = next
      .filter((it) => it.category === 'labor')
      .reduce((sum, it) => sum + (it.total_price || 0), 0);

    const newLabor = laborTotal > 0 ? laborTotal : formData.cost_labor;
    const newParts = partsTotal > 0 ? partsTotal : formData.cost_parts;

    setFormData((prev) => ({
      ...prev,
      cost_parts: partsTotal > 0 ? partsTotal : prev.cost_parts,
      cost_labor: laborTotal > 0 ? laborTotal : prev.cost_labor,
      total_cost: newParts + newLabor,
    }));
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const total = (formData.total_cost && formData.total_cost > 0)
        ? formData.total_cost
        : (formData.cost_parts || 0) + (formData.cost_labor || 0);

      await onSave({
        ...formData,
        date: new Date(formData.date).toISOString(),
        total_cost: total,
        items,
      });
      onClose();
    } catch (err) {
      alert('Ошибка сохранения записи');
    } finally {
      setLoading(false);
    }
  };

  const typeLabels = {
    service: 'Плановое ТО',
    repair: 'Внеплановый ремонт',
    upgrade: 'Тюнинг / Дооснащение',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              {record ? 'Редактировать запись' : `Новая запись: ${typeLabels[formData.record_type]}`}
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
          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-dark-900 rounded-xl border border-dark-750">
            {(['service', 'repair', 'upgrade'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFormData({ ...formData, record_type: t })}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  formData.record_type === t
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дата *
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
                Пробег ({vehicle.distance_unit}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.odometer}
                onChange={(e) =>
                  setFormData({ ...formData, odometer: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Название / Тема обслуживания *
            </label>
            <input
              type="text"
              required
              placeholder={
                formData.record_type === 'service'
                  ? 'Замена масла ДВС и фильтров, ТО-4...'
                  : formData.record_type === 'repair'
                  ? 'Замена передних ступичных подшипников...'
                  : 'Установка фаркопа, шумоизоляция дверей...'
              }
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Описание выполненных работ
            </label>
            <textarea
              rows={2}
              placeholder="Детали обслуживания, сервис, диагностика..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Parts / Items Table */}
          <div className="bg-dark-900 border border-dark-750 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-400" />
                Запчасти и расходные материалы
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center space-x-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2 py-1 rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить позицию</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-3 text-xs text-slate-500 border border-dashed border-dark-750 rounded-lg">
                Нет добавленных запчастей. Можно ввести общую сумму ниже или добавить позиции с артикулами.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-dark-850 p-2 rounded-lg border border-dark-750 text-xs"
                  >
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Наименование (Масло...)"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Артикул / Партномер"
                        value={item.part_number || ''}
                        onChange={(e) => handleUpdateItem(idx, 'part_number', e.target.value)}
                        className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        placeholder="Кол-во"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white text-xs text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Цена"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white text-xs text-right font-mono"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Costs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-dark-900 p-3 rounded-xl border border-dark-750">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Стоимость запчастей ({vehicle.currency})
              </label>
              <input
                type="number"
                step="any"
                value={formData.cost_parts}
                onChange={(e) => {
                  const parts = parseFloat(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    cost_parts: parts,
                    total_cost: parts + (formData.cost_labor || 0),
                  });
                }}
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Стоимость работ ({vehicle.currency})
              </label>
              <input
                type="number"
                step="any"
                value={formData.cost_labor}
                onChange={(e) => {
                  const labor = parseFloat(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    cost_labor: labor,
                    total_cost: (formData.cost_parts || 0) + labor,
                  });
                }}
                className="w-full bg-dark-850 border border-dark-750 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-brand-400 mb-1">
                ИТОГО ({vehicle.currency}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.total_cost}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    total_cost: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-dark-850 border border-brand-500/50 rounded-lg px-2.5 py-1.5 text-xs text-brand-400 font-bold focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Заметки мастера / сервиса
            </label>
            <input
              type="text"
              placeholder="Гарантия 6 месяцев, заказ-наряд №4512..."
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
              {loading ? 'Сохранение...' : record ? 'Сохранить изменения' : 'Добавить запись'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
