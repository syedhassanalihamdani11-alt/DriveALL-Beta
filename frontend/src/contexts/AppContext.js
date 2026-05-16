import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { t as translate } from '../i18n';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TOKEN_KEY = 'da_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export const api = axios.create({ baseURL: API });

// Attach Bearer token from localStorage on every request.
api.interceptors.request.use((config) => {
  const tok = getToken();
  if (tok) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${tok}`;
  }
  return config;
});

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
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      if (data.language) setLanguageState(data.language);
      if (data.theme) setThemeState(data.theme);
    } catch (e) {
      setToken(null);
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
    setToken(null);
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
