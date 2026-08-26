/**
 * Fire a one-time onboarding tour when a surface mounts (or becomes enabled).
 *
 * Steps are produced by a builder so target elements are resolved lazily —
 * after the short delay the DOM (and any open modal) is settled, which lets
 * `pickVisible` pick the on-screen copy of responsive nodes.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DriveStep } from 'driver.js';
import { runTourOnce, stopActiveTour } from '@/utils/tour';

/** Delay before launching so mount/route animations finish first. */
const DEFAULT_DELAY_MS = 750;

export function useGuideTour(
  id: string,
  buildSteps: () => DriveStep[],
  enabled = true,
  delayMs: number = DEFAULT_DELAY_MS,
): void {
  const { t } = useTranslation();

  // Keep the latest builder without making it an effect dependency, so the
  // tour fires exactly once per (id, enabled) transition. Updating the ref in
  // an effect (not during render) keeps the React Compiler lint happy.
  const buildRef = useRef(buildSteps);
  useEffect(() => {
    buildRef.current = buildSteps;
  });

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => {
      runTourOnce({
        id,
        steps: buildRef.current(),
        nextBtnText: t('tour.next'),
        prevBtnText: t('tour.prev'),
        doneBtnText: t('tour.done'),
      });
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      // Not just the pending timer: a tour that already started must go with the
      // screen it was explaining, or its back handler keeps swallowing presses
      // on whatever replaced it.
      stopActiveTour();
    };
  }, [id, enabled, delayMs, t]);
}
