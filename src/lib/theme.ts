/**
 * Theme preference for the client app.
 *
 * `next-themes` (mounted in `main.tsx`) stays the only thing that touches the
 * `dark` class and `localStorage.theme` — this module owns the *preference*
 * above it, which `next-themes` cannot express: "follow whatever Telegram is
 * doing". Its own `enableSystem` resolves to `prefers-color-scheme`, and inside
 * a Telegram WebView that is not the same question. A client who runs Telegram
 * in dark on a light phone should get a dark Mini App.
 *
 * The preference lives under its own key so `localStorage.theme` keeps holding
 * a plain 'light' | 'dark' — several staff screens read it directly
 * (`POSDashboard.tsx:167`, `AdminLayout.tsx:109`) and would break on 'system'.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREF_KEY = 'mc:theme-pref';

/** Background per theme, mirrored from `--mc-bg` in `index.css`. Kept as
 *  literals because `<meta name="theme-color">` is set before any stylesheet
 *  has been parsed. Update both places together. */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f7f7f8',
  dark: '#0f0f11',
};

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_PREF_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Falling back
    // to the platform is the right default, not an error worth surfacing.
  }
  return 'system';
}

/**
 * Subscribers to preference changes.
 *
 * The preference is read from `localStorage`, which React cannot observe, and
 * it is read from more than one component. A module-level store keeps every
 * caller on the same value instead of each holding its own `useState` copy
 * that the others never hear about.
 */
const preferenceListeners = new Set<() => void>();

export function subscribeThemePreference(onChange: () => void): () => void {
  preferenceListeners.add(onChange);
  return () => {
    preferenceListeners.delete(onChange);
  };
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_PREF_KEY);
    else localStorage.setItem(THEME_PREF_KEY, preference);
  } catch {
    // Preference simply will not survive a reload; the session still switches.
  }
  preferenceListeners.forEach((listener) => listener());
}

/** What the platform around us is currently showing. */
export function getPlatformTheme(): ResolvedTheme {
  const telegramScheme = window.Telegram?.WebApp?.colorScheme;
  if (telegramScheme === 'light' || telegramScheme === 'dark') return telegramScheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getPlatformTheme() : preference;
}

/**
 * Notify on any platform-level theme change: Telegram's own switch, and the OS
 * media query for the browser-tab case. Returns an unsubscribe function.
 */
export function subscribePlatformTheme(onChange: () => void): () => void {
  const webApp = window.Telegram?.WebApp;
  webApp?.onEvent?.('themeChanged', onChange);

  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  query?.addEventListener('change', onChange);

  return () => {
    webApp?.offEvent?.('themeChanged', onChange);
    query?.removeEventListener('change', onChange);
  };
}

/** Keep the browser chrome (Telegram header, iOS status bar) in step. */
export function syncThemeColorMeta(theme: ResolvedTheme): void {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
}
