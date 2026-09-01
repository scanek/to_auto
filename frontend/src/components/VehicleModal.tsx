import React, { useState, useEffect } from 'react';
import { X, Car, Upload, Image as ImageIcon, Globe, Lock, Calendar, Gauge, Fuel } from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../services/api';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Vehicle>) => Promise<void>;
  vehicle?: Vehicle | null;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    engine: '',
    oil_spec: '',
    license_plate: '',
    vin: '',
    is_public: false,
    purchase_date: '',
    starting_odometer: 0,
    current_odometer: 0,
    current_engine_hours: 0,
        track_engine_hours: true,
    distance_unit: 'km',
    fuel_unit: 'L',
        fuel_tank_capacity: 55,
    currency: 'RUB',
    photo_url: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        name: vehicle.name || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        engine: vehicle.engine || '',
        oil_spec: vehicle.oil_spec || '',
        license_plate: vehicle.license_plate || '',
        vin: vehicle.vin || '',
        is_public: vehicle.is_public ?? false,
        purchase_date: vehicle.purchase_date ? vehicle.purchase_date.split('T')[0] : (vehicle.created_at ? vehicle.created_at.split('T')[0] : ''),
        starting_odometer: vehicle.starting_odometer ?? 0,
        current_odometer: vehicle.current_odometer ?? 0,
        current_engine_hours: vehicle.current_engine_hours ?? 0,
        track_engine_hours: vehicle.track_engine_hours ?? true,
        distance_unit: vehicle.distance_unit || 'km',
        fuel_unit: vehicle.fuel_unit || 'L',
        fuel_tank_capacity: vehicle.fuel_tank_capacity ?? 55,
        currency: vehicle.currency || 'RUB',
        photo_url: vehicle.photo_url || '',
        notes: vehicle.notes || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        name: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        engine: '',
        oil_spec: '',
        license_plate: '',
        vin: '',
        is_public: false,
        purchase_date: today,
        starting_odometer: 0,
        current_odometer: 0,
        current_engine_hours: 0,
        track_engine_hours: true,
        distance_unit: 'km',
        fuel_unit: 'L',
        fuel_tank_capacity: 55,
        currency: 'RUB',
        photo_url: '',
        notes: '',
      });
    }
  }, [vehicle, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const res = await api.uploadPhoto(file);
      setFormData((prev) => ({ ...prev, photo_url: res.url }));
    } catch (err) {
      alert('Ошибка при загрузке фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : undefined,
        starting_odometer: parseFloat(String(formData.starting_odometer)) || 0,
        current_odometer: parseFloat(String(formData.current_odometer)) || 0,
        current_engine_hours: parseFloat(String(formData.current_engine_hours)) || 0,
        fuel_tank_capacity: parseFloat(String(formData.fuel_tank_capacity)) || 55,
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении автомобиля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-750">
          <div className="flex items-center space-x-2">
            <Car className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {vehicle ? 'Редактировать автомобиль' : 'Добавить автомобиль в гараж'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Photo upload from PC / Device */}
          <div className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 p-4 rounded-xl space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Фотография автомобиля
            </label>
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                {formData.photo_url ? (
                  <img
                    src={formData.photo_url}
                    alt="Предпросмотр"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <label className="cursor-pointer inline-flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>{uploadingPhoto ? 'Загрузка...' : 'Загрузить с ПК / Телефона'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
                <div className="text-[11px] text-slate-400">
                  или укажите прямую ссылку ниже:
                </div>
                <input
                  type="text"
                  placeholder="https://... или /uploads/..."
                  value={formData.photo_url}
                  onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Марка *
              </label>
              <input
                type="text"
                required
                placeholder="Changan, Toyota, BMW..."
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Модель *
              </label>
              <input
                type="text"
                required
                placeholder="CS55 Plus, RAV4, 320i..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Год выпуска
              </label>
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Госномер
              </label>
              <input
                type="text"
                placeholder="А381РН252"
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 uppercase font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Двигатель / КПП
              </label>
              <input
                type="text"
                placeholder="1.5T 7DCT"
                value={formData.engine}
                onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* PURCHASE DETAILS: Date of purchase and Starting Odometer */}
          <div className="bg-slate-50 dark:bg-dark-900/80 border border-slate-200 dark:border-dark-750 p-4 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-brand-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Момент покупки и ввода в эксплуатацию
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Служит базовой точкой отсчета для сервисной книжки, регламентов ТО и расчета общей статистики.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Дата покупки / регистрации
                </label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Пробег при покупке ({formData.distance_unit})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0 для нового авто"
                  value={formData.starting_odometer}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      starting_odometer: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          {/* CURRENT ODOMETER & ENGINE HOURS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Текущий пробег ({formData.distance_unit}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.current_odometer}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    current_odometer: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-bold"
              />
            </div>
            {formData.track_engine_hours ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Текущие моточасы (м/ч)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Например 800"
                  value={formData.current_engine_hours || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      current_engine_hours: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>
            ) : (
              <div className="flex items-center">
                <span className="text-xs text-slate-400 italic">Учет моточасов отключен</span>
              </div>
            )}
          </div>

          {/* ENGINE HOURS TOGGLE */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-dark-900/90 rounded-2xl border border-slate-200 dark:border-dark-750">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Учитывать моточасы двигателя (м/ч)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Включает учет наработки в карточке, ТО и регламентах обслуживания
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={formData.track_engine_hours}
                onChange={(e) => setFormData({ ...formData, track_engine_hours: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-dark-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Спецификация масла
              </label>
              <input
                type="text"
                placeholder="SAE 0W-20 SP / C5 (4.2 - 4.5 л)"
                value={formData.oil_spec}
                onChange={(e) => setFormData({ ...formData, oil_spec: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                VIN номер
              </label>
              <input
                type="text"
                placeholder="17 знаков..."
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 uppercase font-mono"
              />
            </div>
          </div>

          {/* FUEL TANK & UNITS */}
          <div className="bg-slate-50 dark:bg-dark-900/80 border border-slate-200 dark:border-dark-750 p-4 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2">
              <Fuel className="w-4 h-4 text-sky-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Топливный бак и единицы измерений
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Объем топливного бака (л)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="55"
                  value={formData.fuel_tank_capacity || ''}
                  onChange={(e) => setFormData({ ...formData, fuel_tank_capacity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Для точного пересчета остатка топлива со StarLine в литры
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Основная валюта
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="RUB">₽ (RUB)</option>
                  <option value="USD">$ (USD)</option>
                  <option value="EUR">€ (EUR)</option>
                  <option value="KZT">₸ (KZT)</option>
                  <option value="BYN">Br (BYN)</option>
                  <option value="UAH">₴ (UAH)</option>
                  <option value="KGS">с (KGS)</option>
                  <option value="GEL">₾ (GEL)</option>
                  <option value="AMD">֏ (AMD)</option>
                  <option value="UZS">so'm (UZS)</option>
                  <option value="AZN">₼ (AZN)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Единицы расстояния
                </label>
                <select
                  value={formData.distance_unit}
                  onChange={(e) => setFormData({ ...formData, distance_unit: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="km">Километры (км)</option>
                  <option value="mi">Мили (mi)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ед. топлива
                </label>
                <select
                  value={formData.fuel_unit}
                  onChange={(e) => setFormData({ ...formData, fuel_unit: e.target.value })}
                  className="w-full bg-white dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="L">Литры (L)</option>
                  <option value="gal">Галлоны (gal)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Заметки / Описание
            </label>
            <textarea
              rows={2}
              placeholder="Дополнительные заметки..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-300 dark:border-dark-750 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Privacy Switch (Public / Private) */}
          <div className="p-3.5 bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  formData.is_public
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-200 dark:bg-dark-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-dark-700'
                }`}
              >
                {formData.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <span>{formData.is_public ? '🌐 Публичный автомобиль (показывать на главной)' : '🔒 Личный автомобиль (скрыт)'}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {formData.is_public
                    ? 'Автомобиль отображается гостям на главной странице и в общем каталоге в режиме «только чтение»'
                    : 'Автомобиль виден исключительно вам в вашем личном гараже'}
                </div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-dark-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-dark-750 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : vehicle ? 'Сохранить изменения' : 'Добавить авто'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
