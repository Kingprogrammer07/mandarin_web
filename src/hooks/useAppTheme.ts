import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import {
  getThemePreference,
  resolveTheme,
  setThemePreference,
  subscribePlatformTheme,
  subscribeThemePreference,
  syncThemeColorMeta,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

/**
 * The stored preference, shared across every caller.
 *
 * `useSyncExternalStore` rather than `useState`, because the value lives in
 * `localStorage`: two components each holding their own copy would drift the
 * moment one of them wrote.
 */
function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeThemePreference, getThemePreference, () => 'system');
}

/**
 * Keeps `next-themes` pointed at the resolved preference.
 *
 * Mount exactly ONCE, above the app. `next-themes` stays the single writer of
 * the `dark` class and of `localStorage.theme` — setting the class directly
 * would fight the provider, which reasserts its own value on every state
 * change. This only decides which value it should hold.
 */
export function useThemeSync(): void {
  const preference = useThemePreference();
  const { setTheme } = useTheme();

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(preference);
      setTheme(next);
      syncThemeColorMeta(next);
    };

    apply();
    // Only follow Telegram/OS while the client has not chosen for themselves.
    if (preference !== 'system') return;
    return subscribePlatformTheme(apply);
  }, [preference, setTheme]);
}

interface AppTheme {
  /** What is on screen right now. */
  theme: ResolvedTheme;
  /** Whether the client picked this, or it is inherited from Telegram. */
  preference: ThemePreference;
  /** Flip light↔dark and remember the choice. */
  toggle: () => void;
  /** Hand control back to Telegram / the OS. */
  followPlatform: () => void;
}

/** Read the active theme and change it. Safe to call from several components. */
export function useAppTheme(): AppTheme {
  const preference = useThemePreference();
  const { resolvedTheme } = useTheme();

  // `resolvedTheme` is undefined on the very first render, which would show a
  // moon icon to someone already in dark mode — and make the first tap a no-op.
  // Falling back to the same resolution the pre-paint script used avoids both.
  const theme: ResolvedTheme =
    resolvedTheme === 'dark' || resolvedTheme === 'light'
      ? resolvedTheme
      : resolveTheme(preference);

  const toggle = useCallback(() => {
    setThemePreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  const followPlatform = useCallback(() => {
    setThemePreference('system');
  }, []);

  return { theme, preference, toggle, followPlatform };
}
