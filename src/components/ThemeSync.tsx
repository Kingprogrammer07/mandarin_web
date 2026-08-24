import { useThemeSync } from '@/hooks/useAppTheme';

/**
 * Holds `next-themes` to the stored theme preference and re-resolves it when
 * Telegram switches theme underneath the app.
 *
 * Mounted once above the router rather than inside a screen, so the sync
 * survives navigation: a client who changes Telegram's theme while on the
 * profile page should see the app follow immediately, not on their next visit
 * to Home. Must sit INSIDE `ThemeProvider` — it calls `useTheme()`.
 */
export function ThemeSync() {
  useThemeSync();
  return null;
}
