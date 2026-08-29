import React from 'react';
import { X, Download, Share, PlusSquare, Smartphone, Check, MoreVertical, Monitor } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  hasNativePrompt: boolean;
  onNativeInstall?: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  hasNativePrompt,
  onNativeInstall,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Установка AutoTracker
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Запуск в 1 касание с экрана без браузера
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-dark-750 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Click Native Install if Supported by Browser */}
        {hasNativePrompt && (
          <button
            onClick={() => {
              if (onNativeInstall) onNativeInstall();
              onClose();
            }}
            className="w-full py-2 px-3 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md shadow-brand-500/20 transition-all text-xs"
          >
            <Download className="w-4 h-4" />
            <span>Установить в 1 клик</span>
          </button>
        )}

        {/* Step-by-Step Instructions */}
        {isIOS ? (
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Инструкция для <strong>iPhone / iPad</strong> в браузере Safari:
            </p>

            <div className="space-y-2.5 bg-slate-50 dark:bg-dark-900 p-3.5 rounded-xl border border-slate-200 dark:border-dark-750">
              <div className="flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  Нажмите иконку <strong className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold"><Share className="w-3 h-3 inline" /> «Поделиться»</strong> в нижней панели Safari.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  Прокрутите список и нажмите <strong className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold"><PlusSquare className="w-3 h-3 inline" /> «На экран "Домой"»</strong>.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  Вверху нажмите кнопку <strong className="text-slate-900 dark:text-white font-bold">«Добавить»</strong>.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Чтобы добавить приложение на экран телефона или рабочий стол:
            </p>

            {/* Android instructions */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-dark-900 p-3.5 rounded-xl border border-slate-200 dark:border-dark-750">
              <div className="font-bold text-[11px] text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>На Android (Chrome, Яндекс, Samsung):</span>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  Нажмите меню браузера <strong className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold"><MoreVertical className="w-3 h-3 inline" /> (три точки)</strong> в правом углу.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  Выберите пункт <strong className="text-slate-900 dark:text-white font-bold">«Установить приложение»</strong> или <strong className="text-slate-900 dark:text-white font-bold">«Добавить на главный экран»</strong>.
                </div>
              </div>
            </div>

            {/* PC Desktop instructions */}
            <div className="space-y-2 bg-slate-50 dark:bg-dark-900 p-3 rounded-xl border border-slate-200 dark:border-dark-750">
              <div className="font-bold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                <span>На компьютере (Chrome / Edge):</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                В адресной строке браузера справа нажмите иконку <strong>⊕ («Установить»)</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-2">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Приложение откроется на весь экран с иконки на рабочем столе!</span>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-750 rounded-xl transition"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
