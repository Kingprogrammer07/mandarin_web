import { useEffect, useState } from 'react';

/**
 * Loads the Yandex Maps JavaScript API **2.1** once per page and reports its state.
 *
 * 2.1 rather than v3 deliberately: the project's key is issued for 2.1 — the v3
 * endpoint rejects it with `403 Invalid api key`, so targeting v3 would silently
 * fall back to Leaflet everywhere.
 *
 * The key is public by design (it ships to the browser); it is protected by the
 * HTTP-Referrer restriction configured in the Yandex console, not by secrecy.
 * When the key is missing or the script fails, this hook reports `unavailable` /
 * `error` and callers render their Leaflet fallback, so a map problem can never
 * blank out an address screen.
 */

export type YandexMapsStatus = 'loading' | 'ready' | 'error' | 'unavailable';

/** Minimal 2.1 surface we use — keeps callers typed without vendoring d.ts. */
export interface YMaps {
  ready: (callback?: () => void) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

declare global {
  interface Window {
    ymaps?: YMaps;
  }
}

const API_KEY: string = import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? '';
const SCRIPT_ID = 'yandex-maps-21';
const LOAD_TIMEOUT_MS = 12_000;

let loaderPromise: Promise<YMaps> | null = null;

function loadYandexMaps(lang: string): Promise<YMaps> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<YMaps>((resolve, reject) => {
    if (!API_KEY) {
      reject(new Error('missing-key'));
      return;
    }
    if (window.ymaps?.Map) {
      resolve(window.ymaps);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);

    const onLoad = () => {
      const api = window.ymaps;
      if (!api) {
        window.clearTimeout(timer);
        reject(new Error('no-namespace'));
        return;
      }
      // 2.1 needs an explicit ready() before its classes exist.
      api
        .ready()
        .then(() => {
          window.clearTimeout(timer);
          resolve(api);
        })
        .catch((error: unknown) => {
          window.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error('ready-failed'));
        });
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener(
      'error',
      () => {
        window.clearTimeout(timer);
        reject(new Error('script-error'));
      },
      { once: true },
    );

    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      // Yandex 2.1 has no Uzbek locale; ru_RU still shows local street names.
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
        API_KEY,
      )}&lang=${lang}`;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    // Let a later mount retry a transient failure (offline, slow network).
    loaderPromise = null;
    throw error;
  });

  return loaderPromise;
}

export function useYandexMaps(lang: string = 'ru_RU'): {
  status: YandexMapsStatus;
  ymaps: YMaps | null;
} {
  const [status, setStatus] = useState<YandexMapsStatus>(
    API_KEY ? 'loading' : 'unavailable',
  );
  const [ymaps, setYmaps] = useState<YMaps | null>(null);

  useEffect(() => {
    if (!API_KEY) return;
    let active = true;
    loadYandexMaps(lang)
      .then((api) => {
        if (!active) return;
        setYmaps(api);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [lang]);

  return { status, ymaps };
}

/** True when a key is configured — lets callers skip rendering Yandex branches. */
export const isYandexMapsConfigured = Boolean(API_KEY);
