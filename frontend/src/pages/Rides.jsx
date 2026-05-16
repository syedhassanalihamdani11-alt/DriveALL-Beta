import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Flag, ChevronRight } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { api, useApp } from '../contexts/AppContext';

export default function Rides() {
  const { t } = useApp();
  const [rides, setRides] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/rides/me/history').then(({ data }) => setRides(data || [])).catch(() => {});
  }, []);

  return (
    <div className="relative w-full h-[100dvh] bg-white dark:bg-ink-950 overflow-hidden flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t('rides')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {rides.length === 0 && (
          <div className="text-center text-ink-500 mt-20" data-testid="rides-empty">{t('no_rides')}</div>
        )}
        {rides.map((r) => (
          <button
            key={r.ride_id}
            data-testid={`history-${r.ride_id}`}
            onClick={() => navigate(`/ride/${r.ride_id}`)}
            className="w-full text-left mt-2 p-4 rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-ink-500">{t(r.status) || r.status}</div>
                <div className="text-brand-600 font-bold">PKR {r.final_price || r.current_price}</div>
              </div>
              <div className="text-sm text-ink-900 dark:text-white truncate flex items-center gap-1 mt-1"><MapPin size={12} /> {r.pickup.label}</div>
              <div className="text-sm text-ink-500 truncate flex items-center gap-1"><Flag size={12} /> {r.drop.label}</div>
              <div className="text-[11px] text-ink-400 mt-1">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <ChevronRight className="text-ink-400" />
          </button>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
