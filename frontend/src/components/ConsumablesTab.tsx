import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Search,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Info,
  Clock,
  Tag,
  ShoppingBag,
} from 'lucide-react';
import { VehicleConsumable, Vehicle } from '../types';
import { api } from '../services/api';

interface ConsumablesTabProps {
  vehicle: Vehicle;
  consumables: VehicleConsumable[];
  isOwner: boolean;
  onRefresh: () => Promise<void>;
  onOpenModal: (consumable?: VehicleConsumable) => void;
}

const CATEGORY_META: Record<string, { label: string; icon: string; order: number }> = {
  engine: { label: 'Двигатель и масло', icon: '🛢️', order: 1 },
  filters: { label: 'Фильтры', icon: '🌪️', order: 2 },
  transmission: { label: 'Трансмиссия и КПП', icon: '⚙️', order: 3 },
  brakes: { label: 'Тормозная система', icon: '🛑', order: 4 },
  cooling: { label: 'Охлаждение и климат', icon: '❄️', order: 5 },
  electrical: { label: 'Электрика, свечи и АКБ', icon: '⚡', order: 6 },
  wipers: { label: 'Дворники и щетки', icon: '🌧️', order: 7 },
  other: { label: 'Прочие узлы', icon: '📦', order: 8 },
};

const STORES = [
  { name: 'Exist', color: 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30', getUrl: (p: string) => `https://exist.ru/Price/?pcode=${encodeURIComponent(p)}` },
  { name: 'Autodoc', color: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30', getUrl: (p: string) => `https://www.autodoc.ru/price/${encodeURIComponent(p)}` },
  { name: 'Emex', color: 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30', getUrl: (p: string) => `https://emex.ru/products/${encodeURIComponent(p)}` },
  { name: 'Ozon', color: 'text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/30', getUrl: (p: string) => `https://www.ozon.ru/search/?text=${encodeURIComponent(p)}` },
  { name: 'WB', color: 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30', getUrl: (p: string) => `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(p)}` },
  { name: 'Яндекс', color: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30', getUrl: (p: string) => `https://yandex.ru/search/?text=${encodeURIComponent('купить артикул ' + p)}` },
];

export const ConsumablesTab: React.FC<ConsumablesTabProps> = ({
  vehicle,
  consumables,
  isOwner,
  onRefresh,
  onOpenModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedPart, setCopiedPart] = useState<string | null>(null);
  const [activeStoreMenu, setActiveStoreMenu] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPart(text);
    setTimeout(() => setCopiedPart(null), 1500);
  };

  const handlePrefill = async () => {
    try {
      setPrefilling(true);
      await api.prefillConsumablesTemplate(vehicle.id);
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Ошибка при заполнении шаблона');
    } finally {
      setPrefilling(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Удалить расходник «${name}» из паспорта?`)) return;
    try {
      await api.deleteConsumable(id);
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter items
  const filtered = consumables.filter((c) => {
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchOem = (c.oem_part_number || '').toLowerCase().includes(q);
      const matchAfter = (c.aftermarket_parts || '').toLowerCase().includes(q);
      const matchSpec = (c.specification || '').toLowerCase().includes(q);
      const matchNotes = (c.notes || '').toLowerCase().includes(q);
      return matchName || matchOem || matchAfter || matchSpec || matchNotes;
    }
    return true;
  });

  // Group by category
  const groups: Record<string, VehicleConsumable[]> = {};
  for (const item of filtered) {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }

  const sortedCategories = Object.keys(groups).sort((a, b) => {
    const ordA = CATEGORY_META[a]?.order || 99;
    const ordB = CATEGORY_META[b]?.order || 99;
    return ordA - ordB;
  });

  // Render single part pill with copy & search menu
  const renderPartPill = (partNumber: string, isOem = false, uniqueId: string) => {
    const clean = partNumber.trim();
    if (!clean) return null;
    const isCopied = copiedPart === clean;
    const isMenuOpen = activeStoreMenu === uniqueId;

    return (
      <div key={uniqueId} className="relative inline-flex items-center">
        <div
          className={`inline-flex items-center space-x-1 pl-2 pr-1.5 py-1 rounded-lg border text-xs font-mono font-bold transition ${
            isOem
              ? 'bg-brand-500/10 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border-brand-500/30'
              : 'bg-slate-100 dark:bg-dark-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-dark-700'
          }`}
        >
          <span className="truncate max-w-[150px] sm:max-w-[200px]" title={clean}>
            {clean}
          </span>
          <button
            type="button"
            onClick={() => copyToClipboard(clean)}
            className="p-1 text-slate-400 hover:text-brand-500 transition rounded"
            title="Скопировать артикул"
          >
            {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveStoreMenu(isMenuOpen ? null : uniqueId)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded flex items-center"
            title="Искать в магазинах"
          >
            <ShoppingBag className="w-3 h-3" />
            <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
          </button>
        </div>

        {/* Store Dropdown Menu */}
        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setActiveStoreMenu(null)}
            />
            <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-dark-850 rounded-xl shadow-xl border border-slate-200 dark:border-dark-750 py-1.5 z-50 text-xs animate-scaleIn origin-top-left">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 dark:border-dark-750">
                Найти {clean}:
              </div>
              {STORES.map((st) => (
                <a
                  key={st.name}
                  href={st.getUrl(clean)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setActiveStoreMenu(null)}
                  className={`flex items-center justify-between px-3 py-1.5 text-xs font-semibold transition ${st.color}`}
                >
                  <span>{st.name}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📋 Паспорт расходников и спецификаций</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono font-bold">
              {consumables.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Оригинальные артикулы, проверенные аналоги, допуски масел и поиск в 1 клик
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center space-x-2">
            {consumables.length === 0 ? (
              <button
                type="button"
                onClick={handlePrefill}
                disabled={prefilling}
                className="flex items-center space-x-1.5 text-xs font-bold text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 active:scale-95 px-3.5 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{prefilling ? 'Заполнение...' : 'Заполнить стандартный шаблон'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrefill}
                disabled={prefilling}
                className="hidden sm:flex items-center space-x-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-brand-500 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-dark-700 transition"
                title="Добавить недостающие шаблоны (масло, фильтры, колодки)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Добавить шаблоны</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenModal()}
              className="flex items-center space-x-1.5 text-xs font-bold text-brand-500 hover:text-brand-600 bg-brand-500/10 border border-brand-500/20 px-3 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить узел</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      {consumables.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по названию, артикулу, бренду или допуску..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-750'
              }`}
            >
              Все ({consumables.length})
            </button>
            {Object.entries(CATEGORY_META).map(([catId, meta]) => {
              const count = consumables.filter((c) => c.category === catId).length;
              if (count === 0) return null;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedCategory(catId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center space-x-1 ${
                    selectedCategory === catId
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-750'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {consumables.length === 0 ? (
        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 flex items-center justify-center">
            <Wrench className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Паспорт расходников еще не заполнен
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Внесите проверенные артикулы фильтров, свечей, масел, колодок и щеток для вашей машины. 
              При следующем ТО вам не придется искать каталоги: все номера будут под рукой с быстрым поиском на Exist, Autodoc и Ozon.
            </p>
          </div>
          {isOwner && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handlePrefill}
                disabled={prefilling}
                className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{prefilling ? 'Создание...' : 'Заполнить стандартный шаблон (1 клик)'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenModal()}
                className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-dark-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить узел вручную</span>
              </button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          По запросу «{searchQuery}» ничего не найдено.
        </div>
      ) : (
        /* Categorized Groups */
        <div className="space-y-4">
          {sortedCategories.map((catKey) => {
            const meta = CATEGORY_META[catKey] || { label: 'Прочее', icon: '📦', order: 99 };
            const items = groups[catKey];

            return (
              <div key={catKey} className="space-y-2.5">
                <div className="flex items-center space-x-2 px-1">
                  <span className="text-base">{meta.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {meta.label} ({items.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((item) => {
                    const afterList = (item.aftermarket_parts || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition space-y-2.5"
                      >
                        {/* Title & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {item.name}
                            </h4>
                            {item.specification && (
                              <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-0.5">
                                {item.specification}
                              </p>
                            )}
                          </div>

                          {isOwner && (
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenModal(item)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750 transition"
                                title="Редактировать"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id, item.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Part Numbers (OEM & Aftermarket) */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-dark-750/70">
                          {item.oem_part_number && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">
                                OEM:
                              </span>
                              {renderPartPill(item.oem_part_number, true, `oem-${item.id}`)}
                            </div>
                          )}

                          {afterList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">
                                Аналоги:
                              </span>
                              {afterList.map((an, idx) =>
                                renderPartPill(an, false, `aft-${item.id}-${idx}`)
                              )}
                            </div>
                          )}

                          {!item.oem_part_number && afterList.length === 0 && (
                            <div className="text-[11px] text-slate-400 italic">
                              Артикул не указан
                            </div>
                          )}
                        </div>

                        {/* Interval & Notes */}
                        {(item.replacement_interval || item.notes) && (
                          <div className="bg-slate-50 dark:bg-dark-900/70 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-dark-750/70 text-[11px] space-y-1">
                            {item.replacement_interval && (
                              <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span>{item.replacement_interval}</span>
                              </div>
                            )}
                            {item.notes && (
                              <div className="flex items-start space-x-1.5 text-slate-500 dark:text-slate-400">
                                <Info className="w-3 h-3 text-sky-500 flex-shrink-0 mt-0.5" />
                                <span className="leading-tight">{item.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
