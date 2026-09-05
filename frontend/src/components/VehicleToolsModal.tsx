import React from 'react';
import {
  X,
  Settings,
  FileText,
  FileSpreadsheet,
  Download,
  QrCode,
  Camera,
  Share2,
  Satellite,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Vehicle } from '../types';

interface VehicleToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  isOwner: boolean;
  onEditVehicle?: () => void;
  onDeleteVehicle?: () => void;
  onOpenStarLineModal: () => void;
  onOpenQrModal: () => void;
  onOpenPublicShareModal: () => void;
  onOpenReceiptScan: () => void;
  onExportVehicleBackup: () => void;
  onDownloadExcel: () => void;
  onDownloadPdf: () => void;
}

export const VehicleToolsModal: React.FC<VehicleToolsModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  isOwner,
  onEditVehicle,
  onDeleteVehicle,
  onOpenStarLineModal,
  onOpenQrModal,
  onOpenPublicShareModal,
  onOpenReceiptScan,
  onExportVehicleBackup,
  onDownloadExcel,
  onDownloadPdf,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-dark-750 flex items-center justify-between bg-slate-50/70 dark:bg-dark-900/50 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Инструменты и опции
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px] sm:max-w-md">
                {vehicle.name || `${vehicle.make} ${vehicle.model}`} {vehicle.license_plate ? `(${vehicle.license_plate})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-750 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* SECTION 1: Reports & Exports */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Отчеты и экспорт
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* PDF Service Booklet */}
              <button
                onClick={() => {
                  onDownloadPdf();
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition flex items-center space-x-3 text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Сервисная книжка (PDF)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Печать официальной истории ТО с печатью
                  </div>
                </div>
              </button>

              {/* Excel Export */}
              <button
                onClick={() => {
                  onDownloadExcel();
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition flex items-center space-x-3 text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Экспорт в Excel (.xlsx)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Таблица всех расходов, запчастей и цен
                  </div>
                </div>
              </button>

              {/* Vehicle JSON Backup */}
              <button
                onClick={() => {
                  onExportVehicleBackup();
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-amber-500/40 hover:bg-amber-500/5 transition flex items-center space-x-3 text-left group sm:col-span-2"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Резервная копия этого авто (JSON)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Полный бэкап истории этой машины для переноса в приложение
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2: Service Tools */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Сервисные утилиты
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Under-hood QR Sticker */}
              <button
                onClick={() => {
                  onClose();
                  onOpenQrModal();
                }}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-brand-500/40 hover:bg-brand-500/5 transition flex items-center space-x-3 text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    QR-бирка под капот
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Печать бирки о замене масла для моторного отсека
                  </div>
                </div>
              </button>

              {/* OCR Vision Scan */}
              {isOwner && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenReceiptScan();
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-purple-500/40 hover:bg-purple-500/5 transition flex items-center space-x-3 text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Распознать заказ-наряд (OCR)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Сканирование фото чека СТО нейросетью
                    </div>
                  </div>
                </button>
              )}

              {/* Public Share Booklet */}
              {isOwner && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenPublicShareModal();
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-sky-500/40 hover:bg-sky-500/5 transition flex items-center space-x-3 text-left group sm:col-span-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Публичная ссылка для Авито / Авто.ру
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Страница с проверенной историей ТО для покупателей
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* SECTION 3: Settings & Vehicle Management */}
          {isOwner && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Настройки и связь
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* StarLine Telematics */}
                <button
                  onClick={() => {
                    onClose();
                    onOpenStarLineModal();
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-sky-500/40 hover:bg-sky-500/5 transition flex items-center space-x-3 text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Satellite className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Телематика StarLine
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Синхронизация пробега и датчиков
                    </div>
                  </div>
                </button>

                {/* Edit Vehicle */}
                {onEditVehicle && (
                  <button
                    onClick={() => {
                      onClose();
                      onEditVehicle();
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750 bg-slate-50/60 dark:bg-dark-800/60 hover:border-brand-500/40 hover:bg-brand-500/5 transition flex items-center space-x-3 text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Параметры авто
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Госномер, VIN, год, фото и характеристики
                      </div>
                    </div>
                  </button>
                )}

                {/* Delete Vehicle */}
                {onDeleteVehicle && (
                  <button
                    onClick={() => {
                      onClose();
                      if (confirm(`Удалить ${vehicle.make} ${vehicle.model} и всю историю обслуживания?`)) {
                        onDeleteVehicle();
                      }
                    }}
                    className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-500/40 hover:bg-rose-500/10 transition flex items-center space-x-3 text-left group sm:col-span-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        Удалить автомобиль
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Безвозвратное удаление карточки авто и записей ТО
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
