import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  UserPlus,
  LogIn,
  Car,
} from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [allowRegistration, setAllowRegistration] = useState<boolean>(true);

  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      checkSetup();
    }
  }, [isOpen]);

  const checkSetup = async () => {
    try {
      const status = await api.getSetupStatus();
      setHasUsers(status.has_users);
      setAllowRegistration(status.allow_registration);
      if (!status.has_users) {
        setMode('register');
      }
    } catch {
      setHasUsers(true);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({
          username: username.trim(),
          password,
        });
        setAuthToken(res.access_token);
        onSuccess(res.user);
        onClose();
      } else {
        const res = await api.register({
          username: username.trim(),
          email: email.trim() || undefined,
          full_name: fullName.trim() || undefined,
          password,
        });
        setAuthToken(res.access_token);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации. Проверьте введенные данные.');
    } finally {
      setLoading(false);
    }
  };

  const isFirstSetup = hasUsers === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 dark:border-dark-750 bg-slate-50/50 dark:bg-dark-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
              {isFirstSetup ? (
                <ShieldCheck className="w-6 h-6" />
              ) : mode === 'login' ? (
                <LogIn className="w-6 h-6" />
              ) : (
                <UserPlus className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isFirstSetup
                  ? 'Первоначальная настройка'
                  : mode === 'login'
                  ? 'Вход в аккаунт'
                  : 'Создание аккаунта'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFirstSetup
                  ? 'Создайте главного администратора системы'
                  : mode === 'login'
                  ? 'Введите логин и пароль для доступа к гаражу'
                  : 'Зарегистрируйте личный изолированный гараж'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (if users exist) */}
        {!isFirstSetup && (
          <div className="flex border-b border-slate-200 dark:border-dark-750 bg-slate-100/50 dark:bg-dark-900/50 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-dark-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Вход</span>
            </button>

            {allowRegistration && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-dark-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Регистрация</span>
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isFirstSetup && (
            <div className="bg-brand-500/10 border border-brand-500/30 text-brand-700 dark:text-brand-300 p-3 rounded-xl text-xs flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Первый пользователь станет Администратором</strong>
                <div className="text-[11px] opacity-90 mt-0.5">
                  Все существующие в базе автомобили будут автоматически привязаны к вашему новому профилю.
                </div>
              </div>
            </div>
          )}

          {/* Username / Login */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Логин {mode === 'login' ? 'или Email' : ''} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'login' ? 'user или email@example.com' : 'ivan_ivanov'}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
          </div>

          {/* Full Name & Email (Only on register) */}
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Имя и Фамилия (для профиля)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email (для входа и уведомлений)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ivan@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
                  />
                </div>
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Пароль <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-dark-750 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <span>Загрузка...</span>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Войти в гараж</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{isFirstSetup ? 'Создать администратора' : 'Создать аккаунт'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
