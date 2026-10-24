import { memo, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { Maximize2 } from 'lucide-react';

import type { MonitorLiveCourier, MonitorStop, MonitorTrack } from '@/api/services/courierMonitor';
import { clockTashkent, courierName, formatMinutes, safeColor } from '@/lib/courierMonitor';

/** Tashkent centre, for the moment before anything is known. */
const TASHKENT: [number, number] = [41.3111, 69.2797];

export interface MapFocus {
  latitude: number;
  longitude: number;
  /** Changes on every tap, so tapping the same row twice flies there again. */
  nonce: number;
}

interface CourierMonitorMapProps {
  /** The selected courier's day; null while it loads. */
  track: MonitorTrack | null;
  /** Today's couriers, drawn where they are now. Empty for a past day. */
  couriers: readonly MonitorLiveCourier[];
  selectedId: number | null;
  onSelect: (courierId: number) => void;
  focus: MapFocus | null;
  /** The map frames the day again only when this changes (courier or date). */
  frameKey: string;
}

const HOUSE_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11 12 4l8 7"/><path d="M6.5 9.5V20h11V9.5"/></svg>';
const CHECK_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

const OFFICE_ICON = L.divIcon({
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div class="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-white bg-mc-brand text-mc-on-brand shadow-[var(--mc-shadow-card)]">${HOUSE_SVG}</div>`,
});

function stopIcon(stop: MonitorStop, index: number): L.DivIcon {
  const ring = safeColor(stop.partner_color);
  // A partner's stops carry the partner's colour as an outer ring, the same cue
  // the courier app uses, so the admin can tell whose parcel a pin is.
  const ringStyle = ring ? ` style="box-shadow:0 0 0 3px ${ring}"` : '';
  let body: string;
  if (stop.status === 'delivered') {
    body = `<div class="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-mc-success text-mc-on-success shadow-[var(--mc-shadow-card)]"${ringStyle}>${CHECK_SVG}</div>`;
  } else if (stop.status === 'cancelled') {
    body = `<div class="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-mc-border bg-mc-surface-2 text-[11px] font-extrabold text-mc-text-3"${ringStyle}>${index}</div>`;
  } else {
    body = `<div class="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[3px] border-mc-brand bg-mc-surface text-[11px] font-extrabold text-mc-text shadow-[var(--mc-shadow-card)]"${ringStyle}>${index}</div>`;
  }
  return L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: body });
}

function courierIcon(name: string, heading: number | null, selected: boolean, live: boolean): L.DivIcon {
  const size = selected ? 34 : 28;
  const glyph =
    heading === null
      ? '<span class="block h-2.5 w-2.5 rounded-full bg-white"></span>'
      : `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(heading)}deg)"><path d="M12 3 19.5 20 12 16.2 4.5 20z" fill="currentColor"/></svg>`;
  // An old position is grey: the admin must not read yesterday's parking spot as «here now».
  const fill = live ? 'bg-mc-text text-mc-surface' : 'bg-mc-text-3 text-mc-surface';
  const halo = selected && live ? '<span class="absolute -inset-[16px] -z-10 rounded-full bg-mc-text/10"></span>' : '';
  const label = `<span class="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-mc-sm bg-mc-surface px-2 py-1 text-[12px] font-extrabold text-mc-text shadow-[var(--mc-shadow-card)]" style="left:${size + 6}px">${escapeHtml(name)}</span>`;
  return L.divIcon({
    className: 'mc-courier-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="relative flex items-center justify-center rounded-full border-[3px] border-white ${fill} shadow-[var(--mc-shadow-card)]" style="width:${size}px;height:${size}px">${halo}${glyph}${label}</div>`,
  });
}

function stopCaption(stop: MonitorStop): string {
  if (stop.status === 'delivered' && stop.delivered_at) return `Yetkazildi ${clockTashkent(stop.delivered_at)}`;
  if (stop.status === 'cancelled') return 'Bekor qilingan';
  if (stop.status === 'on_the_way') return "Hozir shu yerga yo'lda";
  return 'Kutmoqda';
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Frames the day once per courier/date (and on the button), never on a
 * refresh: the admin may have zoomed into one street, and a poll every 30 s
 * yanking the view back would make the map unusable.
 */
function Framing({
  frameKey,
  points,
  ready,
  focus,
}: {
  frameKey: string;
  points: [number, number][];
  ready: boolean;
  focus: MapFocus | null;
}) {
  const map = useMap();
  const framed = useRef<string | null>(null);

  useEffect(() => {
    // The card can change size (tab switch, sidebar, rotation); Leaflet only
    // measures itself on window resize, and greys out tiles it thinks are off-screen.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (!ready || framed.current === frameKey) return;
    framed.current = frameKey;
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
      return;
    }
    // Extra room on the right: the courier's name chip hangs off the right of its marker.
    const right = Math.min(110, map.getSize().x * 0.25);
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: L.point(64, 40),
      paddingBottomRight: L.point(right, 40),
      maxZoom: 16,
      animate: false,
    });
  }, [map, frameKey, points, ready]);

  useEffect(() => {
    if (!focus) return;
    const target: [number, number] = [focus.latitude, focus.longitude];
    const zoom = Math.max(map.getZoom(), 16);
    if (prefersReducedMotion()) map.setView(target, zoom, { animate: false });
    else map.flyTo(target, zoom, { duration: 0.6 });
  }, [map, focus]);

  return null;
}

