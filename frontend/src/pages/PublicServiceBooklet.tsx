import React, { useState, useEffect } from 'react';
import { PublicBookletData } from '../types';
import { api } from '../services/api';
import { parseDotCode } from '../utils/tyreAnalytics';
import {
  Car,
  ShieldCheck,
  Calendar,
  Gauge,
  Printer,
  CheckCircle2,
  Wrench,
  Disc,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Radio,
  RotateCcw,
} from 'lucide-react';

export const PublicServiceBooklet: React.FC = () => {
  const [data, setData] = useState<PublicBookletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'service' | 'tyres' | 'consumables'>('service');

  // Extract token from URL path (/booklet/:token)
  const pathname = window.location.pathname;
  const token = pathname.split('/booklet/')[1]?.replace(/[^a-zA-Z0-9_-]/g, '') || '';

  useEffect(() => {
    if (!token) {
      setError('Не указан токен сервисной книжки');
      setLoading(false);
      return;
    }

    const fetchBooklet = async () => {
      try {
        setLoading(true);
        const res = await api.getPublicBooklet(token);
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Сервисная книжка не найдена или доступ ограничен владельцем.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooklet();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="w-10 h-10 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Загрузка электронной сервисной книжки...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Доступ ограничен</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {error || 'Сервисная книжка не найдена или доступ закрыт владельцем автомобиля.'}
          </p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-block px-5 py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              На главную
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { vehicle, service_records, tyres, consumables, public_show_costs } = data;

  const driveLabels: Record<string, string> = {
    fwd: 'Передний (FWD)',
    awd: 'Полный (AWD / 4WD)',
    rwd: 'Задний (RWD)',
  };

  const totalCostSum = service_records.reduce((acc, r) => acc + (r.total_cost || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 font-sans">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-sky-600 text-white rounded-xl shadow-xs">
              <Car className="w-5 h-5" />
            </span>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white block">
                Электронная сервисная книжка
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 block">
                Верифицированная история обслуживания авто
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-xs transition-all"
            >
              <Printer className="w-4 h-4 text-sky-600" />
              <span>Распечатать / PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Vehicle Hero Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold text-xs rounded-md border border-sky-200 dark:border-sky-800">
                  {vehicle.year ? `${vehicle.year} г.в.` : 'Год не указан'}
                </span>
                {vehicle.license_plate && (
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs rounded-md border border-slate-300 dark:border-slate-700 tracking-wider">
                    {vehicle.license_plate}
                  </span>
                )}
                {vehicle.vin && (
                  <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] text-slate-500 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700">
                    VIN: {vehicle.vin}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {vehicle.make} {vehicle.model}
              </h1>

              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {vehicle.body_type || ''} {vehicle.engine ? `• ДВС: ${vehicle.engine}` : ''}{' '}
                {vehicle.transmission ? `• КПП: ${vehicle.transmission}` : ''}
              </p>
            </div>

            {/* Odometer & Verification Badge */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0 min-w-[240px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-500" />
                Текущий пробег
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {vehicle.current_odometer.toLocaleString()} {vehicle.distance_unit}
              </div>

              {vehicle.telematics_verified ? (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>Пробег подтвержден StarLine CAN</span>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-400">
                  Показания одометра владельца
                </div>
              )}
            </div>
          </div>

          {/* Quick Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Привод</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {driveLabels[vehicle.drive_type?.toLowerCase() || 'fwd'] || vehicle.drive_type || 'Передний'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Моточасы</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {vehicle.current_engine_hours ? `${vehicle.current_engine_hours} м/ч` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Моторное масло</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate" title={vehicle.oil_spec || ''}>
                {vehicle.oil_spec || 'Не указано'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Всего записей в истории</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {service_records.length} ТО и ремонтов
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('service')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
              activeTab === 'service'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Wrench className="w-4 h-4" />
            История обслуживания ({service_records.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tyres')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
              activeTab === 'tyres'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Disc className="w-4 h-4" />
            Комплекты шин ({tyres.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('consumables')}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
              activeTab === 'consumables'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            Паспорт расходников ({consumables.length})
          </button>
        </div>

        {/* Tab 1: Service Records Timeline */}
        {activeTab === 'service' && (
          <div className="space-y-4">
            {public_show_costs && totalCostSum > 0 && (
              <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/80 rounded-xl p-4 flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-200">
                <span>Подтвержденные затраты на обслуживание:</span>
                <span className="text-sm font-bold">
                  {totalCostSum.toLocaleString()} {vehicle.currency}
                </span>
              </div>
            )}

            {service_records.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-800">
                Записей об обслуживании пока нет
              </div>
            ) : (
              <div className="space-y-3">
                {service_records.map((r, idx) => {
                  const typeStyles: Record<string, { label: string; bg: string; text: string }> = {
                    service: { label: 'ТО', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400' },
                    repair: { label: 'Ремонт', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-400' },
                    upgrade: { label: 'Тюнинг', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-400' },
                  };
                  const currentType = typeStyles[r.record_type] || typeStyles.service;

                  return (
                    <div
                      key={r.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${currentType.bg} ${currentType.text}`}
                          >
                            {currentType.label}
                          </span>
                          {r.to_tag && (
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-900 text-white dark:bg-slate-700">
                              {r.to_tag}
                            </span>
                          )}
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                            {r.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {r.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {r.date}
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <Gauge className="w-3.5 h-3.5 text-sky-500" />
                            {r.odometer.toLocaleString()} {vehicle.distance_unit}
                          </span>
                          {public_show_costs && r.total_cost ? (
                            <span className="font-bold text-slate-900 dark:text-white pl-2 border-l border-slate-200 dark:border-slate-700">
                              {r.total_cost.toLocaleString()} {vehicle.currency}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Description / Notes */}
                      {r.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {r.description}
                        </p>
                      )}

                      {/* Items & Spare Parts Table */}
                      {r.items && r.items.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 border border-slate-100 dark:border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Установленные запчасти и расходники:
                          </div>
                          <div className="space-y-1 text-xs">
                            {r.items.map((it, itemIdx) => (
                              <div
                                key={itemIdx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-700 dark:text-slate-300"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400">•</span>
                                  <span className="font-semibold">{it.name}</span>
                                  {it.brand && (
                                    <span className="text-slate-400 text-[11px]">({it.brand})</span>
                                  )}
                                  {it.part_number && (
                                    <code className="text-[11px] bg-slate-200/70 dark:bg-slate-700 px-1 py-0.5 rounded text-sky-700 dark:text-sky-300">
                                      {it.part_number}
                                    </code>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 pl-3 sm:pl-0">
                                  {it.quantity > 1 ? `${it.quantity} ${it.unit}` : ''}
                                  {public_show_costs && it.total_price
                                    ? ` — ${it.total_price.toLocaleString()} ${vehicle.currency}`
                                    : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Tyres & Wheels */}
        {activeTab === 'tyres' && (
          <div className="space-y-4">
            {tyres.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-800">
                Комплекты шин пока не добавлены
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tyres.map((t) => {
                  const dotAnalysis = parseDotCode(t.dot_code || '');

                  return (
                    <div
                      key={t.id}
                      className={`bg-white dark:bg-slate-900 rounded-xl p-5 border shadow-xs space-y-4 ${
                        t.is_active
                          ? 'border-sky-500/80 ring-1 ring-sky-500/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {t.season === 'summer' ? '☀️' : '❄️'}
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                              {t.name}
                            </h3>
                            <span className="text-[11px] text-slate-400">
                              {t.season === 'summer' ? 'Летний комплект' : 'Зимний комплект'}
                            </span>
                          </div>
                        </div>

                        {t.is_active ? (
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md text-[10px] font-bold">
                            Установлен на авто
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md text-[10px]">
                            На хранении
                          </span>
                        )}
                      </div>

                      {/* Tyre Specs */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Модель и размер:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {t.brand_model || '—'} {t.size ? `(${t.size})` : ''}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Остаток протектора:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {t.tread_depth_mm ? `${t.tread_depth_mm} мм` : 'Не указан'}
                          </span>
                        </div>

                        {/* DOT Code & Age Badge */}
                        {dotAnalysis && (
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-slate-400">Возраст резины (DOT):</span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] font-bold ${dotAnalysis.badgeBg} ${dotAnalysis.badgeColor} ${dotAnalysis.badgeBorder}`}
                              title={dotAnalysis.recommendation}
                            >
                              DOT {dotAnalysis.raw}: {dotAnalysis.statusLabel}
                            </span>
                          </div>
                        )}

                        {/* TPMS Sensors */}
                        {(t.tpms_sensors || t.tpms_fl_id) && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            <span className="text-slate-400 block mb-1 font-semibold flex items-center gap-1">
                              <Radio className="w-3.5 h-3.5 text-sky-500" />
                              Датчики давления TPMS:
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                              <span>ПЛ: {t.tpms_fl_id || '—'}</span>
                              <span>ПП: {t.tpms_fr_id || '—'}</span>
                              <span>ЗЛ: {t.tpms_rl_id || '—'}</span>
                              <span>ЗП: {t.tpms_rr_id || '—'}</span>
                            </div>
                          </div>
                        )}

                        {/* Rotation */}
                        {t.last_rotation_km && (
                          <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <RotateCcw className="w-3.5 h-3.5 text-sky-500" />
                              Последняя перестановка колес:
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              на {t.last_rotation_km.toLocaleString()} км
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Consumables & Specifications */}
        {activeTab === 'consumables' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Паспорт расходных материалов и спецификаций
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Заводские артикулы OEM и проверенные аналоги деталей для регулярного ТО
                </p>
              </div>
            </div>

            {consumables.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Расходные материалы пока не внесены
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="p-3">Категория / Деталь</th>
                      <th className="p-3">Спецификация</th>
                      <th className="p-3">OEM Артикул</th>
                      <th className="p-3">Регламент замены</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {consumables.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {c.name}
                          </span>
                          {c.aftermarket_parts && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Аналоги: {c.aftermarket_parts}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {c.specification || '—'}
                        </td>
                        <td className="p-3">
                          {c.oem_part_number ? (
                            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sky-700 dark:text-sky-300">
                              {c.oem_part_number}
                            </code>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          {c.replacement_interval || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
