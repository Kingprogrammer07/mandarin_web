import { useEffect } from "react";
import { checkForNewVersion } from "@/utils/appUpdate";

// How often to re-check for a new deploy while the tab is visible.
const POLL_INTERVAL_MS = 3 * 60_000;

/**
 * Proactively detects a newer frontend deploy and prompts the user to reload.
 *
 * The reactive path (vite:preloadError in main.tsx) only fires when the user
 * navigates to a lazy route whose chunk has been removed by a deploy. A user
 * sitting on an already-loaded page (e.g. the POS dashboard) would otherwise
 * stay on the stale bundle indefinitely. This watcher closes that gap by
 * polling `version.json` on mount, on tab focus / visibility (which fires when
 * a Telegram Mini App is reopened), and on a slow visibility-gated interval.
 */
export function useVersionWatcher(): void {
  useEffect(() => {
    // Initial mount = a fresh app open. If a newer build shipped, reload silently
    // instead of prompting — the user is entering now, so it's seamless.
    void checkForNewVersion({ autoReload: true });

    const onActive = () => {
      // Mid-session (tab refocus / Mini App reopen / slow interval): prompt only,
      // never auto-reload — an active user must not be yanked off the page.
      if (document.visibilityState === "visible") void checkForNewVersion();
    };

    const intervalId = window.setInterval(onActive, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, []);
}
