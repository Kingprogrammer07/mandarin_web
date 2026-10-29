/**
 * The session table, locked before it is changed.
 *
 * These assertions describe what `App.tsx` does TODAY, extracted verbatim.
 * One of them — a staff token winning a `/user/*` route — is the trap the
 * owner reported: open the admin panel once inside Telegram and the client app
 * becomes unreachable, because both sessions share one storage context in that
 * WebView and the staff branch returned before the client token was read. It is
 * asserted here so the behaviour change that fixes it shows up in a diff rather
 * than sliding in unnoticed.
 */

import { describe, expect, it } from 'vitest';

import {
  credentialForPath,
  isClientEntryPath,
  isClientPath,
  isStaffPath,
  pickSession,
  type StoredSessions,
} from './session';

const NONE: StoredSessions = { adminToken: null, adminRole: null, userToken: null };
const STAFF: StoredSessions = { adminToken: 'jwt', adminRole: 'super-admin', userToken: null };
const CLIENT: StoredSessions = { adminToken: null, adminRole: null, userToken: 'tok' };
const BOTH: StoredSessions = { adminToken: 'jwt', adminRole: 'super-admin', userToken: 'tok' };

const STAFF_ROUTE = { isPublic: false, isUserPage: false, isClientEntry: false };
const USER_ROUTE = { isPublic: false, isUserPage: true, isClientEntry: false };
const PUBLIC_ROUTE = { isPublic: true, isUserPage: false, isClientEntry: false };
// `/auth/login`: what every "Mini App" button in the bot opens.
const ENTRY_ROUTE = { isPublic: false, isUserPage: false, isClientEntry: true };

describe('a public route', () => {
  it('needs no session', () => {
    expect(pickSession(NONE, PUBLIC_ROUTE)).toEqual({ kind: 'public', role: null });
  });

  it('still reports a staff role when one is stored, for display', () => {
    expect(pickSession(STAFF, PUBLIC_ROUTE)).toEqual({
      kind: 'public',
      role: 'super-admin',
    });
  });

  it('does not claim a role from a client token it has not verified', () => {
    expect(pickSession(CLIENT, PUBLIC_ROUTE)).toEqual({ kind: 'public', role: null });
  });
});

describe('a staff route', () => {
  it('is served by the staff session', () => {
    expect(pickSession(STAFF, STAFF_ROUTE)).toEqual({ kind: 'admin', role: 'super-admin' });
  });

  it('shows the staff login when only a client session is stored', () => {
    // A client session only opens client pages now, so it used to bounce a
    // staff member who pressed «Admin panel» back to the client home.
    expect(pickSession(CLIENT, STAFF_ROUTE)).toEqual({ kind: 'guest' });
  });

  it('is a guest with nothing stored', () => {
    expect(pickSession(NONE, STAFF_ROUTE)).toEqual({ kind: 'guest' });
  });

  it('needs the role, not just the token', () => {
    const tokenOnly = { adminToken: 'jwt', adminRole: null, userToken: null };
    expect(pickSession(tokenOnly, STAFF_ROUTE)).toEqual({ kind: 'guest' });
  });
});

describe('a client route', () => {
  it('is served by the client session', () => {
    expect(pickSession(CLIENT, USER_ROUTE)).toEqual({ kind: 'client' });
  });

  it('is a guest with nothing stored', () => {
    expect(pickSession(NONE, USER_ROUTE)).toEqual({ kind: 'guest' });
  });

  it('is served by the client session even when a staff session exists', () => {
    // The reported trap. Previously the staff session took this route and
    // `checkAccess` rewrote the URL to the admin dashboard, so a staff member
    // who opened the panel once inside Telegram could not get back to the
    // client app from that WebView at all.
    expect(pickSession(BOTH, USER_ROUTE)).toEqual({ kind: 'client' });
  });

  it('sends a staff member with no client session to the client login', () => {
    // Not the admin dashboard: they asked for a client page, and the honest
    // answer is that they are not signed in as a customer.
    expect(pickSession(STAFF, USER_ROUTE)).toEqual({ kind: 'guest' });
  });

  it('leaves staff routes alone', () => {
    expect(pickSession(BOTH, STAFF_ROUTE)).toEqual({ kind: 'admin', role: 'super-admin' });
  });
});

