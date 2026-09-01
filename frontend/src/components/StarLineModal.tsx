import React, { useState } from 'react';
import { X, Satellite, CheckCircle2, RefreshCw, Smartphone, ShieldCheck, BatteryCharging, Gauge, Flame, AlertCircle, Trash2, KeyRound } from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../services/api';

interface StarLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  onSuccess: (updatedVehicle?: Vehicle) => void;
}

export const StarLineModal: React.FC<StarLineModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}) => {
  const [step, setStep] = useState<'auth' | 'select' | 'connected'>(
    vehicle.telematics_provider === 'starline' ? 'connected' : 'auth'
  );

  // Form state
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [appId, setAppId] = useState('52429');
  const [secret, setSecret] = useState('sLH_ZdZNh13xPAS1_taVqeUF_uoGk1wP');
  const [smsCode, setSmsCode] = useState('');
  const [needSms, setNeedSms] = useState(false);
  const [captchaSid, setCaptchaSid] = useState<string | null>(null);
  const [captchaImg, setCaptchaImg] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Result state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [authData, setAuthData] = useState<{ user_id: string; token: string } | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [autoSync, setAutoSync] = useState(true);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.authStarLine(vehicle.id, {
        login,
        password,
        app_id: appId.trim() || '52429',
        secret: secret.trim() || 'sLH_ZdZNh13xPAS1_taVqeUF_uoGk1wP',
        sms_code: needSms ? smsCode : undefined,
        captcha_sid: captchaSid || undefined,
        captcha_code: captchaCode || undefined,
      });

      if (res.status === 'captcha_needed' || res.captcha_sid) {
        setCaptchaSid(res.captcha_sid || null);
        setCaptchaImg(res.captcha_img || null);
        setCaptchaCode('');
        setErrorMsg('StarLine запросил ввод капчи. Введите символы с картинки.');
        return;
      }

      setCaptchaSid(null);
      setCaptchaImg(null);
      setAuthData({ user_id: res.user_id, token: res.token });
      setDevices(res.devices || []);
      if (res.devices && res.devices.length > 0) {
        setSelectedDeviceId(res.devices[0].device_id);
      }
      setStep('select');
    } catch (err: any) {
      const errStr = err.message || '';
      if (errStr.toLowerCase().includes('sms') || errStr.toLowerCase().includes('код')) {
        setNeedSms(true);
        setErrorMsg('StarLine запросил SMS-код подтверждения. Введите код из SMS.');
      } else {
        setErrorMsg(errStr || 'Ошибка подключения к StarLine. Проверьте логин и пароль.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!authData || !selectedDeviceId) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const chosenDevice = devices.find((d) => d.device_id === selectedDeviceId);
      const res = await api.connectStarLine(vehicle.id, {
        login,
        token: authData.token,
        user_id: authData.user_id,
        device_id: selectedDeviceId,
        device_alias: chosenDevice ? chosenDevice.alias : 'StarLine S96',
        auto_sync: autoSync,
      });

      setSuccessMsg(res.message || 'Телематика StarLine успешно подключена!');
      setStep('connected');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка привязки устройства');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await api.syncTelematics(vehicle.id);
      setSuccessMsg(res.message || 'Пробег и моточасы успешно обновлены со StarLine S96!');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Не удалось обновить телеметрию');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Отключить интеграцию со StarLine для этого автомобиля?')) return;
    setLoading(true);
    try {
      await api.disconnectTelematics(vehicle.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка отключения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 transition-colors max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-750">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>StarLine S96 Телематика</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                  CAN / OBD
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {vehicle.make} {vehicle.model} ({vehicle.license_plate || 'В гараже'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: ALREADY CONNECTED STATE */}
        {step === 'connected' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-brand-500/5 to-transparent border border-sky-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {vehicle.starline_device_alias || 'StarLine S96 Онлайн'}
                  </span>
                </div>
                {vehicle.starline_last_sync && (
                  <span className="text-[10px] text-slate-400">
                    Синхр: {new Date(vehicle.starline_last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-white/80 dark:bg-dark-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold">Пробег</div>
                  <div className="text-xs font-extrabold text-brand-600 dark:text-brand-400 mt-0.5">
                    {vehicle.current_odometer ? `${Math.round(vehicle.current_odometer).toLocaleString('ru-RU')} км` : '—'}
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-dark-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold">Моточасы</div>
                  <div className="text-xs font-extrabold text-amber-500 mt-0.5">
                    {vehicle.current_engine_hours ? `${vehicle.current_engine_hours} м/ч` : '—'}
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-dark-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold">АКБ</div>
                  <div className="text-xs font-extrabold text-emerald-500 mt-0.5">
                    {vehicle.starline_battery ? `${vehicle.starline_battery.toFixed(1)} В` : '—'}
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-dark-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-dark-700 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold">Бак</div>
                  <div className="text-xs font-extrabold text-sky-500 mt-0.5">
                    {vehicle.starline_fuel_percent ? `${vehicle.starline_fuel_percent}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 text-xs transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Синхронизация...' : 'Синхронизировать сейчас'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-xl flex items-center justify-center space-x-1.5 text-xs transition"
                title="Отключить StarLine от этого авто"
              >
                <Trash2 className="w-4 h-4" />
                <span>Отключить</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: AUTHENTICATION FORM */}
        {step === 'auth' && (
          <form onSubmit={handleAuth} className="space-y-3.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              💡 Введите ваш логин (телефон или email) и пароль от <strong>StarLine Онлайн</strong> (starline-online.ru или мобильного приложения).
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Логин StarLine (Телефон или Email) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+79XXXXXXXXX или user@mail.ru"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Пароль от StarLine *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* CAPTCHA SECTION */}
              {captchaImg && (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-2 animate-fadeIn">
                  <label className="block text-xs font-bold text-sky-800 dark:text-sky-200">
                    Код с картинки (Captcha) *
                  </label>
                  <div className="flex items-center space-x-3">
                    <img
                      src={captchaImg}
                      alt="StarLine Captcha"
                      className="h-10 rounded-lg border border-slate-300 bg-white p-1 shadow-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Символы"
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-dark-900 border border-sky-400 rounded-xl text-xs font-bold font-mono tracking-wider text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {needSms && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 animate-fadeIn">
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-300">
                    Код подтверждения из SMS *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например, 123456"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-900 border border-amber-400 dark:border-amber-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline flex items-center space-x-1"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{showAdvanced ? 'Скрыть параметры API' : 'Параметры StarLine API (AppId & Secret)'}</span>
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-2 mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 text-xs animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">App ID</label>
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        className="w-full px-2 py-1 text-[11px] bg-white dark:bg-dark-800 border rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Secret</label>
                      <input
                        type="text"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        className="w-full px-2 py-1 text-[11px] bg-white dark:bg-dark-800 border rounded font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !login || !password}
              className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 text-xs transition disabled:opacity-50"
            >
              <Satellite className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Подключение к StarLine...' : 'Найти мои автомобили'}</span>
            </button>
          </form>
        )}

        {/* STEP 3: SELECT DEVICE FROM FOUND VEHICLES */}
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              В вашем аккаунте StarLine найдено устройств: <strong>{devices.length}</strong>. Выберите нужное для привязки к <strong>{vehicle.make} {vehicle.model}</strong>:
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {devices.map((d) => (
                <div
                  key={d.device_id}
                  onClick={() => setSelectedDeviceId(d.device_id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedDeviceId === d.device_id
                      ? 'border-sky-500 bg-sky-500/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-dark-750 hover:bg-slate-50 dark:hover:bg-dark-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-500 flex items-center justify-center font-bold text-xs">
                      S96
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{d.alias}</div>
                      <div className="text-[10px] text-slate-400">ID: {d.device_id} • IMEI: {d.imei || '—'}</div>
                    </div>
                  </div>

                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedDeviceId === d.device_id ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300'
                  }`}>
                    {selectedDeviceId === d.device_id && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="autoSyncCheck"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400"
              />
              <label htmlFor="autoSyncCheck" className="text-xs text-slate-700 dark:text-slate-300">
                Автоматически обновлять пробег и моточасы
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('auth')}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-dark-700 text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading || !selectedDeviceId}
                className="flex-1 py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 text-xs transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Подключение...' : 'Привязать к автомобилю'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
