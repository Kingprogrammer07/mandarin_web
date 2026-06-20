import {
  playErrorSound,
  playRusterSuccessSound,
  playSuccessSound,
  playWarningSound,
} from '@/utils/audioUtils';
import {
  EXPECTED_CARGO_SOUND_EVENTS,
  expectedCargoSoundStorage,
  type ExpectedCargoCustomSound,
  type ExpectedCargoSoundEvent,
  type ExpectedCargoSoundProfile,
} from '@/utils/expectedCargoSoundStorage';

interface CachedCustomSound extends ExpectedCargoCustomSound {
  objectUrl: string;
}

let profileCache: ExpectedCargoSoundProfile | null = null;
let cachePromise: Promise<void> | null = null;
let customSoundCache = new Map<ExpectedCargoSoundEvent, CachedCustomSound>();
let activeCustomAudio: HTMLAudioElement | null = null;
let pendingCustomEvent: ExpectedCargoSoundEvent | null = null;

function stopActiveCustomAudio(): void {
  pendingCustomEvent = null;
  if (!activeCustomAudio) return;
  activeCustomAudio.pause();
  activeCustomAudio.currentTime = 0;
  activeCustomAudio = null;
}

function playPendingCustomSound(): void {
  const pendingEvent = pendingCustomEvent;
  pendingCustomEvent = null;
  if (pendingEvent) void playExpectedCargoSound(pendingEvent);
}

function replaceCustomSoundCache(records: ExpectedCargoCustomSound[]): void {
  for (const cached of customSoundCache.values()) {
    URL.revokeObjectURL(cached.objectUrl);
  }
  customSoundCache = new Map(
    records.map((record) => [
      record.event,
      { ...record, objectUrl: URL.createObjectURL(record.blob) },
    ]),
  );
}

export async function refreshExpectedCargoSoundCache(): Promise<void> {
  const [profile, customSounds] = await Promise.all([
    expectedCargoSoundStorage.loadProfile(),
    expectedCargoSoundStorage.loadCustomSounds(),
  ]);
  profileCache = profile;
  replaceCustomSoundCache(customSounds);
}

export function initializeExpectedCargoSounds(): Promise<void> {
  if (!cachePromise) {
    cachePromise = refreshExpectedCargoSoundCache().catch((error: unknown) => {
      cachePromise = null;
      console.error('Expected Cargo sound cache failed', error);
    });
  }
  return cachePromise;
}

function playDefaultSound(event: ExpectedCargoSoundEvent, volume: number): void {
  if (event === 'success' || event === 'merge') {
    playSuccessSound(volume);
  } else if (event === 'error') {
    playErrorSound(volume);
  } else {
    playWarningSound(volume);
  }
}

function triggerHaptic(event: ExpectedCargoSoundEvent): void {
  const feedback = window.Telegram?.WebApp?.HapticFeedback;
  if (!feedback) return;
  const type = event === 'success' || event === 'merge'
    ? 'success'
    : event === 'error'
      ? 'error'
      : 'warning';
  feedback.notificationOccurred(type);
}

export async function playExpectedCargoSound(event: ExpectedCargoSoundEvent): Promise<void> {
  await initializeExpectedCargoSounds();
  const settings = profileCache?.events[event];
  if (!settings?.enabled || settings.volume <= 0) return;

  if (settings.source === 'ruster') {
    playRusterSuccessSound(settings.volume);
    return;
  }

  const custom = customSoundCache.get(event);
  if (settings.source !== 'custom' || !custom) {
    playDefaultSound(event, settings.volume);
    return;
  }

  if (activeCustomAudio && !activeCustomAudio.paused) {
    if (settings.playbackMode === 'finish') {
      pendingCustomEvent = event;
      return;
    }
    stopActiveCustomAudio();
  }

  const audio = new Audio(custom.objectUrl);
  audio.volume = settings.volume;
  activeCustomAudio = audio;
  audio.addEventListener('ended', () => {
    if (activeCustomAudio === audio) activeCustomAudio = null;
    playPendingCustomSound();
  }, { once: true });
  try {
    await audio.play();
    triggerHaptic(event);
  } catch {
    if (activeCustomAudio === audio) activeCustomAudio = null;
    playDefaultSound(event, settings.volume);
    playPendingCustomSound();
  }
}

export async function testExpectedCargoSound(
  event: ExpectedCargoSoundEvent,
  profile: ExpectedCargoSoundProfile,
  stagedFile?: File,
): Promise<void> {
  const settings = profile.events[event];
  if (!settings.enabled || settings.volume <= 0) return;

  if (settings.source === 'ruster') {
    playRusterSuccessSound(settings.volume);
    return;
  }

  if (settings.source !== 'custom') {
    playDefaultSound(event, settings.volume);
    return;
  }

  const cached = customSoundCache.get(event);
  const objectUrl = stagedFile
    ? URL.createObjectURL(stagedFile)
    : cached?.objectUrl;
  if (!objectUrl) {
    playDefaultSound(event, settings.volume);
    return;
  }

  stopActiveCustomAudio();
  const audio = new Audio(objectUrl);
  audio.volume = settings.volume;
  activeCustomAudio = audio;
  audio.addEventListener('ended', () => {
    if (stagedFile) URL.revokeObjectURL(objectUrl);
    if (activeCustomAudio === audio) activeCustomAudio = null;
  }, { once: true });
  await audio.play().catch(() => {
    if (stagedFile) URL.revokeObjectURL(objectUrl);
    playDefaultSound(event, settings.volume);
  });
}

export function getExpectedCargoSoundProfileSnapshot(): ExpectedCargoSoundProfile | null {
  return profileCache
    ? structuredClone(profileCache)
    : null;
}

export function getExpectedCargoCustomSoundNames(): Partial<Record<ExpectedCargoSoundEvent, string>> {
  return Object.fromEntries(
    EXPECTED_CARGO_SOUND_EVENTS.flatMap((event) => {
      const sound = customSoundCache.get(event);
      return sound ? [[event, sound.fileName]] : [];
    }),
  );
}
