import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, User as UserIcon, ChevronRight } from 'lucide-react';
import Logo from '../components/Logo';
import VehicleSelector from '../components/VehicleSelector';
import { api, useApp } from '../contexts/AppContext';

export default function Onboarding() {
  const { t, user, setUser, language, setLanguage } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(user?.role ? 1 : 0);
  const [role, setRole] = useState(user?.role || null);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    village: user?.village || '',
    city: user?.city || '',
    vehicle_model: user?.vehicle_model || '',
    vehicle_plate: user?.vehicle_plate || '',
    vehicle_type: user?.vehicle_type || 'car',
    cnic: user?.cnic || '',
    license_no: user?.license_no || '',
  });
  const [saving, setSaving] = useState(false);

  const pickRole = async (r) => {
    setRole(r);
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', { role: r });
      setUser(data);
      setStep(1);
    } finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', { ...form });
      setUser(data);
      navigate('/home', { replace: true });
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-ink-950 flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <div className="font-display font-semibold text-lg text-ink-900 dark:text-white">DriveAll</div>
        </div>
        <button
          data-testid="lang-toggle-onboarding"
          onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
          className="text-xs px-3 py-1.5 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-100"
        >
          {language === 'en' ? 'Roman Urdu' : 'English'}
        </button>
      </div>

      {step === 0 && (
        <div className="px-6 mt-10">
          <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t('choose_role')}</h1>
          <p className="text-ink-500 text-sm mt-2">{t('select_role_to_continue')}</p>

          <div className="mt-8 space-y-4">
            <RoleCard
              icon={UserIcon}
              title={t('rider')}
              subtitle={t('rider_desc')}
              onClick={() => pickRole('rider')}
              testId="role-rider"
              disabled={saving}
            />
            <RoleCard
              icon={Car}
              title={t('driver')}
              subtitle={t('driver_desc')}
              onClick={() => pickRole('driver')}
              testId="role-driver"
              disabled={saving}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="px-6 pb-10 mt-8 flex-1 overflow-y-auto">
          <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t('profile_setup')}</h2>
          <p className="text-ink-500 text-sm mt-1">{t('your_role')}: <span className="text-brand-600 font-medium">{role === 'driver' ? t('driver') : t('rider')}</span></p>

          <div className="mt-6 space-y-3">
            <Field label={t('full_name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="onb-name" />
            <Field label={t('phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testId="onb-phone" placeholder="+923xxxxxxxxx" />
            <Field label={t('village')} value={form.village} onChange={(v) => setForm({ ...form, village: v })} testId="onb-village" />
            <Field label={t('city')} value={form.city} onChange={(v) => setForm({ ...form, city: v })} testId="onb-city" />

            {role === 'driver' && (
              <>
                <div className="pt-3 text-xs font-semibold uppercase tracking-wider text-ink-500">{t('vehicle_info')}</div>
                <div className="text-xs text-ink-500 mb-1">{t('your_vehicle')}</div>
                <VehicleSelector value={form.vehicle_type} onChange={(v) => setForm({ ...form, vehicle_type: v })} testIdPrefix="onb-vtype" />
                <Field label={t('vehicle_model')} value={form.vehicle_model} onChange={(v) => setForm({ ...form, vehicle_model: v })} testId="onb-vmodel" />
                <Field label={t('vehicle_plate')} value={form.vehicle_plate} onChange={(v) => setForm({ ...form, vehicle_plate: v })} testId="onb-vplate" />
                <Field label={t('cnic')} value={form.cnic} onChange={(v) => setForm({ ...form, cnic: v })} testId="onb-cnic" />
                <Field label={t('license')} value={form.license_no} onChange={(v) => setForm({ ...form, license_no: v })} testId="onb-license" />
              </>
            )}
          </div>

          <button
            data-testid="onb-save-btn"
            disabled={saving || !form.name || !form.phone}
            onClick={save}
            className="mt-8 w-full h-14 rounded-xl bg-brand-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
          >
            {t('save_continue')} <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function RoleCard({ icon: Icon, title, subtitle, onClick, testId, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="w-full flex items-center gap-4 p-5 rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-left hover:border-brand-600"
    >
      <div className="h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
        <Icon size={28} />
      </div>
      <div className="flex-1">
        <div className="font-display font-semibold text-lg text-ink-900 dark:text-white">{title}</div>
        <div className="text-ink-500 text-sm mt-0.5">{subtitle}</div>
      </div>
      <ChevronRight className="text-ink-400" />
    </motion.button>
  );
}

function Field({ label, value, onChange, testId, placeholder }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-500 mb-1">{label}</span>
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 rounded-xl bg-ink-100 dark:bg-ink-800 border border-transparent focus:border-brand-600 focus:bg-white dark:focus:bg-ink-900 outline-none text-ink-900 dark:text-white"
      />
    </label>
  );
}
