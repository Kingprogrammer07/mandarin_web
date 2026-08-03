import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useYandexMaps, type YMaps } from '@/hooks/useYandexMaps';

/**
 * Thin declarative wrapper over the Yandex Maps JavaScript API 2.1.
 *
 * The API is imperative (`new ymaps.Map`, `geoObjects.add`), so this component
 * owns one map instance and reconciles placemarks on every render. Callers pass
 * the Leaflet markup as `fallback`; it renders whenever Yandex is unavailable
 * (no key, blocked CDN, load error), so a map failure never hides an address.
 *
 * Coordinates are `[latitude, longitude]` throughout — the order 2.1 itself uses.
 */

export interface YandexMarker {
  id: string | number;
  latitude: number;
  longitude: number;
  /** Pin colour (CSS hex). */
  color: string;
  /** Larger pin for the active item. */
  selected?: boolean;
  /**
   * Caption beside the pin. Passed as a Yandex *property*, not markup — branch
   * names come from an external feed, so string-built HTML would be an XSS sink.
   */
  label?: string;
  onClick?: () => void;
}

interface YandexMapProps {
  center: [number, number];
  zoom?: number;
  markers?: YandexMarker[];
  /** Recentre when `center` changes (geolocation, branch selection). */
  followCenter?: boolean;
  className?: string;
  fallback: ReactNode;
}

interface TrackedMarker {
  placemark: unknown;
  /** Appearance+position fingerprint; a change forces the pin to be rebuilt. */
  signature: string;
}

interface MapRefs {
  map: unknown;
  markerById: Map<string | number, TrackedMarker>;
}

interface YandexMapInstance {
  geoObjects: {
    add: (object: unknown) => void;
    remove: (object: unknown) => void;
  };
  setCenter: (center: number[], zoom?: number, options?: Record<string, unknown>) => void;
  destroy: () => void;
}

function markerSignature(marker: YandexMarker): string {
  return [
    marker.latitude,
    marker.longitude,
    marker.color,
    marker.selected ? 1 : 0,
    marker.label ?? '',
  ].join('|');
}

export default function YandexMap({
  center,
  zoom = 15,
  markers = [],
  followCenter = false,
  className = '',
  fallback,
}: YandexMapProps) {
  const { status, ymaps } = useYandexMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<MapRefs>({ map: null, markerById: new Map() });
  // Held in refs so the map is created once — rebuilding it on every prop change
  // would flicker and throw away the user's pan/zoom.
  const initialCenter = useRef(center);
  const initialZoom = useRef(zoom);

  // ── create the map once the API is ready ──
  useEffect(() => {
    if (status !== 'ready' || !ymaps || !containerRef.current) return;
    const api = ymaps as YMaps;

    const map = new api.Map(
      containerRef.current,
      { center: initialCenter.current, zoom: initialZoom.current, controls: ['zoomControl'] },
      // The default "open in Yandex Maps" overlay steals taps on a small screen.
      { suppressMapOpenBlock: true },
    ) as YandexMapInstance;

    refs.current.map = map;
    return () => {
      try {
        map.destroy();
      } catch {
        // Destroying an already-torn-down map is harmless.
      }
      refs.current = { map: null, markerById: new Map() };
    };
  }, [status, ymaps]);

  // ── reconcile placemarks ──
  useEffect(() => {
    const api = ymaps as YMaps | null;
    const map = refs.current.map as YandexMapInstance | null;
    if (status !== 'ready' || !api || !map) return;

    const alive = new Set<string | number>();

    markers.forEach((marker) => {
      alive.add(marker.id);
      const signature = markerSignature(marker);
      const existing = refs.current.markerById.get(marker.id);
      if (existing) {
        if (existing.signature === signature) return;
        try {
          map.geoObjects.remove(existing.placemark);
        } catch {
          // Already detached.
        }
        refs.current.markerById.delete(marker.id);
      }

      const placemark = new api.Placemark(
        [marker.latitude, marker.longitude],
        // Properties, not markup — Yandex renders these as text.
        marker.label ? { iconCaption: marker.label } : {},
        {
          // Teardrop pins read as "location" far better than flat circles at a
          // glance, which is the whole point of this screen.
          preset: marker.selected ? 'islands#dotIcon' : 'islands#circleDotIcon',
          iconColor: marker.color,
          zIndex: marker.selected ? 1000 : 100,
        },
      );
      if (marker.onClick) {
        placemark.events.add('click', marker.onClick);
      }
      map.geoObjects.add(placemark);
      refs.current.markerById.set(marker.id, { placemark, signature });
    });

    refs.current.markerById.forEach((tracked, id) => {
      if (alive.has(id)) return;
      try {
        map.geoObjects.remove(tracked.placemark);
      } catch {
        // Already detached.
      }
      refs.current.markerById.delete(id);
    });
  }, [markers, status, ymaps]);

  // ── follow an externally-driven centre ──
  useEffect(() => {
    if (!followCenter || status !== 'ready') return;
    const map = refs.current.map as YandexMapInstance | null;
    try {
      map?.setCenter(center, zoom, { duration: 400 });
    } catch {
      // A destroyed map can reject setCenter during unmount races.
    }
  }, [center, zoom, followCenter, status]);

  if (status !== 'ready') return <>{fallback}</>;
  return <div ref={containerRef} className={className || 'h-full w-full'} />;
}
