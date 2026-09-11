/**
 * Roles that grant a permission and nothing else.
 *
 * `uzpost-label-config` exists only to carry `uzpost_labels:configure` — the
 * right to change how many copies of a UzPost label print. It has no screen and
 * no landing page, so it is never a role to switch into: offering it opened a
 * blank page with no way back.
 *
 * It still stays in the token's `roles` claim on purpose. The server resolves
 * permissions from role names, so dropping it there would silently take the
 * right away.
 *
 * Mirrors `CAPABILITY_ROLE_NAMES` in
 * backend/src/infrastructure/database/models/role.py — change both together.
 */
const CAPABILITY_ROLES: ReadonlySet<string> = new Set(['uzpost-label-config']);

/** Is this role a permission carrier rather than a workspace? */
export function isCapabilityRole(role: string): boolean {
  return CAPABILITY_ROLES.has(role);
}

/** The roles a user can switch into, in token order. */
export function switchableRoles(roleNames: readonly string[]): string[] {
  return roleNames.filter((role) => !isCapabilityRole(role));
}
