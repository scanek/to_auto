import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertCircle, FileJson } from 'lucide-react';
import { api } from '../services/api';

interface ImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vehicleId: number) => void;
}

export const ImportBackupModal: React.FC<ImportBackupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    } catch (e: any) {
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

  const veh = parsedData?.vehicle || parsedData?.vehicles?.[0];
  const recordsCount = parsedData?.maintenance_records?.length || 0;
  const trackersCount = parsedData?.trackers?.length || veh?.trackers?.length || 0;
  const tyresCount = parsedData?.tyre_sets?.length || 0;
  const insCount = parsedData?.insurances?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">Импорт бэкапа (Восстановление данных)</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Загрузите файл бэкапа (.json) или вставьте текст:
            </label>
            <div className="flex items-center space-x-3 mb-3">
              <label className="cursor-pointer flex items-center space-x-2 bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 px-4 py-2 rounded-xl text-xs font-semibold transition-all">
                <FileJson className="w-4 h-4 text-brand-400" />
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
              placeholder='Вставьте JSON бэкапа (версии 2.5 или AutoTracker)...'
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg p-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-brand-500"
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsedData && veh && (
            <div className="bg-dark-900 border border-brand-500/30 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center space-x-2 text-xs font-bold text-brand-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Данные распознаны успешно!</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-dark-850 p-2.5 rounded-lg border border-dark-750">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Автомобиль</span>
                  <span className="text-white font-bold">{veh.name || `${veh.brand} ${veh.model}`}</span>
                  {veh.plate && <span className="text-brand-400 block font-mono text-[11px]">{veh.plate}</span>}
                </div>

                <div className="bg-dark-850 p-2.5 rounded-lg border border-dark-750">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Пробег / Моточасы</span>
                  <span className="text-white font-mono font-bold">{veh.current_km} км</span>
                  {veh.current_engine_hours && (
                    <span className="text-slate-400 block text-[11px] font-mono">
                      {veh.current_engine_hours} м/ч
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                <span className="bg-dark-800 px-2 py-1 rounded border border-dark-700">
                  📝 Записей обслуживания: <strong>{recordsCount}</strong>
                </span>
                <span className="bg-dark-800 px-2 py-1 rounded border border-dark-700">
                  ⏰ Регламентов ТО: <strong>{trackersCount}</strong>
                </span>
                <span className="bg-dark-800 px-2 py-1 rounded border border-dark-700">
                  🛞 Комплектов шин: <strong>{tyresCount}</strong>
                </span>
                <span className="bg-dark-800 px-2 py-1 rounded border border-dark-700">
                  🛡️ Страховок: <strong>{insCount}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-dark-750 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={!parsedData || loading}
              onClick={handleImport}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Восстановление...' : 'Восстановить в гараж'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
