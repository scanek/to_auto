import React, { useState } from 'react';
import {
  X,
  QrCode,
  Printer,
  Copy,
  Check,
  Calendar,
  Share2,
  ExternalLink,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Fuel,
} from 'lucide-react';
import { Vehicle, MaintenancePlan } from '../types';
import { generateQrUrl, downloadIcsReminder } from '../utils/qrcodeHelper';

interface QrBookletModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  reminders: MaintenancePlan[];
}

export const QrBookletModal: React.FC<QrBookletModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  reminders,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'sticker'>('qr');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the public link to this vehicle
  const shareUrl = `${window.location.origin}/?vehicle=${vehicle.id}`;
  const qrSvgUrl = generateQrUrl(shareUrl, 300);

  // Find next oil reminder
  const oilReminder = reminders.find(
    (r) =>
      r.title.toLowerCase().includes('масло') ||
      r.title.toLowerCase().includes('то-') ||
      r.title.toLowerCase().includes('двс')
  ) || reminders[0];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Электронная сервисная книжка — ${vehicle.make} ${vehicle.model}`,
          text: `История обслуживания, пробег и регламенты ТО автомобиля ${vehicle.make} ${vehicle.model}:`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleAddToCalendar = () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6); // default 6 months or next target
    const targetKm = oilReminder
      ? (oilReminder.last_service_odometer || vehicle.current_odometer) + (oilReminder.interval_distance || 7500)
      : vehicle.current_odometer + 7500;

    downloadIcsReminder({
      title: oilReminder ? oilReminder.title : 'Замена моторного масла и фильтров',
      carName: `${vehicle.make} ${vehicle.model}`,
      licensePlate: vehicle.license_plate,
      targetDate: targetDate,
      odometerTarget: targetKm,
      distanceUnit: vehicle.distance_unit,
      oilSpec: vehicle.oil_spec,
      bookletUrl: shareUrl,
    });
  };

  const handlePrintSticker = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-750 bg-slate-50 dark:bg-dark-900/60 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                QR-код и Наклейка ТО
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {vehicle.make} {vehicle.model} {vehicle.license_plate ? `(${vehicle.license_plate})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-100 dark:bg-dark-900/40 border-b border-slate-200 dark:border-dark-750 flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'qr'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📱 QR-код сервисной книги
          </button>
          <button
            onClick={() => setActiveTab('sticker')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sticker'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🏷️ Наклейка под капот / Бирка ТО
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'qr' ? (
            <div className="space-y-4 text-center">
              {/* QR Image Box */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-inner w-56 h-56 mx-auto flex items-center justify-center">
                <img
                  src={qrSvgUrl}
                  alt={`QR-код для ${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Отсканируйте камерой телефона
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  QR-код мгновенно открывает электронную сервисную книжку автомобиля со всей историей обслуживания, заменами масла и остатком шин.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-dark-700 transition-all active:scale-95 shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-brand-500" />}
                  <span>{copied ? 'Ссылка скопирована!' : 'Скопировать ссылку'}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-dark-700 transition-all active:scale-95 shadow-sm"
                >
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span>Поделиться</span>
                </button>
              </div>

              {/* Option A: Add reminder to phone calendar */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-brand-500/10 border border-amber-500/25 rounded-2xl p-3.5 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Напоминание о замене масла</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Добавить плановое ТО в календарь смартфона (Apple / Google / Outlook)
                  </div>
                </div>

                <button
                  onClick={handleAddToCalendar}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/25 flex-shrink-0 flex items-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>В календарь (.ics)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Printable Service Sticker Preview */}
              <div
                id="printable-service-sticker"
                className="bg-white text-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-slate-300 shadow-md space-y-3 font-sans"
              >
                {/* Sticker Header */}
                <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      ТО
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tight text-slate-900">
                        Электронная сервисная книжка
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        Бортовой Журнал • scanek.ru
                      </div>
                    </div>
                  </div>
                  {vehicle.license_plate && (
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded border border-slate-400 bg-slate-50">
                      {vehicle.license_plate}
                    </span>
                  )}
                </div>

                {/* Car info */}
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-sm font-extrabold text-blue-900">
                    {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
                  </span>
                  <span className="font-mono text-[11px] text-slate-600">
                    {Math.round(vehicle.current_odometer).toLocaleString('ru-RU')} {vehicle.distance_unit}
                  </span>
                </div>

                {/* Main Maintenance Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">
                      След. замена масла
                    </span>
                    <span className="font-mono font-black text-blue-600 text-xs">
                      {oilReminder
                        ? `${Math.round((oilReminder.last_service_odometer || vehicle.current_odometer) + (oilReminder.interval_distance || 7500)).toLocaleString('ru-RU')} км`
                        : `${Math.round(vehicle.current_odometer + 7500).toLocaleString('ru-RU')} км`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">
                      Масло / Вязкость
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-[11px]">
                      {vehicle.oil_spec || '5W-30 / 5W-40'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">
                      Моточасы (м/ч)
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-[11px]">
                      {vehicle.track_engine_hours ? `${Math.round(vehicle.current_engine_hours || 0)} м/ч` : '—'}
                    </span>
                  </div>
                </div>

                {/* Sticker Footer with QR */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[10px] text-slate-600 space-y-0.5">
                    <div>📌 Наклейка на стойку двери / под капот</div>
                    <div className="text-[9px] text-slate-400">
                      Отсканируйте QR для просмотра всей истории ТО
                    </div>
                  </div>

                  <div className="w-14 h-14 p-1 bg-white border border-slate-300 rounded-lg flex items-center justify-center flex-shrink-0">
                    <img src={qrSvgUrl} alt="QR" className="w-full h-full object-contain" />
                  </div>
                </div>
              </div>

              {/* Print CTA */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Подходит для печати на самоклеящейся бумаге или обычном принтере.
                </p>
                <button
                  onClick={handlePrintSticker}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-blue-600/25 transition-all flex-shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Печать наклейки</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
