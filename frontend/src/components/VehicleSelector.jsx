import React, { useEffect, useState } from 'react';
import { Bike, Car, Package, Truck } from 'lucide-react';
import { api } from '../contexts/AppContext';

// Rickshaw custom icon (tuk-tuk silhouette)
function RickshawIcon({ size = 22, strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17h2l1-7h11l1 4h3v3h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M6 10l1-3h6l2 3" />
    </svg>
  );
}

const ICON_MAP = { bike: Bike, car: Car, rickshaw: RickshawIcon, parcel: Package, transport: Truck };

export function useVehicles() {
  const [vehicles, setVehicles] = useState([]);
  useEffect(() => {
    api.get('/config/vehicles').then(({ data }) => setVehicles(data || [])).catch(() => {});
  }, []);
  return vehicles;
}

export default function VehicleSelector({ value, onChange, lang = 'en', testIdPrefix = 'vehicle' }) {
  const vehicles = useVehicles();
  const cols = vehicles.length <= 4 ? 'grid-cols-4' : 'grid-cols-5';
  return (
    <div className={`grid ${cols} gap-2`} data-testid="vehicle-selector">
      {vehicles.map((v) => {
        const Icon = ICON_MAP[v.key] || Car;
        const active = value === v.key;
        return (
          <button
            key={v.key}
            data-testid={`${testIdPrefix}-${v.key}`}
            onClick={() => onChange(v.key)}
            className={`flex flex-col items-center justify-center py-3 rounded-2xl border transition-all ${
              active
                ? 'bg-brand-600 text-white border-brand-600 shadow-floating'
                : 'bg-white dark:bg-ink-800 text-ink-700 dark:text-white border-ink-200 dark:border-ink-700'
            }`}
          >
            <Icon size={22} strokeWidth={2} />
            <span className="mt-1 text-[11px] font-semibold leading-none">{lang === 'ur' ? v.label_ur : v.label}</span>
            <span className={`text-[10px] mt-0.5 leading-none ${active ? 'text-white/80' : 'text-ink-500'}`}>{v.base}+</span>
          </button>
        );
      })}
    </div>
  );
}
