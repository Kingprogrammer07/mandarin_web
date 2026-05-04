interface SavedMapLocation {
  version: number;
  savedAt: string;
  latitude: number;
  longitude: number;
}

const STORAGE_KEY = 'mandarin:deliveryMapLocation:v1';
const STORAGE_VERSION = 1;

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isSavedMapLocation(value: unknown): value is SavedMapLocation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    version?: unknown;
    savedAt?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };

  return (
    candidate.version === STORAGE_VERSION &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.latitude === 'number' &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === 'number' &&
    Number.isFinite(candidate.longitude)
  );
}

export function getSavedMapLocation(): { latitude: number; longitude: number } | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isSavedMapLocation(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveMapLocation(location: { latitude: number; longitude: number }): void {
  if (!canUseLocalStorage()) {
    return;
  }

  const preference: SavedMapLocation = {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    latitude: location.latitude,
    longitude: location.longitude,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Storage can be unavailable in private modes
  }
}

export function clearSavedMapLocation(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
