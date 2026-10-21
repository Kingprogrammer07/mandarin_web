import { useEffect } from "react";

/**
 * Telegram minimises the whole Mini App on a downward swipe. While a
 * full-screen layer is open (a photo, the camera) that gesture belongs to the
 * layer, so Telegram's is switched off and put back as it was.
 */
export function useTelegramVerticalSwipesOff() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    // Older clients only print an "unsupported" warning.
    if (!webApp?.disableVerticalSwipes || webApp.isVersionAtLeast?.("7.7") !== true) return;
    const wasEnabled = webApp.isVerticalSwipesEnabled !== false;
    webApp.disableVerticalSwipes();
    return () => {
      if (wasEnabled) webApp.enableVerticalSwipes?.();
    };
  }, []);
}
