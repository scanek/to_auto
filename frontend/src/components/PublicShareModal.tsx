import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { api } from '../services/api';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  ShieldCheck,
  RotateCcw,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  Printer,
} from 'lucide-react';

interface PublicShareModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  onUpdateVehicle: (updated: Partial<Vehicle>) => void;
}

export const PublicShareModal: React.FC<PublicShareModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onUpdateVehicle,
}) => {
  const [enabled, setEnabled] = useState<boolean>(vehicle.public_booklet_enabled ?? false);
  const [showCosts, setShowCosts] = useState<boolean>(vehicle.public_show_costs ?? false);
  const [token, setToken] = useState<string>(vehicle.public_booklet_token ?? '');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(vehicle.public_booklet_enabled ?? false);
    setShowCosts(vehicle.public_show_costs ?? false);
    setToken(vehicle.public_booklet_token ?? '');
  }, [vehicle]);

  if (!isOpen) return null;

  const publicUrl = token ? `${window.location.origin}/booklet/${token}` : '';
  const qrCodeUrl = token
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicUrl)}`
    : '';

  const handleToggleEnable = async (newEnabled: boolean) => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.updatePublicBookletSettings(vehicle.id, {
        enabled: newEnabled,
        show_costs: showCosts,
        regenerate_token: !token,
      });
      setEnabled(res.enabled);
      setToken(res.public_token);
      onUpdateVehicle({
        public_booklet_enabled: res.enabled,
        public_show_costs: res.show_costs,
        public_booklet_token: res.public_token,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения настроек доступа');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCosts = async (newShowCosts: boolean) => {
    setIsSaving(true);
    setErrorMsg(null);
    setShowCosts(newShowCosts);
    try {
      const res = await api.updatePublicBookletSettings(vehicle.id, {
        enabled,
        show_costs: newShowCosts,
      });
      onUpdateVehicle({
        public_show_costs: res.show_costs,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!window.confirm('Сгенерировать новую ссылку? Старая ссылка перестанет работать!')) {
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.updatePublicBookletSettings(vehicle.id, {
        enabled: true,
        show_costs: showCosts,
        regenerate_token: true,
      });
      setEnabled(res.enabled);
      setToken(res.public_token);
      onUpdateVehicle({
        public_booklet_enabled: res.enabled,
        public_show_costs: res.show_costs,
        public_booklet_token: res.public_token,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка генерации новой ссылки');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Share2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Публичная сервисная книжка
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Для покупателей на Авито / Авто.ру или демонстрации истории
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Master Switch: Enable Public Access */}
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-sm block">
              Публичный доступ по ссылке
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
              {enabled
                ? 'Сервисная книжка доступна любому пользователю, у кого есть ссылка'
                : 'Доступ отключен. Никто не может открыть вашу сервисную книжку'}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              disabled={isSaving}
              onChange={(e) => handleToggleEnable(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Settings when enabled */}
        {enabled && (
          <div className="space-y-4 pt-1">
            {/* Show Costs Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                {showCosts ? (
                  <Eye className="w-4 h-4 text-sky-500" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Отображать стоимость затрат
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {showCosts
                      ? 'Покупатели увидят суммы ТО и деталей'
                      : 'Финансовые суммы скрыты, видны только даты, работы и артикулы деталей'}
                  </span>
                </div>
              </div>

              <input
                type="checkbox"
                checked={showCosts}
                disabled={isSaving}
                onChange={(e) => handleToggleCosts(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 border-slate-300 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Public Link Copy Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Прямая защищенная ссылка на авто:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>
            </div>

            {/* QR Code Preview */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-4">
              {qrCodeUrl && (
                <div className="p-2 bg-white rounded-lg shadow-xs border border-slate-200 shrink-0">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code сервисной книжки"
                    className="w-28 h-28 object-contain"
                  />
                </div>
              )}
              <div className="space-y-2 text-center sm:text-left text-xs">
                <div className="flex items-center gap-1.5 justify-center sm:justify-start font-bold text-slate-800 dark:text-slate-200">
                  <QrCode className="w-4 h-4 text-sky-500" />
                  QR-код для объявлений
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  Прикрепите изображение этого QR-кода к фото автомобиля на Авито / Авто.ру. Покупатели смогут навести камеру смартфона и мгновенно увидеть честную историю обслуживания.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <a
                    href={qrCodeUrl}
                    download={`qr-booklet-${vehicle.make}-${vehicle.model}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                  >
                    Скачать изображение QR
                  </a>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Открыть в новой вкладке
                  </a>
                </div>
              </div>
            </div>

            {/* Data Protection Guarantee Notice */}
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <strong>Приватность защищена:</strong> в публичной версии скрыты ваши личные данные, пароли, загруженные чеки/файлы и внутренние заметки. Если у вас подключена телематика StarLine, покупатели увидят подтвержденную метку оригинального пробега.
              </div>
            </div>

            {/* Invalidate Token Button */}
            <div className="flex justify-between items-center pt-2 text-xs">
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Сгенерировать новую ссылку (аннулировать старую)
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-700 rounded-lg shadow-sm transition-all"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
