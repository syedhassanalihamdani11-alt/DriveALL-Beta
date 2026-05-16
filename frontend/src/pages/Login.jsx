import React from 'react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';
import { useApp } from '../contexts/AppContext';
import { Globe, Moon, Sun } from 'lucide-react';

export default function Login() {
  const { t, language, setLanguage, theme, setTheme } = useApp();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogle = () => {
    const redirectUrl = window.location.origin + '/home';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="relative w-full min-h-[100dvh] bg-gradient-to-b from-brand-50 via-white to-white dark:from-ink-900 dark:via-ink-950 dark:to-ink-950 flex flex-col">
      <div className="flex justify-between items-center px-5 pt-5">
        <button
          data-testid="lang-toggle-login"
          onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-700 dark:text-ink-100 bg-white/70 dark:bg-ink-800/70 backdrop-blur px-3 py-1.5 rounded-full border border-ink-200 dark:border-ink-700"
        >
          <Globe size={14} /> {language === 'en' ? 'English' : 'Roman Urdu'}
        </button>
        <button
          data-testid="theme-toggle-login"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-full bg-white/70 dark:bg-ink-800/70 backdrop-blur border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-100"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center items-start px-7 -mt-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <Logo size={56} />
          <div>
            <div className="font-display font-bold text-3xl text-ink-900 dark:text-white leading-none">DriveAll</div>
            <div className="text-brand-600 dark:text-brand-400 text-sm font-medium mt-1">{t('app_tagline')}</div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink-900 dark:text-white max-w-xs"
        >
          {t('welcome')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="text-ink-500 dark:text-ink-400 mt-3 text-base leading-relaxed max-w-sm"
        >
          {t('welcome_sub')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mt-10 w-full"
        >
          <button
            data-testid="google-login-btn"
            onClick={handleGoogle}
            className="w-full h-14 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 font-semibold flex items-center justify-center gap-3 shadow-floating hover:opacity-95 active:scale-[0.99] transition"
          >
            <GoogleG />
            {t('continue_with_google')}
          </button>

          <p className="text-xs text-ink-500 dark:text-ink-400 mt-5 leading-relaxed">
            {t('rural_friendly_note')}
          </p>
        </motion.div>
      </div>

      <div className="px-7 pb-8 text-xs text-ink-400 dark:text-ink-500">
        © DriveAll · Azad Kashmir
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.2 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.1z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41.4 35.8 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
