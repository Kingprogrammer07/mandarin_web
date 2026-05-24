/**
 * One-time onboarding tour helper, built on driver.js (~5KB, zero deps).
 *
 * `runTourOnce` shows a guided highlight tour the FIRST time a surface is
 * visited, then persists a localStorage flag so it never replays. Idle cost is
 * zero — driver.js only touches the DOM while a tour is actively running.
 */
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';

/**
 * Bump when tour content changes and every user should see the new version
 * once more. Old flags (`tour_done_<id>_v1`) stay dormant.
 */
const TOUR_VERSION = 'v1';

const storageKey = (id: string): string => `tour_done_${id}_${TOUR_VERSION}`;

export function hasSeenTour(id: string): boolean {
  try {
    return localStorage.getItem(storageKey(id)) === '1';
  } catch {
    // Private mode / storage disabled → treat as "seen" so we never nag.
    return true;
  }
}

export function markTourSeen(id: string): void {
  try {
    localStorage.setItem(storageKey(id), '1');
  } catch {
    // Ignore — nothing we can do without storage.
  }
}

/** Clear all tour flags (current version). Callable from the Eruda console. */
export function resetAllTours(): void {
  try {
    const suffix = `_${TOUR_VERSION}`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tour_done_') && k.endsWith(suffix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore — storage unavailable.
  }
}

// Expose for manual use in the in-app Eruda console: `__resetTours()`.
if (typeof window !== 'undefined') {
  (window as unknown as { __resetTours?: () => void }).__resetTours = resetAllTours;
}

/**
 * Resolve the first VISIBLE element matching `selector`. Surfaces that render
 * a mobile + desktop copy of the same node (one hidden via CSS) rely on this
 * so the tour highlights whichever is actually on screen.
 */
export function pickVisible(selector: string): Element | undefined {
  const candidates = document.querySelectorAll(selector);
  for (const el of candidates) {
    // offsetParent is null for display:none nodes (and fixed elements, which
    // we don't use as tour targets) — a cheap visibility probe.
    if ((el as HTMLElement).offsetParent !== null) {
      return el;
    }
  }
  return candidates[0];
}

interface RunTourOptions {
  /** Unique, stable id used for the localStorage guard. */
  id: string;
  steps: DriveStep[];
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  /** If true, ignore the once-guard (manual replay, e.g. a "show guide" button). */
  force?: boolean;
}

/**
 * Run a tour once. No-op when already seen, when there are no steps, or when
 * the first step's target is not in the DOM (e.g. a modal that isn't open).
 */
export function runTourOnce(opts: RunTourOptions): void {
  if (!opts.force && hasSeenTour(opts.id)) return;
  if (opts.steps.length === 0) return;

  // Guard against running before the target surface is mounted.
  const first = opts.steps[0]?.element;
  if (typeof first === 'string' && !document.querySelector(first)) return;
  if (first === undefined) return;

  const instance = driver({
    showProgress: true,
    allowClose: true,
    overlayColor: 'rgba(0, 0, 0, 0.65)',
    stagePadding: 6,
    stageRadius: 12,
    nextBtnText: opts.nextBtnText,
    prevBtnText: opts.prevBtnText,
    doneBtnText: opts.doneBtnText,
    steps: opts.steps,
    // Fires on finish AND on early close — "once" means once, even if skipped.
    onDestroyed: () => markTourSeen(opts.id),
  });

  instance.drive();
}
