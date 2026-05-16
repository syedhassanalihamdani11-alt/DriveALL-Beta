import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, ChevronRight, Crosshair, X } from 'lucide-react';
import { api, useApp } from '../contexts/AppContext';

/**
 * 3-step location picker:
 *   1) Pick city  →  2) Pick area / landmark  →  3) Search or fallback to map-pin
 *
 * Props:
 *   - title: heading text
 *   - onSelect({lat, lng, label}): called when user picks a location
 *   - onUseGPS(): optional, used for current-location fast path
 *   - onPinOnMap(): fallback — let user pin on map manually
 *   - onClose(): close button
 *   - showGPS: bool — render "Use current GPS" button
 */
export default function LocationPicker({ title, onSelect, onUseGPS, onPinOnMap, onClose, showGPS = false }) {
  const { t } = useApp();
  const [data, setData] = useState([]);
  const [city, setCity] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/config/locations').then(({ data }) => setData(data || [])).catch(() => {});
  }, []);

  // Flat search index across all cities + areas
  const flatIndex = useMemo(() => {
    const items = [];
    data.forEach((c) => {
      items.push({ type: 'city', label: c.city, city: c.city, area: null, lat: c.lat, lng: c.lng });
      (c.areas || []).forEach((a) =>
        items.push({ type: 'area', label: `${a}, ${c.city}`, city: c.city, area: a, lat: c.lat, lng: c.lng })
      );
    });
    return items;
  }, [data]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return flatIndex.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 25);
  }, [flatIndex, search]);

  const pickItem = (item) => {
    // tiny jitter so area markers don't all collide on the city center
    const jitter = (n) => n + (Math.random() - 0.5) * 0.01;
    onSelect({ lat: jitter(item.lat), lng: jitter(item.lng), label: item.label });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-white">{title}</h3>
        {onClose && (
          <button data-testid="loc-picker-close" onClick={onClose} className="h-9 w-9 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search box */}
      <div className="flex items-center gap-2 bg-ink-100 dark:bg-ink-800 rounded-xl px-3 h-12">
        <Search size={16} className="text-ink-500" />
        <input
          data-testid="loc-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search_placeholder')}
          className="flex-1 h-full bg-transparent outline-none text-ink-900 dark:text-white text-sm"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {showGPS && onUseGPS && (
          <button
            data-testid="loc-use-gps"
            onClick={onUseGPS}
            className="h-11 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-brand-600/30"
          >
            <Crosshair size={14} /> {t('use_current_location')}
          </button>
        )}
        {onPinOnMap && (
          <button
            data-testid="loc-pin-on-map"
            onClick={onPinOnMap}
            className={`h-11 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5 ${!showGPS ? 'col-span-2' : ''}`}
          >
            <MapPin size={14} /> {t('pin_on_map')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mt-3 no-scrollbar">
        {/* Search results */}
        {search.trim() && (
          <div className="space-y-1.5">
            {searchResults.length === 0 && (
              <div className="text-sm text-ink-500 py-6 text-center">
                {t('cant_find')}{' '}
                {onPinOnMap && (
                  <button onClick={onPinOnMap} className="text-brand-600 font-medium underline">
                    {t('pin_on_map')}
                  </button>
                )}
              </div>
            )}
            {searchResults.map((r, i) => (
              <button
                key={i}
                data-testid={`loc-search-result-${i}`}
                onClick={() => pickItem(r)}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-white dark:bg-ink-800/60 border border-ink-200 dark:border-ink-800 hover:border-brand-600 flex items-center gap-2"
              >
                <MapPin size={14} className={r.type === 'city' ? 'text-brand-600' : 'text-ink-500'} />
                <span className="text-sm text-ink-900 dark:text-white truncate">{r.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* City list */}
        {!search.trim() && !city && (
          <>
            <div className="text-xs uppercase tracking-wider text-ink-500 mt-2 mb-2">{t('select_city')}</div>
            <div className="space-y-2">
              {data.map((c) => (
                <motion.button
                  key={c.city}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`loc-city-${c.city.replace(/\s+/g,'-').toLowerCase()}`}
                  onClick={() => setCity(c)}
                  className="w-full text-left px-4 py-3 rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-800/60 flex items-center gap-3 hover:border-brand-600"
                >
                  <div className="h-9 w-9 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center"><MapPin size={16} /></div>
                  <div className="flex-1">
                    <div className="font-medium text-ink-900 dark:text-white">{c.city}</div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-500">{c.type} · {c.areas.length} places</div>
                  </div>
                  <ChevronRight className="text-ink-400" size={18} />
                </motion.button>
              ))}
            </div>
          </>
        )}

        {/* Area list */}
        {!search.trim() && city && (
          <>
            <button onClick={() => setCity(null)} className="text-xs text-brand-600 font-medium mt-1 mb-2" data-testid="loc-back-to-cities">
              ← {t('select_city')}
            </button>
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">{t('select_area')} — <span className="text-brand-600">{city.city}</span></div>
            <div className="space-y-1.5">
              <button
                data-testid="loc-city-center"
                onClick={() => pickItem({ city: city.city, area: null, label: city.city, lat: city.lat, lng: city.lng })}
                className="w-full text-left px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-600/30 flex items-center gap-2"
              >
                <MapPin size={14} className="text-brand-600" />
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{city.city} (city center)</span>
              </button>
              {city.areas.map((a) => (
                <button
                  key={a}
                  data-testid={`loc-area-${a.replace(/\s+/g,'-').toLowerCase()}`}
                  onClick={() => pickItem({ city: city.city, area: a, label: `${a}, ${city.city}`, lat: city.lat, lng: city.lng })}
                  className="w-full text-left px-4 py-2.5 rounded-xl bg-white dark:bg-ink-800/60 border border-ink-200 dark:border-ink-800 hover:border-brand-600 flex items-center gap-2"
                >
                  <MapPin size={14} className="text-ink-500" />
                  <span className="text-sm text-ink-900 dark:text-white">{a}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
