import { useState, useEffect, useCallback } from 'react';

/**
 * Standard browser PWA install event — not part of the official DOM spec
 * typings, so we define it here.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallMethod = 'telegram' | 'browser' | null;

export interface UseInstallPromptResult {
  /** True when there is an actionable install path available. */
  canInstall: boolean;
  /** Which install mechanism will be used when handleInstall() is called. */
  installMethod: InstallMethod;
  /** Trigger the install flow for whichever platform is active. */
  handleInstall: () => void;
}

/**
 * Detects whether the app can be installed to the home screen and exposes
 * a single `handleInstall()` that dispatches to the correct platform API:
 *
 * - **Telegram Mini App** (Bot API 8.0+): calls `Telegram.WebApp.addToHomeScreen()`
 * - **Android / Desktop browser**: defers and replays the `beforeinstallprompt` event
 * - **iOS Safari**: handled via the `apple-mobile-web-app-capable` meta tag in
 *   index.html — users can add through the Share sheet manually; we surface a
 *   toast instruction from the call-site when `installMethod === null` on iOS.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    // ── Telegram path ──────────────────────────────────────────────────────────
    // addToHomeScreen() is available since Bot API 8.0
    if (
      tg &&
      typeof tg.isVersionAtLeast === 'function' &&
      tg.isVersionAtLeast('8.0') &&
      typeof tg.addToHomeScreen === 'function'
    ) {
      if (typeof tg.checkHomeScreenStatus === 'function') {
        tg.checkHomeScreenStatus((status) => {
          // Only offer the button when not already pinned
          if (status !== 'added' && status !== 'unsupported') {
            setInstallMethod('telegram');
          }
        });
      } else {
        // Older 8.x builds that lack checkHomeScreenStatus — defer to avoid
        // synchronous setState inside an effect body (cascading render warning)
        setTimeout(() => setInstallMethod('telegram'), 0);
      }
      return;
    }

    // ── Browser PWA path ───────────────────────────────────────────────────────
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing; we surface our own UI
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallMethod('browser');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = useCallback(() => {
    if (installMethod === 'telegram') {
      window.Telegram?.WebApp?.addToHomeScreen?.();
    } else if (installMethod === 'browser' && deferredPrompt) {
      deferredPrompt
        .prompt()
        .then(() => deferredPrompt.userChoice)
        .then(() => {
          // Hide the button regardless of outcome — user has seen the prompt
          setDeferredPrompt(null);
          setInstallMethod(null);
        });
    }
  }, [installMethod, deferredPrompt]);

  return { canInstall: installMethod !== null, installMethod, handleInstall };
}
