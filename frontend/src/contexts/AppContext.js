import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { t as translate } from '../i18n';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
axios.defaults.withCredentials = true;

export const api = axios.create({ baseURL: API, withCredentials: true });

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState(() => localStorage.getItem('da_lang') || 'en');
  const [theme, setThemeState] = useState(() => localStorage.getItem('da_theme') || 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('da_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('da_lang', language);
  }, [language]);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      if (data.language) setLanguageState(data.language);
      if (data.theme) setThemeState(data.theme);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const setLanguage = async (lng) => {
    setLanguageState(lng);
    if (user) {
      try { await api.patch('/users/me', { language: lng }); } catch (e) {}
    }
  };

  const setTheme = async (th) => {
    setThemeState(th);
    if (user) {
      try { await api.patch('/users/me', { theme: th }); } catch (e) {}
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (e) {}
    setUser(null);
    window.location.href = '/';
  };

  const t = (key) => translate(language, key);

  return (
    <AppContext.Provider value={{ user, setUser, loading, language, setLanguage, theme, setTheme, t, logout, checkAuth }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
