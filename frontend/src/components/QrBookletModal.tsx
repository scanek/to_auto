import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  QrCode,
  Printer,
  Copy,
  Check,
  Calendar,
  Share2,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Wrench,
  Edit3,
  Clock,
  Gauge,
  Tag,
  Layers,
} from 'lucide-react';
import { Vehicle, MaintenancePlan, ServiceRecord } from '../types';
import { generateQrUrl, downloadIcsReminder } from '../utils/qrcodeHelper';

interface QrBookletModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  reminders: MaintenancePlan[];
  records?: ServiceRecord[];
}

export const QrBookletModal: React.FC<QrBookletModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  reminders,
  records = [],
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'sticker'>('sticker');
  const [stickerTemplate, setStickerTemplate] = useState<'dealer' | 'compact'>('dealer');
  const [copied, setCopied] = useState(false);

  // Helper to strictly exclude transmission / gearbox / axle / ATF oils
  const isTransmission = (str: string) => {
    const s = (str || '').toLowerCase();
    return (
      s.includes('кпп') ||
      s.includes('акпп') ||
      s.includes('мкпп') ||
      s.includes('коробк') ||
      s.includes('трансмис') ||
      s.includes('вариатор') ||
      s.includes('cvt') ||
      s.includes('atf') ||
      s.includes('редуктор') ||
      s.includes('раздатк') ||
      s.includes('мост') ||
      s.includes('гур') ||
      s.includes('75w') ||
      s.includes('80w') ||
      s.includes('85w')
    );
  };

  // Helper to strictly identify MOTOR / ENGINE oil (ДВС)
  const isMotorOil = (str: string) => {
    const s = (str || '').toLowerCase();
    if (isTransmission(s)) return false;
    return (
      s.includes('двс') ||
      s.includes('моторн') ||
      s.includes('двигател') ||
      s.includes('то-') ||
      s.includes('масло') ||
      s.includes('0w') ||
      s.includes('5w') ||
      s.includes('10w')
    );
  };

  // 1. Detect latest real ENGINE oil change from records
  const latestOilRecord = useMemo(() => {
    if (!records || records.length === 0) return null;
    const sorted = [...records].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Primary search: explicit motor oil or TO records
    const engineRecord = sorted.find((r) => {
      const t = (r.title || '').toLowerCase();
      const d = (r.description || '').toLowerCase();
      if (isTransmission(t) || isTransmission(d)) return false;

      const hasMotorOilItem = r.items?.some(
        (it) => isMotorOil(it.name) || (it.category === 'oil' && !isTransmission(it.name))
      );

      return (
        t.includes('моторн') ||
        t.includes('двс') ||
        t.includes('то-') ||
        (t.includes('масло') && !isTransmission(t)) ||
        (d.includes('масло') && !isTransmission(d)) ||
        hasMotorOilItem
      );
    });

    return engineRecord || null;
  }, [records]);

  // Extract specifically ENGINE oil item from the latest record
  const latestOilItem = useMemo(() => {
    if (!latestOilRecord?.items) return null;
    // Prefer explicit motor oil item
    return (
      latestOilRecord.items.find(
        (it) =>
          !isTransmission(it.name) &&
          (it.name.toLowerCase().includes('мотор') ||
            it.name.toLowerCase().includes('двс') ||
            it.name.toLowerCase().includes('0w') ||
            it.name.toLowerCase().includes('5w') ||
            it.name.toLowerCase().includes('10w') ||
            it.category === 'oil')
      ) ||
      latestOilRecord.items.find((it) => !isTransmission(it.name) && it.name.toLowerCase().includes('масло')) ||
      null
    );
  }, [latestOilRecord]);

  // 2. Detect ENGINE oil reminder plan (strictly exclude transmission/gearbox)
  const oilReminder = useMemo(() => {
    // 1st priority: explicit motor oil / DVS
    const explicitEngine = reminders.find((r) => {
      const t = (r.title || '').toLowerCase();
      return !isTransmission(t) && (t.includes('моторн') || t.includes('двс') || t.includes('двигател'));
    });
    if (explicitEngine) return explicitEngine;

    // 2nd priority: general oil or TO-1/TO-2 without transmission keywords
    const generalEngine = reminders.find((r) => {
      const t = (r.title || '').toLowerCase();
      return !isTransmission(t) && (t.includes('масло') || t.includes('то-') || r.category === 'oil');
    });
    if (generalEngine) return generalEngine;

    // Fallback: any reminder that is NOT transmission
    return reminders.find((r) => !isTransmission(r.title || '')) || reminders[0];
  }, [reminders]);

  // Interval parameters
  const defaultIntervalKm = oilReminder?.interval_distance || 7500;
  const defaultIntervalHours = oilReminder?.interval_hours || 250;
  const defaultIntervalMonths = oilReminder?.interval_months || 12;

  // Exact calculation: Last Oil Change Odometer + Interval (e.g. 60000 + 7500 = 67500)
  const initialNextOdo = useMemo(() => {
    let baseOdo = 0;
    if (latestOilRecord?.odometer && latestOilRecord.odometer > 0) {
      baseOdo = latestOilRecord.odometer;
    } else if (oilReminder?.last_service_odometer && oilReminder.last_service_odometer > 0) {
      baseOdo = oilReminder.last_service_odometer;
    } else if (vehicle.starting_odometer && vehicle.starting_odometer > 0) {
      baseOdo = vehicle.starting_odometer;
    } else {
      baseOdo = vehicle.current_odometer;
    }

    return baseOdo + defaultIntervalKm;
  }, [latestOilRecord, oilReminder, defaultIntervalKm, vehicle.starting_odometer, vehicle.current_odometer]);

  // Exact calculation: Last Oil Change Engine Hours + Interval (e.g. 150 + 250 = 400)
  const initialNextHours = useMemo(() => {
    let baseHours = 0;
    if (latestOilRecord?.engine_hours && latestOilRecord.engine_hours > 0) {
      baseHours = latestOilRecord.engine_hours;
    } else if (oilReminder?.last_service_hours && oilReminder.last_service_hours > 0) {
      baseHours = oilReminder.last_service_hours;
    } else {
      baseHours = vehicle.current_engine_hours || 0;
    }

    return baseHours + defaultIntervalHours;
  }, [latestOilRecord, oilReminder, defaultIntervalHours, vehicle.current_engine_hours]);

  // Exact calculation: Last Oil Change Date + Interval Months (e.g. 15.01.2026 + 12m = 15.01.2027)
  const initialNextDate = useMemo(() => {
    let baseDate = new Date();
    if (latestOilRecord?.date) {
      const d = new Date(latestOilRecord.date);
      if (!isNaN(d.getTime())) baseDate = d;
    } else if (oilReminder?.last_service_date) {
      const d = new Date(oilReminder.last_service_date);
      if (!isNaN(d.getTime())) baseDate = d;
    }

    const targetDate = new Date(baseDate);
    targetDate.setMonth(targetDate.getMonth() + defaultIntervalMonths);
    return targetDate.toISOString().split('T')[0];
  }, [latestOilRecord, oilReminder, defaultIntervalMonths]);

  // Oil specification text
  const initialOilSpec = useMemo(() => {
    if (latestOilItem?.brand && latestOilItem?.name) {
      return `${latestOilItem.brand} ${latestOilItem.name}`;
    }
    if (latestOilItem?.name) return latestOilItem.name;
    if (oilReminder?.brand && oilReminder?.spec) {
      return `${oilReminder.brand} ${oilReminder.spec}`;
    }
    if (oilReminder?.brand) return oilReminder.brand;
    if (oilReminder?.spec) return oilReminder.spec;
    if (vehicle.oil_spec) return vehicle.oil_spec;
    if (vehicle.engine) return `По мануалу (${vehicle.engine})`;
    return 'По регламенту ТО';
  }, [latestOilItem, oilReminder, vehicle.oil_spec, vehicle.engine]);

  // Nearest other scheduled maintenance
  const nearestOtherReminder = useMemo(() => {
    const others = reminders.filter((r) => r.id !== oilReminder?.id);
    if (others.length === 0) return null;
    return others.sort((a, b) => (a.remaining_distance || 999999) - (b.remaining_distance || 999999))[0];
  }, [reminders, oilReminder]);

  // Interactive Editable States
  const [customNextOdo, setCustomNextOdo] = useState<number>(initialNextOdo);
  const [customNextHours, setCustomNextHours] = useState<number>(initialNextHours);
  const [customNextDate, setCustomNextDate] = useState<string>(initialNextDate);
  const [customOilSpec, setCustomOilSpec] = useState<string>(initialOilSpec);
  const [customServiceCenter, setCustomServiceCenter] = useState<string>(latestOilRecord?.store || 'Автосервис / СТО');
  const [isEditingSticker, setIsEditingSticker] = useState<boolean>(false);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomNextOdo(initialNextOdo);
      setCustomNextHours(initialNextHours);
      setCustomNextDate(initialNextDate);
      setCustomOilSpec(initialOilSpec);
      setCustomServiceCenter(latestOilRecord?.store || 'Автосервис / СТО');
    }
  }, [isOpen, initialNextOdo, initialNextHours, initialNextDate, initialOilSpec, latestOilRecord]);

  if (!isOpen) return null;

  // Build the public link to this vehicle
  const shareUrl = `${window.location.origin}/?vehicle=${vehicle.id}`;
  const qrSvgUrl = generateQrUrl(shareUrl, 300);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Электронная сервисная книжка — ${vehicle.make} ${vehicle.model}`,
          text: `История обслуживания, пробег и регламенты ТО автомобиля ${vehicle.make} ${vehicle.model}:`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleAddToCalendar = () => {
    const targetDate = new Date(customNextDate);

    downloadIcsReminder({
      title: oilReminder ? oilReminder.title : 'Замена моторного масла и фильтров',
      carName: `${vehicle.make} ${vehicle.model}`,
      licensePlate: vehicle.license_plate,
      targetDate: targetDate,
      odometerTarget: customNextOdo,
      distanceUnit: vehicle.distance_unit,
      oilSpec: customOilSpec,
      bookletUrl: shareUrl,
    });
  };

  const handlePrintSticker = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Dedicated Print Stylesheet for Sticker */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-service-sticker, #printable-service-sticker * {
            visibility: visible !important;
          }
          #printable-service-sticker {
            position: fixed !important;
            left: 50% !important;
            top: 20mm !important;
            transform: translateX(-50%) !important;
            width: 95mm !important;
            max-width: 95mm !important;
            margin: 0 auto !important;
            padding: 4mm !important;
            border: 2px solid #000 !important;
            border-radius: 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: auto;
            margin: 8mm;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-750 bg-slate-50 dark:bg-dark-900/60 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Сервисная Бирка и QR-код ТО
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {vehicle.make} {vehicle.model} {vehicle.license_plate ? `(${vehicle.license_plate})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-100 dark:bg-dark-900/40 border-b border-slate-200 dark:border-dark-750 flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab('sticker')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sticker'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🏷️ Наклейка под капот / Бирка ТО
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'qr'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📱 QR-код сервисной книги
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'sticker' ? (
            <div className="space-y-4">
              {/* Template Switcher (Option 1 vs Option 3) */}
              <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-100 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-750 text-xs">
                <button
                  onClick={() => setStickerTemplate('dealer')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    stickerTemplate === 'dealer'
                      ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Вариант 1: Дилерская карта ТО</span>
                </button>

                <button
                  onClick={() => setStickerTemplate('compact')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    stickerTemplate === 'compact'
                      ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Вариант 3: Наклейка (90×50 мм)</span>
                </button>
              </div>

              {/* Sticker Customizer Bar */}
              <div className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-brand-500" />
                    <span>Параметры для бирки</span>
                  </span>
                  <button
                    onClick={() => setIsEditingSticker(!isEditingSticker)}
                    className="text-[11px] text-brand-600 dark:text-brand-400 font-bold hover:underline"
                  >
                    {isEditingSticker ? 'Свернуть' : 'Настроить значения'}
                  </button>
                </div>

                {isEditingSticker && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Следующая замена масла ({vehicle.distance_unit})
                      </label>
                      <input
                        type="number"
                        value={customNextOdo}
                        onChange={(e) => setCustomNextOdo(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Масло и вязкость
                      </label>
                      <input
                        type="text"
                        value={customOilSpec}
                        onChange={(e) => setCustomOilSpec(e.target.value)}
                        placeholder="Например: Lukoil Genesis 5W-40"
                        className="w-full bg-white dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white"
                      />
                    </div>

                    {vehicle.track_engine_hours && (
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Следующие моточасы (м/ч)
                        </label>
                        <input
                          type="number"
                          value={customNextHours}
                          onChange={(e) => setCustomNextHours(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-cyan-600 dark:text-cyan-400"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Дата следующего ТО
                      </label>
                      <input
                        type="date"
                        value={customNextDate}
                        onChange={(e) => setCustomNextDate(e.target.value)}
                        className="w-full bg-white dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Автосервис / СТО / Мастер
                      </label>
                      <input
                        type="text"
                        value={customServiceCenter}
                        onChange={(e) => setCustomServiceCenter(e.target.value)}
                        placeholder="Название автосервиса или Личный гараж"
                        className="w-full bg-white dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* OPTION 1: DEALER SERVICE CARD TEMPLATE */}
              {/* ========================================================================= */}
              {stickerTemplate === 'dealer' ? (
                <div
                  id="printable-service-sticker"
                  className="bg-white text-slate-900 p-5 rounded-2xl border-2 border-slate-800 shadow-lg space-y-3 font-sans relative overflow-hidden"
                >
                  {/* Top Bar Accent */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600" />

                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2.5 pt-0.5">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 bg-blue-700 text-white rounded text-[10px] font-black">
                          ТО
                        </span>
                        <span>СЕРВИСНАЯ КАРТА АВТОМОБИЛЯ</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {customServiceCenter}
                      </div>
                    </div>

                    {vehicle.license_plate && (
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded bg-slate-100 border border-slate-400 tracking-wider">
                        {vehicle.license_plate}
                      </span>
                    )}
                  </div>

                  {/* Vehicle Name & Current Mileage */}
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-sm font-extrabold text-blue-900">
                      {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">
                      Текущий: {Math.round(vehicle.current_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                    </span>
                  </div>

                  {/* Core Maintenance Box */}
                  <div className="bg-slate-50 border-2 border-blue-900/20 rounded-xl p-3 grid grid-cols-2 gap-3 text-left">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">
                        🛢️ След. замена масла ДВС
                      </span>
                      <span className="font-mono font-black text-blue-700 text-base block mt-0.5">
                        {Math.round(customNextOdo).toLocaleString('ru-RU')} {vehicle.distance_unit}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        или до {new Date(customNextDate).toLocaleDateString('ru-RU')}
                      </span>
                    </div>

                    <div className="border-l border-slate-200 pl-3">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">
                        ⚙️ Масло и вязкость
                      </span>
                      <span className="font-bold text-slate-900 text-xs block mt-0.5 truncate" title={customOilSpec}>
                        {customOilSpec}
                      </span>
                      {vehicle.track_engine_hours && (
                        <span className="font-mono text-[11px] text-cyan-700 font-bold block mt-1">
                          ⏱️ {Math.round(customNextHours)} м/ч
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nearest scheduled maintenance info */}
                  {nearestOtherReminder && (
                    <div className="bg-amber-50/80 border border-amber-300 rounded-lg px-2.5 py-1.5 text-[10px] text-amber-900 flex items-center justify-between">
                      <span className="font-bold truncate">
                        📌 Ближайшее регламентное ТО: {nearestOtherReminder.title}
                      </span>
                      <span className="font-mono font-black ml-2 whitespace-nowrap">
                        {Math.round(
                          (nearestOtherReminder.last_service_odometer || vehicle.current_odometer) +
                            (nearestOtherReminder.interval_distance || 15000)
                        ).toLocaleString('ru-RU')}{' '}
                        {vehicle.distance_unit}
                      </span>
                    </div>
                  )}

                  {/* Footer with QR */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <div className="text-[10px] text-slate-600 space-y-0.5 pr-2">
                      <div className="font-bold text-slate-800">
                        📱 Онлайн сервисная книжка
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Отсканируйте камерой для просмотра полной истории ТО
                      </div>
                    </div>

                    <div className="w-14 h-14 p-1 bg-white border border-slate-300 rounded-lg flex items-center justify-center flex-shrink-0">
                      <img src={qrSvgUrl} alt="QR" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* OPTION 3: COMPACT STICKER TEMPLATE (90x50 mm) */
                /* ========================================================================= */
                <div
                  id="printable-service-sticker"
                  className="bg-white text-slate-900 p-3.5 rounded-xl border-2 border-dashed border-slate-900 shadow-md space-y-2 font-sans max-w-[340px] mx-auto"
                >
                  {/* Compact Header */}
                  <div className="flex items-center justify-between border-b pb-1.5 border-slate-900">
                    <span className="text-[11px] font-black uppercase tracking-tight text-slate-900">
                      ТО • {vehicle.make} {vehicle.model}
                    </span>
                    {vehicle.license_plate && (
                      <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded border border-slate-900 bg-slate-50">
                        {vehicle.license_plate}
                      </span>
                    )}
                  </div>

                  {/* Compact Body */}
                  <div className="grid grid-cols-3 gap-1.5 items-center">
                    <div className="col-span-2 space-y-1">
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-500 block">
                          СЛЕД. ЗАМЕНА МАСЛА
                        </span>
                        <span className="font-mono font-black text-sm text-blue-800 leading-none">
                          {Math.round(customNextOdo).toLocaleString('ru-RU')} {vehicle.distance_unit}
                        </span>
                      </div>

                      <div className="text-[9px] font-bold text-slate-800 truncate" title={customOilSpec}>
                        {customOilSpec}
                      </div>

                      {vehicle.track_engine_hours && (
                        <div className="text-[9px] font-mono text-cyan-800 font-bold">
                          {Math.round(customNextHours)} м/ч
                        </div>
                      )}
                    </div>

                    <div className="w-14 h-14 p-1 bg-white border border-slate-400 rounded flex items-center justify-center justify-self-end flex-shrink-0">
                      <img src={qrSvgUrl} alt="QR" className="w-full h-full object-contain" />
                    </div>
                  </div>

                  {/* Compact Footer */}
                  <div className="border-t pt-1 border-slate-200 flex items-center justify-between text-[8px] text-slate-500 font-medium">
                    <span>{customServiceCenter}</span>
                    <span>{new Date(customNextDate).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              )}

              {/* Print CTA */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Подходит для печати на самоклеящейся бумаге или обычном принтере.
                </p>
                <button
                  onClick={handlePrintSticker}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-blue-600/25 transition-all flex-shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Печать наклейки</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* QR TAB */
            /* ========================================================================= */
            <div className="space-y-4 text-center">
              {/* QR Image Box */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-inner w-56 h-56 mx-auto flex items-center justify-center">
                <img
                  src={qrSvgUrl}
                  alt={`QR-код для ${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Отсканируйте камерой телефона
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  QR-код мгновенно открывает электронную сервисную книжку автомобиля со всей историей обслуживания, заменами масла и остатком шин.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-dark-700 transition-all active:scale-95 shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-brand-500" />}
                  <span>{copied ? 'Ссылка скопирована!' : 'Скопировать ссылку'}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-dark-700 transition-all active:scale-95 shadow-sm"
                >
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span>Поделиться</span>
                </button>
              </div>

              {/* Add reminder to phone calendar */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-brand-500/10 border border-amber-500/25 rounded-2xl p-3.5 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Напоминание о замене масла</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Добавить событие следующего ТО ({Math.round(customNextOdo).toLocaleString('ru-RU')} {vehicle.distance_unit}) в календарь смартфона (Apple / Google / Outlook)
                  </div>
                </div>

                <button
                  onClick={handleAddToCalendar}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/25 flex-shrink-0 flex items-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>В календарь (.ics)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
