import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

const makeIcon = (color, label) => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
           <div style="background:${color};color:white;font-size:11px;font-weight:600;padding:3px 8px;border-radius:9999px;box-shadow:0 4px 10px rgba(0,0,0,0.25);white-space:nowrap">${label}</div>
           <div style="width:14px;height:14px;background:${color};border:3px solid white;border-radius:9999px;margin-top:-2px;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>
         </div>`,
  iconSize: [1, 1],
  iconAnchor: [0, 0],
});

export const pickupIcon = makeIcon('#16A34A', 'Pickup');
export const dropIcon = makeIcon('#F97316', 'Drop');
export const driverIcon = makeIcon('#3B82F6', 'Driver');

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { duration: 0.8 });
  }, [center, map]);
  return null;
}

export default function MapView({
  center = [34.3700, 73.4711],
  zoom = 13,
  onMapClick,
  pickup,
  drop,
  driver,
  flyTo,
  testId = 'map-view',
}) {
  const routeLine = pickup && drop ? [[pickup.lat, pickup.lng], [drop.lat, drop.lng]] : null;
  return (
    <div className="absolute inset-0 z-0" data-testid={testId}>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickHandler onMapClick={onMapClick} />
        <FlyTo center={flyTo} />
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {drop && <Marker position={[drop.lat, drop.lng]} icon={dropIcon} />}
        {driver && <Marker position={[driver.lat, driver.lng]} icon={driverIcon} />}
        {routeLine && (
          <Polyline positions={routeLine} pathOptions={{ color: '#16A34A', weight: 5, opacity: 0.85, dashArray: '8 6' }} />
        )}
      </MapContainer>
    </div>
  );
}
