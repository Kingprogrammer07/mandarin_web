/** webkit-prefixed AudioContext used by older Safari / iOS WebView. */
interface WindowWithWebkit extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function getAudioContext(): AudioContext | null {
  const win = window as WindowWithWebkit;
  const Ctor = win.AudioContext ?? win.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

const CARGO_AUDIO_VOLUME_KEY = 'expected_cargo_audio_volume';
const DEFAULT_CARGO_AUDIO_VOLUME = 1;
const RUSTER_SUCCESS_MAX_MS = 1200;
const RUSTER_SUCCESS_COOLDOWN_MS = 250;
const RUSTER_SUCCESS_RAPID_WINDOW_MS = 2200;
let rusterSuccessAudio: HTMLAudioElement | null = null;
let rusterSuccessStopTimer: ReturnType<typeof setTimeout> | null = null;
let lastRusterSuccessAt = 0;

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getCargoAudioVolume(): number {
  try {
    const stored = localStorage.getItem(CARGO_AUDIO_VOLUME_KEY);
    if (stored === null) return DEFAULT_CARGO_AUDIO_VOLUME;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clampVolume(parsed) : DEFAULT_CARGO_AUDIO_VOLUME;
  } catch {
    return DEFAULT_CARGO_AUDIO_VOLUME;
  }
}

export function setCargoAudioVolume(value: number) {
  try {
    localStorage.setItem(CARGO_AUDIO_VOLUME_KEY, String(clampVolume(value)));
  } catch {
    // Ignore storage failures; audio can still play with the in-memory value.
  }
}

export function playSuccessSound(volumeOverride?: number) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const volume = clampVolume(volumeOverride ?? getCargoAudioVolume());

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 — high
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // slide up

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.9 * volume, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

export function playRusterSuccessSound(volumeOverride?: number) {
  try {
    const now = Date.now();
    if (now - lastRusterSuccessAt < RUSTER_SUCCESS_COOLDOWN_MS) return;
    const shouldPlayShortSnippet =
      lastRusterSuccessAt > 0 && now - lastRusterSuccessAt < RUSTER_SUCCESS_RAPID_WINDOW_MS;
    lastRusterSuccessAt = now;

    if (!rusterSuccessAudio) {
      rusterSuccessAudio = new Audio('/ruster.mp3');
      rusterSuccessAudio.preload = 'auto';
    }

    if (rusterSuccessStopTimer) {
      clearTimeout(rusterSuccessStopTimer);
      rusterSuccessStopTimer = null;
    }

    rusterSuccessAudio.pause();
    rusterSuccessAudio.currentTime = 0;
    rusterSuccessAudio.volume = clampVolume(volumeOverride ?? getCargoAudioVolume());

    void rusterSuccessAudio.play().then(() => {
      if (shouldPlayShortSnippet) {
        rusterSuccessStopTimer = setTimeout(() => {
          if (!rusterSuccessAudio) return;
          rusterSuccessAudio.pause();
          rusterSuccessAudio.currentTime = 0;
        }, RUSTER_SUCCESS_MAX_MS);
      }
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    }).catch(() => {
      playSuccessSound(volumeOverride);
    });
  } catch (e) {
    console.error('Audio play failed', e);
    playSuccessSound(volumeOverride);
  }
}

const APPLE_PAY_VOLUME = 0.9; // 90% — celebratory cue on a confirmed web payment
let applePayAudio: HTMLAudioElement | null = null;

/**
 * Play the Apple-Pay-style success chime (`/applepay.mp3`) at a fixed 90% volume.
 *
 * Used on the web NBU payment-success surfaces so the user *feels* the payment
 * landed. Autoplay may be blocked in a redirect tab that never received a user
 * gesture — that rejection is swallowed (the visual success state still shows).
 */
export function playApplePaySound() {
  try {
    if (!applePayAudio) {
      applePayAudio = new Audio('/applepay.mp3');
      applePayAudio.preload = 'auto';
    }
    applePayAudio.pause();
    applePayAudio.currentTime = 0;
    applePayAudio.volume = APPLE_PAY_VOLUME;
    void applePayAudio.play().catch(() => {
      // Autoplay policy blocked it (no prior gesture in this tab) — ignore.
    });
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

/**
 * Played when a scan resolves to a DIFFERENT client than the previous one.
 *
 * Deliberately unlike the other four: triangle timbre (success is sine,
 * warning sawtooth, error square) and two DISCRETE rising notes rather than
 * success's single glide, so a warehouse worker hears "new person" without
 * looking up. Rising rather than falling because nothing went wrong — the
 * scan succeeded, the owner just changed.
 */
export function playClientChangeSound(volumeOverride?: number) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const volume = clampVolume(volumeOverride ?? getCargoAudioVolume());

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.85 * volume, startTime + 0.012);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Ascending perfect fifth: C5 -> G5.
    playTone(523.25, ctx.currentTime, 0.09);
    playTone(783.99, ctx.currentTime + 0.11, 0.11);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

/** Two-tone descending warning chime — distinct from success (ascending) and error (square). */
export function playWarningSound(volumeOverride?: number) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const volume = clampVolume(volumeOverride ?? getCargoAudioVolume());

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.75 * volume, startTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Descending two-tone: 660 Hz → 440 Hz (warning interval)
    playTone(760, ctx.currentTime, 0.08);
    playTone(760, ctx.currentTime + 0.12, 0.08);
    playTone(520, ctx.currentTime + 0.24, 0.12);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

export function playErrorSound(volumeOverride?: number) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const volume = clampVolume(volumeOverride ?? getCargoAudioVolume());

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime); // low pitch
    osc.frequency.setValueAtTime(250, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(1 * volume, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}