describe("the client app's front door", () => {
  it('opens the client app for a staff member who is also a customer', () => {
    // The reported trap: the bot's client button opened the admin panel for
    // every admin with a staff session stored, so they could not use the
    // client app the way customers do.
    expect(pickSession(BOTH, ENTRY_ROUTE)).toEqual({ kind: 'client' });
  });

  it('still takes a staff member with no client account to the staff panel', () => {
    expect(pickSession(STAFF, ENTRY_ROUTE)).toEqual({ kind: 'admin', role: 'super-admin' });
  });

  it('is served by the client session for a customer', () => {
    expect(pickSession(CLIENT, ENTRY_ROUTE)).toEqual({ kind: 'client' });
  });

  it('is a guest with nothing stored', () => {
    expect(pickSession(NONE, ENTRY_ROUTE)).toEqual({ kind: 'guest' });
  });

  it.each(['/', '/auth/login', '/auth/login/', '/auth/register'])('%s is the front door', (path) => {
    expect(isClientEntryPath(path)).toBe(true);
  });

  it.each(['/admin/login', '/admin', '/user/home', '/kassa'])('%s is not', (path) => {
    expect(isClientEntryPath(path)).toBe(false);
  });

  it('asks /auth/me with the client token when both are stored', () => {
    // Sent with the staff JWT instead, a rejected client check would have been
    // read as the staff session dying and signed the admin out of the panel.
    const both = { adminToken: 'jwt', userToken: 'tok' };
    expect(credentialForPath('/auth/login', both)).toBe('client');
    expect(credentialForPath('/', both)).toBe('client');
    expect(credentialForPath('/auth/login', { adminToken: 'jwt', userToken: null })).toBe('admin');
  });
});

describe.each(['uzpost-label-config', 'delivery-override'])(
  'a staff session whose active role has no screen: %s',
  (capabilityRole) => {
    // Capability roles only grant permissions. A browser switched into one kept
    // `admin_role` in localStorage and reopened the same blank page on every
    // load, with no switcher and no sign-out on screen.
    const GRANT: StoredSessions = {
      adminToken: 'jwt',
      adminRole: capabilityRole,
      userToken: null,
    };

    it('is discarded on a staff route', () => {
      expect(pickSession(GRANT, STAFF_ROUTE)).toEqual({ kind: 'discard-admin' });
    });

    it('is discarded even when a client session is stored too', () => {
      expect(pickSession({ ...GRANT, userToken: 'tok' }, STAFF_ROUTE)).toEqual({
        kind: 'discard-admin',
      });
    });

    it('leaves the client app to the client session', () => {
      expect(pickSession({ ...GRANT, userToken: 'tok' }, USER_ROUTE)).toEqual({
        kind: 'client',
      });
    });

    it('is not reported as the role on a public route', () => {
      // App routes later in-app navigation with this role; reporting it would lead
      // back to the same blank page from /pickup-tv or an NBU return page.
      expect(pickSession(GRANT, PUBLIC_ROUTE)).toEqual({ kind: 'public', role: null });
    });

    it.each(['worker', 'manager', 'warehouse', 'accountant', 'super-admin'])(
      'keeps serving %s',
      (role) => {
        expect(
          pickSession({ adminToken: 'jwt', adminRole: role, userToken: null }, STAFF_ROUTE),
        ).toEqual({ kind: 'admin', role });
      },
    );
  },
);

describe('route classification', () => {
  it.each([
    '/admin/dashboard',
    '/admin/system-settings',
    // The stock-take scanner. A worker opens it in a browser on the warehouse
    // floor, so leaving it out puts it behind the Telegram-only guard.
    '/astatka',
    '/flights',
    '/flights/M264/photos',
    '/statistics',
    '/import',
    '/client/add',
    '/client/edit/42',
    '/warehouse',
    '/admin/warehouse',
    '/pos',
    '/kassa',
  ])('%s is a staff console', (path) => {
    expect(isStaffPath(path)).toBe(true);
  });

  it.each(['/user/home', '/user/reports', '/payment/nbu/cards', '/pickup-tv', '/'])(
    '%s is not a staff console',
    (path) => {
      expect(isStaffPath(path)).toBe(false);
    },
  );

  it.each(['/user/home', '/user/reports', '/user/profile', '/payment/nbu/cards'])(
    '%s is the client app',
    (path) => {
      expect(isClientPath(path)).toBe(true);
    },
  );

  it.each(['/admin/dashboard', '/kassa', '/flights'])('%s is not the client app', (path) => {
    expect(isClientPath(path)).toBe(false);
  });
});

describe('which credential a request carries', () => {
  const both = { adminToken: 'jwt', userToken: 'tok' };

  it('sends the client token from a client page even when a staff JWT is stored', () => {
    // The staff JWT used to win unconditionally, so a client screen's requests
    // went out with no client credential and came back 401 — which then logged
    // the staff member out of the admin panel too.
    expect(credentialForPath('/user/home', both)).toBe('client');
  });

  it('sends nothing from a client page when there is no client token', () => {
    expect(credentialForPath('/user/home', { adminToken: 'jwt', userToken: null })).toBe(null);
  });

  it('sends the staff JWT from a staff console', () => {
    expect(credentialForPath('/admin/dashboard', both)).toBe('admin');
  });

  it('falls back to the client token on a staff console with no staff JWT', () => {
    expect(credentialForPath('/kassa', { adminToken: null, userToken: 'tok' })).toBe('client');
  });

  it('sends nothing when nothing is stored', () => {
    expect(credentialForPath('/admin/dashboard', { adminToken: null, userToken: null })).toBe(null);
  });
});
