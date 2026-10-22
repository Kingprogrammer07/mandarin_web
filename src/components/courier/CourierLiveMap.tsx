import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLon } from '@/lib/courierArea';

export interface CourierFix extends LatLon {
  heading: number | null;
}

interface CourierLiveMapProps {
  home: LatLon;
  homeLabel: string;
  courier: CourierFix | null;
  courierName: string | null;
  /** Height of the sheet edge that covers the map's bottom, in px. */
  bottomInset: number;
}

const HOUSE_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11 12 4l8 7"/><path d="M6.5 9.5V20h11V9.5"/></svg>';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function label(text: string, left: number): string {
  return `<span class="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-mc-sm bg-mc-surface px-2 py-1 text-[12px] font-extrabold text-mc-text shadow-[var(--mc-shadow-card)]" style="left:${left}px">${escapeHtml(text)}</span>`;
}

function homeIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div class="relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-mc-brand text-mc-on-brand shadow-[var(--mc-shadow-card)]">${HOUSE_SVG}${label(text, 46)}</div>`,
  });
}

function courierIcon(name: string | null, heading: number | null): L.DivIcon {
  // No heading (standing still, or iOS did not know): a dot, not an arrow
  // pointing somewhere it is not going.
  const glyph =
    heading === null
      ? '<span class="block h-2.5 w-2.5 rounded-full bg-white"></span>'
      : `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(heading)}deg)"><path d="M12 3 19.5 20 12 16.2 4.5 20z" fill="currentColor"/></svg>`;
  return L.divIcon({
    className: 'mc-courier-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-white bg-mc-text text-mc-surface shadow-[var(--mc-shadow-card)]"><span class="absolute -inset-[19px] -z-10 rounded-full bg-mc-text/10"></span>${glyph}${name ? label(name, 40) : ''}</div>`,
  });
}

/**
 * Keeps both points in view while the courier moves, until the client takes
 * the map in hand; the recenter button gives the framing back.
 */
function Framing({
  home,
  courier,
  bottomInset,
  following,
  onUserMove,
}: {
  home: LatLon;
  courier: CourierFix | null;
  bottomInset: number;
  following: boolean;
  onUserMove: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    // Any touch, drag or wheel is the client looking around: stop following.
    const stop = () => onUserMove();
    container.addEventListener('pointerdown', stop);
    container.addEventListener('wheel', stop, { passive: true });
    return () => {
      container.removeEventListener('pointerdown', stop);
      container.removeEventListener('wheel', stop);
    };
  }, [map, onUserMove]);

  useEffect(() => {
    // The view mounts inside a sliding screen; Leaflet measures it too early.
    const id = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(id);
  }, [map]);

  const courierLat = courier?.latitude;
  const courierLon = courier?.longitude;
  useEffect(() => {
    if (!following) return;
    if (courierLat === undefined || courierLon === undefined) {
      map.setView([home.latitude, home.longitude], 15, { animate: true });
      return;
    }
    map.fitBounds(
      L.latLngBounds([
        [home.latitude, home.longitude],
        [courierLat, courierLon],
      ]),
      {
        // Top: the back button and the status pill sit over the map. Right:
        // the name chips hang off the right of each marker.
        paddingTopLeft: L.point(40, 76),
        paddingBottomRight: L.point(112, 40 + bottomInset),
        maxZoom: 16,
        animate: true,
      },
    );
  }, [map, following, home.latitude, home.longitude, courierLat, courierLon, bottomInset]);

  return null;
}

export const CourierLiveMap = memo(function CourierLiveMap({
  home,
  homeLabel,
  courier,
  courierName,
  bottomInset,
}: CourierLiveMapProps) {
  const { t } = useTranslation();
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);

  const stopFollowing = useCallback(() => {
    if (!followingRef.current) return;
    followingRef.current = false;
    setFollowing(false);
  }, []);
  const recenter = useCallback(() => {
    followingRef.current = true;
    setFollowing(true);
  }, []);

  const homeMarker = useMemo(() => homeIcon(homeLabel), [homeLabel]);
  const heading = courier?.heading ?? null;
  const courierMarker = useMemo(() => courierIcon(courierName, heading), [courierName, heading]);

  return (
    <div className="mc-live-map relative h-full w-full">
      <MapContainer
        center={[home.latitude, home.longitude]}
        zoom={15}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
        style={{ touchAction: 'none' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Framing
          home={home}
          courier={courier}
          bottomInset={bottomInset}
          following={following}
          onUserMove={stopFollowing}
        />
        <Marker position={[home.latitude, home.longitude]} icon={homeMarker} interactive={false} />
        {courier && (
          <Marker
            position={[courier.latitude, courier.longitude]}
            icon={courierMarker}
            interactive={false}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-2 z-[1000] rounded-mc-sm bg-mc-surface/80 px-1.5 py-0.5 text-[10px] font-semibold text-mc-text-2"
        style={{ bottom: bottomInset + 8 }}
      >
        © OpenStreetMap
      </a>

      {!following && (
        <button
          type="button"
          onClick={recenter}
          aria-label={t('courierTrack.recenter')}
          className="absolute right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-mc-md bg-mc-surface text-mc-text shadow-[var(--mc-shadow-card)] transition-transform active:scale-95"
          style={{ bottom: bottomInset + 32 }}
        >
          <LocateFixed className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

export default CourierLiveMap;
