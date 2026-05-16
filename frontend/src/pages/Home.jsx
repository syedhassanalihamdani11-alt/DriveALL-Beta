import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Flag, Navigation, Power, Home as HomeIcon, Briefcase, Crosshair } from 'lucide-react';
import MapView from '../components/MapView';
import BottomNav from '../components/BottomNav';
import BottomSheet from '../components/BottomSheet';
import Logo from '../components/Logo';
import LocationPicker from '../components/LocationPicker';
import VehicleSelector, { useVehicles } from '../components/VehicleSelector';
import { api, useApp } from '../contexts/AppContext';

const MUZAFFARABAD = { lat: 34.3700, lng: 73.4711 };

function approxKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function Home() {
  const { t, user, setUser, language } = useApp();
  const navigate = useNavigate();
  const vehicles = useVehicles();

  const [center, setCenter] = useState([MUZAFFARABAD.lat, MUZAFFARABAD.lng]);
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [vehicleType, setVehicleType] = useState(user?.role === 'driver' ? user?.vehicle_type || 'car' : 'car');
  const [offer, setOffer] = useState('');
  const [fareEst, setFareEst] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(null); // 'pickup' | 'drop' | null
  const [mapPickMode, setMapPickMode] = useState(null); // 'pickup' | 'drop' | null
  const [offerSheet, setOfferSheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [driverReqs, setDriverReqs] = useState([]);

  // initialize pickup to GPS for rider
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter([c.lat, c.lng]);
        if (user?.role === 'rider' && !pickup) {
          setPickup({ ...c, label: t('use_current_location') });
        }
        if (user?.role === 'driver') {
          api.post('/drivers/status', { is_online: user.is_online || false, lat: c.lat, lng: c.lng }).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Driver: poll for ride requests
  useEffect(() => {
    if (user?.role !== 'driver' || !user.is_online) {
      setDriverReqs([]);
      return;
    }
    let stop = false;
    const tick = async () => {
      try {
        const { data } = await api.get('/rides/driver/requests');
        if (!stop) setDriverReqs(data || []);
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [user?.role, user?.is_online]);

  const distance_km = useMemo(() => (pickup && drop ? approxKm(pickup, drop) : 0), [pickup, drop]);

  // recompute fare estimate when distance/vehicle changes
  useEffect(() => {
    if (!pickup || !drop || !vehicleType) { setFareEst(null); return; }
    api.post('/fare/estimate', {
      vehicle_type: vehicleType,
      distance_km,
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      drop_lat: drop.lat, drop_lng: drop.lng,
    }).then(({ data }) => {
      setFareEst(data);
      setOffer((cur) => (cur ? cur : String(data.suggested)));
    }).catch(() => {});
  }, [pickup, drop, vehicleType, distance_km]);

  const onMapClick = ({ lat, lng }) => {
    if (user?.role !== 'rider' || !mapPickMode) return;
    const point = { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    if (mapPickMode === 'pickup') setPickup(point);
    else setDrop(point);
    setMapPickMode(null);
  };

  const toggleOnline = async () => {
    const next = !user.is_online;
    let lat = user.current_lat, lng = user.current_lng;
    if (!lat) { lat = center[0]; lng = center[1]; }
    const { data } = await api.post('/drivers/status', { is_online: next, lat, lng });
    setUser({ ...user, ...data });
  };

  const requestRide = async () => {
    if (!pickup || !drop || !offer) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/rides', {
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_label: pickup.label,
        drop_lat: drop.lat, drop_lng: drop.lng, drop_label: drop.label,
        offer_price: parseFloat(offer),
        vehicle_type: vehicleType,
      });
      setOfferSheet(false);
      navigate(`/ride/${data.ride_id}`);
    } finally { setSubmitting(false); }
  };

  const useGPSForPickup = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude, label: t('use_current_location') };
      setPickup(c);
      setCenter([c.lat, c.lng]);
      setPickerOpen(null);
    });
  };

  const savedLocs = user?.saved_locations || [];

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-ink-100 dark:bg-ink-950">
      <MapView
        center={center}
        zoom={14}
        onMapClick={onMapClick}
        pickup={pickup}
        drop={drop}
        testId="home-map"
      />

      {/* Map pick mode banner */}
      {mapPickMode && (
        <div className="absolute top-20 left-4 right-4 z-30 px-4 py-2 rounded-2xl bg-orange-500 text-white text-sm font-medium text-center shadow-floating">
          {mapPickMode === 'pickup' ? t('tap_to_set_pickup') : t('tap_to_set_drop')}
          <button onClick={() => setMapPickMode(null)} className="ml-3 underline text-white/90 text-xs">{t('cancel')}</button>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-4 flex justify-between items-center">
        <div className="flex items-center gap-2 bg-white/95 dark:bg-ink-900/95 backdrop-blur px-3 py-2 rounded-2xl shadow-floating dark:shadow-floating-dark">
          <Logo size={28} />
          <div className="font-display font-bold text-base text-ink-900 dark:text-white">DriveAll</div>
        </div>

        {user?.role === 'driver' && (
          <button
            data-testid="driver-online-toggle"
            onClick={toggleOnline}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm shadow-floating ${
              user.is_online
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-100 border border-ink-200 dark:border-ink-700'
            }`}
          >
            <Power size={14} /> {user.is_online ? t('online') : t('offline')}
          </button>
        )}
      </div>

      <button
        data-testid="recenter-btn"
        onClick={() => {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition((p) => setCenter([p.coords.latitude, p.coords.longitude]));
        }}
        className="absolute right-4 bottom-44 z-30 h-12 w-12 rounded-full bg-white dark:bg-ink-900 text-ink-700 dark:text-white shadow-floating flex items-center justify-center"
      >
        <Navigation size={20} />
      </button>

      {/* Rider booking panel */}
      {user?.role === 'rider' && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute left-0 right-0 bottom-16 z-30 px-4 pb-4"
        >
          <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-floating dark:shadow-floating-dark p-4 max-h-[68vh] overflow-y-auto no-scrollbar">
            {/* Vehicle selector */}
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">{t('select_vehicle')}</div>
            <VehicleSelector value={vehicleType} onChange={setVehicleType} lang={language} />

            {/* Pickup + drop */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                <div className="w-px h-6 bg-ink-200 dark:bg-ink-700 my-1" />
                <div className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
              </div>
              <div className="flex-1 space-y-2">
                <button
                  data-testid="set-pickup-btn"
                  onClick={() => setPickerOpen('pickup')}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium bg-brand-50 dark:bg-brand-900/30 ring-1 ring-brand-600"
                >
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">{t('pickup')}</div>
                  <div className="truncate text-ink-900 dark:text-white">{pickup?.label || t('tap_to_set_pickup')}</div>
                </button>
                <button
                  data-testid="set-drop-btn"
                  onClick={() => setPickerOpen('drop')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium ${
                    drop ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-500' : 'bg-ink-100 dark:bg-ink-800'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">{t('drop')}</div>
                  <div className="truncate text-ink-900 dark:text-white">{drop?.label || t('where_to')}</div>
                </button>
              </div>
            </div>

            {/* Saved locations quick row */}
            {savedLocs.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {savedLocs.map((loc, i) => {
                  const isHome = loc.label?.toLowerCase() === 'home' || loc.label === t('home_label');
                  const isWork = loc.label?.toLowerCase() === 'work' || loc.label === t('work_label');
                  const Icon = isHome ? HomeIcon : isWork ? Briefcase : MapPin;
                  return (
                    <button
                      key={i}
                      data-testid={`saved-loc-${i}`}
                      onClick={() => setDrop({ lat: loc.lat, lng: loc.lng, label: `${loc.label} · ${loc.address}` })}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-ink-100 dark:bg-ink-800 text-xs font-medium text-ink-800 dark:text-white"
                    >
                      <Icon size={12} className="text-brand-600" /> {loc.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Fare estimate */}
            {fareEst && (
              <div className="mt-4 rounded-2xl bg-brand-50 dark:bg-brand-900/30 p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-700 dark:text-brand-300">{t('fare_estimate')}</div>
                  <div className="font-display text-xl font-bold text-brand-700 dark:text-brand-300">PKR {fareEst.low}–{fareEst.high}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">{t('distance')}</div>
                  <div className="font-display text-xl font-bold text-ink-900 dark:text-white">{fareEst.distance_km} {t('distance_km_short')}</div>
                </div>
              </div>
            )}

            <button
              data-testid="open-offer-sheet-btn"
              disabled={!pickup || !drop || !fareEst}
              onClick={() => setOfferSheet(true)}
              className="mt-4 w-full h-12 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50 active:scale-[0.99]"
            >
              {pickup && drop ? t('book_ride') : t('select_drop_first')}
            </button>
          </div>
        </motion.div>
      )}

      {/* Driver request list */}
      {user?.role === 'driver' && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute left-0 right-0 bottom-16 z-30 px-4 pb-4"
        >
          <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-floating dark:shadow-floating-dark p-4 max-h-[55vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between mb-2">
              <div className="font-display font-semibold text-ink-900 dark:text-white">{t('ride_requests')}</div>
              <div className="text-xs text-ink-500">{user.vehicle_type ? (vehicles.find(v => v.key === user.vehicle_type)?.label || '') : ''} · {driverReqs.length}</div>
            </div>
            {!user.is_online && (
              <div className="text-sm text-ink-500 py-6 text-center">
                {t('offline')} —{' '}
                <button data-testid="driver-go-online-cta" onClick={toggleOnline} className="underline text-brand-600 font-medium">{t('online')}?</button>
              </div>
            )}
            {user.is_online && driverReqs.length === 0 && (
              <div className="text-sm text-ink-500 py-6 text-center">{t('no_requests')}</div>
            )}
            {driverReqs.map((r) => (
              <DriverRequestCard key={r.ride_id} ride={r} onOpen={() => navigate(`/ride/${r.ride_id}`)} t={t} vehicles={vehicles} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Location picker sheet */}
      <BottomSheet open={pickerOpen !== null} onClose={() => setPickerOpen(null)} testId={`picker-sheet-${pickerOpen}`}>
        <div className="h-[70vh]">
          {pickerOpen && (
            <LocationPicker
              title={pickerOpen === 'pickup' ? t('pickup_location') : t('drop_location')}
              onSelect={(loc) => {
                if (pickerOpen === 'pickup') setPickup(loc); else setDrop(loc);
                setCenter([loc.lat, loc.lng]);
                setPickerOpen(null);
              }}
              onUseGPS={pickerOpen === 'pickup' ? useGPSForPickup : undefined}
              onPinOnMap={() => { setMapPickMode(pickerOpen); setPickerOpen(null); }}
              onClose={() => setPickerOpen(null)}
              showGPS={pickerOpen === 'pickup'}
            />
          )}
        </div>
      </BottomSheet>

      {/* Offer sheet */}
      <BottomSheet open={offerSheet} onClose={() => setOfferSheet(false)} testId="offer-sheet">
        <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-white">{t('your_offer')}</h3>
        <p className="text-sm text-ink-500 mt-1">
          {t('distance')}: {fareEst?.distance_km || 0} km · {t('fare_estimate')}: PKR {fareEst?.low}–{fareEst?.high}
        </p>

        <div className="mt-4">
          <div className="flex items-center gap-2 bg-ink-100 dark:bg-ink-800 rounded-xl px-4 h-14">
            <span className="text-ink-500 font-medium">PKR</span>
            <input
              data-testid="offer-input"
              type="number"
              inputMode="numeric"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder={String(fareEst?.suggested || 250)}
              className="flex-1 h-full bg-transparent text-2xl font-semibold outline-none text-ink-900 dark:text-white"
            />
          </div>
        </div>

        {fareEst && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[fareEst.low, fareEst.suggested, fareEst.high].map((v, i) => (
              <button
                key={i}
                data-testid={`quick-offer-${i}`}
                onClick={() => setOffer(String(v))}
                className={`h-10 rounded-lg text-sm font-medium ${
                  String(v) === offer
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-100'
                }`}
              >
                {i === 1 ? `★ ${v}` : v}
              </button>
            ))}
          </div>
        )}

        <button
          data-testid="request-ride-btn"
          disabled={!offer || submitting}
          onClick={requestRide}
          className="mt-5 w-full h-14 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
        >
          {submitting ? '...' : t('request_ride')}
        </button>
      </BottomSheet>

      <BottomNav />
    </div>
  );
}

function DriverRequestCard({ ride, onOpen, t, vehicles }) {
  const lastBy = ride.last_offer_by;
  const veh = vehicles.find((v) => v.key === ride.vehicle_type);
  return (
    <button
      data-testid={`driver-request-${ride.ride_id}`}
      onClick={onOpen}
      className="w-full text-left mt-2 p-3 rounded-2xl border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/40 hover:border-brand-600"
    >
      <div className="flex items-center justify-between">
        <div className="font-display font-semibold text-ink-900 dark:text-white">{ride.rider_name}</div>
        <div className="text-brand-600 font-bold">PKR {ride.current_price}</div>
      </div>
      <div className="text-xs text-ink-500 mt-1 flex items-center gap-1">
        <MapPin size={12} /> {ride.pickup.label}
      </div>
      <div className="text-xs text-ink-500 flex items-center gap-1">
        <Flag size={12} /> {ride.drop.label} · {ride.distance_km} km
      </div>
      <div className="mt-1 flex items-center gap-2">
        {veh && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium">
            {veh.label}
          </span>
        )}
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-700">
          {lastBy === 'rider' ? t('new_offer') : t('counter')}
        </span>
      </div>
    </button>
  );
}
