import React from 'react';
import { Wrench, Plus, Car } from 'lucide-react';
import { Vehicle } from '../types';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (v: Vehicle | null) => void;
  onAddVehicle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  onAddVehicle,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-dark-900/90 backdrop-blur-md border-b border-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectVehicle(null)}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold text-xl">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                AutoTracker
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5">Учет ТО и расходов автомобиля</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {vehicles.length > 0 && (
            <div className="flex items-center bg-dark-850 border border-dark-750 rounded-lg p-1">
              <button
                onClick={() => onSelectVehicle(null)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !selectedVehicle
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>Гараж ({vehicles.length})</span>
                </div>
              </button>
              {selectedVehicle && (
                <div className="flex items-center text-xs text-slate-300 px-2 py-1 bg-dark-800 rounded font-medium border border-dark-700 ml-1">
                  <span className="text-brand-400 mr-1.5">●</span>
                  {selectedVehicle.make} {selectedVehicle.model}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onAddVehicle}
            className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Добавить авто</span>
          </button>
        </div>
      </div>
    </header>
  );
};
