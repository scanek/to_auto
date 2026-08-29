import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Fuel,
  CalendarClock,
  BarChart3,
  FileText,
  Plus,
  ArrowLeft,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  DocumentNote,
  VehicleAnalytics,
} from '../types';
import { api } from '../services/api';
import { ProgressBar } from '../components/ProgressBar';

interface VehicleDetailsProps {
  vehicle: Vehicle;
  onBack: () => void;
  onRefreshVehicle: () => Promise<void>;
  onOpenServiceModal: (type?: 'service' | 'repair' | 'upgrade', record?: ServiceRecord) => void;
  onOpenFuelModal: (log?: FuelLog) => void;
  onOpenReminderModal: (plan?: MaintenancePlan) => void;
  onOpenDocModal: (doc?: DocumentNote) => void;
}

export const VehicleDetails: React.FC<VehicleDetailsProps> = ({
  vehicle,
  onBack,
  onRefreshVehicle,
  onOpenServiceModal,
  onOpenFuelModal,
  onOpenReminderModal,
  onOpenDocModal,
}) => {
  const [activeTab, setActiveTab] = useState<
    'service' | 'repairs' | 'upgrades' | 'fuel' | 'reminders' | 'analytics' | 'documents'
  >('service');

  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [reminders, setReminders] = useState<MaintenancePlan[]>([]);
  const [documents, setDocuments] = useState<DocumentNote[]>([]);
  const [analytics, setAnalytics] = useState<VehicleAnalytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [editingOdometer, setEditingOdometer] = useState(false);
  const [newOdometerVal, setNewOdometerVal] = useState(vehicle.current_odometer);

  const loadData = async () => {
    setLoading(true);
    try {
      const [srv, fuel, rem, docs, an] = await Promise.all([
        api.getServiceRecords(vehicle.id),
        api.getFuelLogs(vehicle.id),
        api.getReminders(vehicle.id),
        api.getDocuments(vehicle.id),
        api.getAnalytics(vehicle.id),
      ]);
      setServiceRecords(srv);
      setFuelLogs(fuel);
      setReminders(rem);
      setDocuments(docs);
      setAnalytics(an);
    } catch (err) {
      console.error('Error loading vehicle data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setNewOdometerVal(vehicle.current_odometer);
  }, [vehicle.id]);

  const handleUpdateOdometer = async () => {
    try {
      await api.updateVehicle(vehicle.id, { current_odometer: newOdometerVal });
      setEditingOdometer(false);
      await onRefreshVehicle();
      await loadData();
    } catch (err) {
      alert('Ошибка обновления одометра');
    }
  };

  const handleMarkReminderDone = async (id: number) => {
    try {
      await api.markReminderDone(id);
      await onRefreshVehicle();
      await loadData();
    } catch (err) {
      alert('Ошибка при отметке напоминания');
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Удалить эту запись?')) return;
    await api.deleteServiceRecord(id);
    await onRefreshVehicle();
    await loadData();
  };

  const handleDeleteFuel = async (id: number) => {
    if (!confirm('Удалить эту заправку?')) return;
    await api.deleteFuelLog(id);
    await onRefreshVehicle();
    await loadData();
  };

  const handleDeleteReminder = async (id: number) => {
    if (!confirm('Удалить это напоминание?')) return;
    await api.deleteReminder(id);
    await onRefreshVehicle();
    await loadData();
  };

  const handleDeleteDoc = async (id: number) => {
    if (!confirm('Удалить этот документ?')) return;
    await api.deleteDocument(id);
    await onRefreshVehicle();
    await loadData();
  };

  // Filter service records by tab
  const displayedServiceRecords = serviceRecords.filter((r) => {
    if (activeTab === 'service') return r.record_type === 'service';
    if (activeTab === 'repairs') return r.record_type === 'repair';
    if (activeTab === 'upgrades') return r.record_type === 'upgrade';
    return true;
  });

  const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Top Navigation & Vehicle Header */}
      <div className="bg-dark-850 border border-dark-750 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white rounded-xl transition-colors border border-dark-700"
              title="Назад в гараж"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {vehicle.make} {vehicle.model}
                </h1>
                {vehicle.year && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-dark-750 text-slate-300 border border-dark-700">
                    {vehicle.year}
                  </span>
                )}
                {vehicle.license_plate && (
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-dark-900 text-brand-400 border border-brand-500/30">
                    {vehicle.license_plate}
                  </span>
                )}
              </div>
              {vehicle.vin && (
                <span className="text-xs text-slate-400 font-mono block mt-0.5">
                  VIN: {vehicle.vin}
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenServiceModal('service')}
              className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Запись ТО</span>
            </button>

            <button
              onClick={() => onOpenFuelModal()}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
            >
              <Fuel className="w-4 h-4" />
              <span>Заправка</span>
            </button>

            <button
              onClick={() => onOpenReminderModal()}
              className="flex items-center space-x-1.5 bg-dark-800 hover:bg-dark-750 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-dark-700 transition-all"
            >
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <span>+ Регламент</span>
            </button>

            <a
              href={`/api/v1/export/service-booklet/${vehicle.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 bg-dark-800 hover:bg-dark-750 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-dark-700 transition-all"
            >
              <Printer className="w-4 h-4 text-brand-400" />
              <span>Сервисная книжка (PDF)</span>
            </a>
          </div>
        </div>

        {/* Vehicle Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-dark-750">
          {/* Odometer Quick Editor */}
          <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Текущий пробег
            </span>
            {editingOdometer ? (
              <div className="flex items-center space-x-1.5 mt-1">
                <input
                  type="number"
                  value={newOdometerVal}
                  onChange={(e) => setNewOdometerVal(parseFloat(e.target.value) || 0)}
                  className="w-24 bg-dark-800 border border-brand-500 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                />
                <button
                  onClick={handleUpdateOdometer}
                  className="p-1 bg-brand-500 text-white rounded hover:bg-brand-600 text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setEditingOdometer(true)}
                className="flex items-center space-x-1.5 cursor-pointer group"
              >
                <span className="text-base font-extrabold text-white font-mono group-hover:text-brand-400 transition-colors">
                  {Math.round(vehicle.current_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                </span>
                <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-brand-400" />
              </div>
            )}
          </div>

          <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Средний расход
            </span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {analytics?.avg_fuel_consumption
                ? `${analytics.avg_fuel_consumption} л/100км`
                : '—'}
            </span>
          </div>

          <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Всего затрат
            </span>
            <span className="text-base font-extrabold text-brand-400 font-mono">
              {Math.round(analytics?.total_spend || 0).toLocaleString('ru-RU')} {vehicle.currency}
            </span>
          </div>

          <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Стоимость 1 км
            </span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {analytics?.cost_per_distance_unit
                ? `${analytics.cost_per_distance_unit} ${vehicle.currency}/км`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (LubeLogger Style) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none border-b border-dark-800">
        {[
          { id: 'service', label: 'Плановое ТО', icon: Wrench, count: serviceRecords.filter(r => r.record_type === 'service').length },
          { id: 'repairs', label: 'Ремонты', icon: AlertTriangle, count: serviceRecords.filter(r => r.record_type === 'repair').length },
          { id: 'upgrades', label: 'Тюнинг & Допы', icon: Sparkles, count: serviceRecords.filter(r => r.record_type === 'upgrade').length },
          { id: 'fuel', label: 'Заправки', icon: Fuel, count: fuelLogs.length },
          { id: 'reminders', label: 'План и Регламенты', icon: CalendarClock, count: reminders.length },
          { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
          { id: 'documents', label: 'Документы', icon: FileText, count: documents.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-slate-200 border border-dark-750'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-dark-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Service / Repairs / Upgrades Tabs */}
        {['service', 'repairs', 'upgrades'].includes(activeTab) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                История записей ({displayedServiceRecords.length})
              </span>
              <button
                onClick={() => onOpenServiceModal(activeTab as any)}
                className="flex items-center space-x-1.5 text-xs font-bold text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить запись</span>
              </button>
            </div>

            {displayedServiceRecords.length === 0 ? (
              <div className="bg-dark-850 border border-dark-750 rounded-2xl p-10 text-center space-y-3">
                <Wrench className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-white">Записей пока нет</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Зафиксируйте выполненные работы, замену расходников или ремонт с ценами и запчастями.
                </p>
                <button
                  onClick={() => onOpenServiceModal(activeTab as any)}
                  className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить запись</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedServiceRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-dark-850 border border-dark-750 hover:border-dark-700 rounded-2xl p-5 shadow-md transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 font-bold text-sm">
                          <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                          <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5 font-mono">
                            <span>📅 {new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                            <span>🛣️ {Math.round(rec.odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-center">
                        <div className="text-right">
                          <div className="text-base font-extrabold text-brand-400 font-mono">
                            {rec.total_cost.toLocaleString('ru-RU')} {vehicle.currency}
                          </div>
                          {(rec.cost_parts > 0 || rec.cost_labor > 0) && (
                            <div className="text-[10px] text-slate-400">
                              {rec.cost_parts > 0 && `Детали: ${rec.cost_parts} `}
                              {rec.cost_labor > 0 && `Работа: ${rec.cost_labor}`}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 pl-2 border-l border-dark-750">
                          <button
                            onClick={() => onOpenServiceModal(rec.record_type, rec)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-750 rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteService(rec.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {rec.description && (
                      <p className="text-xs text-slate-300 bg-dark-900/60 p-2.5 rounded-lg border border-dark-750/60">
                        {rec.description}
                      </p>
                    )}

                    {rec.items && rec.items.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-dark-750/70">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Запчасти и материалы:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rec.items.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-dark-900 p-2 rounded-lg border border-dark-750 text-slate-300"
                            >
                              <div className="truncate mr-2">
                                <span className="font-medium">{it.name}</span>
                                {it.part_number && (
                                  <span className="text-[10px] text-slate-500 block font-mono">
                                    Арт: {it.part_number}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-slate-200 whitespace-nowrap">
                                {it.quantity} × {it.unit_price} = {it.total_price} {vehicle.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fuel Logs Tab */}
        {activeTab === 'fuel' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Журнал заправок ({fuelLogs.length})
              </span>
              <button
                onClick={() => onOpenFuelModal()}
                className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить заправку</span>
              </button>
            </div>

            {fuelLogs.length === 0 ? (
              <div className="bg-dark-850 border border-dark-750 rounded-2xl p-10 text-center space-y-3">
                <Fuel className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-white">Нет записей о заправках</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Вносите данные о заправках полного бака для точного расчета расхода топлива и стоимости 1 км.
                </p>
                <button
                  onClick={() => onOpenFuelModal()}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить заправку</span>
                </button>
              </div>
            ) : (
              <div className="bg-dark-850 border border-dark-750 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-dark-900 border-b border-dark-750 text-slate-400 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Дата</th>
                        <th className="p-3.5">Пробег</th>
                        <th className="p-3.5">Объем</th>
                        <th className="p-3.5">Цена/л</th>
                        <th className="p-3.5">Расход</th>
                        <th className="p-3.5">Сумма</th>
                        <th className="p-3.5">АЗС / Топливо</th>
                        <th className="p-3.5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-750 text-slate-300">
                      {fuelLogs.map((f) => (
                        <tr key={f.id} className="hover:bg-dark-800/60 transition-colors">
                          <td className="p-3.5 font-medium text-white whitespace-nowrap">
                            {new Date(f.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="p-3.5 font-mono">
                            {Math.round(f.odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                          </td>
                          <td className="p-3.5 font-mono">
                            {f.fuel_amount} {vehicle.fuel_unit}
                          </td>
                          <td className="p-3.5 font-mono text-slate-400">
                            {f.unit_price} {vehicle.currency}
                          </td>
                          <td className="p-3.5 font-mono font-bold">
                            {f.consumption ? (
                              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                {f.consumption} л/100км
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono font-extrabold text-brand-400">
                            {f.total_cost.toLocaleString('ru-RU')} {vehicle.currency}
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {f.gas_station || f.fuel_grade ? (
                              <span>
                                {f.gas_station} {f.fuel_grade && `(${f.fuel_grade})`}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => onOpenFuelModal(f)}
                              className="p-1 text-slate-400 hover:text-white mr-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFuel(f.id)}
                              className="p-1 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reminders / Planner Tab (LubeLogger Style) */}
        {activeTab === 'reminders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                План регламентов ТО и износа ({reminders.length})
              </span>
              <button
                onClick={() => onOpenReminderModal()}
                className="flex items-center space-x-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Новый регламент</span>
              </button>
            </div>

            {reminders.length === 0 ? (
              <div className="bg-dark-850 border border-dark-750 rounded-2xl p-10 text-center space-y-3">
                <CalendarClock className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-white">Регламенты не настроены</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Добавьте регламент замены масла, фильтров, свечей или колодок, и система заранее предупредит о необходимости ТО.
                </p>
                <button
                  onClick={() => onOpenReminderModal()}
                  className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Создать регламент</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reminders.map((rem) => {
                  const isOverdue = rem.status === 'overdue';
                  const isDueSoon = rem.status === 'due_soon';

                  return (
                    <div
                      key={rem.id}
                      className={`bg-dark-850 border rounded-2xl p-5 shadow-lg space-y-4 transition-all ${
                        isOverdue
                          ? 'border-rose-500/50 shadow-rose-500/5'
                          : isDueSoon
                          ? 'border-amber-500/40'
                          : 'border-dark-750'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-white">{rem.title}</h4>
                            {isOverdue && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Просрочено
                              </span>
                            )}
                            {isDueSoon && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Скоро ТО
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 mt-1">
                            Интервал:{' '}
                            {rem.interval_distance ? `${rem.interval_distance.toLocaleString('ru-RU')} ${vehicle.distance_unit}` : ''}
                            {rem.interval_distance && rem.interval_months ? ' или ' : ''}
                            {rem.interval_months ? `${rem.interval_months} мес.` : ''}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => onOpenReminderModal(rem)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-dark-750"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteReminder(rem.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            Осталось:{' '}
                            {rem.remaining_distance !== null && rem.remaining_distance !== undefined && (
                              <span
                                className={`font-mono font-bold ${
                                  rem.remaining_distance <= 0 ? 'text-rose-400' : 'text-slate-200'
                                }`}
                              >
                                {Math.round(rem.remaining_distance).toLocaleString('ru-RU')} {vehicle.distance_unit}
                              </span>
                            )}
                            {rem.remaining_distance !== null && rem.remaining_days !== null && ' / '}
                            {rem.remaining_days !== null && rem.remaining_days !== undefined && (
                              <span
                                className={`font-bold ${
                                  rem.remaining_days <= 0 ? 'text-rose-400' : 'text-slate-200'
                                }`}
                              >
                                {rem.remaining_days} дн.
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 font-bold">
                            {rem.progress_percentage}%
                          </span>
                        </div>
                        <ProgressBar percentage={rem.progress_percentage} status={rem.status} />
                      </div>

                      {/* Last done baseline and Mark Done button */}
                      <div className="flex items-center justify-between pt-3 border-t border-dark-750/70 text-xs">
                        <div className="text-[11px] text-slate-500">
                          Было: {Math.round(rem.last_service_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit} (
                          {new Date(rem.last_service_date).toLocaleDateString('ru-RU')})
                        </div>

                        <button
                          onClick={() => handleMarkReminderDone(rem.id)}
                          className="flex items-center space-x-1.5 bg-dark-800 hover:bg-emerald-600 hover:text-white text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold border border-dark-700 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Выполнено</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab (Charts) */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl">
                <span className="text-xs uppercase font-semibold text-slate-400">
                  Всего на ТО и ремонты
                </span>
                <div className="text-xl font-extrabold text-brand-400 mt-1 font-mono">
                  {(analytics.total_service_spend + analytics.total_repair_spend).toLocaleString('ru-RU')}{' '}
                  {vehicle.currency}
                </div>
              </div>

              <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl">
                <span className="text-xs uppercase font-semibold text-slate-400">
                  Всего на топливо
                </span>
                <div className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">
                  {analytics.total_fuel_spend.toLocaleString('ru-RU')} {vehicle.currency}
                </div>
              </div>

              <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl">
                <span className="text-xs uppercase font-semibold text-slate-400">
                  Заправлено литров
                </span>
                <div className="text-xl font-extrabold text-amber-400 mt-1 font-mono">
                  {analytics.total_fuel_liters.toLocaleString('ru-RU')} {vehicle.fuel_unit}
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown Pie */}
              <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-white">Структура расходов</h4>
                {analytics.categories.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="amount"
                          nameKey="category"
                        >
                          {analytics.categories.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [`${Number(value).toLocaleString('ru-RU')} ${vehicle.currency}`, 'Сумма']}
                          contentStyle={{ backgroundColor: '#1b2230', borderColor: '#2d3748', borderRadius: 8 }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                    Недостаточно данных для графика
                  </div>
                )}
              </div>

              {/* Monthly Costs Bar Chart */}
              <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-white">Расходы по месяцам</h4>
                {analytics.monthly_costs.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.monthly_costs}>
                        <XAxis dataKey="month" stroke="#718096" fontSize={11} />
                        <YAxis stroke="#718096" fontSize={11} />
                        <Tooltip
                          formatter={(value: any) => [`${Number(value).toLocaleString('ru-RU')} ${vehicle.currency}`, '']}
                          contentStyle={{ backgroundColor: '#1b2230', borderColor: '#2d3748', borderRadius: 8 }}
                        />
                        <Legend />
                        <Bar dataKey="service_cost" name="ТО" stackId="a" fill="#0ea5e9" />
                        <Bar dataKey="repair_cost" name="Ремонт" stackId="a" fill="#f43f5e" />
                        <Bar dataKey="upgrade_cost" name="Тюнинг" stackId="a" fill="#10b981" />
                        <Bar dataKey="fuel_cost" name="Топливо" stackId="a" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                    Недостаточно данных для графика
                  </div>
                )}
              </div>

              {/* Fuel Economy Trend */}
              {analytics.fuel_trend.length > 0 && (
                <div className="bg-dark-850 border border-dark-750 p-5 rounded-2xl space-y-4 lg:col-span-2">
                  <h4 className="text-sm font-bold text-white">Динамика расхода топлива (л/100км)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.fuel_trend}>
                        <XAxis dataKey="date" stroke="#718096" fontSize={11} />
                        <YAxis stroke="#718096" fontSize={11} domain={['auto', 'auto']} />
                        <Tooltip
                          formatter={(value: any) => [`${value} л/100км`, 'Расход']}
                          contentStyle={{ backgroundColor: '#1b2230', borderColor: '#2d3748', borderRadius: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="consumption"
                          name="Расход л/100км"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#10b981' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents & Insurance Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Документы, страховки и сроки ({documents.length})
              </span>
              <button
                onClick={() => onOpenDocModal()}
                className="flex items-center space-x-1.5 text-xs font-bold text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить документ</span>
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="bg-dark-850 border border-dark-750 rounded-2xl p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-white">Документы не добавлены</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Сохраняйте полисы ОСАГО/КАСКО, диагностические карты техосмотра и важные заметки с напоминанием о сроках окончания.
                </p>
                <button
                  onClick={() => onOpenDocModal()}
                  className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить документ</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`bg-dark-850 border rounded-2xl p-5 shadow-lg space-y-3 ${
                      doc.is_expired
                        ? 'border-rose-500/50'
                        : doc.days_until_expiration && doc.days_until_expiration <= 30
                        ? 'border-amber-500/50'
                        : 'border-dark-750'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{doc.title}</h4>
                        {doc.document_number && (
                          <span className="text-xs text-slate-400 font-mono block">
                            № {doc.document_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onOpenDocModal(doc)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-dark-750"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {doc.expiration_date && (
                      <div className="flex items-center justify-between bg-dark-900/80 p-3 rounded-xl border border-dark-750">
                        <span className="text-xs text-slate-400">
                          Действует до: {new Date(doc.expiration_date).toLocaleDateString('ru-RU')}
                        </span>
                        {doc.is_expired ? (
                          <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            Истёк!
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              doc.days_until_expiration && doc.days_until_expiration <= 30
                                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            }`}
                          >
                            Осталось {doc.days_until_expiration} дн.
                          </span>
                        )}
                      </div>
                    )}

                    {doc.notes && (
                      <p className="text-xs text-slate-400 italic">
                        {doc.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
