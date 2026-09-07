import React, { useState, useMemo } from 'react';
import {
  Zap,
  Search,
  X,
  Info,
  SlidersHorizontal,
  Flame,
  Lightbulb,
  ShieldAlert,
  Car,
  Wind,
  Power,
  KeyRound,
  BatteryCharging,
  Sparkles,
  MapPin,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { FuseBox, FuseItem, FusePowerType } from '../types';
import { CHANGAN_CS55_PLUS_FUSE_BOXES } from '../data/fuseBoxesData';

interface FuseBoxTabProps {
  vehicleMake?: string;
  vehicleModel?: string;
}

export const FuseBoxTab: React.FC<FuseBoxTabProps> = ({ vehicleMake, vehicleModel }) => {
  const [activeBoxId, setActiveBoxId] = useState<string>('cabin_p01');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPowerType, setSelectedPowerType] = useState<string>('all');

  const currentBox: FuseBox = useMemo(() => {
    return (
      CHANGAN_CS55_PLUS_FUSE_BOXES.find((b) => b.id === activeBoxId) ||
      CHANGAN_CS55_PLUS_FUSE_BOXES[0]
    );
  }, [activeBoxId]);

  // Quick preset filter buttons
  const quickPresets = [
    { id: 'all', label: 'Все цепи', icon: SlidersHorizontal },
    { id: 'preset_dashcam', label: '📹 Регистратор (ACC + B+)', filter: (item: FuseItem) => ['DF30', 'DF31', 'DF10', 'DF13', 'DF27'].includes(item.code) },
    { id: 'preset_lighter', label: '🔌 Розетки и USB', filter: (item: FuseItem) => ['DF31', 'DF32', 'DF30'].includes(item.code) || item.name.toLowerCase().includes('розет') || item.name.toLowerCase().includes('usb') },
    { id: 'preset_heat', label: '🔥 Обогревы', filter: (item: FuseItem) => item.category === 'climate' && (item.name.toLowerCase().includes('обогрев') || item.name.toLowerCase().includes('подогрев')) },
    { id: 'preset_lights', label: '💡 Свет и фары', filter: (item: FuseItem) => item.category === 'lighting' || item.name.toLowerCase().includes('фар') || item.name.toLowerCase().includes('свет') },
    { id: 'preset_wipers', label: '🌧️ Дворники', filter: (item: FuseItem) => item.name.toLowerCase().includes('стеклоочистител') || item.name.toLowerCase().includes('дворник') },
    { id: 'preset_engine', label: '⚙️ ДВС и КПП', filter: (item: FuseItem) => item.category === 'powertrain' },
    { id: 'preset_obd', label: '🔍 Разъем OBD2', filter: (item: FuseItem) => item.code === 'DF02' || item.name.toLowerCase().includes('obd') || item.name.toLowerCase().includes('диагност') },
  ];

  const [activePreset, setActivePreset] = useState<string>('all');

  // Filtered items
  const filteredItems = useMemo(() => {
    let list = currentBox.items;

    // Apply quick preset
    if (activePreset !== 'all') {
      const presetObj = quickPresets.find((p) => p.id === activePreset);
      if (presetObj && presetObj.filter) {
        list = list.filter(presetObj.filter);
      }
    }

    // Apply power type filter
    if (selectedPowerType !== 'all') {
      list = list.filter((item) => item.powerType === selectedPowerType);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.rating && item.rating.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [currentBox, activePreset, selectedPowerType, searchQuery]);

  // Color mapper for standard automotive fuse ratings
  const getRatingBadgeStyle = (item: FuseItem) => {
    if (item.type === 'relay') {
      return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-300 dark:border-purple-800';
    }
    if (item.type === 'terminal') {
      return 'bg-slate-200 text-slate-800 dark:bg-dark-750 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }

    const val = item.ratingValue;
    if (!val) {
      return 'bg-slate-100 text-slate-700 dark:bg-dark-750 dark:text-slate-300 border-slate-300';
    }

    if (val <= 5) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-400';
    if (val <= 7.5) return 'bg-yellow-900/10 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-700';
    if (val <= 10) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-400';
    if (val <= 15) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-400';
    if (val <= 20) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-400';
    if (val <= 25) return 'bg-slate-100 text-slate-800 dark:bg-dark-700 dark:text-slate-200 border-slate-400';
    if (val <= 30) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-400';
    if (val <= 40) return 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 border-teal-500';
    if (val <= 60) return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 border-fuchsia-400';
    return 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-700';
  };

  const getPowerTypeBadge = (powerType: FusePowerType) => {
    switch (powerType) {
      case 'battery':
        return {
          label: 'BAT+ (12V)',
          title: 'Постоянное питание (даже при выключенном зажигании)',
          style: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
          icon: BatteryCharging,
        };
      case 'acc':
        return {
          label: 'ACC',
          title: 'Питание при включенных аксессуарах (кнопка Start 1 раз / магнитола)',
          style: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
          icon: KeyRound,
        };
      case 'ignition':
        return {
          label: 'IG1 (Зажигание)',
          title: 'Питание появляется при включенном зажигании или заведенном двигателе',
          style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
          icon: Power,
        };
      default:
        return {
          label: 'Цепь',
          title: 'Стандартная коммутируемая цепь',
          style: 'bg-slate-100 text-slate-600 dark:bg-dark-750 dark:text-slate-400 border-slate-300',
          icon: Zap,
        };
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4" />
              <span>Заводская документация • Changan CS55 Plus / UNI-S</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Интерактивный справочник предохранителей и реле
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Точные номиналы, коды гнезд, цвета вставок и тип питания (ACC / Постоянное / IG1). Мгновенный поиск для быстрой замены или безопасного подключения доп. оборудования.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5">
            <span className="text-slate-400 font-semibold">Легенда питания:</span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30 flex items-center space-x-1">
              <BatteryCharging className="w-3 h-3" />
              <span>BAT+</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-bold border border-blue-500/30 flex items-center space-x-1">
              <KeyRound className="w-3 h-3" />
              <span>ACC</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30 flex items-center space-x-1">
              <Power className="w-3 h-3" />
              <span>IG1</span>
            </span>
          </div>
        </div>
      </div>

      {/* Box Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {CHANGAN_CS55_PLUS_FUSE_BOXES.map((box) => {
          const isActive = box.id === activeBoxId;
          return (
            <button
              key={box.id}
              type="button"
              onClick={() => {
                setActiveBoxId(box.id);
                setActivePreset('all');
              }}
              className={`p-3.5 rounded-2xl text-left transition-all border flex flex-col justify-between space-y-2 relative overflow-hidden ${
                isActive
                  ? 'bg-brand-500/10 dark:bg-brand-500/15 border-brand-500 shadow-md ring-2 ring-brand-500/20'
                  : 'bg-white dark:bg-dark-850 border-slate-200 dark:border-dark-750 hover:border-slate-300 dark:hover:border-dark-700 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 dark:bg-dark-750 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {box.code}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {box.items.length} элементов
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {box.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {box.location}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Location & Driver Tips Bar */}
      <div className="bg-slate-50 dark:bg-dark-850/60 border border-slate-200 dark:border-dark-750 rounded-2xl p-4 space-y-3">
        <div className="flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-300">
          <MapPin className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white">Расположение: </span>
            <span>{currentBox.location}</span>
          </div>
        </div>

        {currentBox.tips && currentBox.tips.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-dark-750/80">
            {currentBox.tips.map((tip, idx) => (
              <div key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search and Quick Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию (прикуриватель, регистратор, свет...) или коду (DF31, EF01)..."
              className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Power Type Filter */}
          <div className="flex items-center space-x-1 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-1 rounded-xl flex-shrink-0 text-xs shadow-sm">
            <span className="text-slate-400 font-bold px-2">Питание:</span>
            <button
              type="button"
              onClick={() => setSelectedPowerType('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                selectedPowerType === 'all'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-750'
              }`}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setSelectedPowerType('battery')}
              className={`px-2 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                selectedPowerType === 'battery'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <span>BAT+</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPowerType('acc')}
              className={`px-2 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                selectedPowerType === 'acc'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
              }`}
            >
              <span>ACC</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPowerType('ignition')}
              className={`px-2 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                selectedPowerType === 'ignition'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <span>IG1</span>
            </button>
          </div>
        </div>

        {/* Preset filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {quickPresets.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActivePreset(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
                    : 'bg-white dark:bg-dark-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-750 hover:bg-slate-100 dark:hover:bg-dark-750'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          Найдено цепей: <strong className="text-slate-900 dark:text-white font-mono">{filteredItems.length}</strong>
        </span>
        {(searchQuery || activePreset !== 'all' || selectedPowerType !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActivePreset('all');
              setSelectedPowerType('all');
            }}
            className="text-brand-500 hover:underline font-semibold"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Fuses & Relays Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 text-center space-y-2">
          <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="font-bold text-slate-800 dark:text-slate-200">Ничего не найдено</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Попробуйте изменить поисковый запрос или переключиться на другой блок предохранителей.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => {
            const powerMeta = getPowerTypeBadge(item.powerType);
            const PowerIcon = powerMeta.icon;
            const ratingStyle = getRatingBadgeStyle(item);
            const isHighlight =
              ['DF31', 'DF30', 'DF10', 'DF13', 'DF02', 'EF15', 'EF01'].includes(item.code);

            return (
              <div
                key={item.code}
                className={`bg-white dark:bg-dark-850 border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative group ${
                  isHighlight
                    ? 'border-brand-500/40 dark:border-brand-500/30'
                    : 'border-slate-200 dark:border-dark-750'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {/* Fuse Code Badge */}
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm">
                        {item.code}
                      </span>
                      {isHighlight && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                          ★ ТОП
                        </span>
                      )}
                    </div>

                    {/* Rating Badge */}
                    <div className="flex items-center space-x-1">
                      {item.rating ? (
                        <span
                          className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border shadow-sm ${ratingStyle}`}
                        >
                          {item.rating}
                        </span>
                      ) : (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold border border-purple-300 dark:border-purple-800">
                          РЕЛЕ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title and Description */}
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug group-hover:text-brand-500 transition-colors">
                    {item.name}
                  </h4>

                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Card Footer: Power type & category */}
                <div className="pt-2 border-t border-slate-100 dark:border-dark-750 flex items-center justify-between text-[11px]">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md border flex items-center space-x-1 ${powerMeta.style}`}
                    title={powerMeta.title}
                  >
                    <PowerIcon className="w-3 h-3" />
                    <span>{powerMeta.label}</span>
                  </span>

                  <span className="text-slate-400 font-medium capitalize">
                    {item.category === 'comfort' && '🛋️ Комфорт'}
                    {item.category === 'climate' && '❄️ Климат & Обогрев'}
                    {item.category === 'lighting' && '💡 Свет & Фары'}
                    {item.category === 'powertrain' && '⚙️ ДВС & КПП'}
                    {item.category === 'safety' && '🛡️ Безопасность'}
                    {item.category === 'electronics' && '📡 Электроника'}
                    {item.category === 'power' && '⚡ Питание сети'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
