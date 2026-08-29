import React, { useState } from 'react';
import { X, Lock, KeyRound, Check, AlertCircle, LogOut } from 'lucide-react';
import { api, setAuthToken, removeAuthToken } from '../services/api';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onAuthSuccess: () => void;
  onLogout: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  onAuthSuccess,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [mode, setMode] = useState<'login' | 'change'>('login');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.loginPin(pin);
      setAuthToken(res.token);
      setSuccessMsg('Доступ владельца открыт!');
      setTimeout(() => {
        onAuthSuccess();
        onClose();
        setPin('');
        setSuccessMsg(null);
      }, 500);
    } catch (err: any) {
      setError('Неверный PIN-код');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 3) {
      setError('PIN-код должен быть от 3 символов');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.changePin({ old_pin: oldPin || undefined, new_pin: newPin });
      setAuthToken(res.token);
      setSuccessMsg('PIN-код успешно сохранен!');
      setTimeout(() => {
        onAuthSuccess();
        onClose();
        setOldPin('');
        setNewPin('');
        setSuccessMsg(null);
      }, 700);
    } catch (err: any) {
      setError('Ошибка при смене PIN-кода. Проверьте старый PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAction = () => {
    removeAuthToken();
    onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isAuthenticated ? 'Управление доступом' : 'Вход для владельца'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAuthenticated ? 'Режим редактирования активен' : 'Защита от случайных изменений'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Вы авторизованы как Владелец</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Вам доступны все действия: добавление ТО, заправок, шин, редактирование и удаление.
              </p>
            </div>

            {mode === 'change' ? (
              <form onSubmit={handleChangePin} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Текущий PIN-код
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="••••"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Новый PIN-код (от 3 цифр)
                  </label>
                  <input
                    type="password"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-brand-500/20 transition disabled:opacity-50"
                  >
                    {loading ? 'Сохранение...' : 'Сохранить PIN'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMode('change')}
                  className="w-full py-2.5 px-3 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 transition border border-slate-200 dark:border-dark-700"
                >
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span>Сменить PIN-код владельца</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogoutAction}
                  className="w-full py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 transition border border-rose-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Заблокировать (Режим гостя)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Введите PIN-код для разблокировки добавления, редактирования и удаления записей.
            </p>

            <div>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center block mt-1.5">
                Если PIN еще не задавался, введите любой желаемый PIN для первой настройки.
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading || !pin}
                className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-brand-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? 'Проверка...' : 'Войти'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
