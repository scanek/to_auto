import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Car,
  Database,
  Download,
} from 'lucide-react';
import { Vehicle, User } from '../types';
import { api } from '../services/api';

interface ImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vehicleId: number) => void;
  vehicles?: Vehicle[];
  selectedVehicle?: Vehicle | null;
  initialTab?: 'import' | 'export';
  currentUser?: User | null;
}

export const ImportBackupModal: React.FC<ImportBackupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vehicles = [],
  selectedVehicle,
  initialTab = 'import',
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);
  const [jsonText, setJsonText] = useState('');
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || api.isStandalone();
  const exportableVehicles = isAdmin
    ? vehicles
    : vehicles.filter((v) => v.is_owner !== false);

  if (!isOpen) return null;

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    setError(null);
    if (!text.trim()) {
      setParsedData(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setParsedData(parsed);
    } catch {
      setError('Неверный формат JSON');
      setParsedData(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleJsonChange(content);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importBackup(parsedData);
      onSuccess(res.vehicle_id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка импорта бэкапа');
    } finally {
      setLoading(false);
    }
  };

  const handleExportFull = async () => {
    try {
      const blob = await api.exportFullServerBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = isAdmin
        ? `bortovoi_full_backup_${dateStr}.json`
        : `my_garage_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Ошибка экспорта бэкапа');
    }
  };

  const handleExportVehicle = async (v: Vehicle) => {
    try {
      const blob = await api.exportBackup(v.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanCar = `${v.make}_${v.model}`.replace(/\s+/g, '_');
      link.download = `backup_${cleanCar}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Ошибка экспорта бэкапа');
    }
  };

  const veh = parsedData?.vehicle || parsedData?.vehicles?.[0] || parsedData?.data?.[0]?.vehicle;
  const recordsCount =
    parsedData?.service_records?.length ||
    parsedData?.maintenance_records?.length ||
    parsedData?.services?.length ||
    parsedData?.data?.[0]?.service_records?.length ||
    0;
  const trackersCount =
    parsedData?.trackers?.length ||
    parsedData?.reminders?.length ||
    veh?.trackers?.length ||
    parsedData?.data?.[0]?.trackers?.length ||
    0;
  const tyresCount =
    parsedData?.tyre_sets?.length ||
    parsedData?.tyres?.length ||
    parsedData?.data?.[0]?.tyre_sets?.length ||
    0;
  const insCount =
    parsedData?.documents?.length ||
    parsedData?.insurances?.length ||
    parsedData?.data?.[0]?.documents?.length ||
    0;
  const fuelCount =
    parsedData?.fuel_logs?.length ||
    parsedData?.fuel?.length ||
    parsedData?.data?.[0]?.fuel_logs?.length ||
    0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-750 bg-slate-50 dark:bg-dark-800">
          <div className="flex items-center space-x-2">
            {activeTab === 'import' ? (
              <UploadCloud className="w-5 h-5 text-brand-500" />
            ) : (
              <DownloadCloud className="w-5 h-5 text-emerald-500" />
            )}
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Резервное копирование (JSON)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-dark-750 bg-slate-100/50 dark:bg-dark-900/50 p-1.5 gap-1.5">
          <button
            onClick={() => {
              setActiveTab('import');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'import'
                ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-dark-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>📥 Импорт бэкапа</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('export');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'export'
                ? 'bg-white dark:bg-dark-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-dark-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>💾 Экспорт бэкапа</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'import' ? (
            /* IMPORT TAB */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Загрузите файл бэкапа (.json) или вставьте текст:
                </label>
                <div className="flex items-center space-x-3 mb-3">
                  <label className="cursor-pointer flex items-center space-x-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-dark-700 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95">
                    <FileJson className="w-4 h-4 text-brand-500" />
                    <span>Выбрать файл JSON</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-500">или вставьте JSON в поле ниже</span>
                </div>

                <textarea
                  rows={5}
                  placeholder='Вставьте JSON бэкапа Бортового Журнала...'
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              {error && (
                <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {parsedData && veh && (
                <div className="bg-slate-50 dark:bg-dark-900 border border-brand-500/30 rounded-xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center space-x-2 text-xs font-bold text-brand-600 dark:text-brand-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Данные распознаны успешно!</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-dark-850 p-2.5 rounded-lg border border-slate-200 dark:border-dark-750">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Автомобиль</span>
                      <span className="text-slate-900 dark:text-white font-bold">{veh.name || `${veh.brand || veh.make} ${veh.model}`}</span>
                      {(veh.plate || veh.license_plate) && (
                        <span className="text-brand-600 dark:text-brand-400 block font-mono text-[11px]">
                          {veh.plate || veh.license_plate}
                        </span>
                      )}
                    </div>

                    <div className="bg-white dark:bg-dark-850 p-2.5 rounded-lg border border-slate-200 dark:border-dark-750">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Пробег / Моточасы</span>
                      <span className="text-slate-900 dark:text-white font-mono font-bold">
                        {veh.current_km || veh.current_odometer || 0} км
                      </span>
                      {(veh.current_engine_hours) && (
                        <span className="text-slate-500 block text-[11px] font-mono">
                          {veh.current_engine_hours} м/ч
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="bg-white dark:bg-dark-800 px-2 py-1 rounded border border-slate-200 dark:border-dark-700">
                      📝 Записей ТО: <strong>{recordsCount}</strong>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-2 py-1 rounded border border-slate-200 dark:border-dark-700">
                      ⛽ Заправок: <strong>{fuelCount}</strong>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-2 py-1 rounded border border-slate-200 dark:border-dark-700">
                      ⏰ Регламентов: <strong>{trackersCount}</strong>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-2 py-1 rounded border border-slate-200 dark:border-dark-700">
                      🛞 Шины: <strong>{tyresCount}</strong>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-2 py-1 rounded border border-slate-200 dark:border-dark-700">
                      🛡️ Страховки: <strong>{insCount}</strong>
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-dark-750 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!parsedData || loading}
                  onClick={handleImport}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
                >
                  {loading ? 'Восстановление...' : 'Восстановить в гараж'}
                </button>
              </div>
            </div>
          ) : (
            /* EXPORT TAB */
            <div className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isAdmin
                  ? 'Выгрузите полную резервную копию всех данных системы или конкретного автомобиля в формате JSON для надежного хранения или переноса на другой сервер.'
                  : 'Выгрузите резервную копию ваших автомобилей и всей истории их обслуживания в формате JSON.'}
              </div>

              {/* Export Full Database Button */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-2.5">
                <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                  <Database className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>
                    {isAdmin
                      ? 'Полный бэкап всей базы данных (Администратор)'
                      : 'Резервная копия всех моих автомобилей'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAdmin
                    ? 'Включает всех пользователей, все автомобили в базе данных, полную историю ТО, все заправки, регламенты, комплекты шин и полисы страхования.'
                    : 'Включает все автомобили из вашего личного гаража, их полную историю ТО, заправки, регламенты, шины и документы.'}
                </p>
                <button
                  onClick={handleExportFull}
                  className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isAdmin
                      ? 'Скачать полный архив базы данных (.json)'
                      : 'Скачать бэкап моих автомобилей (.json)'}
                  </span>
                </button>
              </div>

              {/* Export Individual Vehicle */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {isAdmin
                    ? 'Или скачать бэкап конкретного автомобиля:'
                    : 'Или скачать бэкап конкретного автомобиля из вашего гаража:'}
                </label>

                {exportableVehicles.length === 0 ? (
                  <div className="text-xs text-slate-400 p-3 bg-slate-50 dark:bg-dark-800 rounded-xl text-center">
                    В вашем гараже пока нет добавленных автомобилей
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {exportableVehicles.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 hover:border-brand-500/40 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold flex-shrink-0">
                            <Car className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {v.license_plate || `${intFormat(v.current_odometer)} ${v.distance_unit}`}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleExportVehicle(v)}
                          className="flex items-center space-x-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-dark-700 dark:hover:bg-dark-600 text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
                          title={`Скачать бэкап ${v.make} ${v.model}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Бэкап JSON</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function intFormat(num?: number): string {
  if (!num) return '0';
  return Math.round(num).toLocaleString('ru-RU');
}
