import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, Users, Car, AlertTriangle, BadgeCheck, Ban, LogOut, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const TOKEN_KEY = 'da_admin_token';

const adminApi = axios.create({ baseURL: API });
adminApi.interceptors.request.use((cfg) => {
  const tok = localStorage.getItem(TOKEN_KEY);
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) { setLoading(false); return; }
    adminApi.get('/me').then(({ data }) => setUser(data)).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-ink-950 text-white"><div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!user) return <Login onLogin={setUser} />;
  return <Dashboard user={user} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setUser(null); }} />;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { data } = await adminApi.post('/login', { username, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      const { data: me } = await adminApi.get('/me');
      onLogin(me);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-ink-950 text-white flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-ink-900 rounded-3xl border border-ink-800 p-8 shadow-floating-dark">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center"><Shield size={20} /></div>
          <div>
            <div className="font-display font-bold text-lg">DriveAll Admin</div>
            <div className="text-xs text-ink-500">Operations console</div>
          </div>
        </div>
        <label className="block mb-3">
          <span className="text-xs text-ink-500">Username</span>
          <input data-testid="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl bg-ink-800 outline-none focus:ring-2 focus:ring-brand-600" autoFocus />
        </label>
        <label className="block mb-3">
          <span className="text-xs text-ink-500">Password</span>
          <input data-testid="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl bg-ink-800 outline-none focus:ring-2 focus:ring-brand-600" />
        </label>
        {err && <div className="text-xs text-red-400 mb-2">{err}</div>}
        <button data-testid="admin-login-btn" disabled={busy} className="mt-3 w-full h-12 rounded-xl bg-brand-600 font-semibold disabled:opacity-50">{busy ? '…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [sos, setSos] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');

  const refresh = async () => {
    const reqs = [adminApi.get('/stats')];
    if (tab === 'users') reqs.push(adminApi.get('/users', { params: roleFilter !== 'all' ? { role: roleFilter } : {} }));
    if (tab === 'rides') reqs.push(adminApi.get('/rides'));
    if (tab === 'sos') reqs.push(adminApi.get('/sos'));
    try {
      const [s, x] = await Promise.all(reqs);
      setStats(s.data);
      if (tab === 'users') setUsers(x.data);
      if (tab === 'rides') setRides(x.data);
      if (tab === 'sos') setSos(x.data);
    } catch (e) {}
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [tab, roleFilter]);

  const approve = async (uid) => {
    await adminApi.post(`/users/${uid}/approve`);
    refresh();
  };
  const suspend = async (uid, suspended) => {
    await adminApi.post(`/users/${uid}/suspend`, { suspended });
    refresh();
  };

  return (
    <div className="min-h-[100dvh] bg-ink-950 text-white">
      <header className="border-b border-ink-800 bg-ink-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center"><Shield size={16} /></div>
          <div className="flex-1">
            <div className="font-display font-bold text-base">DriveAll Admin</div>
            <div className="text-[11px] text-ink-500">{user.username}</div>
          </div>
          <button data-testid="admin-refresh" onClick={refresh} className="h-9 w-9 rounded-lg bg-ink-800 flex items-center justify-center"><RefreshCw size={14} /></button>
          <button data-testid="admin-logout" onClick={onLogout} className="h-9 w-9 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center"><LogOut size={14} /></button>
        </div>
        <div className="max-w-6xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {[
            ['overview', 'Overview'],
            ['users', 'Users'],
            ['rides', 'Rides'],
            ['sos', 'SOS'],
          ].map(([k, l]) => (
            <button
              key={k}
              data-testid={`admin-tab-${k}`}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === k ? 'border-brand-600 text-brand-400' : 'border-transparent text-ink-400'}`}
            >{l}</button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {/* Stats cards (always visible) */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Stat icon={<Users size={16} />} label="Riders" value={stats.riders} />
            <Stat icon={<Car size={16} />}   label="Drivers" value={stats.drivers} />
            <Stat icon={<Car size={16} />}   label="Rides total" value={stats.total_rides} />
            <Stat icon={<BadgeCheck size={16} />} label="Completed" value={stats.completed_rides} />
            <Stat icon={<AlertTriangle size={16} />} label="SOS alerts" value={stats.sos_alerts} highlight={stats.sos_alerts > 0} />
            <div className="col-span-2 md:col-span-5 rounded-2xl bg-brand-600/15 border border-brand-600/30 p-4">
              <div className="text-[11px] uppercase tracking-wider text-brand-400">Gross fare (completed)</div>
              <div className="font-display text-3xl font-bold text-brand-400">PKR {(stats.gross_fare || 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <div className="text-sm text-ink-400">
            Welcome back. Use the tabs above to manage <b className="text-white">users</b>, monitor <b className="text-white">rides</b>, and react to <b className="text-white">SOS alerts</b>.
          </div>
        )}

        {tab === 'users' && (
          <div>
            <div className="flex gap-2 mb-3">
              {['all', 'rider', 'driver'].map((r) => (
                <button key={r} data-testid={`filter-role-${r}`} onClick={() => setRoleFilter(r)} className={`px-3 h-9 rounded-full text-xs font-semibold ${roleFilter === r ? 'bg-brand-600' : 'bg-ink-800 text-ink-400'}`}>{r}</button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-ink-500 text-xs uppercase">
                  <tr><th className="py-2">Name</th><th>Role</th><th>City</th><th>Vehicle</th><th>Earnings</th><th>Verified</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-t border-ink-800" data-testid={`user-row-${u.user_id}`}>
                      <td className="py-2.5">
                        <div className="font-medium text-white">{u.name}</div>
                        <div className="text-[11px] text-ink-500">{u.email}</div>
                      </td>
                      <td className="text-xs"><Pill color={u.role === 'driver' ? 'blue' : 'gray'}>{u.role || '—'}</Pill></td>
                      <td className="text-xs text-ink-300">{u.city || '—'}</td>
                      <td className="text-xs text-ink-300">{u.vehicle_type || '—'}</td>
                      <td className="text-xs text-brand-400">PKR {u.earnings || 0}</td>
                      <td>{u.verified ? <BadgeCheck size={14} className="text-brand-400" /> : <span className="text-xs text-ink-500">—</span>}</td>
                      <td>
                        <div className="flex gap-1">
                          {u.role === 'driver' && !u.verified && (
                            <button data-testid={`approve-${u.user_id}`} onClick={() => approve(u.user_id)} className="px-2 h-7 rounded-md bg-brand-600 text-[11px] font-medium">Approve</button>
                          )}
                          <button data-testid={`suspend-${u.user_id}`} onClick={() => suspend(u.user_id, !u.suspended)} className={`px-2 h-7 rounded-md text-[11px] font-medium ${u.suspended ? 'bg-ink-700 text-white' : 'bg-red-500/20 text-red-400'}`}>
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'rides' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-500 text-xs uppercase">
                <tr><th className="py-2">Ride</th><th>Rider</th><th>Driver</th><th>Route</th><th>Vehicle</th><th>Fare</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.ride_id} className="border-t border-ink-800" data-testid={`ride-row-${r.ride_id}`}>
                    <td className="py-2.5 font-mono text-[11px] text-ink-400">{r.ride_id.slice(0,10)}</td>
                    <td className="text-xs">{r.rider_name}</td>
                    <td className="text-xs">{r.driver_name || '—'}</td>
                    <td className="text-xs text-ink-300 max-w-[220px] truncate">{r.pickup?.label} → {r.drop?.label}</td>
                    <td className="text-xs">{r.vehicle_type || '—'}</td>
                    <td className="text-xs text-brand-400">PKR {r.final_price || r.current_price}</td>
                    <td><Pill color={statusColor(r.status)}>{r.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sos' && (
          <div className="space-y-3">
            {sos.length === 0 && <div className="text-sm text-ink-500 text-center py-12">No SOS alerts.</div>}
            {sos.map((s) => (
              <div key={s.alert_id} className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4" data-testid={`sos-${s.alert_id}`}>
                <div className="flex items-center gap-2 text-red-400 font-bold"><AlertTriangle size={16} /> SOS — {new Date(s.created_at).toLocaleString()}</div>
                <div className="text-xs text-ink-300 mt-2">Ride: <span className="font-mono">{s.ride_id}</span></div>
                <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                  <div><div className="text-ink-500">Rider</div><div className="text-white">{s.rider?.name}</div><div className="text-ink-400">{s.rider?.phone || '—'}</div></div>
                  <div><div className="text-ink-500">Driver</div><div className="text-white">{s.driver?.name || '—'}</div><div className="text-ink-400">{s.driver?.phone || '—'}</div></div>
                </div>
                <div className="mt-2 text-xs text-ink-300">📍 {s.pickup?.label} → {s.drop?.label}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label, value, highlight }) {
  return (
    <div className={`rounded-2xl p-3 border ${highlight ? 'bg-red-500/15 border-red-500/30' : 'bg-ink-900 border-ink-800'}`}>
      <div className={`text-[11px] uppercase tracking-wider flex items-center gap-1 ${highlight ? 'text-red-400' : 'text-ink-500'}`}>{icon} {label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Pill({ children, color }) {
  const cl = {
    blue: 'bg-blue-500/20 text-blue-300',
    gray: 'bg-ink-700 text-ink-300',
    green: 'bg-brand-600/20 text-brand-400',
    yellow: 'bg-orange-500/20 text-orange-300',
    red: 'bg-red-500/20 text-red-400',
  }[color] || 'bg-ink-800 text-ink-300';
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cl}`}>{children}</span>;
}
function statusColor(s) {
  return { searching: 'yellow', negotiating: 'yellow', accepted: 'blue', in_progress: 'blue', pending_confirm: 'yellow', completed: 'green', cancelled: 'red', expired: 'red' }[s] || 'gray';
}