export const CourierMonitorMap = memo(function CourierMonitorMap({
  track,
  couriers,
  selectedId,
  onSelect,
  focus,
  frameKey,
}: CourierMonitorMapProps) {
  const [refit, setRefit] = useState(0);

  const trail = useMemo<[number, number][]>(
    () => (track?.trail ?? []).map(([latitude, longitude]) => [latitude, longitude]),
    [track],
  );
  const placedStops = useMemo(
    () =>
      (track?.stops ?? []).flatMap((stop, i) =>
        stop.latitude !== null && stop.longitude !== null
          ? [{ stop, index: i + 1, position: [stop.latitude, stop.longitude] as [number, number] }]
          : [],
      ),
    [track],
  );
  const stopIcons = useMemo(() => placedStops.map(({ stop, index }) => stopIcon(stop, index)), [placedStops]);

  const visibleCouriers = useMemo(
    () => couriers.filter((c): c is MonitorLiveCourier & { position: NonNullable<MonitorLiveCourier['position']> } => c.position !== null),
    [couriers],
  );
  const courierIcons = useMemo(
    () =>
      visibleCouriers.map((c) =>
        courierIcon(courierName(c), c.position.live ? c.position.heading : null, c.id === selectedId, c.position.live),
      ),
    [visibleCouriers, selectedId],
  );

  const office = track?.office ?? null;
  const selectedPosition = visibleCouriers.find((c) => c.id === selectedId)?.position ?? null;
  const framePoints = useMemo<[number, number][]>(() => {
    const points: [number, number][] = [...trail, ...placedStops.map((s) => s.position)];
    if (selectedPosition) points.push([selectedPosition.latitude, selectedPosition.longitude]);
    if (points.length === 0 && office) points.push([office.latitude, office.longitude]);
    return points;
  }, [trail, placedStops, selectedPosition, office]);

  const center: [number, number] = office ? [office.latitude, office.longitude] : TASHKENT;
  const rawTrail = track?.trail ?? [];
  const trailStart = rawTrail[0];
  const trailEnd = rawTrail.length > 1 ? rawTrail[rawTrail.length - 1] : undefined;

  return (
    <div className="mc-live-map relative h-full w-full overflow-hidden">
      <MapContainer center={center} zoom={12} zoomControl attributionControl={false} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Framing frameKey={`${frameKey}#${refit}`} points={framePoints} ready={track !== null} focus={focus} />

        {office && (
          <Marker position={[office.latitude, office.longitude]} icon={OFFICE_ICON} zIndexOffset={-100}>
            <Tooltip direction="top" offset={[0, -16]}>Ofis</Tooltip>
          </Marker>
        )}

        {trail.length > 1 && (
          <>
            <Polyline positions={trail} className="mc-trail-casing" interactive={false} />
            <Polyline positions={trail} className="mc-trail" interactive={false} />
          </>
        )}
        {trailStart && (
          <CircleMarker center={[trailStart[0], trailStart[1]]} radius={6} className="mc-trail-start">
            <Tooltip direction="top" offset={[0, -6]}>
              Kun boshi · {clockTashkent(trailStart[2] * 1000)}
            </Tooltip>
          </CircleMarker>
        )}
        {trailEnd && (
          <CircleMarker center={[trailEnd[0], trailEnd[1]]} radius={6} className="mc-trail-end">
            <Tooltip direction="top" offset={[0, -6]}>
              Oxirgi nuqta · {clockTashkent(trailEnd[2] * 1000)}
            </Tooltip>
          </CircleMarker>
        )}

        {(track?.gaps ?? []).map((gap) => (
          <Polyline
            key={`gap-${gap.started_at}`}
            positions={[gap.start, gap.end]}
            className="mc-gap"
          >
            <Tooltip sticky>
              GPS yo'q · {clockTashkent(gap.started_at)}–{clockTashkent(gap.ended_at)}
            </Tooltip>
          </Polyline>
        ))}

        {(track?.stays ?? []).map((stay) => (
          <CircleMarker
            key={`stay-${stay.started_at}`}
            center={[stay.latitude, stay.longitude]}
            // Longer stays read bigger, capped so a lunch break does not cover the street.
            radius={7 + Math.min(stay.minutes / 15, 7)}
            className="mc-stay"
          >
            <Tooltip direction="top">
              Turdi · {clockTashkent(stay.started_at)}–{clockTashkent(stay.ended_at)} · {formatMinutes(stay.minutes)}
            </Tooltip>
          </CircleMarker>
        ))}

        {placedStops.map(({ stop, position }, i) => (
          <Marker key={stop.public_id} position={position} icon={stopIcons[i]} zIndexOffset={200}>
            <Tooltip direction="top" offset={[0, -12]}>
              <span className="block font-extrabold">{stop.name}</span>
              {stop.address && <span className="block max-w-[220px] whitespace-normal font-medium">{stop.address}</span>}
              <span className="block font-medium">{stopCaption(stop)}</span>
            </Tooltip>
          </Marker>
        ))}

        {visibleCouriers.map((courier, i) => (
          <Marker
            key={`courier-${courier.id}`}
            position={[courier.position.latitude, courier.position.longitude]}
            icon={courierIcons[i]}
            zIndexOffset={courier.id === selectedId ? 1000 : 500}
            eventHandlers={{ click: () => onSelect(courier.id) }}
            title={courierName(courier)}
          />
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={() => setRefit((n) => n + 1)}
        aria-label="Butun kunni ko'rsatish"
        title="Butun kunni ko'rsatish"
        className="absolute right-3 top-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-mc-md border border-mc-border bg-mc-surface text-mc-text shadow-[var(--mc-shadow-card)] transition-transform active:scale-95"
      >
        <Maximize2 className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </button>

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-1.5 right-1.5 z-[1000] rounded-mc-sm bg-mc-surface/80 px-1.5 py-0.5 text-[10px] font-semibold text-mc-text-2"
      >
        © OpenStreetMap
      </a>
    </div>
  );
});

export default CourierMonitorMap;
