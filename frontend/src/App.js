import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Rides from './pages/Rides';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import RideFlow from './pages/RideFlow';
import Admin from './pages/Admin';
import MobileFrame from './components/MobileFrame';
import './App.css';

function ProtectedRoute({ children, requireRole = true }) {
  const { user, loading } = useApp();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/" replace />;
  if (requireRole && !user.role) return <Navigate to="/onboarding" replace />;
  return children;
}

function Loader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-ink-950">
      <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  const location = useLocation();
  // CRITICAL: process session_id BEFORE other routing.
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/onboarding" element={<ProtectedRoute requireRole={false}><MobileFrame><Onboarding /></MobileFrame></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute><MobileFrame><Home /></MobileFrame></ProtectedRoute>} />
      <Route path="/rides" element={<ProtectedRoute><MobileFrame><Rides /></MobileFrame></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><MobileFrame><Profile /></MobileFrame></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MobileFrame><Settings /></MobileFrame></ProtectedRoute>} />
      <Route path="/ride/:rideId" element={<ProtectedRoute><MobileFrame><RideFlow /></MobileFrame></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function HomeRedirect() {
  const { user, loading } = useApp();
  if (loading) return <Loader />;
  if (!user) return <MobileFrame><Login /></MobileFrame>;
  if (!user.role) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/home" replace />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </AppProvider>
  );
}
