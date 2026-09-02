/**
 * Signing out has to actually revoke the token.
 *
 * `logoutAdmin` existed and was never called — the identifier appeared exactly
 * once in the whole frontend, at its own definition. So the Redis JTI blocklist
 * that `get_admin_from_jwt` checks on every staff request has, in practice,
 * never held a key: tapping "Chiqish" cleared `localStorage` and left the JWT
 * valid server-side for the rest of its eight hours.
 *
 * It would not have worked even if something had called it. The endpoint takes
 * `AdminLogoutRequest` as a REQUIRED body parameter (admin_auth.py:202), and
 * the function posted no body at all, so every call would have been a 422.
 *
 * Both of those are asserted here, because both were true at once and fixing
 * only one leaves a sign-out that still does nothing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
  },
}));

const { logoutAdmin } = await import("./adminAuth");

describe("logoutAdmin", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { message: "Logged out successfully" } });
  });

  it("posts to the endpoint that writes the blocklist entry", async () => {
    await logoutAdmin("some-device");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("/admin/auth/logout");
  });

  it("sends a body, because a bodiless post is a 422", async () => {
    await logoutAdmin("some-device");

    const body = post.mock.calls[0][1];
    expect(body).toBeDefined();
    expect(body).toEqual({ device_info: "some-device" });
  });

  it("defaults device_info rather than omitting it, so the audit row is filled", async () => {
    await logoutAdmin();

    expect(post.mock.calls[0][1]).toHaveProperty("device_info");
    expect(post.mock.calls[0][1].device_info).toBeTruthy();
  });

  it("caps the wait well below the client default", async () => {
    // 30s is the client-wide default. A cashier at shift change must not be
    // held on a dead "Chiqish" button by a flaky link.
    await logoutAdmin("some-device");

    const config = post.mock.calls[0][2] as { timeout?: number };
    expect(config?.timeout).toBeGreaterThan(0);
    expect(config?.timeout).toBeLessThanOrEqual(5000);
  });

  it("lets a failure propagate, so the caller can decide", async () => {
    // The caller signs the user out locally in a `finally`. Swallowing the
    // error here would hide a revocation that silently stopped working.
    post.mockRejectedValue(new Error("network down"));

    await expect(logoutAdmin("some-device")).rejects.toThrow("network down");
  });
});
