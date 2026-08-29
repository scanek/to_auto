import React, { useState, useEffect } from 'react';
import { X, Car } from 'lucide-react';
import { Vehicle } from '../types';

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
    license_plate: '',
    vin: '',
    starting_odometer: 0,
    current_odometer: 0,
    distance_unit: 'km',
    fuel_unit: 'L',
    currency: 'RUB',
    photo_url: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        name: vehicle.name || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        license_plate: vehicle.license_plate || '',
        vin: vehicle.vin || '',
        starting_odometer: vehicle.starting_odometer || 0,
        current_odometer: vehicle.current_odometer || 0,
        distance_unit: vehicle.distance_unit || 'km',
        fuel_unit: vehicle.fuel_unit || 'L',
        currency: vehicle.currency || 'RUB',
        photo_url: vehicle.photo_url || '',
        notes: vehicle.notes || '',
      });
    } else {
      setFormData({
        name: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
        vin: '',
        starting_odometer: 0,
        current_odometer: 0,
        distance_unit: 'km',
        fuel_unit: 'L',
        currency: 'RUB',
        photo_url: '',
        notes: '',
      });
    }
  }, [vehicle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении автомобиля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <Car className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              {vehicle ? 'Редактировать автомобиль' : 'Добавить автомобиль в гараж'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Марка *
              </label>
              <input
                type="text"
                required
                placeholder="Toyota, BMW, VAZ..."
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Модель *
              </label>
              <input
                type="text"
                required
                placeholder="RAV4, 320i, Vesta..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Год выпуска
              </label>
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Госномер
              </label>
              <input
                type="text"
                placeholder="A777AA 777"
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                VIN номер
              </label>
              <input
                type="text"
                placeholder="17 знаков"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Текущий пробег (км) *
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
                    starting_odometer: formData.starting_odometer === 0 ? parseFloat(e.target.value) || 0 : formData.starting_odometer,
                  })
                }
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Название/Прозвище
              </label>
              <input
                type="text"
                placeholder="Мой повседнев, Семейный..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Единицы расстояния
              </label>
              <select
                value={formData.distance_unit}
                onChange={(e) => setFormData({ ...formData, distance_unit: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="km">Километры (км)</option>
                <option value="mi">Мили (mi)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Объем топлива
              </label>
              <select
                value={formData.fuel_unit}
                onChange={(e) => setFormData({ ...formData, fuel_unit: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="L">Литры (L)</option>
                <option value="gal">Галлоны (gal)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Валюта
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="RUB">₽ (RUB)</option>
                <option value="USD">$ (USD)</option>
                <option value="EUR">€ (EUR)</option>
                <option value="KZT">₸ (KZT)</option>
                <option value="BYN">Br (BYN)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ссылка на фото автомобиля (URL)
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Заметки / Комплектация
            </label>
            <textarea
              rows={2}
              placeholder="Двигатель 2.0L, АКПП, цвет черный..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 border-t border-dark-750 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : vehicle ? 'Сохранить изменения' : 'Добавить авто'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
