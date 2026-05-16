import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Clock, User, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function BottomNav() {
  const { t } = useApp();
  const items = [
    { to: '/home', icon: Home, label: t('home'), tid: 'nav-home' },
    { to: '/rides', icon: Clock, label: t('rides'), tid: 'nav-rides' },
    { to: '/profile', icon: User, label: t('profile'), tid: 'nav-profile' },
    { to: '/settings', icon: SettingsIcon, label: t('settings'), tid: 'nav-settings' },
  ];
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800 h-16 flex justify-around items-center pb-safe">
      {items.map(({ to, icon: Icon, label, tid }) => (
        <NavLink
          key={to}
          to={to}
          data-testid={tid}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 h-full text-xs ${
              isActive ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-ink-500'
            }`
          }
        >
          <Icon size={22} strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
