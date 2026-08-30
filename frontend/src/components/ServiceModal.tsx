import React, { useState, useEffect } from 'react';
import { X, Wrench, Plus, Trash2, Tag, ShoppingCart, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { ServiceRecord, ServiceItem, Vehicle } from '../types';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ServiceRecord>) => Promise<void>;
  record?: ServiceRecord | null;
  vehicle: Vehicle;
  defaultType?: 'service' | 'repair' | 'upgrade';
}

const POPULAR_STORES = ['Ozon', 'Wildberries', 'Exist', 'Автодок', 'Emex', 'Авито', 'Яндекс Маркет', 'Дилер'];

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
    to_tag: '',
    date: new Date().toISOString().split('T')[0],
    odometer: vehicle.current_odometer || 0,
    engine_hours: vehicle.current_engine_hours || 0,
    title: '',
    description: '',
    store: '',
    url: '',
    cost_labor: 0,
    cost_parts: 0,
    total_cost: 0,
    notes: '',
  });

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (record) {
      const recordItems = record.items || [];
      const partsSum = recordItems
        .filter((it) => it.category !== 'labor')
        .reduce((sum, it) => sum + (it.total_price || ((it.quantity || 1) * (it.unit_price || 0))), 0);
      const laborSum = recordItems
        .filter((it) => it.category === 'labor')
        .reduce((sum, it) => sum + (it.total_price || ((it.quantity || 1) * (it.unit_price || 0))), 0);

      const resolvedParts = partsSum > 0 ? partsSum : (record.cost_parts || 0);
      const resolvedLabor = laborSum > 0 ? laborSum : (record.cost_labor || 0);
      const minTotal = resolvedParts + resolvedLabor;
      const resolvedTotal = (record.total_cost && record.total_cost >= minTotal && record.total_cost > 0)
        ? record.total_cost
        : minTotal;

      setFormData({
        record_type: record.record_type,
        to_tag: record.to_tag || '',
        date: record.date.split('T')[0],
        odometer: record.odometer,
        engine_hours: record.engine_hours || 0,
        title: record.title,
        description: record.description || '',
        store: record.store || '',
        url: record.url || '',
        cost_labor: resolvedLabor,
        cost_parts: resolvedParts,
        total_cost: resolvedTotal,
        notes: record.notes || '',
      });
      setItems(recordItems);
    } else {
      setFormData({
        record_type: defaultType,
        to_tag: '',
        date: new Date().toISOString().split('T')[0],
        odometer: vehicle.current_odometer || 0,
        engine_hours: vehicle.current_engine_hours || 0,
        title: '',
        description: '',
        store: '',
        url: '',
        cost_labor: 0,
        cost_parts: 0,
        total_cost: 0,
        notes: '',
      });
      setItems([]);
    }
  }, [record, isOpen, vehicle, defaultType]);

  if (!isOpen) return null;

  const updateItemsAndCosts = (
    newItems: ServiceItem[],
    customLabor?: number,
    customParts?: number
  ) => {
    setItems(newItems);
    const partsSum = newItems
      .filter((it) => it.category !== 'labor')
      .reduce((sum, it) => sum + (it.total_price || ((it.quantity || 1) * (it.unit_price || 0))), 0);
    const laborSum = newItems
      .filter((it) => it.category === 'labor')
      .reduce((sum, it) => sum + (it.total_price || ((it.quantity || 1) * (it.unit_price || 0))), 0);

    const parts = customParts !== undefined ? customParts : (partsSum > 0 ? partsSum : (newItems.length === 0 ? formData.cost_parts : partsSum));
    const labor = customLabor !== undefined ? customLabor : (laborSum > 0 ? laborSum : formData.cost_labor);

    setFormData((prev) => ({
      ...prev,
      cost_parts: parts,
      cost_labor: labor,
      total_cost: parts + labor,
    }));
  };

  const handleAddItem = () => {
    const newItems = [
      ...items,
      {
        name: '',
        brand: '',
        part_number: '',
        store: formData.store || '',
        url: '',
        category: 'part',
        unit: 'шт',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      },
    ];
    updateItemsAndCosts(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof ServiceItem, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? parseFloat(value) || 0 : next[index].quantity;
      const u = field === 'unit_price' ? parseFloat(value) || 0 : next[index].unit_price;
      next[index].total_price = q * u;
    }

    updateItemsAndCosts(next);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    updateItemsAndCosts(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const partsSum = items
        .filter((it) => it.category !== 'labor')
        .reduce((sum, it) => sum + (it.total_price || ((it.quantity || 1) * (it.unit_price || 0))), 0);
      const laborSum = items
        .filter((it) => it.category === 'labor')
        .reduce((sum, it) => sum + (it.total_price || ((it.quantity || 1) * (it.unit_price || 0))), 0);

      const resolvedParts = partsSum > 0 ? partsSum : (formData.cost_parts || 0);
      const resolvedLabor = laborSum > 0 ? laborSum : (formData.cost_labor || 0);
      const minTotal = resolvedParts + resolvedLabor;
      const finalTotal = formData.total_cost > 0 && formData.total_cost >= minTotal
        ? formData.total_cost
        : minTotal;

      await onSave({
        ...formData,
        cost_parts: resolvedParts,
        cost_labor: resolvedLabor,
        total_cost: finalTotal,
        date: new Date(formData.date).toISOString(),
        engine_hours: formData.engine_hours > 0 ? formData.engine_hours : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-750">
          <div className="flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {record ? 'Редактировать запись' : `Новая запись: ${typeLabels[formData.record_type]}`}
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
          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-750">
            {(['service', 'repair', 'upgrade'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFormData({ ...formData, record_type: t })}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  formData.record_type === t
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>

          {/* Date, Mileage, Engine Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Дата *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Моточасы (м/ч)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Не указано"
                value={formData.engine_hours || ''}
                onChange={(e) =>
                  setFormData({ ...formData, engine_hours: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Title & Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Название / Тема обслуживания *
              </label>
              <input
                type="text"
                required
                placeholder={
                  formData.record_type === 'service'
                    ? 'Замена масла ДВС и фильтров, ТО-4...'
                    : formData.record_type === 'repair'
                    ? 'Замена передних тормозных колодок...'
                    : 'Шумоизоляция дверей, накладки порогов...'
                }
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Тег ТО (опция)
              </label>
              <input
                type="text"
                placeholder="ТО-1, ТО-2..."
                value={formData.to_tag}
                onChange={(e) => setFormData({ ...formData, to_tag: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* General Store & URL Fields (For entire record / single item) */}
          <div className="bg-slate-50 dark:bg-dark-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-dark-750/80 space-y-3">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <ShoppingCart className="w-3.5 h-3.5 text-brand-500" />
              <span>Магазин и ссылка на покупку (Ozon, Exist, Автодок...)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Название магазина / сервиса
                </label>
                <input
                  type="text"
                  placeholder="Ozon, Exist, Wildberries, Автодок..."
                  value={formData.store}
                  onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                  className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {POPULAR_STORES.slice(0, 5).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFormData({ ...formData, store: st })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-dark-800 hover:bg-brand-500 hover:text-white text-slate-600 dark:text-slate-400 transition"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Ссылка на товар / заказ (URL)
                </label>
                <div className="flex items-center space-x-1.5">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      placeholder="https://ozon.ru/product/..."
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                  {formData.url && (
                    <a
                      href={formData.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-brand-500/10 hover:bg-brand-500 text-brand-500 hover:text-white rounded-lg border border-brand-500/20 transition"
                      title="Проверить ссылку"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Описание выполненных работ / комментарий
            </label>
            <textarea
              rows={2}
              placeholder="Детали обслуживания, сервис, диагностика..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Parts / Items Table */}
          <div className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-500" />
                Запчасти, расходники и детали ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center space-x-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:text-white hover:bg-brand-500 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Добавить позицию</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-dark-750 rounded-xl">
                Нет добавленных запчастей. Можно ввести общую сумму ниже или добавить позиции с артикулами, магазинами и ссылками.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-dark-850 p-3 rounded-xl border border-slate-200 dark:border-dark-750 shadow-sm space-y-2.5 text-xs"
                  >
                    {/* Row 1: Name, Brand, Part Number, Delete */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 sm:col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Наименование (Масло, фильтр, спойлер...)"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="text"
                          placeholder="Бренд (Лукойл, VIC...)"
                          value={item.brand || ''}
                          onChange={(e) => handleUpdateItem(idx, 'brand', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="text"
                          placeholder="Артикул / Код"
                          value={item.part_number || ''}
                          onChange={(e) => handleUpdateItem(idx, 'part_number', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-500/10 transition"
                          title="Удалить позицию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Store, URL, Quantity, Unit Price, Total */}
                    <div className="grid grid-cols-12 gap-2 items-center pt-1 border-t border-slate-100 dark:border-dark-750">
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="text"
                          placeholder="Магазин (Ozon, Exist...)"
                          value={item.store || ''}
                          onChange={(e) => handleUpdateItem(idx, 'store', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-[11px]"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-3 flex items-center space-x-1">
                        <input
                          type="url"
                          placeholder="Ссылка (URL)..."
                          value={item.url || ''}
                          onChange={(e) => handleUpdateItem(idx, 'url', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                        />
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-brand-500 hover:text-brand-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          placeholder="Кол-во"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-1.5 py-1 text-slate-900 dark:text-white text-[11px] text-center font-mono"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <input
                          type="number"
                          step="any"
                          placeholder="Цена/ед"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-1.5 py-1 text-slate-900 dark:text-white text-[11px] text-right font-mono"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2 text-right">
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-xs">
                          {Math.round(item.total_price || 0).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Costs Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-dark-900 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Стоимость деталей ({vehicle.currency})
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
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Стоимость работ / сервиса ({vehicle.currency})
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
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-brand-600 dark:text-brand-400 mb-1">
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
                className="w-full bg-white dark:bg-dark-850 border border-brand-500/60 rounded-xl px-3 py-2 text-xs sm:text-sm text-brand-600 dark:text-brand-400 font-bold focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Заметки мастера / сервиса / номер заказ-наряда
            </label>
            <input
              type="text"
              placeholder="Гарантия 6 месяцев, заказ-наряд №4512..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Footer Buttons */}
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
              {loading ? 'Сохранение...' : record ? 'Сохранить изменения' : 'Добавить запись'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
