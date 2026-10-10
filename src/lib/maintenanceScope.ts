import { isClientPath } from '@/lib/session';

/**
 * Where the "Texnik ishlar" screens are allowed to appear: client pages only.
 *
 * The app has two maintenance screens. The full-screen `MaintenancePage`
 * ("Texnik ishlar ketmoqda") is flipped by `client.ts` when the backend looks
 * down (502/503/504 or a refused connection); the `MaintenanceOverlay` follows
 * the admin-toggled maintenance switch. Both were meant for clients. Staff in
 * the admin panel, the cashier consoles, the warehouse scanners and the flight
 * screens keep their page through an outage and see the failing request's own
 * error instead of a wall over their work.
 *
 * Listed positively on purpose. The old rule exempted a handful of staff
 * consoles by name, so every other admin page was still covered — and every
 * new one would have been too. Naming the client pages instead means a new
 * staff page is clear of the screen without anyone remembering to exempt it.
 *
 * `client.ts` checks this before flipping the store and `App.tsx` before
 * rendering either screen, so the two layers cannot disagree.
 */

/**
 * The client's guest screens, which `isClientPath` leaves out because they
 * carry no client credential. `/` is where the Mini App opens before routing.
 */
const CLIENT_GUEST_PATHS: readonly string[] = ['/', '/auth/login', '/auth/register'];

/** True when `pathname` is a client page, the only place a maintenance screen may show. */
export function isMaintenanceScreenPath(pathname: string): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return isClientPath(path) || CLIENT_GUEST_PATHS.includes(path);
}
