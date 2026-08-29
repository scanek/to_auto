import React from 'react';
import {
  Car,
  Plus,
  CalendarClock,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Vehicle } from '../types';

interface GarageProps {
  vehicles: Vehicle[];
  onSelectVehicle: (v: Vehicle) => void;
  onAddVehicle: () => void;
  onEditVehicle: (v: Vehicle) => void;
  onDeleteVehicle: (id: number) => void;
}

export const Garage: React.FC<GarageProps> = ({
  vehicles,
  onSelectVehicle,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
}) => {
  const totalSpendAll = vehicles.reduce((sum, v) => sum + (v.total_cost || 0), 0);
  const totalOverdueReminders = vehicles.reduce(
    (sum, v) => sum + (v.overdue_reminders_count || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Автомобилей в гараже</span>
            <div className="text-2xl font-extrabold text-white mt-1">{vehicles.length}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Car className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Напоминаний к ТО</span>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`text-2xl font-extrabold ${
                  totalOverdueReminders > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {totalOverdueReminders}
              </span>
              {totalOverdueReminders > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                  Требует внимания
                </span>
              )}
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              totalOverdueReminders > 0
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            }`}
          >
            <CalendarClock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Всего расходов</span>
            <div className="text-2xl font-extrabold text-white mt-1">
              {totalSpendAll.toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Vehicles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Ваш гараж</h2>
            <p className="text-xs text-slate-400">
              Выберите автомобиль для просмотра журнала обслуживания, заправок и аналитики
            </p>
          </div>
          <button
            onClick={onAddVehicle}
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить авто</span>
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="bg-dark-850 border border-dark-750 rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto text-slate-500">
              <Car className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Гараж пока пуст</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Добавьте свой первый автомобиль, чтобы начать вести электронную сервисную книжку и следить за расходами.
              </p>
            </div>
            <button
              onClick={onAddVehicle}
              className="inline-flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить автомобиль</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-dark-850 border border-dark-750 hover:border-dark-700 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col group"
              >
                {/* Vehicle Image / Placeholder */}
                <div
                  onClick={() => onSelectVehicle(v)}
                  className="h-44 relative bg-dark-800 overflow-hidden cursor-pointer group-hover:brightness-105 transition-all"
                >
                  {v.photo_url ? (
                    <img
                      src={v.photo_url}
                      alt={`${v.make} ${v.model}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-dark-800 to-dark-900 text-slate-600">
                      <Car className="w-16 h-16 stroke-[1.2]" />
                    </div>
                  )}

                  {/* Overdue Badge */}
                  {(v.overdue_reminders_count || 0) > 0 && (
                    <div className="absolute top-3 left-3 bg-rose-500/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-lg shadow-rose-500/30">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{v.overdue_reminders_count} ТО скоро/просрочено</span>
                    </div>
                  )}

                  {/* Plate / Year Badges */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    {v.license_plate && (
                      <span className="bg-dark-950/80 backdrop-blur-md border border-dark-700 text-slate-100 text-xs font-mono font-bold px-2.5 py-1 rounded-md shadow-md">
                        {v.license_plate}
                      </span>
                    )}
                    {v.year && (
                      <span className="bg-dark-950/80 backdrop-blur-md border border-dark-700 text-slate-300 text-xs font-semibold px-2 py-0.5 rounded-md ml-auto">
                        {v.year} г.
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        onClick={() => onSelectVehicle(v)}
                        className="cursor-pointer group-hover:text-brand-400 transition-colors"
                      >
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {v.make} {v.model}
                        </h3>
                        {v.name && <p className="text-xs text-slate-400">{v.name}</p>}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEditVehicle(v)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-750 rounded-lg transition-colors"
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
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-dark-750">
                      <div className="bg-dark-900/70 p-2.5 rounded-xl border border-dark-750/70">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Одометр
                        </span>
                        <span className="text-sm font-bold text-white font-mono">
                          {Math.round(v.current_odometer).toLocaleString('ru-RU')}{' '}
                          <span className="text-xs text-slate-400 font-sans">{v.distance_unit}</span>
                        </span>
                      </div>

                      <div className="bg-dark-900/70 p-2.5 rounded-xl border border-dark-750/70">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Затраты
                        </span>
                        <span className="text-sm font-bold text-brand-400 font-mono">
                          {Math.round(v.total_cost || 0).toLocaleString('ru-RU')}{' '}
                          <span className="text-xs text-slate-400 font-sans">{v.currency}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Open Button */}
                  <button
                    onClick={() => onSelectVehicle(v)}
                    className="w-full flex items-center justify-center space-x-1.5 bg-dark-800 hover:bg-brand-500 text-slate-200 hover:text-white py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border border-dark-700 hover:border-brand-500 shadow-sm"
                  >
                    <span>Открыть журнал и ТО</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
