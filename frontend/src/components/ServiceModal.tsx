import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  Plus,
  Trash2,
  Camera,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { ServiceRecord, ServiceItem, Vehicle } from '../types';
import { ReceiptScanModal } from './ReceiptScanModal';
import { detectStoreFromUrl } from './StoreBadge';
import { useModalA11y } from '../utils/useModalA11y';
import { getConsumableItemIcon } from '../utils/consumableIcons';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ServiceRecord>) => Promise<void>;
  record?: ServiceRecord | null;
  vehicle: Vehicle;
  defaultType?: 'service' | 'repair' | 'upgrade';
}

const POPULAR_STORES = ['Ozon', 'Wildberries', 'Exist', 'Автодок', 'Emex', 'Авито', 'Дилер'];
const ITEM_UNITS = ['шт', 'л', 'компл', 'кан', 'уп', 'кг', 'м'];

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
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  useModalA11y({ isOpen, onClose });

  useEffect(() => {
    if (record) {
      let recordItems = record.items ? [...record.items] : [];
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
        title: record.title || '',
        description: record.description || '',
        store: record.store || '',
        url: record.url || '',
        cost_labor: resolvedLabor,
        cost_parts: resolvedParts,
        total_cost: resolvedTotal,
        notes: record.notes || '',
      });
      setItems(recordItems);
      if (record.description || record.notes || record.store) {
        setIsNotesExpanded(true);
      }
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
      setExpandedItems({});
      setIsNotesExpanded(false);
    }
  }, [record, isOpen, vehicle, defaultType]);

  if (!isOpen) return null;

  const calculatePartsSum = (itemList: ServiceItem[]) => {
    return itemList
      .filter((it) => it.category !== 'labor')
      .reduce((sum, it) => sum + (Number(it.total_price) || ((Number(it.quantity) || 1) * (Number(it.unit_price) || 0))), 0);
  };

  const updateItemsAndCosts = (newItems: ServiceItem[], customLabor?: number) => {
    setItems(newItems);
    const partsSum = calculatePartsSum(newItems);
    const labor = customLabor !== undefined ? customLabor : formData.cost_labor;

    setFormData((prev) => ({
      ...prev,
      cost_parts: partsSum,
      cost_labor: labor,
      total_cost: partsSum + labor,
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
    const newItems = [...items, newItem];
    updateItemsAndCosts(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof ServiceItem, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? parseFloat(value) || 0 : (next[index].quantity || 1);
      const u = field === 'unit_price' ? parseFloat(value) || 0 : (next[index].unit_price || 0);
      next[index].total_price = q * u;
    } else if (field === 'total_price') {
      const total = parseFloat(value) || 0;
      next[index].total_price = total;
      const q = next[index].quantity || 1;
      next[index].unit_price = q > 0 ? Math.round(total / q) : total;
    }

    if (field === 'url' && value && !next[index].store) {
      const detected = detectStoreFromUrl(String(value));
      if (detected) {
        next[index].store = detected;
      }
    }

    updateItemsAndCosts(next);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    updateItemsAndCosts(next);
  };

  const toggleItemExpanded = (index: number) => {
    setExpandedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleLaborChange = (val: string) => {
    const labor = parseFloat(val) || 0;
    const partsSum = calculatePartsSum(items);
    setFormData((prev) => ({
      ...prev,
      cost_labor: labor,
      total_cost: partsSum + labor,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const partsSum = calculatePartsSum(items);
      const labor = Number(formData.cost_labor) || 0;
      const minTotal = partsSum + labor;
      const finalTotal = formData.total_cost >= minTotal && formData.total_cost > 0
        ? formData.total_cost
        : minTotal;

      await onSave({
        ...formData,
        cost_parts: partsSum,
        cost_labor: labor,
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

  const partsSum = calculatePartsSum(items);
  const laborSum = Number(formData.cost_labor) || 0;
  const currentTotal = formData.total_cost > 0 ? formData.total_cost : (partsSum + laborSum);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fadeIn p-0 sm:p-4"
    >
      <div className="bg-white dark:bg-dark-850 border-t sm:border border-slate-200 dark:border-dark-750 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl h-[94vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* 1. STICKY TOP HEADER */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-dark-750 bg-white/95 dark:bg-dark-850/95 backdrop-blur-md flex-shrink-0 z-10">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Wrench className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 id="service-modal-title" className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                {record
                  ? (record.to_tag ? `Редактирование: ${record.to_tag}` : 'Редактировать запись')
                  : `Новая запись: ${typeLabels[formData.record_type]}`}
              </h2>
              <span className="text-[10px] text-slate-400 font-mono block">
                {vehicle.make} {vehicle.model}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800/80 flex items-center space-x-1 transition active:scale-95 shadow-2xs"
              title="Распознать заказ-наряд или чек по фото (OCR)"
            >
              <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Скан чека</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 transition active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. SCROLLABLE FORM BODY */}
        <form id="service-record-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* A. Type Selector (Pill Segments) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-dark-900 rounded-2xl border border-slate-200/80 dark:border-dark-750">
            {(['service', 'repair', 'upgrade'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFormData({ ...formData, record_type: t })}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  formData.record_type === t
                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t === 'service' ? 'Плановое ТО' : t === 'repair' ? 'Ремонт' : 'Тюнинг'}
              </button>
            ))}
          </div>

          {/* B. Key Metrics: Date, Mileage, Hours */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Дата *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Пробег ({vehicle.distance_unit || 'км'}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.odometer}
                onChange={(e) =>
                  setFormData({ ...formData, odometer: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Моточасы (м/ч)
              </label>
              <input
                type="number"
                step="any"
                value={formData.engine_hours || ''}
                onChange={(e) =>
                  setFormData({ ...formData, engine_hours: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* C. Tag & Title */}
          <div className="space-y-2 bg-slate-50 dark:bg-dark-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-750">
            <div className="flex items-center space-x-2">
              <div className="w-24 sm:w-28 flex-shrink-0">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-0.5">
                  Тег / Этап
                </label>
                <input
                  type="text"
                  value={formData.to_tag}
                  onChange={(e) => setFormData({ ...formData, to_tag: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-xs text-brand-600 dark:text-brand-400 font-mono font-black focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-0.5 truncate">
                  Название / Тема обслуживания *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Quick Tag Presets Horizontal Scroll */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">Быстро:</span>
              {(formData.record_type === 'service'
                ? ['ТО-0', 'ТО-1', 'ТО-2', 'ТО-3', 'ТО-4', 'ТО-5', 'Вне ТО']
                : formData.record_type === 'upgrade'
                ? ['Допы', 'Стайлинг', 'Шумоизоляция', 'Свет', 'Салон', 'Защита']
                : ['Ходовая', 'Тормоза', 'ДВС', 'Электрика', 'Кузов', 'Вне ТО']
              ).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const nextTag = formData.to_tag === tag ? '' : tag;
                    const nextTitle = !formData.title || /^ТО-\d+/i.test(formData.title)
                      ? (nextTag ? `${nextTag}: Плановое обслуживание` : formData.title)
                      : formData.title;
                    setFormData({ ...formData, to_tag: nextTag, title: nextTitle });
                  }}
                  className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                    formData.to_tag === tag
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* D. PARTS & CONSUMABLES (The Star Component) */}
          <div className="bg-slate-50 dark:bg-dark-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-dark-750 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-base">📦</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Запчасти и расходники ({items.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="flex items-center space-x-1 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-sky-600 hover:from-brand-500 hover:to-sky-500 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Деталь</span>
              </button>
            </div>

            {/* Quick Preset Chips Row */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 flex-shrink-0">
                <Sparkles className="w-3 h-3 text-amber-500" />
                В 1 клик:
              </span>
              {QUICK_PART_PRESETS.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleAddItem(preset)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-dark-850 hover:bg-brand-50 dark:hover:bg-dark-750 hover:text-brand-600 dark:hover:text-brand-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 transition flex-shrink-0 whitespace-nowrap shadow-2xs active:scale-95"
                >
                  + {preset.name}
                </button>
              ))}
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div className="text-center py-5 px-3 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-dark-700 rounded-xl bg-white/40 dark:bg-dark-850/40">
                <p className="font-semibold text-slate-600 dark:text-slate-300">Список запчастей пуст</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Нажмите на кнопки выше, чтобы добавить масло или фильтры с ценой и артикулом.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item, idx) => {
                  const itemIcon = getConsumableItemIcon(item.name, item.category);
                  const isExpanded = Boolean(expandedItems[idx]);

                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-dark-850 p-3 rounded-2xl border border-slate-200/90 dark:border-dark-700/90 shadow-xs space-y-2 text-xs transition-all"
                    >
                      {/* Row 1: Icon + Name + Delete */}
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl ${itemIcon.bg} flex items-center justify-center text-base flex-shrink-0`}>
                          {itemIcon.icon}
                        </div>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-slate-900 dark:text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-b border-brand-500 py-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition flex-shrink-0"
                          title="Удалить позицию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Row 2: 2 Clean Balanced Columns (Price & Article/Brand) */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-dark-800">
                        {/* Cost Input */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                            Стоимость (₽)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={item.total_price || ''}
                              onChange={(e) => handleUpdateItem(idx, 'total_price', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                              ₽
                            </span>
                          </div>
                        </div>

                        {/* Article & Brand */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                            Артикул / Бренд
                          </label>
                          <input
                            type="text"
                            value={item.part_number || item.brand || ''}
                            onChange={(e) => handleUpdateItem(idx, 'part_number', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>

                      {/* Optional Expand Toggle (Store, URL, Quantity) */}
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleItemExpanded(idx)}
                          className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                        >
                          <span>{isExpanded ? 'Скрыть параметры' : 'Магазин, ссылка, кол-во'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {item.url && (
                          <a
                            href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand-500 hover:underline flex items-center space-x-0.5"
                          >
                            <span>Открыть ссылку</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      {/* Expanded Section (Keeps UI uncluttered unless explicitly needed) */}
                      {isExpanded && (
                        <div className="space-y-2 p-2.5 bg-slate-50 dark:bg-dark-900 rounded-xl border border-slate-200/80 dark:border-dark-750 text-xs animate-fadeIn">
                          {/* Qty & Unit */}
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-400 w-16 flex-shrink-0">Количество:</span>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity || 1}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                              className="w-20 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-xs"
                            />
                            <select
                              value={item.unit || 'шт'}
                              onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                              className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-xs font-bold"
                            >
                              {ITEM_UNITS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>

                          {/* Store Name & Chips */}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold text-slate-400 w-16 flex-shrink-0">Магазин:</span>
                              <input
                                type="text"
                                value={item.store || ''}
                                onChange={(e) => handleUpdateItem(idx, 'store', e.target.value)}
                                className="flex-1 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex items-center space-x-1 mt-1.5 ml-18 overflow-x-auto pb-0.5 scrollbar-none">
                              {POPULAR_STORES.map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, 'store', st)}
                                  className="text-[9.5px] px-2 py-0.5 rounded-md bg-white dark:bg-dark-800 hover:bg-brand-500 hover:text-white text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-700 transition flex-shrink-0"
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* URL */}
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-400 w-16 flex-shrink-0">Ссылка:</span>
                            <input
                              type="url"
                              value={item.url || ''}
                              onChange={(e) => handleUpdateItem(idx, 'url', e.target.value)}
                              className="flex-1 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* E. SERVICE LABOR & WORKSHOP NOTES */}
          <div className="bg-slate-50 dark:bg-dark-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-dark-750 space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                🛠️ Стоимость работ автосервиса / СТО ({vehicle.currency || '₽'})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={formData.cost_labor || ''}
                  onChange={(e) => handleLaborChange(e.target.value)}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  {vehicle.currency || '₽'}
                </span>
              </div>
            </div>

            {/* Spoiler: Workshop notes, Station name, Order # */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-brand-500 flex items-center space-x-1"
              >
                <span>{isNotesExpanded ? '▲ Скрыть данные СТО и заметки' : '▼ СТО, заказ-наряд и комментарий (опция)'}</span>
              </button>

              {isNotesExpanded && (
                <div className="space-y-2.5 pt-2.5 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Автосервис / СТО / Место
                    </label>
                    <input
                      type="text"
                      value={formData.store}
                      onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Номер заказ-наряда / чека
                    </label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Комментарий / описание выполненных работ
                    </label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* 3. STICKY BOTTOM FOOTER (Always Visible, Never Lost) */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 dark:border-dark-750 bg-white/95 dark:bg-dark-850/95 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0 z-20 shadow-lg">
          {/* Total Sum Display */}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ИТОГО К ОПЛАТЕ:
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
                {Math.round(currentTotal).toLocaleString('ru-RU')}
              </span>
              <span className="text-xs font-bold text-slate-500">{vehicle.currency || '₽'}</span>
            </div>
            <div className="text-[9.5px] text-slate-400 font-mono truncate">
              Детали: {Math.round(partsSum).toLocaleString('ru-RU')} ₽ • Работы: {Math.round(laborSum).toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-block px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              form="service-record-form"
              disabled={loading}
              className="px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-brand-600 via-sky-600 to-brand-500 hover:from-brand-500 hover:to-sky-400 active:scale-95 shadow-md shadow-brand-500/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <span>{loading ? 'Сохранение...' : 'Сохранить запись'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* OCR Scanner Modal */}
      {isScannerOpen && (
        <ReceiptScanModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          vehicle={vehicle}
          onApplyToService={(data) => {
            setFormData((prev) => ({
              ...prev,
              record_type: data.record_type || prev.record_type,
              date: data.date ? data.date.split('T')[0] : prev.date,
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

export default ServiceModal;
