import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useApp } from '../contexts/AppContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const hasProcessed = useRef(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || '';
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate('/');
      return;
    }
    const sessionId = decodeURIComponent(m[1]);

    (async () => {
      try {
        const { data } = await api.post('/auth/session', { session_id: sessionId });
        setUser(data.user);
        window.history.replaceState({}, document.title, window.location.pathname);
        if (!data.user.role) {
          navigate('/onboarding', { replace: true, state: { user: data.user } });
        } else {
          navigate('/home', { replace: true, state: { user: data.user } });
        }
      } catch (e) {
        setErr('Login failed. Please try again.');
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-ink-950 text-ink-900 dark:text-white">
      <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-sm text-ink-500">{err || 'Signing you in…'}</p>
    </div>
  );
}
