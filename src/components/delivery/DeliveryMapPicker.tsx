import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useTranslation } from 'react-i18next';

import { requestUserLocation, type UserLocation } from '@/utils/locationRequest';

const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562];

interface DeliveryMapPickerProps {
  initialLocation?: { latitude: number; longitude: number } | null;
  onConfirm: (location: { latitude: number; longitude: number }) => void;
  onCancel?: () => void;
}

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
    html: `
      <div style="
        width:36px;
        height:36px;
        border-radius:9999px 9999px 9999px 0;
        transform:rotate(-45deg);
        background:#f59e0b;
        border:3px solid white;
        box-shadow:0 8px 16px rgba(15,23,42,.25);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="
          width:10px;
          height:10px;
          border-radius:9999px;
          background:white;
          display:block;
          transform:rotate(45deg);
        "></span>
      </div>
    `,
  });
}

function MapController({
  onCenterChange,
  onMapReady,
}: {
  onCenterChange: (center: L.LatLng) => void;
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      onCenterChange(map.getCenter());
    },
  });

  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => map.invalidateSize());
    const timeoutId = window.setTimeout(() => map.invalidateSize(), 300);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(timeoutId);
    };
  }, [map]);

  return null;
}

export const DeliveryMapPicker = memo(function DeliveryMapPicker({
  initialLocation,
  onConfirm,
  onCancel,
}: DeliveryMapPickerProps) {
  const { t } = useTranslation();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<L.LatLng>(
    L.latLng(initialLocation?.latitude ?? DEFAULT_CENTER[0], initialLocation?.longitude ?? DEFAULT_CENTER[1])
  );
  const mapRef = useRef<L.Map | null>(null);
  const pinIcon = useMemo(() => createPinIcon(), []);

  const handleFlyToUserLocation = useCallback((location: UserLocation) => {
    if (mapRef.current) {
      mapRef.current.flyTo([location.latitude, location.longitude], 16, { duration: 0.6 });
    }
  }, []);

  const handleLocateUser = useCallback(async () => {
    if (!navigator.geolocation && !window.Telegram?.WebApp?.LocationManager) {
      setLocationError(t('deliveryRequest.map.geolocationUnsupported'));
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    const nextLocation = await requestUserLocation();

    if (!nextLocation) {
      setLocationError(t('deliveryRequest.map.geolocationFailed'));
      setIsLocating(false);
      return;
    }

    setSelectedCenter(L.latLng(nextLocation.latitude, nextLocation.longitude));
    setIsLocating(false);
    handleFlyToUserLocation(nextLocation);
  }, [t, handleFlyToUserLocation]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);


  const handleConfirm = useCallback(() => {
    onConfirm({
      latitude: selectedCenter.lat,
      longitude: selectedCenter.lng,
    });
  }, [onConfirm, selectedCenter]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleLocateUser}
          disabled={isLocating}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-mc-lg bg-mc-brand px-4 text-xs font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-95 disabled:opacity-70"
        >
          {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {t('deliveryRequest.map.locateButton')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-mc-lg bg-mc-surface-2 px-4 text-xs font-bold text-mc-text transition active:scale-95 dark:bg-white/10 dark:text-mc-text"
          >
            <X className="h-4 w-4" />
            {t('deliveryRequest.map.cancelButton')}
          </button>
        )}
      </div>

      {locationError && <p className="text-xs font-semibold text-mc-danger">{locationError}</p>}

      {/* Map container */}
      <div className="relative isolate overflow-hidden rounded-mc-lg border border-mc-border" style={{ height: 320 }}>
        <MapContainer
          center={[selectedCenter.lat, selectedCenter.lng]}
          zoom={15}
          scrollWheelZoom
          dragging
          touchZoom
          doubleClickZoom
          zoomControl
          style={{ touchAction: 'none' }}
          className="h-full w-full"
          boxZoom
          keyboard

        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController onCenterChange={setSelectedCenter} onMapReady={handleMapReady} />
          <Marker
            position={[selectedCenter.lat, selectedCenter.lng]}
            icon={pinIcon}
            interactive={false}
          />
        </MapContainer>

        {/* Center crosshair overlay for UX */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-black/30 dark:bg-white/40" />
            <div className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-black/30 dark:bg-white/40" />
          </div>
        </div>

        {/* Bottom-right coordinate pill */}
        <div className="absolute bottom-3 right-3 z-[400] rounded-mc-md bg-white/95 px-3 py-1.5 text-[10px] font-bold text-mc-text shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:bg-mc-cardface/95 dark:text-mc-text dark:ring-white/10">
          {selectedCenter.lat.toFixed(5)}, {selectedCenter.lng.toFixed(5)}
        </div>
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        className="h-12 rounded-mc-lg bg-mc-success px-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4" />
          {t('deliveryRequest.map.confirmButton')}
        </span>
      </button>
    </div>
  );
});
