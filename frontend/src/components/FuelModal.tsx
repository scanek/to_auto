import React, { useState, useEffect } from 'react';
import { X, Fuel, Calculator } from 'lucide-react';
import { FuelLog, Vehicle } from '../types';
import { api } from '../services/api';

interface FuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<FuelLog>) => Promise<void>;
  log?: FuelLog | null;
  vehicle: Vehicle;
}

export const FuelModal: React.FC<FuelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  log,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    odometer: vehicle.current_odometer || 0,
    fuel_amount: 40,
    total_cost: 2400,
    unit_price: 60,
    is_full_tank: true,
    is_missed: false,
    fuel_grade: 'АИ-95',
    gas_station: '',
    notes: '',
  });

  // String inputs for smooth decimal/comma typing on mobile and desktop
  const [amountInput, setAmountInput] = useState<string>('40');
  const [unitPriceInput, setUnitPriceInput] = useState<string>('60');
  const [totalCostInput, setTotalCostInput] = useState<string>('2400');

  // Which field is currently auto-calculated ('amount' | 'price' | 'total')
  const [calculatedTarget, setCalculatedTarget] = useState<'amount' | 'price' | 'total'>('total');
  // Last edited field by user
  const [lastEdited, setLastEdited] = useState<'amount' | 'price' | 'total'>('amount');

  const [loading, setLoading] = useState(false);

  const round2 = (num: number) => Math.round(num * 100) / 100;

  useEffect(() => {
    if (log) {
      const initialAmt = log.fuel_amount || 0;
      const initialPrc = log.unit_price || 0;
      const initialTot = log.total_cost || 0;

      setFormData({
        date: log.date.split('T')[0],
        odometer: log.odometer,
        fuel_amount: initialAmt,
        total_cost: initialTot,
        unit_price: initialPrc,
        is_full_tank: log.is_full_tank,
        is_missed: log.is_missed,
        fuel_grade: log.fuel_grade || 'АИ-95',
        gas_station: log.gas_station || '',
        notes: log.notes || '',
      });
      setAmountInput(String(initialAmt));
      setUnitPriceInput(String(initialPrc));
      setTotalCostInput(String(initialTot));
      setLastEdited('amount');
      setCalculatedTarget('total');
    } else if (isOpen) {
      const defaultAmt = 40;
      const defaultPrc = 60;
      const defaultTot = 2400;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        odometer: vehicle.current_odometer || 0,
        fuel_amount: defaultAmt,
        total_cost: defaultTot,
        unit_price: defaultPrc,
        is_full_tank: true,
        is_missed: false,
        fuel_grade: 'АИ-95',
        gas_station: '',
        notes: '',
      });
      setAmountInput(String(defaultAmt));
      setUnitPriceInput(String(defaultPrc));
      setTotalCostInput(String(defaultTot));
      setLastEdited('amount');
      setCalculatedTarget('total');

      // Pre-fill smart defaults from user's last fuel log for this car
      if (vehicle?.id) {
        api.getFuelLogs(vehicle.id).then((logs) => {
          if (logs && logs.length > 0) {
            const last = logs[0];
            const prc = last.unit_price || defaultPrc;
            const tot = round2(defaultAmt * prc);

            setFormData((prev) => ({
              ...prev,
              fuel_grade: last.fuel_grade || prev.fuel_grade,
              gas_station: last.gas_station || prev.gas_station,
              unit_price: prc,
              total_cost: tot,
            }));
            setUnitPriceInput(String(prc));
            setTotalCostInput(String(tot));
          }
        }).catch((err) => console.warn('Could not fetch last fuel log for defaults', err));
      }
    }
  }, [log, isOpen, vehicle]);

  if (!isOpen) return null;

  const handleFieldChange = (field: 'amount' | 'price' | 'total', rawValue: string) => {
    // Normalize comma to dot for Russian mobile keyboards, allow numbers & decimal point
    const normalized = rawValue.replace(',', '.');
    if (normalized !== '' && !/^[0-9]*\.?[0-9]*$/.test(normalized)) {
      return;
    }

    // Determine auto-calculated target:
    // If user edits the current calculatedTarget, switch target to the third untouched field
    let newTarget = calculatedTarget;
    if (field === calculatedTarget) {
      if (field === 'amount') {
        newTarget = lastEdited === 'price' ? 'total' : 'price';
      } else if (field === 'price') {
        newTarget = lastEdited === 'amount' ? 'total' : 'amount';
      } else if (field === 'total') {
        newTarget = lastEdited === 'amount' ? 'price' : 'amount';
      }
      setCalculatedTarget(newTarget);
    }
    setLastEdited(field);

    let amt = field === 'amount' ? parseFloat(normalized) || 0 : parseFloat(amountInput) || 0;
    let prc = field === 'price' ? parseFloat(normalized) || 0 : parseFloat(unitPriceInput) || 0;
    let tot = field === 'total' ? parseFloat(normalized) || 0 : parseFloat(totalCostInput) || 0;

    if (field === 'amount') setAmountInput(normalized);
    if (field === 'price') setUnitPriceInput(normalized);
    if (field === 'total') setTotalCostInput(normalized);

    // 3-way recalculation
    if (newTarget === 'amount') {
      if (prc > 0 && tot > 0) {
        const calculatedAmt = round2(tot / prc);
        setAmountInput(String(calculatedAmt));
        amt = calculatedAmt;
      }
    } else if (newTarget === 'price') {
      if (amt > 0 && tot > 0) {
        const calculatedPrc = round2(tot / amt);
        setUnitPriceInput(String(calculatedPrc));
        prc = calculatedPrc;
      }
    } else if (newTarget === 'total') {
      if (amt > 0 && prc > 0) {
        const calculatedTot = round2(amt * prc);
        setTotalCostInput(String(calculatedTot));
        tot = calculatedTot;
      }
    }

    setFormData((prev) => ({
      ...prev,
      fuel_amount: amt,
      unit_price: prc,
      total_cost: tot,
    }));
  };

  const handleCalculate = (target: 'amount' | 'price' | 'total') => {
    setCalculatedTarget(target);
    let amt = parseFloat(amountInput) || 0;
    let prc = parseFloat(unitPriceInput) || 0;
    let tot = parseFloat(totalCostInput) || 0;

    if (target === 'amount') {
      if (prc > 0 && tot > 0) {
        amt = round2(tot / prc);
        setAmountInput(String(amt));
      }
    } else if (target === 'price') {
      if (amt > 0 && tot > 0) {
        prc = round2(tot / amt);
        setUnitPriceInput(String(prc));
      }
    } else if (target === 'total') {
      if (amt > 0 && prc > 0) {
        tot = round2(amt * prc);
        setTotalCostInput(String(tot));
      }
    }

    setFormData((prev) => ({
      ...prev,
      fuel_amount: amt,
      unit_price: prc,
      total_cost: tot,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalAmount = parseFloat(amountInput) || formData.fuel_amount || 0;
      const finalPrice = parseFloat(unitPriceInput) || formData.unit_price || 0;
      const finalTotal = parseFloat(totalCostInput) || formData.total_cost || 0;

      await onSave({
        ...formData,
        fuel_amount: finalAmount,
        unit_price: finalPrice,
        total_cost: finalTotal,
        date: new Date(formData.date).toISOString(),
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении заправки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-750">
          <div className="flex items-center space-x-2">
            <Fuel className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {log ? 'Редактировать заправку' : 'Добавить заправку'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Дата заправки *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Текущий одометр ({vehicle.distance_unit}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.odometer}
                onChange={(e) =>
                  setFormData({ ...formData, odometer: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-50 dark:bg-dark-900/80 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                  Объем ({vehicle.fuel_unit}) *
                </label>
                {calculatedTarget === 'amount' ? (
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold bg-brand-500/10 px-1 py-0.5 rounded border border-brand-500/20" title="Вычисляется автоматически">
                    авто
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCalculate('amount')}
                    title="Рассчитать литры из суммы и цены"
                    className="text-[10px] text-slate-400 hover:text-brand-500 font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Calculator className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amountInput}
                onChange={(e) => handleFieldChange('amount', e.target.value)}
                className={`w-full bg-white dark:bg-dark-850 border rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none font-mono font-semibold transition ${
                  calculatedTarget === 'amount'
                    ? 'border-brand-500 ring-1 ring-brand-500/30'
                    : 'border-slate-300 dark:border-dark-700 focus:border-brand-500'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                  Цена за {vehicle.fuel_unit}
                </label>
                {calculatedTarget === 'price' ? (
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold bg-brand-500/10 px-1 py-0.5 rounded border border-brand-500/20" title="Вычисляется автоматически">
                    авто
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCalculate('price')}
                    title="Рассчитать цену за литр из суммы и объема"
                    className="text-[10px] text-slate-400 hover:text-brand-500 font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Calculator className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={unitPriceInput}
                onChange={(e) => handleFieldChange('price', e.target.value)}
                className={`w-full bg-white dark:bg-dark-850 border rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none font-mono font-semibold transition ${
                  calculatedTarget === 'price'
                    ? 'border-brand-500 ring-1 ring-brand-500/30'
                    : 'border-slate-300 dark:border-dark-700 focus:border-brand-500'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                  Сумма ({vehicle.currency}) *
                </label>
                {calculatedTarget === 'total' ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20" title="Вычисляется автоматически">
                    авто
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCalculate('total')}
                    title="Рассчитать сумму из объема и цены"
                    className="text-[10px] text-slate-400 hover:text-emerald-500 font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Calculator className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                required
                value={totalCostInput}
                onChange={(e) => handleFieldChange('total', e.target.value)}
                className={`w-full bg-white dark:bg-dark-850 border rounded-xl px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none font-mono transition ${
                  calculatedTarget === 'total'
                    ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                    : 'border-emerald-500/50 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Марка топлива
              </label>
              <input
                type="text"
                placeholder="АИ-95, АИ-98, ДТ, 100..."
                value={formData.fuel_grade}
                onChange={(e) => setFormData({ ...formData, fuel_grade: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['АИ-95', 'АИ-95+', 'АИ-92', 'АИ-98', 'АИ-100', 'ДТ'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, fuel_grade: g }))}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                      formData.fuel_grade === g
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-dark-750 hover:bg-slate-200 dark:hover:bg-dark-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                АЗС / Сеть
              </label>
              <input
                type="text"
                placeholder="Лукойл, Газпромнефть, Teboil..."
                value={formData.gas_station}
                onChange={(e) => setFormData({ ...formData, gas_station: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['Лукойл', 'Газпромнефть', 'Роснефть', 'Татнефть', 'Teboil', 'Башнефть'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, gas_station: st }))}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                      formData.gas_station === st
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-dark-750 hover:bg-slate-200 dark:hover:bg-dark-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-750">
            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_full_tank}
                onChange={(e) => setFormData({ ...formData, is_full_tank: e.target.checked })}
                className="rounded bg-white dark:bg-dark-800 border-slate-300 dark:border-dark-750 text-brand-500 focus:ring-0 w-4 h-4"
              />
              <span>Полный бак (для расчета л/100км)</span>
            </label>

            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer" title="Отметьте, если это первая заправка или вы пропустили прошлые чеки. Расход начнется заново с этой точки.">
              <input
                type="checkbox"
                checked={formData.is_missed}
                onChange={(e) => setFormData({ ...formData, is_missed: e.target.checked })}
                className="rounded bg-white dark:bg-dark-800 border-slate-300 dark:border-dark-750 text-brand-500 focus:ring-0 w-4 h-4"
              />
              <span>Точка отсчёта (сброс / первая)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Заметки
            </label>
            <input
              type="text"
              placeholder="Трасса / Город, кондиционер..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
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
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : log ? 'Сохранить изменения' : 'Записать заправку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
