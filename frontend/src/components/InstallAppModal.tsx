import React from 'react';
import { X, Download, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  onNativeInstall?: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  onNativeInstall,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Установка AutoTracker
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Мобильное приложение для вашего смартфона
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <p className="text-slate-600 dark:text-slate-400">
              Чтобы установить приложение на <strong>iPhone / iPad</strong> через Safari:
            </p>

            <div className="space-y-3 bg-slate-50 dark:bg-dark-900 p-4 rounded-xl border border-slate-200 dark:border-dark-750">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  Нажмите кнопку <strong className="inline-flex items-center gap-1 text-brand-500 font-bold"><Share className="w-3.5 h-3.5 inline" /> «Поделиться»</strong> в нижней панели Safari.
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  Прокрутите список и нажмите пункт <strong className="inline-flex items-center gap-1 text-brand-500 font-bold"><PlusSquare className="w-3.5 h-3.5 inline" /> «На экран "Домой"»</strong>.
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  В правом верхнем углу нажмите кнопку <strong className="text-slate-900 dark:text-white font-bold">«Добавить»</strong>.
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Иконка AutoTracker появится на рабочем столе и будет запускаться как полноценное приложение без адресной строки!</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <p>
              Вы можете установить AutoTracker как автономное приложение на ваш смартфон или компьютер. Оно будет работать быстрее и доступно в 1 касание с рабочего стола!
            </p>

            <button
              onClick={() => {
                if (onNativeInstall) onNativeInstall();
                onClose();
              }}
              className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/25 transition-all text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Установить сейчас на экран</span>
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-750 rounded-xl transition"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
