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
  ExternalLink,
  Satellite,
  BatteryCharging,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Bot,
  RefreshCw,
} from 'lucide-react';
import { notificationService, NotificationSettings } from '../services/notificationService';
import { api } from '../services/api';
import { TelegramStatus, TelegramBotConfig, User } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(notificationService.getSettings());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Telegram Integration State
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<string | null>(null);

  // Admin Bot Token Config State
  const isAdmin = currentUser?.role === 'admin';
  const [botConfig, setBotConfig] = useState<TelegramBotConfig | null>(null);
  const [showBotConfigEditor, setShowBotConfigEditor] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [showTokenText, setShowTokenText] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [tokenSaveMsg, setTokenSaveMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(notificationService.getSettings());
      setPermission(notificationService.getPermission());
      setTestResult(null);
      setTelegramTestResult(null);
      setTokenSaveMsg(null);
      loadTelegramStatus();
      if (isAdmin) {
        loadBotConfig();
      }
    }
  }, [isOpen, isAdmin]);

  const loadBotConfig = async () => {
    try {
      const cfg = await api.getTelegramBotConfig();
      setBotConfig(cfg);
      if (cfg.bot_token) {
        setBotTokenInput(cfg.bot_token);
      }
    } catch (e) {
      console.error('Failed to load bot config', e);
    }
  };

  const handleSaveBotToken = async () => {
    if (!botTokenInput.trim()) {
      setTokenSaveMsg({ text: 'Введите токен от @BotFather', type: 'error' });
      return;
    }
    setIsSavingToken(true);
    setTokenSaveMsg(null);
    try {
      const res = await api.updateTelegramBotConfig(botTokenInput.trim());
      setTokenSaveMsg({ text: res.message, type: 'success' });
      await loadBotConfig();
      await loadTelegramStatus();
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Ошибка проверки токена бота';
      setTokenSaveMsg({ text: errMsg, type: 'error' });
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleResetBotToken = async () => {
    if (!window.confirm('Сбросить токен бота к значению по умолчанию?')) return;
    setIsSavingToken(true);
    setTokenSaveMsg(null);
    try {
      const res = await api.resetTelegramBotConfig();
      setTokenSaveMsg({ text: res.message, type: 'success' });
      await loadBotConfig();
      await loadTelegramStatus();
    } catch (err: any) {
      setTokenSaveMsg({ text: 'Ошибка сброса настроек токена', type: 'error' });
    } finally {
      setIsSavingToken(false);
    }
  };

  const loadTelegramStatus = async () => {
    try {
      setLoadingTelegram(true);
      const res = await api.getTelegramStatus();
      setTelegramStatus(res);
    } catch (e) {
      console.error('Failed to load Telegram status', e);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm('Отвязать Telegram-бота от аккаунта?')) return;
    try {
      await api.unlinkTelegram();
      await loadTelegramStatus();
    } catch (e) {
      alert('Ошибка при отвязке Telegram');
    }
  };

  const handleSendTelegramTest = async () => {
    setTelegramTestResult('Отправка в Telegram...');
    try {
      await api.sendTelegramTestMessage();
      setTelegramTestResult('✅ Сообщение отправлено в Telegram!');
    } catch (e) {
      setTelegramTestResult('⚠️ Ошибка отправки. Убедитесь, что бот запущен.');
    }
  };

  const handleToggleTelegramOption = async (field: keyof TelegramStatus, val: boolean) => {
    if (!telegramStatus) return;
    const updated = { ...telegramStatus, [field]: val };
    setTelegramStatus(updated);
    try {
      await api.updateTelegramSettings(updated);
    } catch (e) {
      console.error('Failed to update telegram settings', e);
    }
  };

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
          {/* Telegram Bot Integration Card */}
          <div className="bg-gradient-to-br from-sky-500/10 via-brand-500/10 to-transparent border border-sky-500/25 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-base shadow-md shadow-sky-500/20">
                  ✈️
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      Telegram-бот (@{telegramStatus?.bot_username || 'to_scanek_bot'})
                    </h4>
                    {telegramStatus?.is_connected ? (
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Подключен
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-slate-400">
                        Не привязан
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Мгновенные оповещения в личные сообщения Telegram
                  </p>
                </div>
              </div>
            </div>

            {telegramStatus?.is_connected ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-white/60 dark:bg-dark-900/60 border border-slate-200 dark:border-dark-700">
                  <span className="text-slate-600 dark:text-slate-400">
                    Привязанный аккаунт: <b className="text-slate-900 dark:text-white">{telegramStatus.telegram_username ? `@${telegramStatus.telegram_username}` : `ID: ${telegramStatus.telegram_chat_id}`}</b>
                  </span>
                  <button
                    onClick={handleUnlinkTelegram}
                    className="text-rose-500 hover:text-rose-600 font-bold text-[10px] hover:underline"
                  >
                    Отвязать
                  </button>
                </div>

                {/* Sub-toggles for Telegram */}
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                    <span>🔧 Напоминания о регламентах ТО</span>
                    <input
                      type="checkbox"
                      checked={telegramStatus.notify_reminders}
                      onChange={(e) => handleToggleTelegramOption('notify_reminders', e.target.checked)}
                      className="rounded text-brand-500"
                    />
                  </label>
                  <label className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                    <span>🪫 Предупреждать о разряде АКБ (&lt; 11.8 В)</span>
                    <input
                      type="checkbox"
                      checked={telegramStatus.notify_battery}
                      onChange={(e) => handleToggleTelegramOption('notify_battery', e.target.checked)}
                      className="rounded text-brand-500"
                    />
                  </label>
                </div>

                <div className="pt-1 flex gap-2">
                  <button
                    onClick={handleSendTelegramTest}
                    className="flex-1 bg-white dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-dark-700 font-bold py-1.5 px-3 rounded-xl transition text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-500" />
                    <span>Отправить тест</span>
                  </button>
                  <a
                    href={`https://t.me/${telegramStatus.bot_username || 'to_scanek_bot'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-1.5 px-3 rounded-xl transition text-[11px] flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>Открыть чат</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {telegramTestResult && (
                  <div className="text-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    {telegramTestResult}
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-1 space-y-2">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Подключите бота в 1 клик, чтобы получать уведомления о приближающемся ТО и критическом разряде аккумулятора.
                </p>
                {telegramStatus?.link_url && (
                  <a
                    href={telegramStatus.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center space-x-2 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold py-2 px-4 rounded-xl transition shadow-md shadow-sky-500/20 text-xs"
                  >
                    <span>Подключить Telegram-бота</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Admin Bot Token Configuration Accordion */}
            {isAdmin && (
              <div className="pt-2 border-t border-sky-500/20">
                <button
                  type="button"
                  onClick={() => setShowBotConfigEditor(!showBotConfigEditor)}
                  className="flex items-center justify-between w-full text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-white transition"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Сменить токен Telegram-бота (Admin)</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30">
                    {showBotConfigEditor ? '▲ Скрыть' : '▼ Изменить токен'}
                  </span>
                </button>

                {showBotConfigEditor && (
                  <div className="mt-2.5 p-3 rounded-xl bg-white dark:bg-dark-900 border border-sky-500/30 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Статус подключения:
                      </span>
                      {botConfig?.is_active ? (
                        <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                          🟢 @{botConfig.bot_username} ({botConfig.bot_name || 'Активен'})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/25">
                          🔴 Не активен / Ошибка
                        </span>
                      )}
                    </div>

                    {botConfig?.status_detail && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {botConfig.status_detail}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        API Token бота (от @BotFather):
                      </label>
                      <div className="relative">
                        <input
                          type={showTokenText ? 'text' : 'password'}
                          value={botTokenInput}
                          onChange={(e) => setBotTokenInput(e.target.value)}
                          placeholder="8868283738:AAG3Dh994OcZ1SxHjRuWeko..."
                          className="w-full text-xs font-mono px-3 py-1.5 pr-8 rounded-lg border border-slate-300 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTokenText(!showTokenText)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showTokenText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSavingToken}
                        onClick={handleSaveBotToken}
                        className="flex-1 bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {isSavingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        <span>Сохранить и применить</span>
                      </button>

                      {botConfig?.is_custom_token && (
                        <button
                          type="button"
                          disabled={isSavingToken}
                          onClick={handleResetBotToken}
                          className="bg-slate-200 hover:bg-slate-300 dark:bg-dark-750 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-bold py-1.5 px-2.5 rounded-lg text-xs transition"
                          title="Сбросить к значению из .env / дефолтному"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>

                    {tokenSaveMsg && (
                      <div
                        className={`text-[10px] p-2 rounded-lg font-medium ${
                          tokenSaveMsg.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                        }`}
                      >
                        {tokenSaveMsg.text}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-dark-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-dark-700/60">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">💡 Как создать или сменить бота:</div>
                      <div>1. Напишите <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-500 underline font-bold">@BotFather</a> в Telegram команду <code>/newbot</code>.</div>
                      <div>2. Вставьте скопированный HTTP API токен в поле выше и нажмите «Сохранить».</div>
                      <div>3. Бот мгновенно переключится и будет отправлять уведомления и команды.</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Browser Web Push Heading */}
          <div className="pt-2">
            <h4 className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Браузерные Web Push-уведомления
            </h4>
          </div>

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
