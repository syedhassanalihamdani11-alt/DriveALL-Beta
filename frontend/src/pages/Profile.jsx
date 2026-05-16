import React from 'react';
import { useApp } from '../contexts/AppContext';
import BottomNav from '../components/BottomNav';
import { Star, MapPin, Car, BadgeCheck } from 'lucide-react';

export default function Profile() {
  const { t, user } = useApp();
  if (!user) return null;
  return (
    <div className="relative w-full h-[100dvh] bg-white dark:bg-ink-950 overflow-hidden flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t('profile')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-brand-50 dark:bg-brand-900/30 overflow-hidden flex items-center justify-center text-brand-600 font-bold text-2xl">
            {user.picture ? (
              <img src={user.picture} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              user.name?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-xl text-ink-900 dark:text-white" data-testid="profile-name">{user.name}</div>
            <div className="text-sm text-ink-500">{user.email}</div>
            <div className="text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium">
              <BadgeCheck size={12} /> {user.role === 'driver' ? t('driver') : t('rider')}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={<Star size={16} />} label="Rating" value={user.rating?.toFixed(1) || '5.0'} />
          <Stat icon={<MapPin size={16} />} label="Village" value={user.village || '—'} />
          <Stat icon={<MapPin size={16} />} label="City" value={user.city || '—'} />
        </div>

        {user.role === 'driver' && (
          <div className="mt-6 rounded-2xl border border-ink-200 dark:border-ink-800 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-ink-500">{t('earnings')}</div>
              <Car size={16} className="text-ink-400" />
            </div>
            <div className="font-display text-3xl font-bold text-brand-600 mt-1" data-testid="profile-earnings">PKR {user.earnings?.toLocaleString() || 0}</div>
            <div className="mt-3 text-sm text-ink-700 dark:text-ink-200">
              <Row k={t('vehicle_model')} v={user.vehicle_model} />
              <Row k={t('vehicle_plate')} v={user.vehicle_plate} />
              <Row k={t('cnic')} v={user.cnic} />
              <Row k={t('license')} v={user.license_no} />
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-ink-200 dark:border-ink-800 p-4 text-sm">
          <Row k={t('phone')} v={user.phone} />
          <Row k={t('village')} v={user.village} />
          <Row k={t('city')} v={user.city} />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-3">
      <div className="text-ink-500 flex items-center gap-1 text-xs">{icon} {label}</div>
      <div className="font-display font-semibold mt-1 truncate text-ink-900 dark:text-white">{value}</div>
    </div>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-ink-500">{k}</span>
      <span className="text-ink-900 dark:text-white font-medium">{v || '—'}</span>
    </div>
  );
}
