import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import VehicleSelector from '../components/VehicleSelector';
import LocationPicker from '../components/LocationPicker';
import BottomSheet from '../components/BottomSheet';
import { api, useApp } from '../contexts/AppContext';
import { Globe, Moon, Sun, LogOut, Save, Pencil, Plus, Home as HomeIcon, Briefcase, MapPin, Trash2 } from 'lucide-react';

export default function Settings() {
  const { t, language, setLanguage, theme, setTheme, logout, user, setUser } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    village: user?.village || '',
    city: user?.city || '',
    picture: user?.picture || '',
    vehicle_model: user?.vehicle_model || '',
    vehicle_plate: user?.vehicle_plate || '',
    vehicle_type: user?.vehicle_type || 'car',
    cnic: user?.cnic || '',
    license_no: user?.license_no || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingLoc, setAddingLoc] = useState(null); // 'home' | 'work' | 'custom' | null
  const [customLabel, setCustomLabel] = useState('');

  const savedLocs = user?.saved_locations || [];

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', form);
      setUser(data);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 1500);
    } finally { setSaving(false); }
  };

  const addLocation = async (loc) => {
    const label = addingLoc === 'home' ? t('home_label') : addingLoc === 'work' ? t('work_label') : (customLabel || t('custom_label'));
    const next = [...savedLocs.filter((s) => s.label.toLowerCase() !== label.toLowerCase()), { label, lat: loc.lat, lng: loc.lng, address: loc.label }];
    const { data } = await api.patch('/users/me', { saved_locations: next });
    setUser(data);
    setAddingLoc(null);
    setCustomLabel('');
  };

  const removeLocation = async (label) => {
    const next = savedLocs.filter((s) => s.label !== label);
    const { data } = await api.patch('/users/me', { saved_locations: next });
    setUser(data);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-white dark:bg-ink-950 overflow-hidden flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t('settings')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">

        {/* Theme */}
        <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'light' ? <Sun size={18} className="text-ink-700 dark:text-ink-200" /> : <Moon size={18} className="text-ink-700 dark:text-ink-200" />}
            <div>
              <div className="font-medium text-ink-900 dark:text-white">{t('theme')}</div>
              <div className="text-xs text-ink-500">{theme === 'light' ? t('light') : t('dark')}</div>
            </div>
          </div>
          <button
            data-testid="theme-switch"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`h-8 w-14 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-brand-600' : 'bg-ink-200'}`}
          >
            <span className={`absolute top-1 transition-all h-6 w-6 rounded-full bg-white shadow ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {/* Language */}
        <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={18} className="text-ink-700 dark:text-ink-200" />
            <div className="font-medium text-ink-900 dark:text-white">{t('language')}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button data-testid="lang-en" onClick={() => setLanguage('en')} className={`h-11 rounded-xl font-medium ${language === 'en' ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white'}`}>English</button>
            <button data-testid="lang-ur" onClick={() => setLanguage('ur')} className={`h-11 rounded-xl font-medium ${language === 'ur' ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white'}`}>Roman Urdu</button>
          </div>
        </div>

        {/* Saved locations */}
        <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-ink-900 dark:text-white">{t('saved_locations')}</div>
          </div>
          <div className="space-y-2">
            {savedLocs.length === 0 && <div className="text-xs text-ink-500 text-center py-2">—</div>}
            {savedLocs.map((loc, i) => {
              const isHome = loc.label?.toLowerCase() === 'home' || loc.label === t('home_label');
              const isWork = loc.label?.toLowerCase() === 'work' || loc.label === t('work_label');
              const Icon = isHome ? HomeIcon : isWork ? Briefcase : MapPin;
              return (
                <div key={i} data-testid={`settings-saved-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-100 dark:bg-ink-800">
                  <Icon size={16} className="text-brand-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-900 dark:text-white">{loc.label}</div>
                    <div className="text-[11px] text-ink-500 truncate">{loc.address}</div>
                  </div>
                  <button data-testid={`remove-saved-${i}`} onClick={() => removeLocation(loc.label)} className="text-red-500 p-1"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button data-testid="add-home-btn" onClick={() => setAddingLoc('home')} className="h-10 rounded-xl bg-ink-100 dark:bg-ink-800 text-xs font-semibold text-ink-700 dark:text-white inline-flex items-center justify-center gap-1"><HomeIcon size={12} /> {t('home_label')}</button>
            <button data-testid="add-work-btn" onClick={() => setAddingLoc('work')} className="h-10 rounded-xl bg-ink-100 dark:bg-ink-800 text-xs font-semibold text-ink-700 dark:text-white inline-flex items-center justify-center gap-1"><Briefcase size={12} /> {t('work_label')}</button>
            <button data-testid="add-custom-btn" onClick={() => setAddingLoc('custom')} className="h-10 rounded-xl bg-ink-100 dark:bg-ink-800 text-xs font-semibold text-ink-700 dark:text-white inline-flex items-center justify-center gap-1"><Plus size={12} /> {t('custom_label')}</button>
          </div>
        </div>

        {/* Profile */}
        <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold text-xl">
              {form.picture ? (
                <img src={form.picture} alt="me" className="h-full w-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-ink-900 dark:text-white">{t('profile')}</div>
              <label className="text-xs text-brand-600 font-medium cursor-pointer inline-flex items-center gap-1">
                <input
                  data-testid="profile-pic-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setForm((cur) => ({ ...cur, picture: String(r.result) }));
                    r.readAsDataURL(f);
                  }}
                />
                <Pencil size={12} /> Upload photo
              </label>
            </div>
            <button data-testid="profile-edit-toggle" onClick={() => setEditing((e) => !e)} className="text-sm text-brand-600 inline-flex items-center gap-1">
              <Pencil size={14} /> {editing ? t('cancel') : 'Edit'}
            </button>
          </div>
          <Field label={t('full_name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} disabled={!editing} testId="set-name" />
          <Field label={t('phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} disabled={!editing} testId="set-phone" />
          <Field label={t('village')} value={form.village} onChange={(v) => setForm({ ...form, village: v })} disabled={!editing} testId="set-village" />
          <Field label={t('city')} value={form.city} onChange={(v) => setForm({ ...form, city: v })} disabled={!editing} testId="set-city" />
          <Field label={t('profile_picture')} value={form.picture} onChange={(v) => setForm({ ...form, picture: v })} disabled={!editing} testId="set-picture" />
          {user?.role === 'driver' && (
            <>
              <div className="mt-2 text-xs text-ink-500">{t('your_vehicle')}</div>
              {editing ? (
                <div className="mt-1"><VehicleSelector value={form.vehicle_type} onChange={(v) => setForm({ ...form, vehicle_type: v })} lang={language} testIdPrefix="set-vtype" /></div>
              ) : (
                <div className="mt-1 text-sm font-medium text-ink-900 dark:text-white">{form.vehicle_type}</div>
              )}
              <Field label={t('vehicle_model')} value={form.vehicle_model} onChange={(v) => setForm({ ...form, vehicle_model: v })} disabled={!editing} testId="set-vmodel" />
              <Field label={t('vehicle_plate')} value={form.vehicle_plate} onChange={(v) => setForm({ ...form, vehicle_plate: v })} disabled={!editing} testId="set-vplate" />
              <Field label={t('cnic')} value={form.cnic} onChange={(v) => setForm({ ...form, cnic: v })} disabled={!editing} testId="set-cnic" />
              <Field label={t('license')} value={form.license_no} onChange={(v) => setForm({ ...form, license_no: v })} disabled={!editing} testId="set-license" />
            </>
          )}
          {editing && (
            <button
              data-testid="settings-save-btn"
              onClick={save}
              disabled={saving}
              className="mt-2 w-full h-12 rounded-xl bg-brand-600 text-white font-semibold inline-flex items-center justify-center gap-2"
            >
              <Save size={16} /> {saving ? '...' : t('save_continue')}
            </button>
          )}
          {saved && <div className="text-xs text-brand-600 mt-2 text-center">{t('saved')}</div>}
        </div>

        <button
          data-testid="logout-btn"
          onClick={logout}
          className="w-full h-12 rounded-xl bg-red-500/10 text-red-500 font-semibold inline-flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> {t('logout')}
        </button>
      </div>

      {/* Add location sheet */}
      <BottomSheet open={addingLoc !== null} onClose={() => setAddingLoc(null)} testId="add-loc-sheet">
        <div className="h-[70vh]">
          {addingLoc === 'custom' && (
            <div className="mb-3">
              <label className="text-xs text-ink-500">{t('custom_label')}</label>
              <input
                data-testid="custom-label-input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Mom's house"
                className="mt-1 w-full h-11 px-3 rounded-xl bg-ink-100 dark:bg-ink-800 outline-none text-ink-900 dark:text-white"
              />
            </div>
          )}
          {addingLoc !== null && (
            <LocationPicker
              title={addingLoc === 'home' ? t('home_label') : addingLoc === 'work' ? t('work_label') : t('add_location')}
              onSelect={addLocation}
              onClose={() => setAddingLoc(null)}
            />
          )}
        </div>
      </BottomSheet>

      <BottomNav />
    </div>
  );
}

function Field({ label, value, onChange, disabled, testId }) {
  return (
    <label className="block mb-2">
      <span className="block text-xs text-ink-500 mb-1">{label}</span>
      <input
        data-testid={testId}
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-xl bg-ink-100 dark:bg-ink-800 outline-none text-ink-900 dark:text-white disabled:opacity-70"
      />
    </label>
  );
}
