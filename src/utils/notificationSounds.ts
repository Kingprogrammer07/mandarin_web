/**
 * Lightweight custom notification sound using a pre-loaded HTMLAudioElement.
 *
 * Replaces the synthesised Web-Audio chimes with the user's own
 * /sound.mp3 so that warehouse / POS / TV notifications sound exactly
 * the way the business wants.
 *
 * Performance notes
 * -----------------
 * • The Audio object is created once at module initialisation and kept
 *   in memory, so there is zero per-call allocation cost.
 * • preload="auto" hints the browser to start fetching the file as
 *   early as possible (ideally add `<link rel="preload" as="audio" href="/sound.mp3">`
 *   to index.html for even faster first playback).
 * • playbackRate is left at 1.0 – if you ever want an "urgent" variant
 *   you can simply call play() twice or use a second file.
 */

interface SoundOptions {
  volume?: number;
}

/** Single shared audio instance – created as soon as the module parses. */
const audio = new Audio("/sound.mp3");
audio.preload = "auto";

/**
 * Play the custom notification sound.
 *
 * @param _urgent – kept for API compatibility with existing callers.
 *                  (The old urgent synthesised two-tone is replaced by
 *                  the same custom sound for consistency.)
 * @param options.volume – 0.0 … 1.0  (default 0.8)
 */
export function playNotificationSound(_urgent: boolean, options?: SoundOptions): void {
  const vol = options?.volume ?? 0.8;

  // Guard: audio element might not be ready on very first tick
  if (!audio) return;

  try {
    audio.volume = Math.max(0, Math.min(1, vol));
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // Autoplay-policy or other runtime error – silently ignore
  }
}

/** Convenience export for callers that only need the normal chime. */
export function playNormalChime(options?: SoundOptions): void {
  playNotificationSound(false, options);
}

/** Convenience export for callers that only need the urgent chime. */
export function playUrgentChime(options?: SoundOptions): void {
  playNotificationSound(true, options);
}
