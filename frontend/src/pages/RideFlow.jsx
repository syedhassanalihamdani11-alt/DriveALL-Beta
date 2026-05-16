import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, MessageCircle, AlertTriangle, Share2, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import MapView from '../components/MapView';
import BottomSheet from '../components/BottomSheet';
import { api, useApp } from '../contexts/AppContext';

export default function RideFlow() {
  const { rideId } = useParams();
  const { t, user } = useApp();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [chatOpen, setChatOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [counterValue, setCounterValue] = useState('');
  const [showCounter, setShowCounter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isRider = user && ride && user.user_id === ride.rider_id;
  const isDriver = user && ride && user.user_id === ride.driver_id;
  const isUnclaimedDriverViewer = user?.role === 'driver' && ride && !ride.driver_id;

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const { data } = await api.get(`/rides/${rideId}`);
        if (!stop) setRide(data);
      } catch (e) {
        if (!stop) setError('Could not load ride');
      }
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(id); };
  }, [rideId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!ride?.offer_expires_at) return 0;
    const exp = new Date(ride.offer_expires_at).getTime();
    return Math.max(0, Math.round((exp - now) / 1000));
  }, [ride?.offer_expires_at, now]);

  const myCanAccept = () => {
    if (!ride) return false;
    if (ride.status !== 'searching' && ride.status !== 'negotiating') return false;
    if (isRider) return ride.last_offer_by === 'driver';
    if (isDriver || isUnclaimedDriverViewer) return ride.last_offer_by === 'rider';
    return false;
  };

  const counters = isRider ? ride?.rider_counters ?? 0 : ride?.driver_counters ?? 0;
  const countersLeft = 3 - counters;

  const doAccept = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/rides/${rideId}/accept`);
      setRide(data);
    } catch (e) { setError(e?.response?.data?.detail || 'Could not accept'); }
    finally { setBusy(false); }
  };
  const doReject = async () => {
    if (!window.confirm(t('reject') + '?')) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/rides/${rideId}/reject`);
      setRide(data);
    } finally { setBusy(false); }
  };
  const doCounter = async () => {
    const price = parseFloat(counterValue);
    if (!price || price <= 0) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/rides/${rideId}/counter`, { price });
      setRide(data);
      setShowCounter(false);
      setCounterValue('');
    } catch (e) { setError(e?.response?.data?.detail || 'Could not counter'); }
    finally { setBusy(false); }
  };
  const doStart = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/rides/${rideId}/start`, { pin: pinInput });
      setRide(data);
    } catch (e) { setError(e?.response?.data?.detail || 'Invalid PIN'); }
    finally { setBusy(false); }
  };
  const doComplete = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/rides/${rideId}/complete`);
      setRide(data);
    } finally { setBusy(false); }
  };
  const doConfirmComplete = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/rides/${rideId}/confirm-complete`);
      setRide(data);
    } finally { setBusy(false); }
  };
  const doDriverStage = async (stage) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/rides/${rideId}/driver-stage`, { stage });
      setRide(data);
    } finally { setBusy(false); }
  };
  const doSOS = async () => {
    if (!window.confirm(t('sos_confirm'))) return;
    try {
      const { data } = await api.post(`/rides/${rideId}/sos`);
      // After alert is recorded, auto-dial emergency number
      const num = data?.emergency_number || '1122';
      if (window.confirm(t('sos_sent') + ' — Call ' + num + '?')) {
        window.location.href = `tel:${num}`;
      }
    } catch (e) {}
  };
  const shareTrip = async () => {
    const url = `${window.location.origin}/ride/${rideId}`;
    const text = `DriveAll trip: ${ride.pickup.label} → ${ride.drop.label}. Track: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'DriveAll Trip', text, url }); } catch (e) {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  if (!ride) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-ink-950 text-ink-700 dark:text-white">
        {error || 'Loading…'}
      </div>
    );
  }

  const status = ride.status;
  const isActiveNeg = status === 'searching' || status === 'negotiating';
  const isConfirmed = status === 'accepted' || status === 'in_progress';
  const isPendingConfirm = status === 'pending_confirm';

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-ink-100 dark:bg-ink-950">
      <MapView
        center={[ride.pickup.lat, ride.pickup.lng]}
        zoom={14}
        pickup={ride.pickup}
        drop={ride.drop}
        driver={ride.driver_location}
        testId="ride-map"
      />

      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-4 flex items-center justify-between">
        <button data-testid="ride-back-btn" onClick={() => navigate('/home')} className="h-10 w-10 rounded-full bg-white dark:bg-ink-900 shadow-floating flex items-center justify-center text-ink-900 dark:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="px-3 py-2 rounded-full bg-white dark:bg-ink-900 shadow-floating text-xs font-semibold capitalize text-ink-900 dark:text-white">
          {t(status) || status}
        </div>
        {(isConfirmed || isPendingConfirm) ? (
          <button data-testid="sos-button" onClick={doSOS} className="h-10 w-10 rounded-full bg-red-500 text-white shadow-floating flex items-center justify-center pulse-dot">
            <AlertTriangle size={18} />
          </button>
        ) : <div className="w-10" />}
      </div>

      {isActiveNeg && (
        <div className="absolute left-0 right-0 bottom-0 z-30 p-4">
          <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-floating dark:shadow-floating-dark p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-500">{ride.last_offer_by === (isRider ? 'rider' : 'driver') ? t('your_offer_short') : t('new_offer')}</div>
                <div className="font-display text-3xl font-bold text-ink-900 dark:text-white">PKR {ride.current_price}</div>
              </div>
              <div className="text-right">
                <div className={`text-xs uppercase tracking-wider ${secondsLeft <= 30 ? 'text-orange-500' : 'text-ink-500'}`}>{t('expires_in')}</div>
                <div className={`font-display text-3xl font-bold ${secondsLeft <= 30 ? 'text-orange-500' : 'text-ink-900 dark:text-white'}`}>
                  {secondsLeft}{t('seconds')}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-ink-500 flex justify-between">
              <span>{ride.pickup.label} → {ride.drop.label} · {ride.distance_km} km</span>
              <span>{countersLeft} {t('counters_left')}</span>
            </div>

            {error && <div className="mt-2 text-xs text-red-500">{error}</div>}

            {isRider && status === 'searching' && (
              <div className="mt-4 text-sm text-ink-500 text-center">
                {t('searching')}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                data-testid="reject-btn"
                onClick={doReject}
                className="h-12 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white font-semibold"
              >
                {t('cancel')}
              </button>
              {countersLeft > 0 && (
                <button
                  data-testid="counter-btn"
                  onClick={() => { setShowCounter(true); setCounterValue(String(ride.current_price)); }}
                  className="h-12 rounded-xl bg-orange-500 text-white font-semibold"
                >
                  {t('counter_offer')}
                </button>
              )}
              {myCanAccept() && (
                <button
                  data-testid="accept-btn"
                  disabled={busy}
                  onClick={doAccept}
                  className="h-12 rounded-xl bg-brand-600 text-white font-semibold col-span-2"
                >
                  {t('accept')} · PKR {ride.current_price}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isConfirmed && (
        <div className="absolute left-0 right-0 bottom-0 z-30 p-4">
          <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-floating dark:shadow-floating-dark p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-500">{t('final_fare')}</div>
                <div className="font-display text-3xl font-bold text-brand-600">PKR {ride.final_price}</div>
                <div className="text-xs text-ink-500 mt-1">{t('cash_only')}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-ink-500">{isRider ? t('driver') : t('rider')}</div>
                <div className="font-semibold text-ink-900 dark:text-white">{isRider ? ride.driver_name : ride.rider_name}</div>
                {(isRider ? ride.driver_phone : ride.rider_phone) && (
                  <a
                    data-testid="call-btn"
                    href={`tel:${isRider ? ride.driver_phone : ride.rider_phone}`}
                    className="text-brand-600 text-sm font-medium inline-flex items-center gap-1 mt-1"
                  >
                    <Phone size={14} /> {isRider ? t('call_driver') : t('call_rider')}
                  </a>
                )}
              </div>
            </div>

            {isRider && status === 'accepted' && (
              <div className="mt-4 rounded-2xl bg-brand-50 dark:bg-brand-900/30 p-4">
                <div className="text-xs uppercase tracking-wider text-brand-700 dark:text-brand-300">{t('pin_label')}</div>
                <div className="font-display text-4xl font-bold tracking-widest text-brand-700 dark:text-brand-300" data-testid="ride-pin">{ride.pin}</div>
                <div className="text-xs text-ink-500 mt-1">{t('your_pin')}</div>
              </div>
            )}

            {isDriver && status === 'accepted' && (
              <div className="mt-4 space-y-2">
                {/* Driver stage buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid="stage-en-route-btn"
                    onClick={() => doDriverStage('en_route')}
                    disabled={busy || ride.driver_stage === 'en_route' || ride.driver_stage === 'arrived'}
                    className={`h-10 rounded-xl text-xs font-semibold ${
                      ride.driver_stage === 'en_route' || ride.driver_stage === 'arrived'
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 border border-brand-600/30'
                        : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white'
                    }`}
                  >
                    {ride.driver_stage === 'en_route' || ride.driver_stage === 'arrived' ? '✓ ' : ''}{t('mark_en_route')}
                  </button>
                  <button
                    data-testid="stage-arrived-btn"
                    onClick={() => doDriverStage('arrived')}
                    disabled={busy || ride.driver_stage === 'arrived'}
                    className={`h-10 rounded-xl text-xs font-semibold ${
                      ride.driver_stage === 'arrived'
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 border border-brand-600/30'
                        : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white'
                    }`}
                  >
                    {ride.driver_stage === 'arrived' ? '✓ ' : ''}{t('mark_arrived')}
                  </button>
                </div>
                <label className="text-xs text-ink-500">{t('enter_pin')}</label>
                <div className="flex gap-2">
                  <input
                    data-testid="pin-input"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 h-12 px-4 rounded-xl bg-ink-100 dark:bg-ink-800 text-xl font-bold tracking-widest outline-none text-ink-900 dark:text-white"
                  />
                  <button data-testid="start-ride-btn" onClick={doStart} disabled={busy} className="h-12 px-4 rounded-xl bg-brand-600 text-white font-semibold">
                    {t('start_ride')}
                  </button>
                </div>
                {error && <div className="text-xs text-red-500">{error}</div>}
              </div>
            )}

            {/* Rider — driver stage indicator */}
            {isRider && status === 'accepted' && ride.driver_stage && (
              <div className="mt-3 text-xs px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-blue-500 rounded-full pulse-dot" />
                {ride.driver_stage === 'en_route' ? t('en_route') : t('arrived_at_pickup')}
              </div>
            )}

            {isDriver && status === 'in_progress' && (
              <button
                data-testid="complete-ride-btn"
                onClick={doComplete}
                disabled={busy}
                className="mt-4 w-full h-12 rounded-xl bg-brand-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> {t('driver_marks_complete')}
              </button>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                data-testid="open-chat-btn"
                onClick={() => setChatOpen(true)}
                className="h-12 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white font-semibold flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} /> {t('chat')}
              </button>
              <button
                data-testid="share-trip-btn"
                onClick={shareTrip}
                className="h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center gap-2"
              >
                <Share2 size={16} /> {t('share_trip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending passenger confirmation */}
      {isPendingConfirm && (
        <div className="absolute left-0 right-0 bottom-0 z-30 p-4">
          <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-floating dark:shadow-floating-dark p-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-orange-500/15 text-orange-500 mb-2">
                <CheckCircle2 size={28} />
              </div>
              <div className="font-display text-xl font-semibold text-ink-900 dark:text-white">{t('pending_confirm')}</div>
              <div className="text-sm text-ink-500 mt-1">{t('awaiting_passenger_confirm')}</div>
              <div className="mt-3 inline-flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold text-brand-600">PKR {ride.final_price}</span>
                <span className="text-xs text-ink-500">· {t('cash_only')}</span>
              </div>
            </div>
            {isRider && (
              <button
                data-testid="confirm-complete-btn"
                onClick={doConfirmComplete}
                disabled={busy}
                className="mt-4 w-full h-12 rounded-xl bg-brand-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> {t('confirm_complete')}
              </button>
            )}
            {isDriver && (
              <div className="mt-4 text-sm text-ink-500 text-center">
                ⏳ {ride.rider_name}…
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                data-testid="open-chat-btn-pending"
                onClick={() => setChatOpen(true)}
                className="h-11 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white font-semibold flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle size={14} /> {t('chat')}
              </button>
              <a
                data-testid="emergency-1122-btn"
                href="tel:1122"
                className="h-11 rounded-xl bg-red-500/10 text-red-500 font-semibold flex items-center justify-center gap-2 text-sm"
              >
                <Phone size={14} /> 1122
              </a>
            </div>
          </div>
        </div>
      )}

      {(status === 'completed' || status === 'cancelled' || status === 'expired') && (
        <div className="absolute left-0 right-0 bottom-0 z-30 p-4">
          <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-floating dark:shadow-floating-dark p-6 text-center">
            <div className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{t(status) || status}</div>
            {status === 'completed' && (
              <div className="mt-1 text-brand-600 font-bold text-xl">PKR {ride.final_price}</div>
            )}
            <button data-testid="back-home-btn" onClick={() => navigate('/home')} className="mt-5 w-full h-12 rounded-xl bg-brand-600 text-white font-semibold">
              {t('home')}
            </button>
          </div>
        </div>
      )}

      <BottomSheet open={showCounter} onClose={() => setShowCounter(false)} testId="counter-sheet">
        <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-white">{t('counter_offer')}</h3>
        <div className="mt-4 flex items-center gap-2 bg-ink-100 dark:bg-ink-800 rounded-xl px-4 h-14">
          <span className="text-ink-500 font-medium">PKR</span>
          <input
            data-testid="counter-input"
            type="number"
            inputMode="numeric"
            value={counterValue}
            onChange={(e) => setCounterValue(e.target.value)}
            className="flex-1 h-full bg-transparent text-2xl font-semibold outline-none text-ink-900 dark:text-white"
          />
        </div>
        <button
          data-testid="counter-send-btn"
          onClick={doCounter}
          disabled={busy || !counterValue}
          className="mt-4 w-full h-14 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
        >
          {t('send')}
        </button>
      </BottomSheet>

      <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} rideId={rideId} t={t} me={user} />
    </div>
  );
}

function ChatSheet({ open, onClose, rideId, t, me }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    let stop = false;
    const load = async () => {
      try {
        const { data } = await api.get(`/rides/${rideId}/chat`);
        if (!stop) setMsgs(data || []);
      } catch (e) {}
    };
    load();
    const id = setInterval(load, 2500);
    return () => { stop = true; clearInterval(id); };
  }, [open, rideId]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      const { data } = await api.post(`/rides/${rideId}/chat`, { text });
      setMsgs((m) => [...m, data]);
      setText('');
    } catch (e) {}
  };

  return (
    <BottomSheet open={open} onClose={onClose} testId="chat-sheet">
      <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-white">{t('chat')}</h3>
      <div ref={ref} className="mt-3 max-h-[40vh] min-h-[180px] overflow-y-auto no-scrollbar space-y-2 py-2" data-testid="chat-messages">
        {msgs.length === 0 && <div className="text-sm text-ink-500 text-center py-6">—</div>}
        {msgs.map((m) => {
          const mine = m.sender_id === me?.user_id;
          return (
            <div key={m.message_id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-ink-100 dark:bg-ink-800 text-ink-900 dark:text-white rounded-tl-sm'}`}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('type_message')}
          className="flex-1 h-12 px-4 rounded-xl bg-ink-100 dark:bg-ink-800 outline-none text-ink-900 dark:text-white"
        />
        <button data-testid="chat-send-btn" onClick={send} className="h-12 w-12 rounded-xl bg-brand-600 text-white flex items-center justify-center">
          <Send size={18} />
        </button>
      </div>
    </BottomSheet>
  );
}
