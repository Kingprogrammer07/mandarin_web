import { useEffect, useSyncExternalStore } from 'react';

import { canGoBack, runBack, subscribeBackStack } from '@/lib/backStack';

/**
 * Wires Telegram's back button to the app's back stack.
 *
 * Why this exists: the phone's system back button used to close the Mini App.
 * Telegram only routes that press into the web view while `WebApp.BackButton`
 * is visible and has a listener — and this codebase never called either, so
 * Telegram applied its own default, which is to close.
 *
 * This is the ONLY component that touches `WebApp.BackButton`. Everything else
 * joins in through `useBackHandler`.
 *
 * The button is shown exactly when there is somewhere to go back to and hidden
 * otherwise, which leaves Telegram's close-the-app default in place at the root
 * of the app — where it is the right behaviour.
 */
export function TelegramBackBridge({ enabled }: { enabled: boolean }) {
  const showButton = useSyncExternalStore(
    subscribeBackStack,
    canGoBack,
    // Server/prerender snapshot. There is no back stack before hydration.
    () => false,
  );

  useEffect(() => {
    if (!enabled) return;

    const webApp = window.Telegram?.WebApp;
    // BackButton is Bot API 6.1+. An older or cached telegram-web-app.js may
    // not expose isVersionAtLeast at all, hence the optional call.
    if (!webApp?.BackButton || webApp.isVersionAtLeast?.('6.1') === false) return;

    const backButton = webApp.BackButton;
    const onClick = () => {
      runBack();
    };

    backButton.onClick(onClick);
    return () => {
      backButton.offClick(onClick);
      // Leaving a visible back button behind would have Telegram route presses
      // at a bridge that is no longer listening — a dead button.
      backButton.hide();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;

    if (showButton) backButton.show();
    else backButton.hide();
  }, [enabled, showButton]);

  return null;
}
