/**
 * Shared constants + helpers for the one-time admin agreement.
 *
 * Kept in a non-component module so the modal file only exports a component
 * (satisfies the `react-refresh/only-export-components` rule) and other modules
 * (e.g. ManagerPage) can read the acceptance state without importing the modal.
 *
 * Bump `ADMIN_AGREEMENT_VERSION` whenever the terms change to re-prompt everyone.
 */

export const ADMIN_AGREEMENT_VERSION = "v1";
export const ADMIN_AGREEMENT_STORAGE_KEY = `admin_agreement_accepted_${ADMIN_AGREEMENT_VERSION}`;

/** Fired on window once the admin accepts — lets the manager tour start only after. */
export const ADMIN_AGREEMENT_ACCEPTED_EVENT = "admin:agreement-accepted";

/** True once this admin has accepted the current agreement version. */
export function isAdminAgreementAccepted(): boolean {
  return localStorage.getItem(ADMIN_AGREEMENT_STORAGE_KEY) === "1";
}
