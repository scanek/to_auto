import React, { useState, useEffect } from 'react';
import { X, Wrench, Plus, Trash2, Tag, ExternalLink, Sparkles, Camera } from 'lucide-react';
import { ServiceRecord, ServiceItem, Vehicle } from '../types';
import { ReceiptScanModal } from './ReceiptScanModal';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ServiceRecord>) => Promise<void>;
  record?: ServiceRecord | null;
  vehicle: Vehicle;
  defaultType?: 'service' | 'repair' | 'upgrade';
}

const POPULAR_STORES = ['Ozon', 'Wildberries', 'Exist', 'Автодок', 'Emex', 'Авито', 'Дилер'];
const ITEM_UNITS = ['шт', 'л', 'компл', 'кан', 'уп', 'кг', 'г', 'м'];

const QUICK_PART_PRESETS = [
  { name: 'Масло моторное', brand: '', unit: 'л', quantity: 4 },
  { name: 'Масляный фильтр', brand: '', unit: 'шт', quantity: 1 },
  { name: 'Воздушный фильтр', brand: '', unit: 'шт', quantity: 1 },
  { name: 'Салонный фильтр', brand: '', unit: 'шт', quantity: 1 },
  { name: 'Свечи зажигания', brand: '', unit: 'компл', quantity: 1 },
  { name: 'Тормозные колодки', brand: '', unit: 'компл', quantity: 1 },
];

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
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (record) {
      let recordItems = record.items ? [...record.items] : [];
      // If record has no items, but has url/store/cost_parts, convert into an initial item
      if (recordItems.length === 0 && (record.url || record.store || (record.cost_parts && record.cost_parts > 0))) {
        recordItems = [
          {
            name: record.title || 'Расходники / Детали',
            brand: '',
            part_number: '',
            store: record.store || '',
            url: record.url || '',
            category: 'part',
            unit: 'шт',
            quantity: 1,
            unit_price: record.cost_parts || record.total_cost || 0,
            total_price: record.cost_parts || record.total_cost || 0,
          },
        ];
      }

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

  const handleAddItem = (preset?: typeof QUICK_PART_PRESETS[0]) => {
    const newItem: ServiceItem = {
      name: preset ? preset.name : '',
      brand: preset ? preset.brand : '',
      part_number: '',
      store: '',
      url: '',
      category: 'part',
      unit: preset ? preset.unit : 'шт',
      quantity: preset ? preset.quantity : 1,
      unit_price: 0,
      total_price: 0,
    };
    const newItems = [newItem, ...items];
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
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg border border-purple-200 dark:border-purple-800/80 flex items-center space-x-1.5 transition active:scale-95 shadow-xs"
              title="Распознать заказ-наряд или чек по фото с помощью нейросети"
            >
              <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Скан чека (OCR)</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {formData.record_type === 'service'
                  ? 'Тег ТО (опция)'
                  : formData.record_type === 'upgrade'
                  ? 'Категория тюнинга'
                  : 'Категория ремонта'}
              </label>
              <input
                type="text"
                placeholder={
                  formData.record_type === 'service'
                    ? 'ТО-1, ТО-2...'
                    : formData.record_type === 'upgrade'
                    ? 'Стайлинг, Допы...'
                    : 'Ходовая, Тормоза...'
                }
                value={formData.to_tag}
                onChange={(e) => setFormData({ ...formData, to_tag: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Quick Tag Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Быстрый тег:</span>
            {(formData.record_type === 'service'
              ? ['ТО-0', 'ТО-1', 'ТО-2', 'ТО-3', 'ТО-4', 'ТО-5', 'ТО-6', 'Вне ТО']
              : formData.record_type === 'upgrade'
              ? ['Допы', 'Стайлинг', 'Шумоизоляция', 'Свет', 'Салон', 'Защита', 'Аудио', 'Вне ТО']
              : ['Ходовая', 'Тормоза', 'ДВС', 'Электрика', 'Кузов', 'Вне ТО']
            ).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFormData({ ...formData, to_tag: formData.to_tag === tag ? '' : tag })}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all ${
                  formData.to_tag === tag
                    ? formData.record_type === 'upgrade'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : formData.record_type === 'repair'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700 border border-slate-200 dark:border-dark-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* MAIN SECTION: PARTS, CONSUMABLES & DETAILS */}
          <div className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl p-4 space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Купленные расходники и запчасти ({items.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Артикулы, бренды, цены, количество и ссылки на Ozon / Exist / Автодок
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddItem()}
                className="flex items-center space-x-1.5 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-xl transition shadow-sm self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Добавить позицию</span>
              </button>
            </div>

            {/* Quick Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Быстро добавить:
              </span>
              {QUICK_PART_PRESETS.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleAddItem(preset)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-white dark:bg-dark-850 hover:bg-brand-50 dark:hover:bg-dark-750 hover:text-brand-600 dark:hover:text-brand-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 transition shadow-2xs"
                >
                  + {preset.name}
                </button>
              ))}
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div className="text-center py-6 px-4 text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-dark-750 rounded-xl bg-white/50 dark:bg-dark-850/50 space-y-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Пока нет добавленных запчастей</div>
                <div>Нажмите на кнопки выше, чтобы добавить масло, фильтры или другие детали с артикулами и ссылками на покупку.</div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-dark-850 p-3.5 rounded-xl border border-slate-200 dark:border-dark-750 shadow-sm space-y-2.5 text-xs transition-all hover:border-slate-300 dark:hover:border-dark-700"
                  >
                    {/* Line 1: Name, Brand, Part Number, Delete */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-5">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 sm:hidden">
                          Наименование детали
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Наименование (Масло, фильтр, колодки...)"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-semibold text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 sm:hidden">
                          Бренд
                        </label>
                        <input
                          type="text"
                          placeholder="Бренд (VIC, Lukoil...)"
                          value={item.brand || ''}
                          onChange={(e) => handleUpdateItem(idx, 'brand', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 sm:hidden">
                          Артикул / Код
                        </label>
                        <input
                          type="text"
                          placeholder="Артикул (C-933...)"
                          value={item.part_number || ''}
                          onChange={(e) => handleUpdateItem(idx, 'part_number', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end sm:justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                          title="Удалить позицию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Line 2: Store, URL, Quantity + Unit, Unit Price, Total */}
                    <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-slate-100 dark:border-dark-750">
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                        <input
                          type="text"
                          placeholder="Магазин (Ozon, Exist, WB...)"
                          value={item.store || ''}
                          onChange={(e) => handleUpdateItem(idx, 'store', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 text-[11px] focus:outline-none focus:border-brand-500"
                        />
                        <div className="flex flex-wrap gap-1">
                          {POPULAR_STORES.slice(0, 5).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateItem(idx, 'store', st)}
                              className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-dark-800 hover:bg-brand-500 hover:text-white text-slate-500 dark:text-slate-400 transition"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="col-span-12 sm:col-span-3 flex items-center space-x-1">
                        <input
                          type="url"
                          placeholder="Ссылка на товар (URL)..."
                          value={item.url || ''}
                          onChange={(e) => handleUpdateItem(idx, 'url', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 font-mono text-[11px] focus:outline-none focus:border-brand-500"
                        />
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-brand-500 hover:text-brand-600 flex-shrink-0"
                            title="Открыть ссылку"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="col-span-5 sm:col-span-2 flex items-center space-x-1">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          placeholder="Кол-во"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-14 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-1.5 py-1 text-slate-900 dark:text-white text-[11px] text-center font-mono focus:outline-none focus:border-brand-500"
                          title="Количество"
                        />
                        <select
                          value={item.unit || 'шт'}
                          onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                          className="bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-1 py-1 text-slate-700 dark:text-slate-300 text-[11px] font-semibold focus:outline-none focus:border-brand-500 cursor-pointer"
                          title="Единица измерения"
                        >
                          {ITEM_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          step="any"
                          placeholder={`Цена/${item.unit || 'ед'}`}
                          value={item.unit_price}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-lg px-1.5 py-1 text-slate-900 dark:text-white text-[11px] text-right font-mono focus:outline-none focus:border-brand-500"
                          title={`Цена за 1 ${item.unit || 'ед.'}`}
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-1 text-right">
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-xs block truncate" title={`${item.quantity} ${item.unit || 'шт'} × ${item.unit_price} ₽ = ${Math.round(item.total_price || 0)} ₽`}>
                          {Math.round(item.total_price || 0).toLocaleString('ru-RU')} ₽
                        </span>
                        {item.quantity > 1 && item.unit_price > 0 && (
                          <span className="text-[9px] text-slate-400 font-mono block truncate">
                            {item.quantity} × {Math.round(item.unit_price)}
                          </span>
                        )}
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
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-semibold"
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
                className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-brand-600 dark:text-brand-400 mb-1">
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
                className="w-full bg-white dark:bg-dark-850 border border-brand-500/60 rounded-xl px-3 py-2 text-xs sm:text-sm text-brand-600 dark:text-brand-400 font-extrabold focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          {/* Description & Additional Workshop Notes */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Описание выполненных работ / комментарий
              </label>
              <textarea
                rows={2}
                placeholder="Детали обслуживания, сервис, замечания, диагностика..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Автосервис / СТО / Место
                </label>
                <input
                  type="text"
                  placeholder="Дилер Changan, Гараж, FIT Service..."
                  value={formData.store}
                  onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Заметки / Номер заказ-наряда
                </label>
                <input
                  type="text"
                  placeholder="Заказ-наряд №4512, гарантия 6 мес..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
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

      {isScannerOpen && (
        <ReceiptScanModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          vehicle={vehicle}
          onApplyToService={(data, attachUrl) => {
            setFormData(prev => ({
              ...prev,
              record_type: data.record_type || prev.record_type,
              date: data.date || prev.date,
              odometer: data.odometer ?? prev.odometer,
              engine_hours: data.engine_hours ?? prev.engine_hours,
              title: data.title || prev.title,
              description: data.description || prev.description,
              store: data.store || prev.store,
              cost_labor: data.cost_labor ?? prev.cost_labor,
              cost_parts: data.cost_parts ?? prev.cost_parts,
              total_cost: data.total_cost ?? prev.total_cost,
              notes: data.notes || prev.notes,
            }));
            if (Array.isArray(data.items) && data.items.length > 0) {
              setItems(data.items);
            }
          }}
          onApplyToFuel={() => {}}
        />
      )}
    </div>
  );
};
