import React, { useState } from 'react';
import { TyreSet, Vehicle } from '../types';
import { api } from '../services/api';
import { getRotationAnalysis, getRotationScheme } from '../utils/tyreAnalytics';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowDownRight,
  ArrowDownLeft,
  HelpCircle,
  Radio,
  Sliders,
} from 'lucide-react';

interface TyreRotationWidgetProps {
  tyre: TyreSet;
  vehicle: Vehicle;
  onRotated: () => void;
  onUpdateTyre?: (updated: Partial<TyreSet>) => void;
}

export const TyreRotationWidget: React.FC<TyreRotationWidgetProps> = ({
  tyre,
  vehicle,
  onRotated,
  onUpdateTyre,
}) => {
  const [driveType, setDriveType] = useState<string>(vehicle.drive_type || 'fwd');
  const [isDirectional, setIsDirectional] = useState<boolean>(tyre.is_directional || false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [odometerInput, setOdometerInput] = useState<number>(vehicle.current_odometer || 0);
  const [swapTpms, setSwapTpms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rotationInterval = tyre.rotation_interval_km || 10000;
  const analysis = getRotationAnalysis(vehicle.current_odometer, tyre.last_rotation_km, rotationInterval);
  const scheme = getRotationScheme(driveType, isDirectional);

  const hasTpms = Boolean(
    tyre.tpms_fl_id || tyre.tpms_fr_id || tyre.tpms_rl_id || tyre.tpms_rr_id
  );

  const handleToggleDirectional = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsDirectional(checked);
    if (onUpdateTyre) {
      onUpdateTyre({ is_directional: checked });
    }
    try {
      await api.updateTyreSet(tyre.id, { is_directional: checked });
    } catch (err) {
      console.error('Failed to update is_directional', err);
    }
  };

  const handleDriveTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDriveType(val);
    try {
      await api.updateVehicle(vehicle.id, { drive_type: val } as any);
    } catch (err) {
      console.error('Failed to update vehicle drive_type', err);
    }
  };

  const handleConfirmRotation = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.rotateTyreSet(tyre.id, {
        current_odometer: Number(odometerInput),
        swap_tpms: swapTpms,
        drive_type: isDirectional ? 'directional' : (driveType as any),
      });
      setIsModalOpen(false);
      onRotated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при сохранении ротации шин');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-lg">
              <RotateCcw className="w-5 h-5" />
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Умная ротация и схема перестановки колес
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Продлевает ресурс шин до 30% за счет компенсации неравномерного износа осей
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setOdometerInput(vehicle.current_odometer);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all"
        >
          <CheckCircle2 className="w-4 h-4" />
          Отметить перестановку
        </button>
      </div>

      {/* Progress & Mileage Tracker */}
      <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {analysis.isOverdue ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-3.5 h-3.5" /> Внимание: перестановка просрочена!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> Интервал в норме
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Регламент: каждые {rotationInterval.toLocaleString()} км
            </span>
          </div>

          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {analysis.statusText}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              analysis.isOverdue
                ? 'bg-rose-500'
                : analysis.progressPercent > 80
                ? 'bg-amber-500'
                : 'bg-sky-500'
            }`}
            style={{ width: `${analysis.progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
          <span>
            {tyre.last_rotation_km
              ? `Прошлая ротация: ${tyre.last_rotation_km.toLocaleString()} ${vehicle.distance_unit}`
              : 'Прошлая ротация: не отмечена'}
          </span>
          <span>
            Текущий пробег авто: {vehicle.current_odometer.toLocaleString()} {vehicle.distance_unit}
          </span>
        </div>
      </div>

      {/* Configuration & Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="drive-type-select" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-500" />
            Привод автомобиля:
          </label>
          <select
            id="drive-type-select"
            value={driveType}
            onChange={handleDriveTypeChange}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md px-2.5 py-1 font-medium focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="fwd">Передний (FWD)</option>
            <option value="awd">Полный (AWD / 4WD)</option>
            <option value="rwd">Задний (RWD)</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer">
            <Radio className="w-3.5 h-3.5 text-sky-500" />
            Направленный протектор («елочка»):
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isDirectional}
              onChange={handleToggleDirectional}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
          </label>
        </div>
      </div>

      {/* Visual Car Schematic */}
      <div className="relative bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-900/20 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80">
        <div className="text-center mb-4">
          <div className="inline-block text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-950/60 px-3 py-1 rounded-full border border-sky-200 dark:border-sky-800">
            {scheme.name}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {scheme.description}
          </p>
        </div>

        {/* 2D Car View Canvas */}
        <div className="max-w-md mx-auto relative bg-white dark:bg-slate-800/90 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700">
          {/* Direction indicator (Front of car) */}
          <div className="text-center mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-0.5">
              ▲ ПЕРЕДНЯЯ ОСЬ (КАПОТ) ▲
            </span>
          </div>

          {/* Front Axle */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Front Left (FL) */}
            <div className="border-2 border-sky-200 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl p-3 flex flex-col items-center text-center shadow-xs">
              <span className="text-xs font-bold text-sky-800 dark:text-sky-300">
                Переднее Левое (ПЛ)
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                TPMS: <code className="font-mono font-semibold">{tyre.tpms_fl_id || '—'}</code>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                <span>Переходит:</span>
                {isDirectional || driveType.toLowerCase() === 'fwd' ? (
                  <span className="text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                    <ArrowDown className="w-3 h-3" /> ЗЛ
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <ArrowDownRight className="w-3 h-3" /> ЗП
                  </span>
                )}
              </div>
            </div>

            {/* Front Right (FR) */}
            <div className="border-2 border-sky-200 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl p-3 flex flex-col items-center text-center shadow-xs">
              <span className="text-xs font-bold text-sky-800 dark:text-sky-300">
                Переднее Правое (ПП)
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                TPMS: <code className="font-mono font-semibold">{tyre.tpms_fr_id || '—'}</code>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                <span>Переходит:</span>
                {isDirectional || driveType.toLowerCase() === 'fwd' ? (
                  <span className="text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                    <ArrowDown className="w-3 h-3" /> ЗП
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <ArrowDownLeft className="w-3 h-3" /> ЗЛ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Car Body Center Line */}
          <div className="relative flex justify-center items-center my-2">
            <div className="w-full border-t border-dashed border-slate-200 dark:border-slate-700" />
            <span className="absolute bg-white dark:bg-slate-800 px-2 text-[10px] text-slate-400">
              База автомобиля
            </span>
          </div>

          {/* Rear Axle */}
          <div className="grid grid-cols-2 gap-6 mt-8">
            {/* Rear Left (RL) */}
            <div className="border-2 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl p-3 flex flex-col items-center text-center shadow-xs">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                Заднее Левое (ЗЛ)
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                TPMS: <code className="font-mono font-semibold">{tyre.tpms_rl_id || '—'}</code>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                <span>Переходит:</span>
                {isDirectional ? (
                  <span className="text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                    <ArrowUp className="w-3 h-3" /> ПЛ
                  </span>
                ) : driveType.toLowerCase() === 'fwd' ? (
                  <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> ПП
                  </span>
                ) : (
                  <span className="text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                    <ArrowUp className="w-3 h-3" /> ПЛ
                  </span>
                )}
              </div>
            </div>

            {/* Rear Right (RR) */}
            <div className="border-2 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl p-3 flex flex-col items-center text-center shadow-xs">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                Заднее Правое (ЗП)
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                TPMS: <code className="font-mono font-semibold">{tyre.tpms_rr_id || '—'}</code>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                <span>Переходит:</span>
                {isDirectional ? (
                  <span className="text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                    <ArrowUp className="w-3 h-3" /> ПП
                  </span>
                ) : driveType.toLowerCase() === 'fwd' ? (
                  <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                    <ArrowUpLeft className="w-3 h-3" /> ПЛ
                  </span>
                ) : (
                  <span className="text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                    <ArrowUp className="w-3 h-3" /> ПП
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Direction indicator (Rear of car) */}
          <div className="text-center mt-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-0.5">
              ▼ ЗАДНЯЯ ОСЬ (БАГАЖНИК) ▼
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <RotateCcw className="w-5 h-5 text-sky-600" />
              <h4 className="font-bold text-base">Подтверждение перестановки колес</h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Будет зафиксирован пробег ротации комплекта «{tyre.name}» и сброшен интервал следующей перестановки.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-lg border border-rose-200 dark:border-rose-800">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Пробег автомобиля на момент перестановки ({vehicle.distance_unit}):
                </label>
                <input
                  type="number"
                  value={odometerInput}
                  onChange={(e) => setOdometerInput(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {hasTpms && (
                <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-lg border border-sky-100 dark:border-sky-900/50">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={swapTpms}
                      onChange={(e) => setSwapTpms(e.target.checked)}
                      className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Автоматически поменять местами ID датчиков TPMS
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Сохранит актуальную привязку колес в приложении в соответствии со схемой {scheme.name}.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmRotation}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-[0.98] rounded-lg shadow-sm transition-all"
              >
                {isSubmitting ? 'Сохранение...' : 'Зафиксировать ротацию'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
