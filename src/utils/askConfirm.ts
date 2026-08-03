/**
 * Native confirmation dialog — Telegram's own when running inside the Mini App,
 * `window.confirm` otherwise.
 *
 * Telegram's dialog is used in preference because a custom in-page modal can be
 * scrolled past or hidden behind the WebApp chrome on small screens, and this is
 * used for choices that cannot be undone.
 */
export function askConfirm(message: string): Promise<boolean> {
  const telegram = window.Telegram?.WebApp as
    | { showConfirm?: (msg: string, cb: (ok: boolean) => void) => void }
    | undefined;

  if (telegram?.showConfirm) {
    return new Promise<boolean>((resolve) => {
      try {
        telegram.showConfirm!(message, (ok: boolean) => resolve(Boolean(ok)));
      } catch {
        resolve(window.confirm(message));
      }
    });
  }
  return Promise.resolve(window.confirm(message));
}
