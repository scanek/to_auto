import React, { useState, useMemo } from 'react';
import {
  Zap,
  Search,
  X,
  SlidersHorizontal,
  Lightbulb,
  ShieldAlert,
  Car,
  MapPin,
  Sparkles,
  AlertTriangle,
  BookOpen,
  Wrench,
  Droplets,
  Disc,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  ChevronRight,
  Info,
  Layers,
  Cpu,
  Eye,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { FuseBox, FuseItem, FusePowerType, DtcCategory, DtcCodeItem, VehicleSpecCategory } from '../types';
import { CHANGAN_CS55_PLUS_FUSE_BOXES } from '../data/fuseBoxesData';
import { DTC_CODES_DATABASE, SYSTEM_GLOSSARY } from '../data/dtcCodesData';
import { CHANGAN_CS55_PLUS_SPECS } from '../data/vehicleSpecsData';

interface KnowledgeBaseTabProps {
  vehicleMake?: string;
  vehicleModel?: string;
}

type KnowledgeSubTab = 'fuses' | 'dtc' | 'specs' | 'glossary';

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({ vehicleMake = '', vehicleModel = '' }) => {
  const [subTab, setSubTab] = useState<KnowledgeSubTab>('fuses');
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Brand check: Changan or UNI
  const isChangan = useMemo(() => {
    const make = (vehicleMake || '').toLowerCase();
    const model = (vehicleModel || '').toLowerCase();
    return make.includes('changan') || make.includes('чанган') || make.includes('uni') || model.includes('cs55') || model.includes('uni');
  }, [vehicleMake, vehicleModel]);

  // FUSE BOX STATE
  const [activeBoxId, setActiveBoxId] = useState<string>('cabin_p01');
  const [fuseSearchQuery, setFuseSearchQuery] = useState<string>('');
  const [selectedPowerType, setSelectedPowerType] = useState<string>('all');
  const [activePreset, setActivePreset] = useState<string>('all');
  const [viewingSchemeImage, setViewingSchemeImage] = useState<string | null>(null);

  // DTC STATE
  const [dtcSearchQuery, setDtcSearchQuery] = useState<string>('');
  const [selectedDtcCategory, setSelectedDtcCategory] = useState<string>('all');
  const [dtcScopeFilter, setDtcScopeFilter] = useState<'all' | 'standard' | 'changan'>('all');
  const [dtcLimit, setDtcLimit] = useState<number>(50);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // SPECS STATE
  const [activeSpecCategory, setActiveSpecCategory] = useState<string>('fluids');
  const [specSearchQuery, setSpecSearchQuery] = useState<string>('');

  // GLOSSARY STATE
  const [glossarySearchQuery, setGlossarySearchQuery] = useState<string>('');

  const currentBox: FuseBox = useMemo(() => {
    return (
      CHANGAN_CS55_PLUS_FUSE_BOXES.find((b) => b.id === activeBoxId) ||
      CHANGAN_CS55_PLUS_FUSE_BOXES[0]
    );
  }, [activeBoxId]);

  // Quick preset filter buttons for fuses
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

  // Filtered fuses
  const filteredFuses = useMemo(() => {
    let list = currentBox.items;

    if (activePreset !== 'all') {
      const presetObj = quickPresets.find((p) => p.id === activePreset);
      if (presetObj && presetObj.filter) {
        list = list.filter(presetObj.filter);
      }
    }

    if (selectedPowerType !== 'all') {
      list = list.filter((item) => item.powerType === selectedPowerType);
    }

    if (fuseSearchQuery.trim()) {
      const q = fuseSearchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.rating && item.rating.toLowerCase().includes(q))
      );
    }

    return list;
  }, [currentBox, activePreset, selectedPowerType, fuseSearchQuery]);

  // Filtered DTC codes
  const filteredDtcCodes = useMemo(() => {
    let list = DTC_CODES_DATABASE;

    if (selectedDtcCategory !== 'all') {
      list = list.filter((c) => c.category === selectedDtcCategory);
    }

    if (dtcScopeFilter === 'standard') {
      list = list.filter((c) => c.isGeneric);
    } else if (dtcScopeFilter === 'changan') {
      list = list.filter((c) => !c.isGeneric || c.code.length > 5);
    }

    if (dtcSearchQuery.trim()) {
      const q = dtcSearchQuery.toUpperCase().trim();
      const qLower = dtcSearchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.code.toUpperCase().includes(q) ||
          c.desc.toLowerCase().includes(qLower) ||
          c.system.toLowerCase().includes(qLower)
      );
    }

    return list;
  }, [selectedDtcCategory, dtcScopeFilter, dtcSearchQuery]);

  // Filtered Glossary
  const filteredGlossary = useMemo(() => {
    if (!glossarySearchQuery.trim()) return SYSTEM_GLOSSARY;
    const q = glossarySearchQuery.toLowerCase().trim();
    return SYSTEM_GLOSSARY.filter(
      (g) => g.abbrev.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q)
    );
  }, [glossarySearchQuery]);

  // Filtered Specs
  const currentSpecCategory = useMemo(() => {
    return CHANGAN_CS55_PLUS_SPECS.find((c) => c.id === activeSpecCategory) || CHANGAN_CS55_PLUS_SPECS[0];
  }, [activeSpecCategory]);

  const filteredSpecs = useMemo(() => {
    let list = currentSpecCategory.specs;
    if (specSearchQuery.trim()) {
      const q = specSearchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.value.toLowerCase().includes(q) ||
          (s.standardOrSpec && s.standardOrSpec.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      );
    }
    return list;
  }, [currentSpecCategory, specSearchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderBrandFallback = (featureTitle: string) => (
    <div className="bg-gradient-to-br from-slate-50 to-brand-50/30 dark:from-dark-850 dark:to-dark-800 border border-slate-200 dark:border-dark-750 rounded-2xl p-6 text-center space-y-4 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
        <Info className="w-6 h-6" />
      </div>
      <div className="max-w-md mx-auto space-y-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {featureTitle} для {vehicleMake || 'вашего автомобиля'} {vehicleModel}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          База электросхем и заправочных объемов сейчас наполнена для семейства Changan (CS55 Plus / UNI-S). Разделы для других марок пополняются по мере загрузки технической документации сообществом.
        </p>
      </div>
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setDemoMode(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition"
        >
          <Eye className="w-4 h-4" />
          <span>Посмотреть демо-базу (Changan CS55 Plus / UNI-S)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('dtc')}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-dark-750 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Перейти к универсальному сканеру ошибок (DTC)</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Knowledge Sub-navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200 dark:border-dark-750">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSubTab('fuses')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              subTab === 'fuses'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Предохранители и схемы</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('dtc')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              subTab === 'dtc'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Коды ошибок (DTC)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white font-mono">
              1391
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('specs')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              subTab === 'specs'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>Заправочные объемы и ТО</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('glossary')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              subTab === 'glossary'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Словарь систем</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white font-mono">
              63
            </span>
          </button>
        </div>

        {demoMode && !isChangan && (
          <div className="flex items-center space-x-2 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/20">
            <span className="font-bold">Демо: Changan CS55 Plus / UNI-S</span>
            <button
              onClick={() => setDemoMode(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. FUSES & SCHEMES TAB */}
      {/* ========================================================================= */}
      {subTab === 'fuses' && (
        <>
          {!isChangan && !demoMode ? (
            renderBrandFallback('Схемы предохранителей')
          ) : (
            <div className="space-y-6">
              {/* Box Selector Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isActive
                          ? 'bg-brand-500/5 dark:bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/20 shadow-md'
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

              {/* Location & Driver Tips Bar with View Scheme Button */}
              <div className="bg-slate-50 dark:bg-dark-850/60 border border-slate-200 dark:border-dark-750 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">Расположение: </span>
                      <span>{currentBox.location}</span>
                    </div>
                  </div>

                  {currentBox.image && (
                    <button
                      type="button"
                      onClick={() => setViewingSchemeImage(currentBox.image || null)}
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-sm flex-shrink-0"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Схема блока (Заводской чертеж)</span>
                    </button>
                  )}
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
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={fuseSearchQuery}
                      onChange={(e) => setFuseSearchQuery(e.target.value)}
                      placeholder="Поиск по названию (прикуриватель, регистратор, свет...) или коду (DF31, EF01)..."
                      className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 shadow-sm"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    {fuseSearchQuery && (
                      <button
                        onClick={() => setFuseSearchQuery('')}
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
                      title="Постоянное питание 12V от АКБ"
                    >
                      <span>BAT+</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPowerType('acc')}
                      className={`px-2 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                        selectedPowerType === 'acc'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                      title="Питание при включенном аксессуарном режиме / зажигании"
                    >
                      <span>ACC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPowerType('ignition')}
                      className={`px-2 py-1 rounded-lg font-bold transition flex items-center space-x-1 ${
                        selectedPowerType === 'ignition'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                      }`}
                      title="Питание только при включенном зажигании IGN1/IGN2"
                    >
                      <span>IGN</span>
                    </button>
                  </div>
                </div>

                {/* Quick Presets Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none">
                  {quickPresets.map((preset) => {
                    const isActive = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setActivePreset(preset.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                          isActive
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                            : 'bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'
                        }`}
                      >
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fuses Count and List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <span>Найдено цепей: <strong className="text-slate-900 dark:text-white">{filteredFuses.length}</strong></span>
                  {activePreset !== 'all' && (
                    <button
                      onClick={() => setActivePreset('all')}
                      className="text-brand-500 hover:underline font-bold"
                    >
                      Сбросить фильтр
                    </button>
                  )}
                </div>

                {filteredFuses.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl space-y-2">
                    <Lightbulb className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Предохранители не найдены
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Попробуйте изменить поисковый запрос или фильтр питания
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredFuses.map((fuse) => {
                      // Color badges for ratings
                      let ratingBadgeBg = 'bg-slate-100 dark:bg-dark-750 text-slate-700 dark:text-slate-300';
                      if (fuse.ratingValue) {
                        if (fuse.ratingValue <= 7.5) ratingBadgeBg = 'bg-amber-900/10 text-amber-800 dark:text-amber-400 border border-amber-800/30';
                        else if (fuse.ratingValue === 10) ratingBadgeBg = 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30';
                        else if (fuse.ratingValue === 15) ratingBadgeBg = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30';
                        else if (fuse.ratingValue === 20) ratingBadgeBg = 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
                        else if (fuse.ratingValue === 25) ratingBadgeBg = 'bg-white text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600';
                        else if (fuse.ratingValue === 30) ratingBadgeBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
                        else if (fuse.ratingValue >= 40) ratingBadgeBg = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30';
                      }

                      return (
                        <div
                          key={fuse.code}
                          className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-dark-700 transition shadow-sm space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-black text-sm px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-dark-750 text-slate-900 dark:text-white border border-slate-200 dark:border-dark-700">
                                {fuse.code}
                              </span>
                              {fuse.rating && (
                                <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${ratingBadgeBg}`}>
                                  {fuse.rating}
                                </span>
                              )}
                              {fuse.type === 'relay' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                  РЕЛЕ
                                </span>
                              )}
                            </div>

                            {/* Power type badge */}
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                fuse.powerType === 'battery'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : fuse.powerType === 'acc'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : fuse.powerType === 'ignition'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-slate-100 dark:bg-dark-750 text-slate-500'
                              }`}
                            >
                              {fuse.powerType === 'battery' && 'BAT+ (Постоянный 12V)'}
                              {fuse.powerType === 'acc' && 'ACC (Зажигание/ACC)'}
                              {fuse.powerType === 'ignition' && 'IGN (Зажигание)'}
                              {fuse.powerType === 'unknown' && 'По цепи'}
                            </span>
                          </div>

                          <div>
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                              {fuse.name}
                            </h5>
                            {fuse.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                                {fuse.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. DIAGNOSTIC TROUBLE CODES (DTC) TAB */}
      {/* ========================================================================= */}
      {subTab === 'dtc' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Диагностический справочник кодов неисправностей (DTC)
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                База включает стандартные коды OBD-II (SAE J2012) для всех автомобилей, а также дилерские 7-значные коды заводских протоколов Changan (BCM, 7DCT, ECM, ADAS).
              </p>
            </div>
            <div className="flex-shrink-0 text-xs font-mono font-bold bg-amber-500 text-white px-3 py-1 rounded-xl shadow-sm">
              1 391 код в базе
            </div>
          </div>

          {/* Search & Category Pills */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Live search input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={dtcSearchQuery}
                  onChange={(e) => {
                    setDtcSearchQuery(e.target.value);
                    setDtcLimit(50);
                  }}
                  placeholder="Введите код (P0300, B1001, U0100...) или симптом (зажигание, сцепление, датчик)..."
                  className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                {dtcSearchQuery && (
                  <button
                    onClick={() => {
                      setDtcSearchQuery('');
                      setDtcLimit(50);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Standard vs Brand Scope Toggle */}
              <div className="flex items-center space-x-1 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-1 rounded-xl flex-shrink-0 text-xs shadow-sm">
                <button
                  type="button"
                  onClick={() => setDtcScopeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    dtcScopeFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-750'
                  }`}
                >
                  Все ({DTC_CODES_DATABASE.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDtcScopeFilter('standard')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    dtcScopeFilter === 'standard'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                  title="Стандартные общепринятые коды OBD-II для всех марок (LADA, Toyota, Changan, и т.д.)"
                >
                  Стандарт OBD-II
                </button>
                <button
                  type="button"
                  onClick={() => setDtcScopeFilter('changan')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    dtcScopeFilter === 'changan'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                  }`}
                  title="Заводские коды Changan с подробным байтом типа неисправности (короткое замыкание, обрыв цепи)"
                >
                  Специфика Changan
                </button>
              </div>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedDtcCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  selectedDtcCategory === 'all'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'
                }`}
              >
                Все категории
              </button>
              <button
                type="button"
                onClick={() => setSelectedDtcCategory('powertrain')}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  selectedDtcCategory === 'powertrain'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'
                }`}
              >
                ⚙️ P — Двигатель и КПП
              </button>
              <button
                type="button"
                onClick={() => setSelectedDtcCategory('body')}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  selectedDtcCategory === 'body'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'
                }`}
              >
                🚗 B — Кузов и салон (BCM)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDtcCategory('chassis')}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  selectedDtcCategory === 'chassis'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'
                }`}
              >
                🛑 C — Шасси, Тормоза и ABS
              </button>
              <button
                type="button"
                onClick={() => setSelectedDtcCategory('network')}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  selectedDtcCategory === 'network'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-dark-700'
                }`}
              >
                🌐 U — CAN-шина и связь
              </button>
            </div>
          </div>

          {/* DTC Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Найдено: <strong className="text-slate-900 dark:text-white">{filteredDtcCodes.length}</strong> кодов
              </span>
              <span className="text-[11px]">
                Показано: {Math.min(dtcLimit, filteredDtcCodes.length)} из {filteredDtcCodes.length}
              </span>
            </div>

            {filteredDtcCodes.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl space-y-2">
                <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Код неисправности не найден
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Попробуйте ввести только первые 4-5 символов (например, P0300 или B1001)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDtcCodes.slice(0, dtcLimit).map((item) => {
                  let catColor = 'bg-slate-100 text-slate-700 dark:bg-dark-750 dark:text-slate-300';
                  if (item.category === 'powertrain') catColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20';
                  else if (item.category === 'body') catColor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20';
                  else if (item.category === 'chassis') catColor = 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20';
                  else if (item.category === 'network') catColor = 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20';

                  return (
                    <div
                      key={item.code}
                      className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl p-3.5 hover:border-amber-500/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.code)}
                            className="inline-flex items-center space-x-1.5 font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition"
                            title="Нажмите, чтобы скопировать код"
                          >
                            <span>{item.code}</span>
                            {copiedCode === item.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${catColor}`}>
                            {item.category === 'powertrain' && 'ДВС / КПП (P)'}
                            {item.category === 'body' && 'Кузов (B)'}
                            {item.category === 'chassis' && 'Шасси (C)'}
                            {item.category === 'network' && 'Связь / CAN (U)'}
                          </span>

                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-750 text-slate-600 dark:text-slate-400">
                            {item.system}
                          </span>

                          {item.isGeneric ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              OBD-II Стандарт (Все авто)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-dark-700 text-slate-600 dark:text-slate-400">
                              Заводской Changan
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {filteredDtcCodes.length > dtcLimit && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setDtcLimit((prev) => prev + 100)}
                      className="px-6 py-2.5 rounded-xl bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 hover:bg-slate-50 dark:hover:bg-dark-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm transition"
                    >
                      Показать еще 100 кодов (осталось {filteredDtcCodes.length - dtcLimit})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FLUIDS & SERVICE SPECS TAB */}
      {/* ========================================================================= */}
      {subTab === 'specs' && (
        <>
          {!isChangan && !demoMode ? (
            renderBrandFallback('Заправочные объемы и регламент ТО')
          ) : (
            <div className="space-y-6">
              {/* Category Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CHANGAN_CS55_PLUS_SPECS.map((cat) => {
                  const isActive = cat.id === activeSpecCategory;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveSpecCategory(cat.id);
                        setSpecSearchQuery('');
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                        isActive
                          ? 'bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/20 shadow-sm'
                          : 'bg-white dark:bg-dark-850 border-slate-200 dark:border-dark-750 hover:border-slate-300 dark:hover:border-dark-700 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`p-2 rounded-xl ${
                            isActive
                              ? 'bg-cyan-500 text-white'
                              : 'bg-slate-100 dark:bg-dark-750 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {cat.id === 'fluids' && <Droplets className="w-4 h-4" />}
                          {cat.id === 'torques' && <Wrench className="w-4 h-4" />}
                          {cat.id === 'wheels' && <Disc className="w-4 h-4" />}
                          {cat.id === 'consumables_guide' && <CheckCircle2 className="w-4 h-4" />}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {cat.specs.length}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                        {cat.title}
                      </h4>
                    </button>
                  );
                })}
              </div>

              {/* Search in Specs */}
              <div className="relative">
                <input
                  type="text"
                  value={specSearchQuery}
                  onChange={(e) => setSpecSearchQuery(e.target.value)}
                  placeholder="Поиск по спецификациям (масло, свечи, давление, момент...)..."
                  className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 shadow-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                {specSearchQuery && (
                  <button
                    onClick={() => setSpecSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Specs Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSpecs.map((spec, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-4 flex flex-col justify-between hover:border-cyan-500/40 transition shadow-sm space-y-3"
                  >
                    <div className="space-y-1">
                      <h5 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {spec.name}
                      </h5>
                      <div className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        {spec.value}
                      </div>
                    </div>

                    {spec.standardOrSpec && (
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-dark-750/70 border border-slate-200/80 dark:border-dark-700 text-xs font-mono text-cyan-700 dark:text-cyan-400 font-bold">
                        {spec.standardOrSpec}
                      </div>
                    )}

                    {spec.notes && (
                      <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-100 dark:border-dark-750">
                        {spec.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. ELECTRONIC SYSTEM GLOSSARY TAB */}
      {/* ========================================================================= */}
      {subTab === 'glossary' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                <span>Словарь автомобильных систем и модулей</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Расшифровка сокращений электронных блоков управления и датчиков (BCM, TCU, ECU, SRS, ADAS, EPB и др.).
              </p>
            </div>
            <div className="text-xs font-mono font-bold bg-purple-500 text-white px-3 py-1 rounded-xl shadow-sm">
              63 системы
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={glossarySearchQuery}
              onChange={(e) => setGlossarySearchQuery(e.target.value)}
              placeholder="Поиск по аббревиатуре (BCM, DCT, EPB...) или описанию..."
              className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            {glossarySearchQuery && (
              <button
                onClick={() => setGlossarySearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredGlossary.map((item, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl p-3 hover:border-purple-500/40 transition shadow-sm flex items-start space-x-3"
              >
                <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex-shrink-0">
                  {item.abbrev}
                </span>
                <div className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCHEMATIC IMAGE VIEWER MODAL */}
      {/* ========================================================================= */}
      {viewingSchemeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-dark-850 rounded-3xl border border-slate-200 dark:border-dark-700 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-dark-750">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Заводская схема: {currentBox.title}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={viewingSchemeImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-750 hover:bg-slate-200 dark:hover:bg-dark-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Открыть оригинал</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewingSchemeImage(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Body with Zoom/Scroll */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100 dark:bg-dark-900 flex items-center justify-center">
              <img
                src={viewingSchemeImage}
                alt="Схема расположения предохранителей"
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg border border-slate-200 dark:border-dark-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
