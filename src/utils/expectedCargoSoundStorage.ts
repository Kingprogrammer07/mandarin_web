import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { getCargoAudioVolume } from '@/utils/audioUtils';

export const EXPECTED_CARGO_SOUND_EVENTS = [
  'success',
  'warning',
  'error',
  'duplicate',
  'merge',
] as const;

export type ExpectedCargoSoundEvent = typeof EXPECTED_CARGO_SOUND_EVENTS[number];
export type ExpectedCargoSoundSource = 'default' | 'ruster' | 'custom';
export type ExpectedCargoPlaybackMode = 'restart' | 'finish';

export interface ExpectedCargoEventSoundSettings {
  enabled: boolean;
  source: ExpectedCargoSoundSource;
  volume: number;
  playbackMode: ExpectedCargoPlaybackMode;
}

export interface ExpectedCargoSoundProfile {
  id: 'active';
  version: 1;
  events: Record<ExpectedCargoSoundEvent, ExpectedCargoEventSoundSettings>;
  updatedAt: number;
}

export interface ExpectedCargoCustomSound {
  event: ExpectedCargoSoundEvent;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  updatedAt: number;
}

interface ExpectedCargoSoundDB extends DBSchema {
  profiles: {
    key: string;
    value: ExpectedCargoSoundProfile;
  };
  custom_sounds: {
    key: ExpectedCargoSoundEvent;
    value: ExpectedCargoCustomSound;
  };
}

const DB_NAME = 'expected-cargo-sound-db';
const DB_VERSION = 1;
const PROFILE_STORE = 'profiles';
const SOUND_STORE = 'custom_sounds';
const PROFILE_ID = 'active';
const LEGACY_RUSTER_KEY = 'expected_cargo_ruster_success_sound';

let dbPromise: Promise<IDBPDatabase<ExpectedCargoSoundDB>> | null = null;

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getDB(): Promise<IDBPDatabase<ExpectedCargoSoundDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ExpectedCargoSoundDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROFILE_STORE)) {
          db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SOUND_STORE)) {
          db.createObjectStore(SOUND_STORE, { keyPath: 'event' });
        }
      },
    });
  }
  return dbPromise;
}

export function createDefaultExpectedCargoSoundProfile(): ExpectedCargoSoundProfile {
  const legacyVolume = getCargoAudioVolume();
  let useLegacyRuster = false;
  try {
    useLegacyRuster = localStorage.getItem(LEGACY_RUSTER_KEY) === 'true';
  } catch {
    // IndexedDB settings still work when localStorage is unavailable.
  }

  const base = (source: ExpectedCargoSoundSource = 'default') => ({
    enabled: true,
    source,
    volume: clampVolume(legacyVolume),
    playbackMode: 'restart' as const,
  });

  return {
    id: PROFILE_ID,
    version: 1,
    events: {
      success: base(useLegacyRuster ? 'ruster' : 'default'),
      warning: base(),
      error: base(),
      duplicate: base(),
      merge: base(),
    },
    updatedAt: Date.now(),
  };
}

function normalizeProfile(profile: ExpectedCargoSoundProfile): ExpectedCargoSoundProfile {
  const defaults = createDefaultExpectedCargoSoundProfile();
  const events = Object.fromEntries(
    EXPECTED_CARGO_SOUND_EVENTS.map((event) => {
      const stored = profile.events?.[event];
      return [event, {
        ...defaults.events[event],
        ...stored,
        volume: clampVolume(stored?.volume ?? defaults.events[event].volume),
      }];
    }),
  ) as Record<ExpectedCargoSoundEvent, ExpectedCargoEventSoundSettings>;

  return { ...profile, id: PROFILE_ID, version: 1, events };
}

export const expectedCargoSoundStorage = {
  async loadProfile(): Promise<ExpectedCargoSoundProfile> {
    const db = await getDB();
    const stored = await db.get(PROFILE_STORE, PROFILE_ID);
    if (stored) return normalizeProfile(stored);

    const profile = createDefaultExpectedCargoSoundProfile();
    await db.put(PROFILE_STORE, profile);
    return profile;
  },

  async saveProfile(profile: ExpectedCargoSoundProfile): Promise<ExpectedCargoSoundProfile> {
    const normalized = normalizeProfile({ ...profile, updatedAt: Date.now() });
    const db = await getDB();
    await db.put(PROFILE_STORE, normalized);
    return normalized;
  },

  async loadCustomSounds(): Promise<ExpectedCargoCustomSound[]> {
    const db = await getDB();
    return db.getAll(SOUND_STORE);
  },

  async saveCustomSound(
    event: ExpectedCargoSoundEvent,
    file: File,
  ): Promise<ExpectedCargoCustomSound> {
    const record: ExpectedCargoCustomSound = {
      event,
      blob: file,
      fileName: file.name,
      mimeType: file.type || 'audio/mpeg',
      size: file.size,
      updatedAt: Date.now(),
    };
    const db = await getDB();
    await db.put(SOUND_STORE, record);
    return record;
  },

  async deleteCustomSound(event: ExpectedCargoSoundEvent): Promise<void> {
    const db = await getDB();
    await db.delete(SOUND_STORE, event);
  },

  async reset(): Promise<ExpectedCargoSoundProfile> {
    const db = await getDB();
    const transaction = db.transaction([PROFILE_STORE, SOUND_STORE], 'readwrite');
    await transaction.objectStore(SOUND_STORE).clear();
    const profile = createDefaultExpectedCargoSoundProfile();
    for (const event of EXPECTED_CARGO_SOUND_EVENTS) {
      profile.events[event] = {
        enabled: true,
        source: 'default',
        volume: 1,
        playbackMode: 'restart',
      };
    }
    try {
      localStorage.removeItem(LEGACY_RUSTER_KEY);
    } catch {
      // IndexedDB reset remains authoritative when localStorage is unavailable.
    }
    await transaction.objectStore(PROFILE_STORE).put(profile);
    await transaction.done;
    return profile;
  },
};
