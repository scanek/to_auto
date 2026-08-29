import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Calendar,
  Gauge,
  Clock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { notificationService, NotificationSettings } from '../services/notificationService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(notificationService.getSettings());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(notificationService.getSettings());
      setPermission(notificationService.getPermission());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setPermission(notificationService.getPermission());
    if (granted) {
      setSettings((prev) => ({ ...prev, enabled: true }));
      notificationService.saveSettings({ ...settings, enabled: true });
    }
  };

  const handleToggleEnabled = async () => {
    if (!settings.enabled && permission !== 'granted') {
      const granted = await notificationService.requestPermission();
      setPermission(notificationService.getPermission());
      if (!granted) return;
    }
    const newSettings = { ...settings, enabled: !settings.enabled };
    setSettings(newSettings);
    notificationService.saveSettings(newSettings);
  };

  const handleChangeField = (field: keyof NotificationSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    notificationService.saveSettings(newSettings);
  };

  const handleSendTest = async () => {
    setTestResult('Отправка...');
    const ok = await notificationService.sendTestNotification();
    if (ok) {
      setTestResult('✅ Уведомление отправлено! Проверьте шторку уведомлений вашего устройства.');
    } else {
      setTestResult('⚠️ Не удалось отправить. Убедитесь, что уведомления разрешены в настройках браузера/системы.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-850 rounded-2xl max-w-md w-full border border-slate-200 dark:border-dark-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between bg-slate-50 dark:bg-dark-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Настройки Push-уведомлений
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Напоминания о регламентах ТО и страховках
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Permission Status Banner */}
          <div
            className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
              permission === 'granted'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                : permission === 'denied'
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-300'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
            }`}
          >
            {permission === 'granted' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold">
                {permission === 'granted'
                  ? 'Уведомления разрешены на этом устройстве'
                  : permission === 'denied'
                  ? 'Уведомления заблокированы в браузере'
                  : 'Требуется разрешение на отправку уведомлений'}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                {permission === 'granted'
                  ? 'Смартфон будет присылать push-напоминания при приближении регламентов обслуживания.'
                  : permission === 'denied'
                  ? 'Разрешите уведомления в настройках сайта в браузере, чтобы получать напоминания.'
                  : 'Нажмите кнопку ниже, чтобы включить уведомления на телефоне или компьютере.'}
              </div>
              {permission !== 'granted' && permission !== 'denied' && (
                <button
                  onClick={handleRequestPermission}
                  className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1 rounded-lg text-xs transition-all shadow-sm active:scale-95"
                >
                  Разрешить уведомления
                </button>
              )}
            </div>
          </div>

          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-100">
                Включить push-напоминания
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Автоматически предупреждать о предстоящем ТО
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={handleToggleEnabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-dark-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
            </label>
          </div>

          {/* Detailed Triggers Configuration */}
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5" />
              <span>Пороги срабатывания напоминаний</span>
            </div>

            {/* Distance Threshold */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Gauge className="w-3.5 h-3.5 text-brand-500" />
                  <span>По пробегу (за сколько км):</span>
                </span>
                <span className="font-bold font-mono text-brand-600 dark:text-brand-400">
                  {settings.notifyDistanceKm} км
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[300, 500, 1000, 2000].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleChangeField('notifyDistanceKm', val)}
                    className={`py-1 rounded-lg font-semibold text-[11px] transition-all ${
                      settings.notifyDistanceKm === val
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-white dark:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
                    }`}
                  >
                    {val} км
                  </button>
                ))}
              </div>
            </div>

            {/* Days Threshold */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  <span>По времени (за сколько дней):</span>
                </span>
                <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                  {settings.notifyDays} дней
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[7, 14, 21, 30].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleChangeField('notifyDays', val)}
                    className={`py-1 rounded-lg font-semibold text-[11px] transition-all ${
                      settings.notifyDays === val
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white dark:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
                    }`}
                  >
                    {val} дн.
                  </button>
                ))}
              </div>
            </div>

            {/* Engine Hours Threshold */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>По моточасам (за сколько м/ч):</span>
                </span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {settings.notifyHours} м/ч
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[10, 20, 30, 50].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleChangeField('notifyHours', val)}
                    className={`py-1 rounded-lg font-semibold text-[11px] transition-all ${
                      settings.notifyHours === val
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white dark:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
                    }`}
                  >
                    {val} м/ч
                  </button>
                ))}
              </div>
            </div>

            {/* Insurance & Documents Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-brand-500 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Окончание полисов ОСАГО / КАСКО
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Предупреждать об истечении срока страховок
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyInsurance}
                  onChange={(e) => handleChangeField('notifyInsurance', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-dark-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* Test Push Button */}
          <div className="pt-2">
            <button
              onClick={handleSendTest}
              className="w-full flex items-center justify-center space-x-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-dark-700 font-bold py-2 px-3 rounded-xl transition-all shadow-sm active:scale-95 text-xs"
            >
              <Send className="w-3.5 h-3.5 text-brand-500" />
              <span>Проверить тестовое Push-уведомление</span>
            </button>
            {testResult && (
              <div className="mt-2 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 animate-fade-in">
                {testResult}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-dark-700 flex justify-end bg-slate-50 dark:bg-dark-800">
          <button
            onClick={onClose}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition-all shadow-sm active:scale-95"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
