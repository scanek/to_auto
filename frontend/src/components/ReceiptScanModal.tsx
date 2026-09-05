import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  UploadCloud,
  FileText,
  Check,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  Eye,
  Key,
  Calendar,
  Gauge,
  Store,
  DollarSign,
  Fuel,
  Wrench,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../services/api';

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  onApplyToService: (data: any, attachmentUrl?: string) => void;
  onApplyToFuel: (data: any) => void;
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  onApplyToService,
  onApplyToFuel,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(!localStorage.getItem('gemini_api_key'));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setExtractedData(null);
      setErrorMsg(null);
      setAttachmentUrl(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setExtractedData(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    if (key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

  const handleScan = async (overrideFile?: File) => {
    const targetFile = overrideFile || selectedFile;
    if (!targetFile) {
      setErrorMsg('Пожалуйста, выберите фото или сделайте снимок заказ-наряда/чека.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const res = await api.scanReceipt(targetFile, apiKey.trim() || undefined, vehicle.id);
      if (res.data) {
        setExtractedData(res.data);
        if (res.data.attachment_url) {
          setAttachmentUrl(res.data.attachment_url);
        }
        if (res.data.requires_api_key) {
          setShowKeyInput(true);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка распознавания документа');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!extractedData) return;
    if (extractedData.record_type === 'fuel') {
      onApplyToFuel({
        date: extractedData.date || new Date().toISOString().split('T')[0],
        odometer: extractedData.odometer || vehicle.current_odometer,
        litres: extractedData.fuel_litres || 0,
        total_cost: extractedData.total_cost || 0,
        price_per_litre: extractedData.fuel_price_per_litre || (extractedData.total_cost && extractedData.fuel_litres ? Math.round((extractedData.total_cost / extractedData.fuel_litres) * 100) / 100 : 0),
        fuel_type: extractedData.fuel_type || '',
        notes: extractedData.vendor ? `АЗС: ${extractedData.vendor}` : '',
      });
    } else {
      onApplyToService(
        {
          record_type: extractedData.record_type || 'service',
          date: extractedData.date || new Date().toISOString().split('T')[0],
          odometer: extractedData.odometer || vehicle.current_odometer,
          engine_hours: extractedData.engine_hours || vehicle.current_engine_hours,
          title: extractedData.title || (extractedData.vendor ? `ТО в ${extractedData.vendor}` : 'Обслуживание'),
          description: extractedData.description || '',
          store: extractedData.vendor || '',
          cost_labor: extractedData.cost_labor || 0,
          cost_parts: extractedData.cost_parts || 0,
          total_cost: extractedData.total_cost || 0,
          items: extractedData.items || [],
          notes: extractedData.notes || '',
        },
        attachmentUrl || undefined
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-dark-750 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-750 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Распознавание заказ-нарядов и чеков</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  AI Vision
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Сфотографируйте документ СТО или чек АЗС — данные сами заполнят форму ТО
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        />
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        />

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Photo Selection / Camera Buttons */}
        {!selectedFile ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-6 rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition flex flex-col items-center justify-center space-y-2 text-center group active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Сфотографировать камерой
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Мгновенный снимок листа заказ-наряда со смартфона
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-dark-700 bg-slate-50/60 dark:bg-dark-900/40 hover:bg-slate-100/80 dark:hover:bg-dark-800 transition flex flex-col items-center justify-center space-y-2 text-center group active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Выбрать файл / из галереи
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  JPG, PNG, WebP до 20 МБ
                </span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-dark-900/60 rounded-xl border border-slate-200/80 dark:border-dark-750 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <span>
                <strong>Подсказка:</strong> распознаются официальные заказ-наряды автосервисов, списки запчастей с ценами, чеки с АЗС и квитанции.
              </span>
            </div>
          </div>
        ) : (
          /* Preview and Recognition Actions */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-dark-900/50 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
              {previewUrl && (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-dark-700 bg-slate-200 dark:bg-dark-800 shrink-0">
                  <img
                    src={previewUrl}
                    alt="Предпросмотр чека"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 space-y-1 text-center sm:text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate max-w-xs sm:max-w-sm">
                  {selectedFile.name}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} МБ • Готово к анализу
                </span>
                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setExtractedData(null);
                    }}
                    className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                  >
                    Выбрать другое фото
                  </button>
                </div>
              </div>

              {!extractedData && (
                <button
                  type="button"
                  onClick={() => handleScan()}
                  disabled={isAnalyzing}
                  className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-purple-600/25 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Нейросеть читает документ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Распознать по фото</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Extracted Data Review */}
            {extractedData && (
              <div className="bg-slate-50 dark:bg-dark-900/60 rounded-2xl p-4 border border-slate-200 dark:border-dark-750 space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-750 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <Check className="w-4 h-4" />
                    </span>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Данные успешно распознаны:
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {extractedData.record_type === 'fuel' ? 'Чек АЗС' : 'Заказ-наряд ТО'}
                  </span>
                </div>

                {/* Main key fields grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white dark:bg-dark-800 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Дата:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {extractedData.date || '—'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-dark-800 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Пробег:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {extractedData.odometer ? `${extractedData.odometer.toLocaleString()} км` : '—'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-dark-800 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Сервис / АЗС:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate block" title={extractedData.vendor || ''}>
                      {extractedData.vendor || '—'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-dark-800 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700">
                    <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Сумма:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {extractedData.total_cost ? `${extractedData.total_cost.toLocaleString()} ${vehicle.currency || '₽'}` : '0 ₽'}
                    </span>
                  </div>
                </div>

                {/* Itemized parts/services list */}
                {Array.isArray(extractedData.items) && extractedData.items.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Распознанные работы и запчасти ({extractedData.items.length}):
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {extractedData.items.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] bg-white dark:bg-dark-800 p-2 rounded-lg border border-slate-200 dark:border-dark-700"
                        >
                          <div className="truncate mr-2">
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold mr-1.5 ${
                              item.category === 'labor'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                            }`}>
                              {item.category === 'labor' ? 'Работа' : 'Деталь'}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.name}
                            </span>
                            {item.part_number && (
                              <span className="text-slate-400 ml-1.5 font-mono text-[10px]">
                                ({item.part_number})
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {item.total_price ? `${item.total_price} ₽` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-600/25"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {extractedData.record_type === 'fuel'
                        ? 'Перенести данные в форму заправки'
                        : 'Перенести данные в форму ТО (с прикреплением фото)'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gemini API Key Configuration Section */}
        <div className="border-t border-slate-100 dark:border-dark-750 pt-3">
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <div className="flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-purple-500" />
              <span>Настройка ключа Google Gemini API</span>
              {apiKey ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                  (Ключ сохранен ✓)
                </span>
              ) : (
                <span className="text-[10px] text-amber-500 font-bold ml-1">
                  (Требуется для Vision)
                </span>
              )}
            </div>
            {showKeyInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showKeyInput && (
            <div className="mt-2.5 p-3 bg-slate-50 dark:bg-dark-900/70 rounded-xl border border-slate-200 dark:border-dark-750 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="Вставьте ключ AIzaSy..."
                  className="flex-1 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500"
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => handleSaveApiKey('')}
                    className="text-[11px] text-slate-400 hover:text-rose-500 px-1"
                  >
                    Очистить
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ключ абсолютно бесплатный (до 15 запросов в минуту). Получить можно за 1 клик на{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-0.5 font-semibold"
                >
                  aistudio.google.com <ExternalLink className="w-2.5 h-2.5" />
                </a>
                . Ключ безопасно сохраняется в вашем браузере.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
