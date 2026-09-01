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

import { pickSession, type StoredSessions } from './session';

const NONE: StoredSessions = { adminToken: null, adminRole: null, userToken: null };
const STAFF: StoredSessions = { adminToken: 'jwt', adminRole: 'super-admin', userToken: null };
const CLIENT: StoredSessions = { adminToken: null, adminRole: null, userToken: 'tok' };
const BOTH: StoredSessions = { adminToken: 'jwt', adminRole: 'super-admin', userToken: 'tok' };

const STAFF_ROUTE = { isPublic: false, isUserPage: false };
const USER_ROUTE = { isPublic: false, isUserPage: true };
const PUBLIC_ROUTE = { isPublic: true, isUserPage: false };

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

  it('falls to the client token when there is no staff one', () => {
    expect(pickSession(CLIENT, STAFF_ROUTE)).toEqual({ kind: 'client' });
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

  it('CURRENTLY hands the route to the staff session when both exist', () => {
    // The trap the owner reported, asserted as it behaves today so that the
    // commit which changes it shows the change in a diff.
    expect(pickSession(BOTH, USER_ROUTE)).toEqual({ kind: 'admin', role: 'super-admin' });
  });

  it('CURRENTLY does the same with a staff token and no client token', () => {
    expect(pickSession(STAFF, USER_ROUTE)).toEqual({ kind: 'admin', role: 'super-admin' });
  });
});
