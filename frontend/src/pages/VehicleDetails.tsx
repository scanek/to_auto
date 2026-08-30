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
  Disc,
  ExternalLink,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle,
  RefreshCw,
  FileJson,
  Eye,
  Globe,
  Lock,
  User as UserIcon,
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
} from 'recharts';
import {
  Vehicle,
  ServiceRecord,
  FuelLog,
  MaintenancePlan,
  DocumentNote,
  VehicleAnalytics,
  TyreSet,
} from '../types';
import { api } from '../services/api';
import { notificationService } from '../services/notificationService';
import { ProgressBar } from '../components/ProgressBar';

interface VehicleDetailsProps {
  vehicle: Vehicle;
  isAuthenticated: boolean;
  onBack: () => void;
  onRefreshVehicle: () => Promise<void>;
  onEditVehicle?: () => void;
  onDeleteVehicle?: () => void;
  onOpenServiceModal: (type?: 'service' | 'repair' | 'upgrade', record?: ServiceRecord) => void;
  onOpenFuelModal: (log?: FuelLog) => void;
  onOpenReminderModal: (plan?: MaintenancePlan) => void;
  onOpenDocModal: (doc?: DocumentNote) => void;
  onOpenTyreModal: (tyre?: TyreSet) => void;
}

export const VehicleDetails: React.FC<VehicleDetailsProps> = ({
  vehicle,
  isAuthenticated,
  onBack,
  onRefreshVehicle,
  onOpenServiceModal,
  onOpenFuelModal,
  onOpenReminderModal,
  onOpenDocModal,
  onOpenTyreModal,
}) => {
  const [activeTab, setActiveTab] = useState<
    'service' | 'repairs' | 'upgrades' | 'fuel' | 'reminders' | 'tyres' | 'analytics' | 'documents'
  >('service');

  const isOwner = isAuthenticated && vehicle.is_owner !== false;

  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [reminders, setReminders] = useState<MaintenancePlan[]>([]);
  const [documents, setDocuments] = useState<DocumentNote[]>([]);
  const [tyres, setTyres] = useState<TyreSet[]>([]);
  const [analytics, setAnalytics] = useState<VehicleAnalytics | null>(null);

  const [editingOdometer, setEditingOdometer] = useState(false);
  const [newOdometerVal, setNewOdometerVal] = useState(vehicle.current_odometer);

  const [editingHours, setEditingHours] = useState(false);
  const [newHoursVal, setNewHoursVal] = useState(vehicle.current_engine_hours || 0);

  const loadData = async () => {
    try {
      const [srv, fuel, rem, docs, an, ty] = await Promise.all([
        api.getServiceRecords(vehicle.id),
        api.getFuelLogs(vehicle.id),
        api.getReminders(vehicle.id),
        api.getDocuments(vehicle.id),
        api.getAnalytics(vehicle.id),
        api.getTyreSets(vehicle.id),
      ]);
      setServiceRecords(srv);
      setFuelLogs(fuel);
      setReminders(rem);
      setDocuments(docs);
      setAnalytics(an);
      setTyres(ty);

      // Check upcoming maintenance and insurance triggers for push alerts
      notificationService.checkAndNotifyVehicle(vehicle, rem, docs).catch(() => {});
    } catch (err) {
      console.error('Error loading vehicle data', err);
    }
  };

  useEffect(() => {
    loadData();
    setNewOdometerVal(vehicle.current_odometer);
    setNewHoursVal(vehicle.current_engine_hours || 0);
  }, [
    vehicle.id,
    vehicle.updated_at,
    vehicle.current_odometer,
    vehicle.current_engine_hours,
    vehicle.total_fuel_cost,
    vehicle.total_service_cost,
    vehicle.total_cost,
  ]);

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

  const handleUpdateHours = async () => {
    try {
      await api.updateVehicle(vehicle.id, { current_engine_hours: newHoursVal });
      setEditingHours(false);
      await onRefreshVehicle();
      await loadData();
    } catch (err) {
      alert('Ошибка обновления моточасов');
    }
  };

  const handleMarkReminderDone = async (id: number) => {
    try {
      await api.markReminderDone(id, vehicle.current_odometer, vehicle.current_engine_hours);
      await onRefreshVehicle();
      await loadData();
    } catch (err) {
      alert('Ошибка при отметке напоминания');
    }
  };

  const handleActivateTyre = async (id: number) => {
    try {
      await api.activateTyreSet(id, vehicle.current_odometer);
      await loadData();
    } catch (err) {
      alert('Ошибка активации комплекта шин');
    }
  };

  const handleSeasonSwap = async (targetSeason: 'summer' | 'winter') => {
    const target = tyres.find((t) => t.season === targetSeason);
    if (!target) {
      alert(`Комплект ${targetSeason === 'summer' ? 'летних' : 'зимних'} шин еще не добавлен`);
      return;
    }
    await handleActivateTyre(target.id);
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

  const handleDeleteTyre = async (id: number) => {
    if (!confirm('Удалить этот комплект шин?')) return;
    await api.deleteTyreSet(id);
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

  const activeTyre = tyres.find((t) => t.is_active);
  const activeInsurances = documents.filter((d) => d.is_active && (d.doc_type === 'insurance' || d.doc_type === 'osago' || d.doc_type === 'kasko'));

  const COLORS = ['#0284c7', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2'];

  // Clean Custom Tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: data.payload.fill || data.color }} />
            <span className="font-bold text-slate-900 dark:text-white">{data.name}</span>
          </div>
          <div className="font-mono text-sm font-extrabold text-brand-600 dark:text-brand-400">
            {Number(data.value).toLocaleString('ru-RU')} {vehicle.currency}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Доля: <strong className="text-slate-800 dark:text-slate-200">{data.payload.percentage}%</strong>
          </div>
        </div>
      );
    }
    return null;
  };

  // Clean Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalMonth = payload.reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0);
      return (
        <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-700 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[190px]">
          <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-dark-750 pb-1">
            {label}
          </div>
          {payload.map((entry: any, index: number) => {
            if (!entry.value || entry.value === 0) return null;
            return (
              <div key={`item-${index}`} className="flex items-center justify-between space-x-2">
                <span className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {Number(entry.value).toLocaleString('ru-RU')} {vehicle.currency}
                </span>
              </div>
            );
          })}
          <div className="pt-1.5 border-t border-slate-100 dark:border-dark-750 flex items-center justify-between font-bold text-xs">
            <span className="text-slate-700 dark:text-slate-300">Итого:</span>
            <span className="text-brand-600 dark:text-brand-400 font-mono">
              {totalMonth.toLocaleString('ru-RU')} {vehicle.currency}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const navTabs = [
    { id: 'service', label: 'ТО', icon: Wrench, count: serviceRecords.filter(r => r.record_type === 'service').length },
    { id: 'repairs', label: 'Ремонт', icon: AlertTriangle, count: serviceRecords.filter(r => r.record_type === 'repair').length },
    { id: 'upgrades', label: 'Тюнинг', icon: Sparkles, count: serviceRecords.filter(r => r.record_type === 'upgrade').length },
    { id: 'fuel', label: 'Топливо', icon: Fuel, count: fuelLogs.length },
    { id: 'reminders', label: 'Регламент', icon: CalendarClock, count: reminders.length },
    { id: 'tyres', label: 'Шины', icon: Disc, count: tyres.length },
    { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
    { id: 'documents', label: 'Документы', icon: FileText, count: documents.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Top Navigation & Vehicle Header */}
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-4 sm:p-6 shadow-md dark:shadow-xl space-y-4 sm:space-y-6 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors border border-slate-200 dark:border-dark-700 flex-shrink-0"
              title="Назад в гараж"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {vehicle.name || `${vehicle.make} ${vehicle.model}`}
                </h1>
                {vehicle.year && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                    {vehicle.year}
                  </span>
                )}
                {vehicle.license_plate && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-dark-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                    {vehicle.license_plate}
                  </span>
                )}
                {vehicle.engine && (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                    {vehicle.engine}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Buttons */}
          {isOwner && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => onOpenServiceModal('service')}
                className="flex items-center justify-center space-x-1 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Запись ТО</span>
              </button>

              <button
                onClick={() => onOpenFuelModal()}
                className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
              >
                <Fuel className="w-4 h-4 flex-shrink-0" />
                <span>Заправка</span>
              </button>

              <button
                onClick={() => onOpenReminderModal()}
                className="flex items-center justify-center space-x-1 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-dark-700 transition-all"
              >
                <CalendarClock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Регламент</span>
              </button>
            </div>
          )}
        </div>

        {/* Read-only Banner for foreign public cars */}
        {!isOwner && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-slate-700 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white">Режим просмотра:</span>{' '}
                Автомобиль пользователя{' '}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {vehicle.owner_name || 'Владелец'}
                </span>
                . Вы можете просматривать всю историю ТО, заправок и аналитики.
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
              Только чтение
            </span>
          </div>
        )}

        {/* Vehicle Stats Bar (5 cards cleanly distributed) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-200 dark:border-dark-750">
          {/* Odometer Quick Editor */}
          <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
              Пробег
            </span>
            {editingOdometer && isOwner ? (
              <div className="flex items-center space-x-1 mt-1">
                <input
                  type="number"
                  value={newOdometerVal}
                  onChange={(e) => setNewOdometerVal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-dark-800 border border-brand-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white font-mono"
                />
                <button
                  onClick={handleUpdateOdometer}
                  className="p-1 bg-brand-500 text-white rounded hover:bg-brand-600 text-xs flex-shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => isOwner && setEditingOdometer(true)}
                className={`flex items-center space-x-1.5 ${isOwner ? 'cursor-pointer group' : ''}`}
              >
                <span className={`text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono ${isOwner ? 'group-hover:text-brand-500 transition-colors' : ''}`}>
                  {Math.round(vehicle.current_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                </span>
                {isOwner && (
                  <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-brand-500 flex-shrink-0" />
                )}
              </div>
            )}
          </div>

          {/* Engine Hours Quick Editor */}
          <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
              Моточасы
            </span>
            {editingHours && isOwner ? (
              <div className="flex items-center space-x-1 mt-1">
                <input
                  type="number"
                  value={newHoursVal}
                  onChange={(e) => setNewHoursVal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-dark-800 border border-brand-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white font-mono"
                />
                <button
                  onClick={handleUpdateHours}
                  className="p-1 bg-brand-500 text-white rounded hover:bg-brand-600 text-xs flex-shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => isOwner && setEditingHours(true)}
                className={`flex items-center space-x-1.5 ${isOwner ? 'cursor-pointer group' : ''}`}
              >
                <span className={`text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono ${isOwner ? 'group-hover:text-brand-500 transition-colors' : ''}`}>
                  {vehicle.current_engine_hours ? `${Math.round(vehicle.current_engine_hours)} м/ч` : '0 м/ч'}
                </span>
                {isOwner && (
                  <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-brand-500 flex-shrink-0" />
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
              Средний расход
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {analytics?.avg_fuel_consumption ? (
                `${analytics.avg_fuel_consumption} л/100км`
              ) : fuelLogs.length === 1 ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold" title="Первая заправка служит базовой точкой отсчета. При следующей заправке будет рассчитан расход">
                  Точка отсчета 📍
                </span>
              ) : (
                '—'
              )}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
              Все расходы
            </span>
            <span className="text-sm sm:text-base font-extrabold text-brand-600 dark:text-brand-400 font-mono">
              {Math.round(analytics?.total_spend || 0).toLocaleString('ru-RU')} {vehicle.currency}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
              Стоимость 1 км
            </span>
            <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {analytics?.cost_per_distance_unit
                ? `${analytics.cost_per_distance_unit} ${vehicle.currency}/км`
                : '—'}
            </span>
          </div>
        </div>

        {/* Quick Status Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Widget 1: Active Tyres & 1-Click Season Swap */}
          <div className="bg-slate-50 dark:bg-dark-900/90 border border-slate-200 dark:border-dark-750 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                  <Disc className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    Установленные шины
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeTyre ? (
                      <span>
                        {activeTyre.season === 'summer' ? '☀️' : '❄️'} {activeTyre.name}{' '}
                        {activeTyre.size && <span className="font-mono text-xs text-slate-400 font-normal">({activeTyre.size})</span>}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Комплект не выбран</span>
                    )}
                  </div>
                </div>
              </div>

              {isOwner && (
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleSeasonSwap('summer')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all"
                    title="Поставить летний комплект"
                  >
                    ☀️ Лето
                  </button>
                  <button
                    onClick={() => handleSeasonSwap('winter')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 transition-all"
                    title="Поставить зимний комплект"
                  >
                    ❄️ Зима
                  </button>
                </div>
              )}
            </div>

            {activeTyre && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-dark-750 font-mono">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Накат:{' '}
                  <strong className="text-brand-600 dark:text-brand-400">
                    {Math.round(activeTyre.current_km).toLocaleString('ru-RU')} км
                  </strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Остаток:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {activeTyre.tread_depth_mm} мм
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Widget 2: Active Insurances */}
          <div className="bg-slate-50 dark:bg-dark-900/90 border border-slate-200 dark:border-dark-750 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    Страховые полисы ({activeInsurances.length})
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeInsurances.length > 0 ? (
                      activeInsurances.map((d) => d.title).join(' • ')
                    ) : (
                      <span className="text-slate-400 italic">Нет активных полисов</span>
                    )}
                  </div>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={() => onOpenDocModal()}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-dark-800 hover:bg-brand-500 hover:text-white text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-dark-700 transition-all flex-shrink-0"
                >
                  + Полис
                </button>
              )}
            </div>

            {activeInsurances.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs pt-1.5 border-t border-slate-200 dark:border-dark-750">
                {activeInsurances.map((ins) => (
                  <span key={ins.id} className="text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[200px]">
                    <strong>{ins.title}:</strong> до {ins.expiration_date ? new Date(ins.expiration_date).toLocaleDateString('ru-RU') : '—'}{' '}
                    {ins.days_until_expiration !== null && ins.days_until_expiration !== undefined && (
                      <span className="text-emerald-500 font-semibold font-mono">
                        ({ins.days_until_expiration} дн.)
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Compact Segmented Tabs (Fits on 1 line on desktop, clean 4x2 on mobile) */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 p-1 bg-slate-200/70 dark:bg-dark-800 border border-slate-200 dark:border-dark-750 rounded-2xl">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-750/50'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[9px] px-1 py-0.1 rounded-full font-mono font-extrabold ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-300 dark:bg-dark-700 text-slate-700 dark:text-slate-300'
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                История записей ({displayedServiceRecords.length})
              </span>
              {isOwner && (
                <button
                  onClick={() => onOpenServiceModal(activeTab as any)}
                  className="flex items-center space-x-1.5 text-xs font-bold text-brand-500 hover:text-brand-600 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить запись</span>
                </button>
              )}
            </div>

            {displayedServiceRecords.length === 0 ? (
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 sm:p-10 text-center space-y-3">
                <Wrench className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">Записей пока нет</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Зафиксируйте выполненные работы, замену расходников или ремонт с ценами и запчастями.
                </p>
                {isOwner && (
                  <button
                    onClick={() => onOpenServiceModal(activeTab as any)}
                    className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить запись</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedServiceRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 hover:border-slate-300 dark:hover:border-dark-700 rounded-2xl p-4 sm:p-5 shadow-sm transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 flex items-center justify-center text-brand-500 font-bold text-sm flex-shrink-0 mt-0.5 sm:mt-0">
                          {rec.to_tag ? (
                            <span className="font-mono text-xs font-extrabold">{rec.to_tag}</span>
                          ) : (
                            <Wrench className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{rec.title}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            <span>📅 {new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                            <span>🛣️ {Math.round(rec.odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}</span>
                            {rec.engine_hours && (
                              <span>⏱️ {rec.engine_hours} м/ч</span>
                            )}
                            {rec.store && (
                              <span className="font-sans font-medium text-slate-600 dark:text-slate-400">🏢 {rec.store}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-dark-750">
                        <div className="text-left sm:text-right">
                          <div className="text-base font-extrabold text-brand-600 dark:text-brand-400 font-mono">
                            {rec.total_cost.toLocaleString('ru-RU')} {vehicle.currency}
                          </div>
                          {(rec.cost_parts > 0 || rec.cost_labor > 0) && (
                            <div className="text-[10px] text-slate-400">
                              {rec.cost_parts > 0 && `Детали: ${rec.cost_parts} `}
                              {rec.cost_labor > 0 && `Работа: ${rec.cost_labor}`}
                            </div>
                          )}
                        </div>

                        {isOwner && (
                          <div className="flex items-center space-x-1 pl-2 border-l border-slate-200 dark:border-dark-750">
                            <button
                              onClick={() => onOpenServiceModal(rec.record_type, rec)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(rec.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {(rec.description || rec.notes) && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-dark-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-dark-750/60 space-y-1">
                        {rec.description && <p>{rec.description}</p>}
                        {rec.notes && <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">📝 {rec.notes}</p>}
                      </div>
                    )}

                    {rec.items && rec.items.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-dark-750/70">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Позиции и артикулы ({rec.items.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rec.items.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-slate-50 dark:bg-dark-900 p-2 rounded-lg border border-slate-200 dark:border-dark-750 text-slate-700 dark:text-slate-300"
                            >
                              <div className="truncate mr-2">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-medium text-slate-900 dark:text-white">{it.name}</span>
                                  {it.brand && (
                                    <span className="text-[10px] text-brand-500 font-semibold">
                                      ({it.brand})
                                    </span>
                                  )}
                                  {it.url && (
                                    <a
                                      href={it.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-slate-400 hover:text-brand-500"
                                    >
                                      <ExternalLink className="w-3 h-3 inline" />
                                    </a>
                                  )}
                                </div>
                                {it.part_number && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">
                                    Арт: <strong>{it.part_number}</strong>
                                    {it.store && ` • ${it.store}`}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0 font-mono text-right pl-2">
                                <span className="text-slate-900 dark:text-slate-200 whitespace-nowrap text-[11px] font-bold">
                                  {Math.round(it.total_price || 0).toLocaleString('ru-RU')} {vehicle.currency}
                                </span>
                                {it.quantity > 1 && it.unit_price > 0 && (
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {it.quantity} {it.unit || 'шт'} × {Math.round(it.unit_price).toLocaleString('ru-RU')}
                                  </span>
                                )}
                              </div>
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

        {/* Reminders / Planner Tab */}
        {activeTab === 'reminders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                План регламентов ТО и износа ({reminders.length})
              </span>
              {isOwner && (
                <button
                  onClick={() => onOpenReminderModal()}
                  className="flex items-center space-x-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Новый регламент</span>
                </button>
              )}
            </div>

            {reminders.length === 0 ? (
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 sm:p-10 text-center space-y-3">
                <CalendarClock className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">Регламенты не настроены</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Добавьте регламент замены масла, фильтров, свечей или колодок, и система заранее предупредит о необходимости ТО.
                </p>
                {isOwner && (
                  <button
                    onClick={() => onOpenReminderModal()}
                    className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Создать регламент</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {reminders.map((rem) => {
                  const isOverdue = rem.status === 'overdue';
                  const isDueSoon = rem.status === 'due_soon';

                  return (
                    <div
                      key={rem.id}
                      className={`bg-white dark:bg-dark-850 border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 transition-all ${
                        isOverdue
                          ? 'border-rose-500/50 shadow-rose-500/5'
                          : isDueSoon
                          ? 'border-amber-500/50'
                          : 'border-slate-200 dark:border-dark-750'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{rem.title}</h4>
                            {isOverdue && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                Просрочено
                              </span>
                            )}
                            {isDueSoon && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                Скоро ТО
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Интервал:{' '}
                            {rem.interval_distance ? `${rem.interval_distance.toLocaleString('ru-RU')} ${vehicle.distance_unit}` : ''}
                            {rem.interval_distance && rem.interval_hours ? ' / ' : ''}
                            {rem.interval_hours ? `${rem.interval_hours} м/ч` : ''}
                            {(rem.interval_distance || rem.interval_hours) && rem.interval_months ? ' / ' : ''}
                            {rem.interval_months ? `${rem.interval_months} мес.` : ''}
                          </div>

                          {(rem.brand || rem.article || rem.spec) && (
                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                              {rem.brand && <span>{rem.brand} </span>}
                              {rem.article && <span className="text-slate-400">[арт: {rem.article}]</span>}
                            </div>
                          )}
                        </div>

                        {isOwner && (
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <button
                              onClick={() => onOpenReminderModal(rem)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteReminder(rem.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            Осталось:{' '}
                            {rem.remaining_distance !== null && rem.remaining_distance !== undefined && (
                              <span
                                className={`font-mono font-bold ${
                                  rem.remaining_distance <= 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {Math.round(rem.remaining_distance).toLocaleString('ru-RU')} {vehicle.distance_unit}
                              </span>
                            )}
                            {rem.remaining_distance !== null && rem.remaining_hours !== null && ' / '}
                            {rem.remaining_hours !== null && rem.remaining_hours !== undefined && (
                              <span
                                className={`font-mono font-bold ${
                                  rem.remaining_hours <= 0 ? 'text-rose-500' : 'text-cyan-600 dark:text-cyan-400'
                                }`}
                              >
                                {Math.round(rem.remaining_hours)} м/ч
                              </span>
                            )}
                            {rem.remaining_days !== null && rem.remaining_days !== undefined && !rem.remaining_hours && (
                              <span
                                className={`font-bold ${
                                  rem.remaining_days <= 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {rem.remaining_days} дн.
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                            {rem.progress_percentage}%
                          </span>
                        </div>
                        <ProgressBar percentage={rem.progress_percentage} status={rem.status} />
                      </div>

                      {/* Last done baseline and Mark Done button */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-dark-750/70 text-xs">
                        <div className="text-[11px] text-slate-500 truncate mr-2">
                          Было: {Math.round(rem.last_service_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                          {rem.last_service_hours ? ` (${rem.last_service_hours} м/ч)` : ''}
                        </div>

                        {isOwner && (
                          <button
                            onClick={() => handleMarkReminderDone(rem.id)}
                            className="flex items-center space-x-1 bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-dark-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-dark-700 transition-all flex-shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Выполнено</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tyres & Wheels Tab */}
        {activeTab === 'tyres' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Комплекты шин и дисков ({tyres.length})
              </span>
              {isOwner && (
                <button
                  onClick={() => onOpenTyreModal()}
                  className="flex items-center space-x-1.5 text-xs font-bold text-brand-500 hover:text-brand-600 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить комплект</span>
                </button>
              )}
            </div>

            {/* Quick Season Swap Banner */}
            {isOwner && (
              <div className="bg-white dark:bg-dark-850 border border-blue-500/30 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Сезонная переобувка в 1 клик:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <button
                    onClick={() => handleSeasonSwap('summer')}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-sm transition"
                  >
                    <span>☀️ Летний комплект</span>
                  </button>
                  <button
                    onClick={() => handleSeasonSwap('winter')}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-sm transition"
                  >
                    <span>❄️ Зимний комплект</span>
                  </button>
                </div>
              </div>
            )}

            {tyres.length === 0 ? (
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 sm:p-10 text-center space-y-3">
                <Disc className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">Комплекты шин не добавлены</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Ведите учет летнего и зимнего комплектов резины, глубины остатка протектора в мм и пробега.
                </p>
                {isOwner && (
                  <button
                    onClick={() => onOpenTyreModal()}
                    className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить комплект</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {tyres.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-white dark:bg-dark-850 border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 transition-all ${
                      t.is_active ? 'border-brand-500/60 bg-brand-500/5 dark:bg-dark-850/90' : 'border-slate-200 dark:border-dark-750'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              t.season === 'summer'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                            }`}
                          >
                            {t.season === 'summer' ? '☀️ Летние' : '❄️ Зимние'}
                          </span>
                          {t.is_active && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              На авто
                            </span>
                          )}
                        </div>
                        {t.brand_model && (
                          <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-1 truncate">
                            {t.brand_model} {t.size && <span className="font-mono text-slate-400">({t.size})</span>}
                          </div>
                        )}
                      </div>

                      {isOwner && (
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => onOpenTyreModal(t)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTyre(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Пробег
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {Math.round(t.current_km).toLocaleString('ru-RU')} км
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Протектор
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {t.tread_depth_mm} мм
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-dark-750/70 text-xs">
                      <div className="text-slate-500 dark:text-slate-400 truncate mr-2">
                        {t.storage_location && <span>📍 {t.storage_location}</span>}
                        {t.total_price > 0 && (
                          <span className="block font-mono text-brand-600 dark:text-brand-400 font-bold text-[11px]">
                            {t.total_price.toLocaleString('ru-RU')} {vehicle.currency}
                          </span>
                        )}
                      </div>

                      {!t.is_active ? (
                        isOwner ? (
                          <button
                            onClick={() => handleActivateTyre(t.id)}
                            className="flex items-center space-x-1 bg-slate-100 dark:bg-dark-800 hover:bg-brand-500 hover:text-white text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-dark-700 transition-all flex-shrink-0"
                          >
                            <Disc className="w-3.5 h-3.5" />
                            <span>На авто</span>
                          </button>
                        ) : null
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1 flex-shrink-0">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Активен
                        </span>
                      )}
                    </div>
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Журнал заправок ({fuelLogs.length})
              </span>
              {isOwner && (
                <button
                  onClick={() => onOpenFuelModal()}
                  className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить заправку</span>
                </button>
              )}
            </div>

            {fuelLogs.length === 0 ? (
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 sm:p-10 text-center space-y-3">
                <Fuel className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">Нет записей о заправках</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Вносите данные о заправках полного бака для точного расчета расхода топлива и стоимости 1 км.
                </p>
                {isOwner && (
                  <button
                    onClick={() => onOpenFuelModal()}
                    className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить заправку</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {fuelLogs.length === 1 && !fuelLogs[0].consumption && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start space-x-2.5">
                    <Fuel className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Первая заправка зафиксирована как точка отсчета!</div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        Расход рассчитывается между заправками методом «от полного до полного». При добавлении <strong>следующей заправки</strong> система автоматически рассчитает точный средний расход (л/100 км) и построит график динамики расхода!
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs min-w-[620px]">
                    <thead className="bg-slate-100 dark:bg-dark-900 border-b border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Дата</th>
                        <th className="p-3">Пробег</th>
                        <th className="p-3">Объем</th>
                        <th className="p-3">Цена/л</th>
                        <th className="p-3">Расход</th>
                        <th className="p-3">Сумма</th>
                        <th className="p-3">АЗС / Топливо</th>
                        {isOwner && <th className="p-3 text-right">Действия</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-dark-750 text-slate-700 dark:text-slate-300">
                      {fuelLogs.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/60 transition-colors">
                          <td className="p-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                            {new Date(f.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="p-3 font-mono whitespace-nowrap">
                            {Math.round(f.odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                          </td>
                          <td className="p-3 font-mono whitespace-nowrap">
                            {f.fuel_amount} {vehicle.fuel_unit}
                          </td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {f.unit_price} {vehicle.currency}
                          </td>
                          <td className="p-3 font-mono font-bold whitespace-nowrap">
                            {f.consumption ? (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {f.consumption} л/100км
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-extrabold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                            {f.total_cost.toLocaleString('ru-RU')} {vehicle.currency}
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                            {f.gas_station || f.fuel_grade ? (
                              <span>
                                {f.gas_station} {f.fuel_grade && `(${f.fuel_grade})`}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          {isOwner && (
                            <td className="p-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => onOpenFuelModal(f)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white mr-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFuel(f.id)}
                                className="p-1 text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Analytics Tab (All Costs Breakdown & History) */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  ТО и Ремонты
                </span>
                <div className="text-base sm:text-lg font-extrabold text-brand-600 dark:text-brand-400 mt-1 font-mono">
                  {(analytics.total_service_spend + analytics.total_repair_spend).toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Топливо
                </span>
                <div className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {analytics.total_fuel_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Тюнинг & Допы
                </span>
                <div className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {analytics.total_upgrade_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Шины и Колеса
                </span>
                <div className="text-base sm:text-lg font-extrabold text-cyan-600 dark:text-cyan-400 mt-1 font-mono">
                  {analytics.total_tyre_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Страховки
                </span>
                <div className="text-base sm:text-lg font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                  {analytics.total_document_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency}</span>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Структура всех расходов</h4>
                {analytics.categories.length > 0 ? (
                  <div className="h-60 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="amount"
                          nameKey="category"
                        >
                          {analytics.categories.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                    Недостаточно данных для графика
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Расходы по месяцам</h4>
                {analytics.monthly_costs.length > 0 ? (
                  <div className="h-60 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.monthly_costs}>
                        <XAxis dataKey="month" stroke="#718096" fontSize={10} />
                        <YAxis stroke="#718096" fontSize={10} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend />
                        <Bar dataKey="service_cost" name="ТО" stackId="a" fill="#0284c7" />
                        <Bar dataKey="repair_cost" name="Ремонт" stackId="a" fill="#e11d48" />
                        <Bar dataKey="upgrade_cost" name="Тюнинг" stackId="a" fill="#059669" />
                        <Bar dataKey="fuel_cost" name="Топливо" stackId="a" fill="#d97706" />
                        <Bar dataKey="tyre_cost" name="Шины" stackId="a" fill="#0891b2" />
                        <Bar dataKey="document_cost" name="Страховки" stackId="a" fill="#7c3aed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                    Недостаточно данных для графика
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Documents & Insurance Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Документы, страховки и сроки ({documents.length})
              </span>
              {isOwner && (
                <button
                  onClick={() => onOpenDocModal()}
                  className="flex items-center space-x-1.5 text-xs font-bold text-brand-500 hover:text-brand-600 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить документ</span>
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-8 sm:p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">Документы не добавлены</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Сохраняйте полисы ОСАГО/КАСКО, диагностические карты техосмотра и важные заметки с напоминанием о сроках окончания.
                </p>
                {isOwner && (
                  <button
                    onClick={() => onOpenDocModal()}
                    className="inline-flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить документ</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`bg-white dark:bg-dark-850 border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 ${
                      doc.is_expired
                        ? 'border-rose-500/50'
                        : doc.days_until_expiration && doc.days_until_expiration <= 30
                        ? 'border-amber-500/50'
                        : 'border-slate-200 dark:border-dark-750'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{doc.title}</h4>
                          {doc.company && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-dark-800 text-brand-600 dark:text-brand-400 border border-slate-200 dark:border-brand-500/20">
                              {doc.company}
                            </span>
                          )}
                        </div>
                        {doc.document_number && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                            № {doc.document_number}
                          </span>
                        )}
                      </div>

                      {isOwner && (
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => onOpenDocModal(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {doc.expiration_date && (
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Действует до: {new Date(doc.expiration_date).toLocaleDateString('ru-RU')}
                        </span>
                        {doc.is_expired ? (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            Истёк!
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              doc.days_until_expiration && doc.days_until_expiration <= 30
                                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            }`}
                          >
                            Осталось {doc.days_until_expiration} дн.
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-dark-750/60">
                      {doc.price > 0 && (
                        <span className="font-mono text-brand-600 dark:text-brand-400 font-bold">
                          {doc.price.toLocaleString('ru-RU')} {vehicle.currency}
                        </span>
                      )}
                      {doc.notes && (
                        <span className="text-slate-500 dark:text-slate-400 italic text-[11px] truncate max-w-[180px]">
                          {doc.notes}
                        </span>
                      )}
                    </div>
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
