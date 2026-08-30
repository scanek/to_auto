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
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Моих авто в гараже
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {myVehicles.length}
              {visibleSharedVehicles.length > 0 && (
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  (+{visibleSharedVehicles.length} общих)
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 flex-shrink-0">
            <Car className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Напоминаний к ТО
            </span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span
                className={`text-xl sm:text-2xl font-extrabold ${
                  totalOverdueReminders > 0 ? 'text-rose-500' : 'text-emerald-500'
                }`}
              >
                {totalOverdueReminders}
              </span>
              {totalOverdueReminders > 0 && (
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium">
                  Требует внимания
                </span>
              )}
            </div>
          </div>
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              totalOverdueReminders > 0
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
            }`}
          >
            <CalendarClock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Всего расходов
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {totalSpendMy.toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

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
            <div className="flex items-center space-x-2">
              <button
                onClick={onOpenImportModal}
                className="flex items-center space-x-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Импорт бэкапа</span>
              </button>
              <button
                onClick={onAddVehicle}
                className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить авто</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Tabs & Hide Shared Controls */}
        {allSharedVehicles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5">
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
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-white dark:bg-dark-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-750 hover:bg-slate-50 dark:hover:bg-dark-800'
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayedVehicles.map((v) => {
              const isOwner = v.is_owner !== false;

              return (
                <div
                  key={v.id}
                  className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 hover:border-slate-300 dark:hover:border-dark-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                >
                  {/* Vehicle Image */}
                  <div
                    onClick={() => onSelectVehicle(v)}
                    className="h-40 sm:h-44 relative bg-slate-100 dark:bg-dark-800 overflow-hidden cursor-pointer group-hover:brightness-105 transition-all"
                  >
                    {v.photo_url ? (
                      <img
                        src={v.photo_url}
                        alt={`${v.make} ${v.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-gradient-to-br dark:from-dark-800 dark:to-dark-900 text-slate-400 dark:text-slate-600">
                        <Car className="w-14 h-14 stroke-[1.2]" />
                      </div>
                    )}

                    {/* Overdue Badge */}
                    {(v.overdue_reminders_count || 0) > 0 && (
                      <div className="absolute top-2.5 left-2.5 bg-rose-500/95 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 shadow-lg shadow-rose-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{v.overdue_reminders_count} ТО скоро/просрочено</span>
                      </div>
                    )}

                    {/* Privacy / Ownership Badges */}
                    <div className="absolute top-2.5 right-2.5 flex items-center space-x-1">
                      {isOwner ? (
                        v.is_public ? (
                          <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 shadow">
                            <Globe className="w-3 h-3" />
                            <span>Публичный</span>
                          </span>
                        ) : (
                          <span className="bg-slate-800/80 backdrop-blur-md text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 shadow">
                            <Lock className="w-3 h-3" />
                            <span>Личный</span>
                          </span>
                        )
                      ) : (
                        <span className="bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center space-x-1 shadow">
                          <UserIcon className="w-3 h-3" />
                          <span>{v.owner_name || 'Общий'}</span>
                        </span>
                      )}
                    </div>

                    {/* Plate / Year Badges */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      {v.license_plate && (
                        <span className="bg-slate-900/85 dark:bg-dark-950/85 backdrop-blur-md border border-slate-700 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-md shadow-md">
                          {v.license_plate}
                        </span>
                      )}
                      {v.year && (
                        <span className="bg-slate-900/85 dark:bg-dark-950/85 backdrop-blur-md border border-slate-700 text-slate-200 text-xs font-semibold px-2 py-0.5 rounded-md ml-auto">
                          {v.year} г.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 sm:space-y-4">
                    <div>
                      <div className="flex items-start justify-between">
                        <div
                          onClick={() => onSelectVehicle(v)}
                          className="cursor-pointer group-hover:text-brand-500 transition-colors min-w-0"
                        >
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                            {v.name || `${v.make} ${v.model}`}
                          </h3>
                          {v.engine && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                              {v.engine}
                            </p>
                          )}
                        </div>
                        {isAuthenticated && isOwner && (
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <button
                              onClick={() => onEditVehicle(v)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-lg transition-colors"
                              title="Редактировать"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Удалить ${v.make} ${v.model} и все связанные записи?`
                                  )
                                ) {
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
                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Только чтение
                            </span>
                            <button
                              onClick={() => handleHideSingleVehicle(v.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-lg transition-colors flex items-center"
                              title="Не показывать этот автомобиль в моем гараже"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-dark-750">
                        <div className="bg-slate-50 dark:bg-dark-900/70 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-dark-750/70">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                            Пробег
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono block">
                            {Math.round(v.current_odometer).toLocaleString('ru-RU')}{' '}
                            <span className="text-[10px] text-slate-500 font-sans">
                              {v.distance_unit}
                            </span>
                          </span>
                          {v.current_engine_hours > 0 && (
                            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">
                              {Math.round(v.current_engine_hours)} м/ч
                            </span>
                          )}
                        </div>

                        <div className="bg-slate-50 dark:bg-dark-900/70 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-dark-750/70">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                            Затраты
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-brand-600 dark:text-brand-400 font-mono">
                            {Math.round(v.total_cost || 0).toLocaleString('ru-RU')}{' '}
                            <span className="text-[10px] text-slate-500 font-sans">
                              {v.currency}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Open Button */}
                    <button
                      onClick={() => onSelectVehicle(v)}
                      className="w-full flex items-center justify-center space-x-1.5 bg-slate-100 dark:bg-dark-800 hover:bg-brand-500 text-slate-700 dark:text-slate-200 hover:text-white py-2 rounded-xl text-xs font-semibold transition-all duration-200 border border-slate-200 dark:border-dark-700 hover:border-brand-500 shadow-sm"
                    >
                      <span>{isOwner ? 'Открыть журнал и ТО' : 'Просмотр сервисной книжки'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
