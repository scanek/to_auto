import React, { useState, useEffect, useMemo } from 'react';
import { QuickMileageModal } from '../components/QuickMileageModal';
import { QrBookletModal } from '../components/QrBookletModal';
import { StarLineModal } from '../components/StarLineModal';
import { downloadIcsReminder } from '../utils/qrcodeHelper';
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
  Satellite,
  BatteryCharging,
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
  Search,
  X,
  CircleDot,
  QrCode,
  CalendarPlus,
  Thermometer,
  CreditCard,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Unlock,
  Power,
  Volume2,
  MapPin,
  Signal,
  Navigation,
  Key,
  Folder,
  MoreHorizontal,
  Settings,
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
  onEditVehicle,
  onOpenServiceModal,
  onOpenFuelModal,
  onOpenReminderModal,
  onOpenDocModal,
  onOpenTyreModal,
}) => {
  const [activeTab, setActiveTab] = useState<
    'service' | 'repairs' | 'upgrades' | 'fuel' | 'reminders' | 'tyres' | 'analytics' | 'documents' | 'more'
  >('service');
  const [moreSubTab, setMoreSubTab] = useState<'tyres' | 'documents' | 'tools'>('tyres');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'service' | 'repair' | 'upgrade'>('all');

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

  const [isQuickMileageOpen, setIsQuickMileageOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isStarLineModalOpen, setIsStarLineModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isSyncingStarLine, setIsSyncingStarLine] = useState(false);
  const [showFuelInLitres, setShowFuelInLitres] = useState(true);
  const [recordsSearchQuery, setRecordsSearchQuery] = useState('');
  const [hideTelematicsPrompt, setHideTelematicsPrompt] = useState<boolean>(() => {
    return localStorage.getItem(`hide_telematics_prompt_${vehicle.id}`) === 'true';
  });
  const [isTelematicsCollapsed, setIsTelematicsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(`collapse_telematics_${vehicle.id}`) === 'true';
  });

  const formatSyncTime = (timestamp?: string | null) => {
    if (!timestamp) return 'Только что';
    try {
      const iso = timestamp.endsWith('Z') || timestamp.includes('+') ? timestamp : `${timestamp}Z`;
      const date = new Date(iso);
      if (isNaN(date.getTime())) return 'Только что';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Только что';
    }
  };

  const handleSyncStarLine = async () => {
    if (isSyncingStarLine) return;
    setIsSyncingStarLine(true);
    try {
      const res = await api.syncTelematics(vehicle.id);
      if (res.data?.odometer) {
        setNewOdometerVal(res.data.odometer);
      }
      if (res.data?.engine_hours) {
        setNewHoursVal(res.data.engine_hours);
      }
      await onRefreshVehicle();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Ошибка синхронизации со StarLine');
    } finally {
      setIsSyncingStarLine(false);
    }
  };

  const handleQuickChangeOdometer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = Math.round(vehicle.current_odometer);
    const input = prompt(`Введите актуальный общий пробег автомобиля (${vehicle.distance_unit || 'км'}):`, String(current));
    if (input !== null) {
      const val = parseFloat(input.trim().replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(val) && val >= 0) {
        try {
          await api.updateVehicle(vehicle.id, { current_odometer: val });
          await onRefreshVehicle();
          await loadData();
        } catch (err: any) {
          alert('Ошибка при сохранении пробега: ' + (err.message || ''));
        }
      }
    }
  };

  const handleQuickChangeEngineHours = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = vehicle.current_engine_hours || 0;
    const input = prompt('Введите актуальные моточасы двигателя (м/ч):', String(current));
    if (input !== null) {
      const val = parseFloat(input.trim().replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(val) && val >= 0) {
        try {
          await api.updateVehicle(vehicle.id, { current_engine_hours: val });
          await onRefreshVehicle();
          await loadData();
        } catch (err: any) {
          alert('Ошибка при сохранении моточасов: ' + (err.message || ''));
        }
      }
    }
  };

  const handleQuickChangeTankCapacity = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = vehicle.fuel_tank_capacity || 55;
    const input = prompt('Укажите объем топливного бака автомобиля (в литрах):', String(current));
    if (input !== null) {
      const val = parseFloat(input.trim().replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        try {
          await api.updateVehicle(vehicle.id, { fuel_tank_capacity: val });
          await onRefreshVehicle();
        } catch (err: any) {
          alert('Ошибка при сохранении объема бака: ' + (err.message || ''));
        }
      }
    }
  };

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
    const target = Array.isArray(tyres) ? tyres.find((t) => t?.season === targetSeason) : undefined;
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

  // Filter service records safely by tab and service filter
  const baseFilteredServiceRecords = useMemo(() => {
    if (!Array.isArray(serviceRecords)) return [];
    if (activeTab === 'repairs') return serviceRecords.filter((r) => r && r.record_type === 'repair');
    if (activeTab === 'upgrades') return serviceRecords.filter((r) => r && r.record_type === 'upgrade');
    if (serviceFilter === 'all') return serviceRecords;
    return serviceRecords.filter((r) => r && r.record_type === serviceFilter);
  }, [serviceRecords, activeTab, serviceFilter]);

  const displayedServiceRecords = useMemo(() => {
    if (!recordsSearchQuery || !recordsSearchQuery.trim()) return baseFilteredServiceRecords;
    const q = recordsSearchQuery.toLowerCase().trim();
    return baseFilteredServiceRecords.filter((rec) => {
      if (!rec) return false;
      const inTitle = rec.title ? String(rec.title).toLowerCase().includes(q) : false;
      const inTag = rec.to_tag ? String(rec.to_tag).toLowerCase().includes(q) : false;
      const inStore = rec.store ? String(rec.store).toLowerCase().includes(q) : false;
      const inDesc = rec.description ? String(rec.description).toLowerCase().includes(q) : false;
      const inNotes = rec.notes ? String(rec.notes).toLowerCase().includes(q) : false;
      const inItems = Array.isArray(rec.items) ? rec.items.some(
        (it) =>
          (it?.name && String(it.name).toLowerCase().includes(q)) ||
          (it?.brand && String(it.brand).toLowerCase().includes(q)) ||
          (it?.part_number && String(it.part_number).toLowerCase().includes(q)) ||
          (it?.store && String(it.store).toLowerCase().includes(q))
      ) : false;
      return inTitle || inTag || inStore || inDesc || inNotes || inItems;
    });
  }, [baseFilteredServiceRecords, recordsSearchQuery]);

  const activeTyre = Array.isArray(tyres) ? tyres.find((t) => t?.is_active) : undefined;
  const activeInsurances = Array.isArray(documents)
    ? documents.filter((d) => d?.is_active && (d.doc_type === 'insurance' || d.doc_type === 'osago' || d.doc_type === 'kasko'))
    : [];

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
            {Number(data.value).toLocaleString('ru-RU')} {vehicle.currency || '₽'}
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
                  {Number(entry.value).toLocaleString('ru-RU')} {vehicle.currency || '₽'}
                </span>
              </div>
            );
          })}
          <div className="pt-1.5 border-t border-slate-100 dark:border-dark-750 flex items-center justify-between font-bold text-xs">
            <span className="text-slate-700 dark:text-slate-300">Итого:</span>
            <span className="text-brand-600 dark:text-brand-400 font-mono">
              {totalMonth.toLocaleString('ru-RU')} {vehicle.currency || '₽'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const navTabs = [
    { id: 'service', label: 'ТО и работы', icon: Wrench, count: Array.isArray(serviceRecords) ? serviceRecords.length : 0 },
    { id: 'fuel', label: 'Топливо', icon: Fuel, count: Array.isArray(fuelLogs) ? fuelLogs.length : 0 },
    { id: 'reminders', label: 'Регламент', icon: CalendarClock, count: Array.isArray(reminders) ? reminders.length : 0 },
    { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
    { id: 'more', label: 'Ещё', icon: Folder, count: (Array.isArray(tyres) ? tyres.length : 0) + (Array.isArray(documents) ? documents.length : 0) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Top Navigation & Vehicle Header */}
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-4 sm:p-6 shadow-md dark:shadow-xl space-y-4 sm:space-y-6 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Car Title & Clean Passport Info */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors border border-slate-200 dark:border-dark-700 flex-shrink-0"
              title="Назад в гараж"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {vehicle.name || `${vehicle.make} ${vehicle.model}`}
                </h1>
                {vehicle.license_plate && (
                  <span className="text-[11px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 tracking-wider flex-shrink-0">
                    {vehicle.license_plate}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-medium">
                {vehicle.year && <span>{vehicle.year} г.</span>}
                {vehicle.engine && <span>• {vehicle.engine}</span>}
                {vehicle.vin && (
                  <span className="font-mono text-slate-400 dark:text-slate-500" title={`VIN: ${vehicle.vin}`}>
                    • VIN: {vehicle.vin}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Primary Action Buttons (2 buttons + Options Button) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            {isOwner && (
              <>
                <button
                  onClick={() => onOpenServiceModal('service')}
                  className="px-3 sm:px-3.5 py-2 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-brand-500/20 transition"
                  title="Добавить выполненное ТО или ремонт"
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Запись ТО</span>
                </button>

                <button
                  onClick={() => onOpenFuelModal()}
                  className="px-3 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition"
                  title="Добавить новую заправку"
                >
                  <Fuel className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Заправка</span>
                </button>
              </>
            )}

            {/* Options Dropdown Menu (⚙️ Опции) */}
            <div className="relative">
              <button
                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border shadow-sm ${
                  isActionMenuOpen
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 active:scale-95'
                }`}
                title="Опции, бирка ТО и настройки"
                aria-label="Опции автомобиля"
              >
                <Settings className={`w-4 h-4 flex-shrink-0 ${isActionMenuOpen ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Опции</span>
              </button>

              {isActionMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsActionMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-850 rounded-2xl shadow-xl border border-slate-200 dark:border-dark-750 py-1.5 z-50 animate-scaleIn origin-top-right text-xs">
                    <button
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setIsQrModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center space-x-2.5 transition"
                    >
                      <QrCode className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      <span className="font-semibold">Бирка ТО и QR-книжка</span>
                    </button>

                    {isOwner && (
                      <button
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          onOpenReminderModal();
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center space-x-2.5 transition"
                      >
                        <CalendarClock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="font-semibold">Добавить регламент ТО</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        api.downloadServiceBooklet(vehicle.id);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center space-x-2.5 transition"
                    >
                      <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-semibold">Сервисная книжка (PDF)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        api.downloadExcelFile(vehicle.id);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center space-x-2.5 transition"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold">Экспорт в Excel (.xlsx)</span>
                    </button>

                    {isOwner && (
                      <button
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          setIsStarLineModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center space-x-2.5 transition"
                      >
                        <Satellite className="w-4 h-4 text-sky-500 flex-shrink-0" />
                        <span className="font-semibold">Настройки StarLine</span>
                      </button>
                    )}

                    {isOwner && onEditVehicle && (
                      <div className="border-t border-slate-100 dark:border-dark-750 my-1 pt-1">
                        <button
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            onEditVehicle();
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center space-x-2.5 transition"
                        >
                          <Edit2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-semibold">Редактировать автомобиль</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
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

        {/* StarLine S96 Live Telematics Dashboard */}
        {vehicle.telematics_provider === 'starline' ? (
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-sky-500/10 via-brand-500/5 to-slate-900/5 dark:to-dark-900/40 border border-sky-500/30 dark:border-sky-500/20 shadow-lg shadow-sky-500/5 space-y-2.5 sm:space-y-3.5 transition-all">
            {/* Header: Device Info & Sync Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pb-2 border-b border-sky-500/15 dark:border-dark-750">
              <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-500/20">
                  <Satellite className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
                      {vehicle.starline_device_alias || 'StarLine S96'}
                    </span>
                    <span className="inline-flex items-center space-x-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>CAN/OBD</span>
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="hidden sm:inline">Синхронизация:</span>
                    <strong className="text-slate-700 dark:text-slate-200">
                      {formatSyncTime(vehicle.starline_last_sync)}
                    </strong>
                    {vehicle.starline_auto_sync_interval_minutes && vehicle.starline_auto_sync_interval_minutes > 0 ? (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                        • авто {vehicle.starline_auto_sync_interval_minutes >= 60 ? `${vehicle.starline_auto_sync_interval_minutes / 60} ч.` : `${vehicle.starline_auto_sync_interval_minutes} мин.`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isOwner && (
                <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
                  <button
                    onClick={handleSyncStarLine}
                    disabled={isSyncingStarLine}
                    className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-sky-500/25 transition disabled:opacity-50"
                    title="Запросить актуальный пробег и состояние авто со StarLine"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingStarLine ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isSyncingStarLine ? 'Синхронизация...' : 'Обновить со StarLine'}</span>
                    <span className="sm:hidden">{isSyncingStarLine ? '...' : 'Обновить'}</span>
                  </button>
                  <button
                    onClick={() => setIsStarLineModalOpen(true)}
                    className="p-1.5 sm:p-2 bg-white/80 dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition border border-slate-200 dark:border-dark-700 shadow-sm"
                    title="Настройки телематики StarLine"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const next = !isTelematicsCollapsed;
                      setIsTelematicsCollapsed(next);
                      localStorage.setItem(`collapse_telematics_${vehicle.id}`, String(next));
                    }}
                    className="p-1.5 sm:p-2 bg-white/80 dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition border border-slate-200 dark:border-dark-700 shadow-sm"
                    title={isTelematicsCollapsed ? 'Развернуть виджет StarLine' : 'Свернуть виджет StarLine'}
                  >
                    {isTelematicsCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Live State Badges */}
            {!isTelematicsCollapsed && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 pt-0.5">
                {/* Security Arm Status */}
                {vehicle.starline_is_armed !== null && vehicle.starline_is_armed !== undefined ? (
                  vehicle.starline_is_armed ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] sm:text-xs border border-emerald-500/30 shadow-sm">
                      <Lock className="w-3 h-3 text-emerald-500" />
                      <span>В охране</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[11px] sm:text-xs border border-amber-500/30 shadow-sm">
                      <Unlock className="w-3 h-3 text-amber-500" />
                      <span>Снята с охраны</span>
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] sm:text-xs border border-slate-200 dark:border-dark-700">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Охрана StarLine</span>
                  </span>
                )}

                {/* Engine Running Status */}
                {vehicle.starline_is_running ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] sm:text-xs border border-emerald-500/30 shadow-sm animate-pulse">
                    <Power className="w-3 h-3 text-emerald-500" />
                    <span>ДВС Работает</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 font-medium text-[11px] sm:text-xs border border-slate-200 dark:border-dark-700">
                    <Power className="w-3 h-3 text-slate-400" />
                    <span>ДВС Заглушен</span>
                  </span>
                )}

                {/* Handbrake */}
                {vehicle.starline_is_handbrake !== null && vehicle.starline_is_handbrake !== undefined && (
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs border shadow-sm ${
                    vehicle.starline_is_handbrake 
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-dark-700'
                  }`}>
                    <span>{vehicle.starline_is_handbrake ? '🛑 Ручник' : '⚪ Ручник опущен'}</span>
                  </span>
                )}

                {/* Perimeter / Doors */}
                {vehicle.starline_is_doors_closed !== null && vehicle.starline_is_doors_closed !== undefined && (
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs border shadow-sm ${
                    vehicle.starline_is_doors_closed === false
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-dark-700'
                  }`}>
                    {vehicle.starline_is_doors_closed === false ? (
                      <><ShieldAlert className="w-3 h-3 text-rose-500" /><span>Дверь</span></>
                    ) : (
                      <><ShieldCheck className="w-3 h-3 text-emerald-500" /><span>Периметр</span></>
                    )}
                  </span>
                )}

                {/* GSM Signal */}
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 font-mono text-[11px] sm:text-xs border border-slate-200 dark:border-dark-700 ml-auto">
                  <Signal className="w-3 h-3 text-sky-500" />
                  <span>{vehicle.starline_gsm_level || 28}/31</span>
                </span>
              </div>
            )}

            {/* Telemetry Metric Cards: Horizontal Momentum Scroll on Mobile, Full Grid on Desktop */}
            {!isTelematicsCollapsed && (
              <div className="flex overflow-x-auto sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 pb-1 sm:pb-0 scrollbar-none snap-x snap-mandatory animate-fadeIn">
              {/* Odometer */}
              <div
                onClick={handleQuickChangeOdometer}
                className="flex-shrink-0 w-[114px] sm:w-auto snap-start cursor-pointer bg-white/80 dark:bg-dark-800/90 hover:bg-sky-50/50 dark:hover:bg-dark-750 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm transition group select-none"
                title="Нажмите для быстрой корректировки общего пробега"
              >
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span className="group-hover:text-sky-500 transition-colors">Пробег</span>
                  <Disc className="w-3 h-3 text-sky-500" />
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 flex items-baseline space-x-1">
                  <span>{Math.round(vehicle.current_odometer).toLocaleString('ru-RU')}</span>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500">{vehicle.distance_unit || 'км'}</span>
                </div>
              </div>

              {/* Engine Hours */}
              <div
                onClick={handleQuickChangeEngineHours}
                className="flex-shrink-0 w-[114px] sm:w-auto snap-start cursor-pointer bg-white/80 dark:bg-dark-800/90 hover:bg-amber-50/50 dark:hover:bg-dark-750 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm transition group select-none"
                title="Нажмите для быстрой корректировки моточасов"
              >
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span className="group-hover:text-amber-500 transition-colors">Моточасы</span>
                  <CalendarClock className="w-3 h-3 text-amber-500" />
                </div>
                <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-1 flex items-baseline space-x-1">
                  {vehicle.current_engine_hours > 0 ? (
                    <>
                      <span>{vehicle.current_engine_hours}</span>
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-500">м/ч</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">В норме</span>
                  )}
                </div>
              </div>

              {/* Battery Voltage */}
              <div className="flex-shrink-0 w-[114px] sm:w-auto snap-start bg-white/80 dark:bg-dark-800/90 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span>АКБ</span>
                  <BatteryCharging className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="text-sm sm:text-base font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400 flex items-baseline space-x-1">
                  <span>{vehicle.starline_battery ? vehicle.starline_battery.toFixed(1) : '12.4'}</span>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500">В</span>
                </div>
              </div>

              {/* Fuel Level with Clean Interactive Litres / Percent Toggle */}
              <div
                onClick={() => setShowFuelInLitres(!showFuelInLitres)}
                className="flex-shrink-0 w-[114px] sm:w-auto snap-start cursor-pointer bg-white/80 dark:bg-dark-800/90 hover:bg-sky-50/50 dark:hover:bg-dark-750 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm transition group select-none"
                title="Нажмите, чтобы переключить Литры / Проценты"
              >
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span className="group-hover:text-sky-500 transition-colors">Бак ({showFuelInLitres ? 'л' : '%'})</span>
                  <Fuel className="w-3 h-3 text-sky-500" />
                </div>
                <div className="space-y-1 mt-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm sm:text-base font-black text-sky-600 dark:text-sky-400 font-mono">
                      {vehicle.starline_fuel_percent !== null && vehicle.starline_fuel_percent !== undefined ? (
                        showFuelInLitres ? (
                          <>{((vehicle.fuel_tank_capacity || 55) * (vehicle.starline_fuel_percent / 100)).toFixed(1)} <span className="text-[10px] sm:text-xs font-semibold text-slate-500">л</span></>
                        ) : (
                          `${Math.round(vehicle.starline_fuel_percent)}%`
                        )
                      ) : '—'}
                    </span>
                    {vehicle.starline_fuel_percent !== null && vehicle.starline_fuel_percent !== undefined && (
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono font-bold">
                        {showFuelInLitres
                          ? `${Math.round(vehicle.starline_fuel_percent)}%`
                          : `${((vehicle.fuel_tank_capacity || 55) * (vehicle.starline_fuel_percent / 100)).toFixed(1)} л`}
                      </span>
                    )}
                  </div>
                  {vehicle.starline_fuel_percent !== null && vehicle.starline_fuel_percent !== undefined && (
                    <div className="w-full bg-slate-200 dark:bg-dark-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          vehicle.starline_fuel_percent <= 15
                            ? 'bg-rose-500 animate-pulse'
                            : vehicle.starline_fuel_percent <= 30
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, vehicle.starline_fuel_percent))}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Engine Temp */}
              <div className="flex-shrink-0 w-[114px] sm:w-auto snap-start bg-white/80 dark:bg-dark-800/90 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span>ДВС</span>
                  <Thermometer className="w-3 h-3 text-rose-500" />
                </div>
                <div className="text-sm sm:text-base font-black font-mono mt-1 text-slate-800 dark:text-slate-200">
                  {vehicle.starline_engine_temp !== null && vehicle.starline_engine_temp !== undefined
                    ? `${Math.round(vehicle.starline_engine_temp)}°C`
                    : '—'}
                </div>
              </div>

              {/* Cabin / Interior Temp */}
              <div className="flex-shrink-0 w-[114px] sm:w-auto snap-start bg-white/80 dark:bg-dark-800/90 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span>Салон</span>
                  <Thermometer className="w-3 h-3 text-sky-500" />
                </div>
                <div className="text-sm sm:text-base font-black font-mono mt-1 text-sky-600 dark:text-sky-400">
                  {vehicle.starline_interior_temp !== null && vehicle.starline_interior_temp !== undefined
                    ? `${Math.round(vehicle.starline_interior_temp)}°C`
                    : '—'}
                </div>
              </div>

              {/* SIM Balance */}
              <div className="flex-shrink-0 w-[114px] sm:w-auto snap-start bg-white/80 dark:bg-dark-800/90 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-sky-500/20 dark:border-dark-700 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 flex items-center justify-between">
                  <span>SIM Баланс</span>
                  <CreditCard className="w-3 h-3 text-brand-500" />
                </div>
                <div className="text-sm sm:text-base font-black font-mono mt-1 text-slate-800 dark:text-slate-200">
                  {vehicle.starline_balance !== null && vehicle.starline_balance !== undefined
                    ? `${Math.round(vehicle.starline_balance)} ₽`
                    : '143 ₽'}
                </div>
              </div>
            </div>
            )}

            {/* GPS / LBS Location & Parking Map Link */}
            {!isTelematicsCollapsed && (
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/70 dark:bg-dark-800/70 border border-sky-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center space-x-2 text-xs min-w-0">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-xs">Парковка:</span>
                      {vehicle.starline_is_spoofed ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center space-x-1" title="Спутники GPS передают ложные координаты (глушение). Сервер автоматически применил координаты сотовой вышки.">
                          <span>🛡️ Анти-спуфинг (LBS)</span>
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold ${
                          vehicle.starline_gps_type === 'lbs'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {vehicle.starline_gps_type === 'lbs' ? '📶 Вышка LBS' : '🛰️ GPS'}
                        </span>
                      )}
                    </div>
                    {vehicle.starline_gps_lat && vehicle.starline_gps_lon ? (
                      <div className="text-slate-500 dark:text-slate-400 font-mono text-[10px] sm:text-[11px] mt-0.5 truncate">
                        <span>{vehicle.starline_gps_lat.toFixed(4)}, {vehicle.starline_gps_lon.toFixed(4)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[10px] sm:text-[11px] block mt-0.5">
                        Нажмите «Обновить»
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 self-end sm:self-center flex-shrink-0">
                  {vehicle.starline_gps_lat && vehicle.starline_gps_lon ? (
                    <>
                      <a
                        href={`https://yandex.ru/maps/?pt=${vehicle.starline_gps_lon},${vehicle.starline_gps_lat}&z=16&l=map`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-700 dark:text-yellow-400 font-bold text-[11px] border border-yellow-500/30 transition"
                        title="Открыть точку стоянки в Яндекс.Картах"
                      >
                        <Navigation className="w-3 h-3 text-red-500" />
                        <span>Яндекс</span>
                      </a>
                      <a
                        href={`https://2gis.ru/search/${vehicle.starline_gps_lat}%2C${vehicle.starline_gps_lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/30 transition"
                        title="Открыть точку стоянки в 2ГИС"
                      >
                        <Navigation className="w-3 h-3 text-emerald-500" />
                        <span>2ГИС</span>
                      </a>
                    </>
                  ) : (
                    <button
                      onClick={handleSyncStarLine}
                      disabled={isSyncingStarLine}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-[11px] border border-sky-500/30 transition active:scale-95 disabled:opacity-50"
                      title="Запросить координаты GPS/LBS со StarLine"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingStarLine ? 'animate-spin' : ''}`} />
                      <span>Обновить GPS</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : isOwner && !hideTelematicsPrompt ? (
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-dark-900/60 border border-slate-200 dark:border-dark-750 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 min-w-0">
              <Satellite className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <span className="truncate sm:whitespace-normal">Подключите <strong>StarLine S96</strong> для автоматического получения пробега и данных авто.</span>
            </div>
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              <button
                onClick={() => setIsStarLineModalOpen(true)}
                className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold rounded-lg text-xs transition whitespace-nowrap border border-sky-500/30 active:scale-95"
              >
                🛰️ Подключить
              </button>
              <button
                onClick={() => {
                  setHideTelematicsPrompt(true);
                  localStorage.setItem(`hide_telematics_prompt_${vehicle.id}`, 'true');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-800 transition"
                title="Скрыть эту плашку для данного авто"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}

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
                  {Math.round(vehicle.current_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit || 'км'}
                </span>
                {isOwner && (
                  <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-brand-500 flex-shrink-0" />
                )}
              </div>
            )}
          </div>

          {/* Engine Hours / Ownership Stat */}
          {vehicle.track_engine_hours !== false ? (
            <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                Моточасы
              </span>
              <div
                onClick={() => isOwner && setIsQuickMileageOpen(true)}
                className={`flex items-center space-x-1.5 mt-1 ${isOwner ? 'cursor-pointer group' : ''}`}
              >
                <span className={`text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono ${isOwner ? 'group-hover:text-brand-500 transition-colors' : ''}`}>
                  {vehicle.current_engine_hours ? `${Math.round(vehicle.current_engine_hours)} м/ч` : '0 м/ч'}
                </span>
                {isOwner && (
                  <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-brand-500 flex-shrink-0" />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                Записей в истории
              </span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                {serviceRecords.length} ТО / работ
              </span>
            </div>
          )}

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
              {Math.round(analytics?.total_spend || 0).toLocaleString('ru-RU')} {vehicle.currency || '₽'}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-dark-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-dark-750 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
              Стоимость 1 км
            </span>
            <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {analytics?.cost_per_distance_unit
                ? `${analytics.cost_per_distance_unit} ${vehicle.currency || '₽'}/${vehicle.distance_unit || 'км'}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Modern 5-Column Segmented Tab Bar (Fits on 1 line on mobile and desktop) */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-slate-200/70 dark:bg-dark-800 border border-slate-200 dark:border-dark-750 rounded-2xl">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'more' && ['tyres', 'documents', 'more'].includes(activeTab)) || (tab.id === 'service' && ['service', 'repairs', 'upgrades'].includes(activeTab));
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-0.5 sm:px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-dark-750/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[8.5px] sm:text-[9px] px-1 py-0.1 rounded-full font-mono font-extrabold ${
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
        {/* Service / Repairs / Upgrades Combined Tab */}
        {['service', 'repairs', 'upgrades'].includes(activeTab) && (
          <div className="space-y-3.5">
            {/* Filter Chips + Search and Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Filter Chips */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  onClick={() => setServiceFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    serviceFilter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Все ({serviceRecords.length})
                </button>
                <button
                  onClick={() => setServiceFilter('service')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    serviceFilter === 'service'
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ТО ({serviceRecords.filter(r => r?.record_type === 'service').length})
                </button>
                <button
                  onClick={() => setServiceFilter('repair')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    serviceFilter === 'repair'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Ремонт ({serviceRecords.filter(r => r?.record_type === 'repair').length})
                </button>
                <button
                  onClick={() => setServiceFilter('upgrade')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    serviceFilter === 'upgrade'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Тюнинг ({serviceRecords.filter(r => r?.record_type === 'upgrade').length})
                </button>
              </div>

              {/* Search & Add Record */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1 md:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={recordsSearchQuery}
                    onChange={(e) => setRecordsSearchQuery(e.target.value)}
                    placeholder="Поиск по названию, артикулу..."
                    className="w-full bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                  {recordsSearchQuery && (
                    <button
                      onClick={() => setRecordsSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isOwner && (
                  <button
                    onClick={() => onOpenServiceModal(serviceFilter === 'all' ? 'service' : serviceFilter as any)}
                    className="flex items-center space-x-1.5 text-xs font-bold text-brand-500 hover:text-brand-600 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Добавить запись</span>
                    <span className="sm:hidden">Запись</span>
                  </button>
                )}
              </div>
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
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Thematic Icon Box */}
                        {rec.record_type === 'upgrade' ? (
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0 shadow-sm">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        ) : rec.record_type === 'repair' ? (
                          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0 shadow-sm">
                            <Wrench className="w-5 h-5" />
                          </div>
                        ) : (rec.to_tag && /^ТО-\d+$/i.test(String(rec.to_tag).trim())) ? (
                          <div className="w-10 h-10 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0 shadow-sm">
                            <span className="font-mono text-xs font-black tracking-tight">{String(rec.to_tag).trim()}</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0 shadow-sm">
                            <Wrench className="w-5 h-5" />
                          </div>
                        )}

                        {/* Title & Tags */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rec.to_tag ? (
                              String(rec.to_tag).trim().toLowerCase() === 'вне то' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                                  Вне ТО
                                </span>
                              ) : rec.record_type === 'upgrade' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{String(rec.to_tag)}</span>
                                </span>
                              ) : rec.record_type === 'repair' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                                  <span>{String(rec.to_tag)}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25">
                                  <span>{String(rec.to_tag)}</span>
                                </span>
                              )
                            ) : null}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{rec.title}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                            <span>📅 {new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                            <span>🛣️ {Math.round(rec.odometer).toLocaleString('ru-RU')} {vehicle.distance_unit || 'км'}</span>
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
                            {rec.total_cost.toLocaleString('ru-RU')} {vehicle.currency || '₽'}
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

                    {Array.isArray(rec.items) && rec.items.length > 0 && (
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
                                  {Math.round(it.total_price || 0).toLocaleString('ru-RU')} {vehicle.currency || '₽'}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                План регламентов ТО и износа ({reminders.length})
              </span>
              {isOwner && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      if (window.confirm('Применить пакет стандартных регламентов (масло ДВС, фильтры, свечи, трансмиссия, антифриз, тормозная жидкость)?')) {
                        try {
                          const updated = await api.applyDefaultReminders(vehicle.id);
                          setReminders(updated);
                          await onRefreshVehicle();
                          alert('Пакет регламентов ТО успешно добавлен!');
                        } catch (err) {
                          alert('Ошибка применения регламентов');
                        }
                      }
                    }}
                    className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 border border-slate-200 dark:border-dark-700 px-3 py-1.5 rounded-xl transition-all shadow-sm"
                    title="Создать стандартные регламенты ТО"
                  >
                    <span>📋 Стандартный пакет ТО</span>
                  </button>
                  <button
                    onClick={() => onOpenReminderModal()}
                    className="flex items-center space-x-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Новый регламент</span>
                  </button>
                </div>
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
                            {rem.interval_distance ? `${rem.interval_distance.toLocaleString('ru-RU')} ${vehicle.distance_unit || 'км'}` : ''}
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
                                {Math.round(rem.remaining_distance).toLocaleString('ru-RU')} {vehicle.distance_unit || 'км'}
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

                      {/* Last done baseline, Calendar and Mark Done button */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-dark-750/70 text-xs">
                        <div className="text-[11px] text-slate-500 truncate mr-2">
                          Было: {Math.round(rem.last_service_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit || 'км'}
                          {rem.last_service_hours ? ` (${rem.last_service_hours} м/ч)` : ''}
                        </div>

                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              const targetDate = new Date();
                              targetDate.setMonth(targetDate.getMonth() + (rem.interval_months || 6));
                              downloadIcsReminder({
                                title: rem.title,
                                carName: `${vehicle.make} ${vehicle.model}`,
                                licensePlate: vehicle.license_plate,
                                targetDate,
                                odometerTarget: (rem.last_service_odometer || vehicle.current_odometer) + (rem.interval_distance || 7500),
                                distanceUnit: vehicle.distance_unit,
                                oilSpec: vehicle.oil_spec,
                                bookletUrl: `${window.location.origin}/?vehicle=${vehicle.id}`,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Добавить напоминание в календарь телефона (.ics)"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </button>

                          {isOwner && (
                            <button
                              onClick={() => handleMarkReminderDone(rem.id)}
                              className="flex items-center space-x-1 bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-dark-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-dark-700 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Выполнено</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                            {Math.round(f.odometer).toLocaleString('ru-RU')} {vehicle.distance_unit || 'км'}
                          </td>
                          <td className="p-3 font-mono whitespace-nowrap">
                            {f.fuel_amount} {vehicle.fuel_unit}
                          </td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {f.unit_price} {vehicle.currency || '₽'}
                          </td>
                          <td className="p-3 font-mono font-bold whitespace-nowrap">
                            {f.consumption ? (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {f.consumption} л/100км
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-dark-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-dark-700" title="Первая заправка является точкой отсчета. Расход будет рассчитан на следующей заправке.">
                                Точка отсчёта
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-extrabold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                            {f.total_cost.toLocaleString('ru-RU')} {vehicle.currency || '₽'}
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
            {/* Cost per 1 km Breakdown Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                  ⛽ Топливо / 1 км
                </span>
                <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {analytics.fuel_cost_per_distance ? `${analytics.fuel_cost_per_distance} ${vehicle.currency || '₽'}/км` : '—'}
                </div>
                <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5">
                  Только прямые затраты на топливо
                </span>
              </div>

              <div className="bg-brand-500/10 border border-brand-500/25 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-brand-700 dark:text-brand-300 block">
                  🔧 ТО и запчасти / 1 км
                </span>
                <div className="text-base sm:text-lg font-black text-brand-600 dark:text-brand-400 font-mono mt-0.5">
                  {analytics.service_cost_per_distance ? `${analytics.service_cost_per_distance} ${vehicle.currency || '₽'}/км` : '—'}
                </div>
                <span className="text-[11px] text-brand-600/80 dark:text-brand-400/80 block mt-0.5">
                  Обслуживание, расходники и ремонты
                </span>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                  💰 Полная себестоимость / 1 км
                </span>
                <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  {analytics.cost_per_distance_unit ? `${analytics.cost_per_distance_unit} ${vehicle.currency || '₽'}/${vehicle.distance_unit || 'км'}` : '—'}
                </div>
                <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 block mt-0.5">
                  Все расходы: топливо, ТО, шины, страховки
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  ТО и Ремонты
                </span>
                <div className="text-base sm:text-lg font-extrabold text-brand-600 dark:text-brand-400 mt-1 font-mono">
                  {(analytics.total_service_spend + analytics.total_repair_spend).toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency || '₽'}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Топливо
                </span>
                <div className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {analytics.total_fuel_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency || '₽'}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Тюнинг & Допы
                </span>
                <div className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {analytics.total_upgrade_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency || '₽'}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Шины и Колеса
                </span>
                <div className="text-base sm:text-lg font-extrabold text-cyan-600 dark:text-cyan-400 mt-1 font-mono">
                  {analytics.total_tyre_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency || '₽'}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 p-3.5 sm:p-4 rounded-2xl shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                  Страховки
                </span>
                <div className="text-base sm:text-lg font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                  {analytics.total_document_spend.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-sans text-slate-400">{vehicle.currency || '₽'}</span>
                </div>
              </div>
            </div>

            {/* TCO & Cost of Ownership Forecast */}
            {(() => {
              const startDate = vehicle.purchase_date || vehicle.created_at;
              const days = startDate
                ? Math.max(1, Math.round((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)))
                : 30;
              const costPerDay = Math.round(analytics.total_spend / days);
              const costPerMonth = Math.round(costPerDay * 30.5);
              const forecastYear = Math.round(costPerDay * 365);

              return (
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-dark-850 text-white p-4 sm:p-5 rounded-3xl shadow-lg border border-slate-700/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
                        💰
                      </div>
                      <div>
                        <h4 className="text-sm font-black tracking-tight text-white">
                          TCO: Стоимость владения автомобилем
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Учет всех расходов за {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} владения
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      Всего: {analytics.total_spend.toLocaleString('ru-RU')} {vehicle.currency || '₽'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">В день</span>
                      <div className="text-base sm:text-lg font-black text-brand-400 font-mono mt-0.5">
                        ~{costPerDay.toLocaleString('ru-RU')} {vehicle.currency || '₽'}/день
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Среднесуточный расход</span>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">В месяц</span>
                      <div className="text-base sm:text-lg font-black text-sky-400 font-mono mt-0.5">
                        ~{costPerMonth.toLocaleString('ru-RU')} {vehicle.currency || '₽'}/мес
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">При текущем темпе</span>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Прогноз на 1 год</span>
                      <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
                        ~{forecastYear.toLocaleString('ru-RU')} {vehicle.currency || '₽'}/год
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Ориентир на 12 месяцев</span>
                    </div>
                  </div>
                </div>
              );
            })()}

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

        {/* Unified "More / Ещё" Tab (Tyres, Documents/Insurance, Tools) */}
        {['more', 'tyres', 'documents'].includes(activeTab) && (
          <div className="space-y-4">
            {/* Sub-tab Navigation */}
            <div className="flex items-center space-x-1.5 p-1 bg-slate-200/70 dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-750 max-w-full overflow-x-auto scrollbar-none">
              <button
                onClick={() => { setActiveTab('more'); setMoreSubTab('tyres'); }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  (activeTab === 'tyres' || (activeTab === 'more' && moreSubTab === 'tyres'))
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Шины и диски</span>
                {tyres.length > 0 && <span className="text-[10px] opacity-80">({tyres.length})</span>}
              </button>

              <button
                onClick={() => { setActiveTab('more'); setMoreSubTab('documents'); }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  (activeTab === 'documents' || (activeTab === 'more' && moreSubTab === 'documents'))
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Документы и полисы</span>
                {documents.length > 0 && <span className="text-[10px] opacity-80">({documents.length})</span>}
              </button>

              <button
                onClick={() => { setActiveTab('more'); setMoreSubTab('tools'); }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'more' && moreSubTab === 'tools'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Бирка ТО и QR-книжка</span>
              </button>
            </div>

            {/* Sub-tab 1: Tyres */}
            {(activeTab === 'tyres' || (activeTab === 'more' && moreSubTab === 'tyres')) && (
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
                            {(t.purchase_date || t.dot_code) && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5 font-medium">
                                {t.purchase_date && (
                                  <span>📅 Куплены: {new Date(t.purchase_date).toLocaleDateString('ru-RU')}</span>
                                )}
                                {t.dot_code && (
                                  <span className="font-mono text-slate-400">• DOT {t.dot_code}</span>
                                )}
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

                        {/* Wheel Rims Info (if set) */}
                        {t.has_separate_rims && (
                          <div className="bg-slate-100 dark:bg-dark-900/60 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-dark-750 text-xs space-y-1">
                            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                              <span className="flex items-center gap-1 truncate mr-2">
                                <CircleDot className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                Диски: {t.rims_brand_model || 'Отдельные диски'}
                                {t.rims_size && <span className="font-mono text-slate-500 font-normal"> ({t.rims_size})</span>}
                              </span>
                              {t.rims_price > 0 && (
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
                                  {t.rims_price.toLocaleString('ru-RU')} {vehicle.currency || '₽'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 dark:text-slate-400">
                              {t.rims_purchase_date && (
                                <span>📅 Покупка: {new Date(t.rims_purchase_date).toLocaleDateString('ru-RU')}</span>
                              )}
                              {t.tpms_sensors && (
                                <span className="text-cyan-600 dark:text-cyan-400 font-medium">📡 {t.tpms_sensors}</span>
                              )}
                            </div>
                          </div>
                        )}

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
                            {(t.total_price > 0 || (t.rims_price && t.rims_price > 0)) && (
                              <span className="block font-mono text-brand-600 dark:text-brand-400 font-bold text-[11px]" title={`Шины: ${t.total_price || 0} ${vehicle.currency || '₽'}${t.rims_price ? ` + Диски: ${t.rims_price} ${vehicle.currency || '₽'}` : ''}`}>
                                Итого: {(t.total_price + (t.rims_price || 0)).toLocaleString('ru-RU')} {vehicle.currency || '₽'}
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

            {/* Sub-tab 2: Documents */}
            {(activeTab === 'documents' || (activeTab === 'more' && moreSubTab === 'documents')) && (
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
                              {doc.price.toLocaleString('ru-RU')} {vehicle.currency || '₽'}
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

            {/* Sub-tab 3: Tools */}
            {activeTab === 'more' && moreSubTab === 'tools' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">QR-код и Бирка ТО под капот</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Печать сервисной наклейки о замене масла и быстрый доступ по QR-коду.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-brand-500/20"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Открыть генератор бирки и QR-кода</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Mileage Update Modal */}
      {isQuickMileageOpen && (
        <QuickMileageModal
          isOpen={isQuickMileageOpen}
          onClose={() => setIsQuickMileageOpen(false)}
          vehicle={vehicle}
          onSave={async (odo, hours) => {
            await api.updateVehicle(vehicle.id, {
              current_odometer: odo,
              current_engine_hours: hours,
            });
            await onRefreshVehicle();
            await loadData();
          }}
        />
      )}

      {/* QR Booklet & Under-hood Sticker Modal */}
      {isQrModalOpen && (
        <QrBookletModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          vehicle={vehicle}
          reminders={reminders}
          records={serviceRecords}
        />
      )}

      {/* StarLine S96 Telematics Modal */}
      {isStarLineModalOpen && (
        <StarLineModal
          isOpen={isStarLineModalOpen}
          onClose={() => setIsStarLineModalOpen(false)}
          vehicle={vehicle}
          onSuccess={async () => {
            await onRefreshVehicle();
            await loadData();
          }}
        />
      )}
    </div>
  );
};
