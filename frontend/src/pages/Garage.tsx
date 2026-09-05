import React, { useState } from 'react';
import {
  Car,
  Plus,
  CalendarClock,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Trash2,
  UploadCloud,
  Globe,
  Lock,
  User as UserIcon,
  ShieldAlert,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Fuel,
  ShieldCheck,
  Wrench,
  Gauge,
  ArrowRight,
} from 'lucide-react';
import { Vehicle } from '../types';

interface GarageProps {
  vehicles: Vehicle[];
  isAuthenticated: boolean;
  onSelectVehicle: (v: Vehicle) => void;
  onAddVehicle: () => void;
  onEditVehicle: (v: Vehicle) => void;
  onDeleteVehicle: (id: number) => void;
  onOpenImportModal: () => void;
  onOpenServiceModal?: (type: 'service' | 'repair' | 'upgrade') => void;
  onOpenFuelModal?: () => void;
  onOpenReminderModal?: () => void;
}

export const Garage: React.FC<GarageProps> = ({
  vehicles,
  isAuthenticated,
  onSelectVehicle,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onOpenImportModal,
  onOpenServiceModal,
  onOpenFuelModal,
  onOpenReminderModal,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'my' | 'shared'>('all');

  const [hideAllShared, setHideAllShared] = useState<boolean>(() => {
    return localStorage.getItem('hide_shared_vehicles') === 'true';
  });

  const [hiddenSharedIds, setHiddenSharedIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hidden_shared_ids') || '[]');
    } catch {
      return [];
    }
  });

  const handleToggleHideAllShared = () => {
    const nextState = !hideAllShared;
    setHideAllShared(nextState);
    localStorage.setItem('hide_shared_vehicles', String(nextState));
  };

  const handleHideSingleVehicle = (id: number) => {
    setHiddenSharedIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('hidden_shared_ids', JSON.stringify(next));
      return next;
    });
  };

  const handleUnhideAll = () => {
    setHideAllShared(false);
    setHiddenSharedIds([]);
    localStorage.removeItem('hide_shared_vehicles');
    localStorage.removeItem('hidden_shared_ids');
  };

  const myVehicles = vehicles.filter((v) => v.is_owner !== false);
  const allSharedVehicles = vehicles.filter((v) => v.is_owner === false);
  const visibleSharedVehicles = allSharedVehicles.filter(
    (v) => !hideAllShared && !hiddenSharedIds.includes(v.id)
  );
  const hiddenCount = allSharedVehicles.length - visibleSharedVehicles.length;

  const displayedVehicles =
    filterTab === 'my'
      ? myVehicles
      : filterTab === 'shared'
      ? visibleSharedVehicles
      : [...myVehicles, ...visibleSharedVehicles];

  const totalSpendMy = myVehicles.reduce((sum, v) => sum + (v.total_cost || 0), 0);
  const totalOverdueReminders = myVehicles.reduce(
    (sum, v) => sum + (v.overdue_reminders_count || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fadeIn">

      {/* Guest Welcome & Showcase Banner */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-r from-brand-600/15 via-brand-500/10 to-purple-600/15 border border-brand-500/30 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0 shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Публичная витрина автомобилей
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl mt-0.5 leading-relaxed">
                Вы просматриваете автомобили с открытым доступом. Выберите любой авто, чтобы изучить историю ТО, заправок и аналитики. Войдите или зарегистрируйтесь, чтобы создать свой гараж.
              </p>
            </div>
          </div>
          <button
            onClick={onAddVehicle}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition-all flex-shrink-0"
          >
            Войти / Регистрация
          </button>
        </div>
      )}
      {/* Overdue Reminders Alert Banner (if any) */}
      {totalOverdueReminders > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 p-3.5 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span className="font-semibold">
              У вас есть {totalOverdueReminders} {totalOverdueReminders === 1 ? 'регламент ТО, требующий' : 'регламента ТО, требующих'} внимания!
            </span>
          </div>
        </div>
      )}

      {/* Vehicles Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Гараж
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Выберите автомобиль для просмотра журнала обслуживания, заправок и аналитики
            </p>
          </div>
          {isAuthenticated && (
            <button
              onClick={onAddVehicle}
              className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить авто</span>
            </button>
          )}
        </div>

        {/* Filter Tabs & Hide Shared Controls */}
        {vehicles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/60 dark:bg-dark-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Все авто ({myVehicles.length + visibleSharedVehicles.length})
              </button>
              <button
                onClick={() => setFilterTab('my')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterTab === 'my'
                    ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Мой гараж ({myVehicles.length})
              </button>
              <button
                onClick={() => setFilterTab('shared')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterTab === 'shared'
                    ? 'bg-white dark:bg-dark-750 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🌐 Общие ({visibleSharedVehicles.length})
              </button>
            </div>

            {/* Quick Toggle to Hide/Show other users' public cars */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleHideAllShared}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                  hideAllShared
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                    : 'bg-white dark:bg-dark-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-dark-750 hover:bg-slate-50 dark:hover:bg-dark-800'
                }`}
                title={
                  hideAllShared
                    ? 'Показать чужие публичные автомобили'
                    : 'Не показывать чужие публичные автомобили в списке'
                }
              >
                {hideAllShared ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span>Чужие авто скрыты</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Скрыть чужие авто</span>
                  </>
                )}
              </button>

              {hiddenCount > 0 && (
                <button
                  onClick={handleUnhideAll}
                  className="flex items-center space-x-1 text-xs text-brand-600 dark:text-brand-400 hover:underline px-2 py-1"
                  title="Вернуть отображение всех скрытых чужих автомобилей"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Показать скрытые ({hiddenCount})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {displayedVehicles.length === 0 ? (
          <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 flex items-center justify-center mx-auto text-slate-400">
              <Car className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {filterTab === 'shared' ? 'Нет общих автомобилей' : 'Гараж пока пуст'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                {filterTab === 'shared'
                  ? 'Другие пользователи пока не сделали свои автомобили публичными.'
                  : isAuthenticated
                  ? 'Вы можете восстановить все данные и историю обслуживания из файла бэкапа или добавить автомобиль вручную.'
                  : 'В гараже нет добавленных автомобилей.'}
              </p>
            </div>
            {isAuthenticated && filterTab !== 'shared' && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={onOpenImportModal}
                  className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 active:scale-95"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>📥 Восстановить из бэкапа JSON</span>
                </button>
                <button
                  onClick={onAddVehicle}
                  className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить автомобиль</span>
                </button>
              </div>
            )}
          </div>
        ) : displayedVehicles.length === 1 ? (
          /* Single Vehicle Hero Showcase (Wide & Centered) */
          (() => {
            const v = displayedVehicles[0];
            const isOwner = v.is_owner !== false;

            return (
              <div className="max-w-4xl mx-auto animate-fadeIn w-full">
                <div
                  onClick={() => onSelectVehicle(v)}
                  className="bg-white dark:bg-dark-850 border border-slate-200/90 dark:border-dark-750 hover:border-brand-500/50 dark:hover:border-brand-500/50 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col md:flex-row cursor-pointer group relative"
                >
                  {/* Subtle Ambient Glow */}
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/10 dark:bg-brand-500/[0.07] rounded-full blur-3xl pointer-events-none" />

                  {/* Left Column (Image & Plate) */}
                  <div className="md:w-5/12 min-h-[220px] sm:min-h-[260px] md:min-h-[340px] relative bg-slate-100 dark:bg-dark-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {v.photo_url ? (
                      <img
                        src={v.photo_url}
                        alt={`${v.make} ${v.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-dark-800 dark:via-dark-850 dark:to-dark-900 text-slate-400 dark:text-slate-600 p-6 select-none">
                        <Car className="w-20 h-20 sm:w-24 sm:h-24 stroke-[1.2] group-hover:scale-110 transition-transform duration-300 text-brand-500/70 dark:text-brand-400/60" />
                        <span className="text-xs font-bold text-slate-400 mt-2">Фото не загружено</span>
                      </div>
                    )}

                    {/* Overdue Badge */}
                    {(v.overdue_reminders_count || 0) > 0 && (
                      <div className="absolute top-3 left-3 bg-rose-500/95 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-xl flex items-center space-x-1.5 shadow-lg shadow-rose-500/30">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{v.overdue_reminders_count} ТО скоро</span>
                      </div>
                    )}

                    {/* License Plate & Year Badges */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      {v.license_plate && (
                        <span className="bg-slate-900/90 dark:bg-dark-950/90 backdrop-blur-md border border-slate-700/80 text-amber-300 font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-md flex items-center space-x-1">
                          <span className="text-[9px] text-slate-400 font-extrabold mr-0.5">RUS</span>
                          <span>{v.license_plate}</span>
                        </span>
                      )}
                      {v.year && (
                        <span className="bg-slate-900/90 dark:bg-dark-950/90 backdrop-blur-md border border-slate-700/80 text-white text-xs font-bold px-2.5 py-1 rounded-lg ml-auto shadow-md">
                          {v.year} г.в.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column (Info, Metrics & Quick Actions) */}
                  <div className="md:w-7/12 p-5 sm:p-7 flex flex-col justify-between space-y-4 sm:space-y-5">
                    <div>
                      {/* Title Row & Admin/Owner Options */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400">
                              Ваш автомобиль
                            </span>
                            {v.is_public && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                                <Globe className="w-3 h-3" />
                                <span>Публичный</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-brand-500 transition-colors truncate">
                            {v.name || `${v.make} ${v.model}`}
                          </h3>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {v.engine && <span>{v.engine}</span>}
                            {v.vin && <span className="font-mono text-slate-400 dark:text-slate-500">• VIN: {v.vin}</span>}
                          </div>
                        </div>

                        {isAuthenticated && isOwner && (
                          <div className="flex items-center space-x-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onEditVehicle(v)}
                              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-xl transition-colors"
                              title="Редактировать автомобиль"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Удалить ${v.make} ${v.model} и все связанные записи?`)) {
                                  onDeleteVehicle(v.id);
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 3 Metric Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-dark-750/80">
                        {/* 1. Odometer */}
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-800/80 border border-slate-100 dark:border-dark-750">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Пробег</span>
                          <div className="font-mono font-black text-slate-900 dark:text-white text-base mt-0.5">
                            {Math.round(v.current_odometer).toLocaleString('ru-RU')}{' '}
                            <span className="text-xs font-sans text-slate-500 font-normal">{v.distance_unit || 'км'}</span>
                          </div>
                          {v.current_engine_hours > 0 && (
                            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono block mt-0.5">
                              {Math.round(v.current_engine_hours)} м/ч
                            </span>
                          )}
                        </div>

                        {/* 2. Fuel / Tank */}
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-800/80 border border-slate-100 dark:border-dark-750">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Топливо</span>
                          {v.starline_fuel_percent !== null && v.starline_fuel_percent !== undefined ? (
                            <div>
                              <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base flex items-center space-x-1 mt-0.5">
                                <Fuel className="w-4 h-4 flex-shrink-0" />
                                <span>
                                  {v.fuel_tank_capacity
                                    ? `~${Math.round((v.starline_fuel_percent / 100) * v.fuel_tank_capacity)} л`
                                    : `${Math.round(v.starline_fuel_percent)}%`}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                                {Math.round(v.starline_fuel_percent)}% бака ({v.fuel_tank_capacity ? `${v.fuel_tank_capacity} л` : ''})
                              </span>
                            </div>
                          ) : (
                            <div>
                              <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-base mt-0.5">
                                {v.fuel_tank_capacity ? `${v.fuel_tank_capacity} л` : '—'}
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">Объем бака</span>
                            </div>
                          )}
                        </div>

                        {/* 3. Status of Maintenance */}
                        <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-slate-50 dark:bg-dark-800/80 border border-slate-100 dark:border-dark-750">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Состояние ТО</span>
                          {(v.overdue_reminders_count || 0) > 0 ? (
                            <div>
                              <span className="font-bold text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-1 mt-0.5">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>Требует ТО ({v.overdue_reminders_count})</span>
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-0.5">Есть срочные работы</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center space-x-1 mt-0.5">
                                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                <span>В норме</span>
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-0.5">Регламенты соблюдены</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* StarLine Status Line if enabled */}
                      {v.telematics_provider === 'starline' && v.starline_token && (
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-dark-750 text-xs">
                          <span className="flex items-center space-x-1 text-slate-500 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>StarLine Online:</span>
                          </span>
                          {v.starline_battery !== null && (
                            <span className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-dark-750 px-2 py-0.5 rounded-md font-bold">
                              АКБ: {v.starline_battery} В
                            </span>
                          )}
                          <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-dark-750 px-2 py-0.5 rounded-md font-medium">
                            {v.starline_is_armed ? '🛡️ В охране' : '⚠️ Снята'}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-dark-750 px-2 py-0.5 rounded-md font-medium">
                            {v.starline_is_running ? '🟢 ДВС заведен' : '⚪ Заглушен'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-dark-750">
                      <div className="flex items-center space-x-2">
                        {onOpenFuelModal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFuelModal();
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition flex items-center space-x-1.5"
                          >
                            <Fuel className="w-3.5 h-3.5" />
                            <span>Заправить</span>
                          </button>
                        )}
                        {onOpenServiceModal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenServiceModal('service');
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition flex items-center space-x-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Запись ТО</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectVehicle(v)}
                        className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-brand-500/25 active:scale-95 transition-all group-hover:scale-102"
                      >
                        <span>Открыть бортовой журнал</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayedVehicles.map((v) => {
              const isOwner = v.is_owner !== false;

              return (
                <div
                  key={v.id}
                  onClick={() => onSelectVehicle(v)}
                  className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 hover:border-brand-500/50 dark:hover:border-brand-500/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer group"
                >
                  {/* Vehicle Image */}
                  <div className="h-36 sm:h-40 relative bg-slate-100 dark:bg-dark-800 overflow-hidden">
                    {v.photo_url ? (
                      <img
                        src={v.photo_url}
                        alt={`${v.make} ${v.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-gradient-to-br dark:from-dark-800 dark:to-dark-900 text-slate-400 dark:text-slate-600">
                        <Car className="w-12 h-12 stroke-[1.2]" />
                      </div>
                    )}

                    {/* Overdue Badge */}
                    {(v.overdue_reminders_count || 0) > 0 && (
                      <div className="absolute top-2.5 left-2.5 bg-rose-500/95 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 shadow-lg shadow-rose-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{v.overdue_reminders_count} ТО скоро</span>
                      </div>
                    )}

                    {/* License plate & Year overlay */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                      {v.license_plate && (
                        <span className="bg-slate-900/85 dark:bg-dark-950/85 backdrop-blur-md border border-slate-700/80 text-amber-300 text-[11px] font-mono font-black px-2 py-0.5 rounded-md shadow">
                          {v.license_plate}
                        </span>
                      )}
                      {v.year && (
                        <span className="bg-slate-900/85 dark:bg-dark-950/85 backdrop-blur-md border border-slate-700/80 text-slate-200 text-xs font-semibold px-2 py-0.5 rounded-md ml-auto">
                          {v.year} г.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-brand-500 transition-colors truncate">
                            {v.name || `${v.make} ${v.model}`}
                          </h3>
                          {v.engine && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                              {v.engine}
                            </p>
                          )}
                        </div>

                        {isAuthenticated && isOwner && (
                          <div className="flex items-center space-x-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onEditVehicle(v)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-lg transition-colors"
                              title="Редактировать"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Удалить ${v.make} ${v.model} и все связанные записи?`)) {
                                  onDeleteVehicle(v.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {!isOwner && (
                          <div className="flex items-center space-x-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {v.owner_name || 'Только чтение'}
                            </span>
                            <button
                              onClick={() => handleHideSingleVehicle(v.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-lg transition-colors flex items-center"
                              title="Скрыть этот автомобиль"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Clean Metric Row (Пробег слева, Топливо справа) */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-dark-750/80 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Пробег</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm block">
                            {Math.round(v.current_odometer).toLocaleString('ru-RU')}{' '}
                            <span className="text-[10px] text-slate-500 font-sans">{v.distance_unit || 'км'}</span>
                          </span>
                          {v.current_engine_hours > 0 && (
                            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono block">
                              {Math.round(v.current_engine_hours)} м/ч
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Топливо</span>
                          {v.starline_fuel_percent !== null && v.starline_fuel_percent !== undefined ? (
                            <>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-end space-x-1">
                                <Fuel className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>
                                  {v.fuel_tank_capacity
                                    ? `~${Math.round((v.starline_fuel_percent / 100) * v.fuel_tank_capacity)} л`
                                    : `${Math.round(v.starline_fuel_percent)}%`}
                                </span>
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                {Math.round(v.starline_fuel_percent)}% бака
                              </span>
                            </>
                          ) : (
                            <span className="font-mono text-slate-400 text-sm block mt-0.5">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
