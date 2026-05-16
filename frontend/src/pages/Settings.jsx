import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import { api, useApp } from '../contexts/AppContext';
import { Globe, Moon, Sun, LogOut, Save, Pencil } from 'lucide-react';

export default function Settings() {
  const { t, language, setLanguage, theme, setTheme, logout, user, setUser } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    village: user?.village || '',
    city: user?.city || '',
    vehicle_model: user?.vehicle_model || '',
    vehicle_plate: user?.vehicle_plate || '',
    cnic: user?.cnic || '',
    license_no: user?.license_no || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="relative w-full h-[100dvh] bg-white dark:bg-ink-950 overflow-hidden flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t('settings')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">
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

        <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={18} className="text-ink-700 dark:text-ink-200" />
            <div className="font-medium text-ink-900 dark:text-white">{t('language')}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid="lang-en"
              onClick={() => setLanguage('en')}
              className={`h-11 rounded-xl font-medium ${language === 'en' ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white'}`}
            >English</button>
            <button
              data-testid="lang-ur"
              onClick={() => setLanguage('ur')}
              className={`h-11 rounded-xl font-medium ${language === 'ur' ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white'}`}
            >Roman Urdu</button>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 dark:border-ink-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-ink-900 dark:text-white">{t('profile')}</div>
            <button data-testid="profile-edit-toggle" onClick={() => setEditing((e) => !e)} className="text-sm text-brand-600 inline-flex items-center gap-1">
              <Pencil size={14} /> {editing ? t('cancel') : 'Edit'}
            </button>
          </div>
          <Field label={t('full_name')} value={form.name} onChange={(v) => setForm({...form, name: v})} disabled={!editing} testId="set-name" />
          <Field label={t('phone')} value={form.phone} onChange={(v) => setForm({...form, phone: v})} disabled={!editing} testId="set-phone" />
          <Field label={t('village')} value={form.village} onChange={(v) => setForm({...form, village: v})} disabled={!editing} testId="set-village" />
          <Field label={t('city')} value={form.city} onChange={(v) => setForm({...form, city: v})} disabled={!editing} testId="set-city" />
          {user?.role === 'driver' && (
            <>
              <Field label={t('vehicle_model')} value={form.vehicle_model} onChange={(v) => setForm({...form, vehicle_model: v})} disabled={!editing} testId="set-vmodel" />
              <Field label={t('vehicle_plate')} value={form.vehicle_plate} onChange={(v) => setForm({...form, vehicle_plate: v})} disabled={!editing} testId="set-vplate" />
              <Field label={t('cnic')} value={form.cnic} onChange={(v) => setForm({...form, cnic: v})} disabled={!editing} testId="set-cnic" />
              <Field label={t('license')} value={form.license_no} onChange={(v) => setForm({...form, license_no: v})} disabled={!editing} testId="set-license" />
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
