/**
 * Professional notification sound synthesizer using Web Audio API.
 *
 * Produces pleasant bell-like chimes instead of raw oscillator tones.
 * Two variants:
 *   - normal:  gentle single chime  (D5 + harmonics, 0.4s)
 *   - urgent:  insistent two-tone   (F5→A5, 0.6s)
 */

interface SoundOptions {
  volume?: number;
}

function getAudioContext(): AudioContext | null {
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  return new AC();
}

/**
 * Create a bell-like tone by mixing a triangle wave (rich harmonics)
 * with a sine wave (pure fundamental) and applying an exponential
 * decay envelope.  A very short noise burst at the start adds a
 * crisp “click” attack.
 */
function playBellTone(
  ctx: AudioContext,
  fundamentalHz: number,
  durationSec: number,
  options: SoundOptions = {},
): void {
  const now = ctx.currentTime;
  const vol = options.volume ?? 0.25;

  // ── Master gain (compressor-like limit) ──
  const master = ctx.createGain();
  master.gain.setValueAtTime(vol, now);
  master.connect(ctx.destination);

  // ── 1. Triangle wave (body / harmonics) ──
  const tri = ctx.createOscillator();
  const triGain = ctx.createGain();
  tri.type = "triangle";
  tri.frequency.setValueAtTime(fundamentalHz, now);
  // Slight detune for richness
  tri.detune.setValueAtTime(3, now);
  tri.connect(triGain);
  triGain.connect(master);

  // ── 2. Sine wave (fundamental) ──
  const sine = ctx.createOscillator();
  const sineGain = ctx.createGain();
  sine.type = "sine";
  sine.frequency.setValueAtTime(fundamentalHz, now);
  sine.connect(sineGain);
  sineGain.connect(master);

  // ── 3. Short noise burst (crisp click attack) ──
  const bufferSize = ctx.sampleRate * 0.02; // 20 ms
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.15, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  noise.connect(noiseGain);
  noiseGain.connect(master);

  // ── Envelopes ──
  // Triangle: quick attack, exponential decay
  triGain.gain.setValueAtTime(0, now);
  triGain.gain.linearRampToValueAtTime(0.8, now + 0.01);
  triGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec * 0.9);

  // Sine: slightly softer attack, longer sustain
  sineGain.gain.setValueAtTime(0, now);
  sineGain.gain.linearRampToValueAtTime(0.6, now + 0.02);
  sineGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  // ── Schedule ──
  tri.start(now);
  tri.stop(now + durationSec);
  sine.start(now);
  sine.stop(now + durationSec);
  noise.start(now);
}

/**
 * Gentle single chime for normal (non-urgent) queues.
 * D5 (≈587 Hz) with bell-like decay.
 */
export function playNormalChime(options?: SoundOptions): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playBellTone(ctx, 587.33, 0.45, options);
}

/**
 * Insistent two-tone alert for urgent (VIP/high-priority) queues.
 * First tone F5, second tone A5 — clearly distinct from the normal chime.
 */
export function playUrgentChime(options?: SoundOptions): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const vol = options?.volume ?? 0.3;

  // Tone 1: F5 (≈698 Hz)
  playBellTone(ctx, 698.46, 0.35, { volume: vol });

  // Tone 2: A5 (≈880 Hz) with 120 ms delay
  setTimeout(() => {
    playBellTone(ctx, 880.0, 0.35, { volume: vol });
  }, 120);
}

/**
 * Unified wrapper used by consumers (warehouse, TV).
 * Keeps the same signature as the old functions for easy swap.
 */
export function playNotificationSound(urgent: boolean, options?: SoundOptions): void {
  if (urgent) {
    playUrgentChime(options);
  } else {
    playNormalChime(options);
  }
}
