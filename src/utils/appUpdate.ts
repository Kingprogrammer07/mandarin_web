import { toast } from "sonner";

// Injected at build time by Vite `define` (see vite.config.ts). Falls back to
// "dev" during local development where no build id exists.
declare const __BUILD_ID__: string;

/** Build id baked into this bundle. "dev" when running the Vite dev server. */
export const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

// Stable id so repeated triggers (chunk error + every version poll) reuse the
// SAME toast instead of stacking — and so it is re-created if Sonner evicts it
// from the visible stack (default visibleToasts=3) when other toasts appear.
const UPDATE_TOAST_ID = "app-update-available";

// Build the user explicitly dismissed via "Keyinroq". We stay quiet for that
// exact build, but a newer deploy re-prompts.
let dismissedForBuild: string | null = null;

/**
 * Clears all caches (service-worker shell + hashed assets), then reloads.
 *
 * A plain `location.reload()` is not enough: the service worker serves the
 * app shell stale-while-revalidate, so the first reload after a deploy still
 * returns the old `index.html`. Dropping the caches first forces the next
 * navigation to fetch the fresh shell (and therefore the new chunk hashes).
 */
export async function hardReloadForUpdate(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Non-fatal — the reload below still recovers most cases.
  }
  window.location.reload();
}

/**
 * Shows a persistent "new version available" toast with a reload action.
 *
 * The toast never auto-dismisses (`duration: Infinity`) and cannot be swiped
 * away — it stays until the user either reloads ("Yangilash") or explicitly
 * defers ("Keyinroq"). Calling this repeatedly reuses one toast (stable id),
 * so the version poll re-asserts it if Sonner evicted it from the stack.
 *
 * @param deployedBuildId  The newer build id, when known (from version.json).
 *                         Lets "Keyinroq" silence only that build, not future ones.
 */
export function promptForReloadIfStale(deployedBuildId?: string, reason?: unknown): void {
  // Stay quiet only for the exact build the user already deferred.
  if (deployedBuildId && dismissedForBuild === deployedBuildId) return;

  if (reason !== undefined) {
    console.warn("[app] stale bundle detected", reason);
  }

  toast.message("Yangi versiya mavjud", {
    id: UPDATE_TOAST_ID,
    description: "Iltimos, sahifani yangilang.",
    duration: Infinity,
    dismissible: false,
    action: {
      label: "Yangilash",
      onClick: () => void hardReloadForUpdate(),
    },
    cancel: {
      label: "Keyinroq",
      onClick: () => {
        dismissedForBuild = deployedBuildId ?? "unknown";
      },
    },
  });
}

// Session marker: the build id we have already auto-reloaded for. Lets a fresh
// entry auto-update exactly once; if the reload doesn't clear the mismatch (e.g.
// a stuck service worker), we fall back to the prompt instead of reload-looping.
const AUTO_RELOAD_KEY = "app-auto-reloaded-for-build";

function hasAutoReloadedFor(buildId: string): boolean {
  try {
    return sessionStorage.getItem(AUTO_RELOAD_KEY) === buildId;
  } catch {
    return false;
  }
}

/** Persists the auto-reload guard. Returns false if it could not persist — in
 * that case the caller must NOT auto-reload (no guard ⇒ loop risk). */
function markAutoReloaded(buildId: string): boolean {
  try {
    sessionStorage.setItem(AUTO_RELOAD_KEY, buildId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches `version.json` (never cached) and reconciles the deployed build id
 * with the one baked into this bundle. No-ops in dev, swallows offline errors.
 *
 * @param options.autoReload  When true (the initial, fresh-entry check) a stale
 *   bundle is hard-reloaded silently — the user is opening the app anyway, so a
 *   transparent reload beats nagging them to refresh. Guarded to fire at most
 *   once per build per session; otherwise it falls back to the prompt. Leave
 *   false for mid-session checks (focus / interval) so an active user is never
 *   yanked off the page.
 */
export async function checkForNewVersion(
  options: { autoReload?: boolean } = {},
): Promise<void> {
  if (CURRENT_BUILD_ID === "dev") return;

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    if (!data.buildId || data.buildId === CURRENT_BUILD_ID) return;

    // Fresh entry → silently pull the new build (guarded against loops).
    if (options.autoReload && !hasAutoReloadedFor(data.buildId)) {
      if (markAutoReloaded(data.buildId)) {
        await hardReloadForUpdate();
        return;
      }
      // Could not persist the guard — fall through to the prompt to be safe.
    }

    promptForReloadIfStale(
      data.buildId,
      `deployed ${data.buildId} != running ${CURRENT_BUILD_ID}`,
    );
  } catch {
    // Offline or transient network error — ignore, retried on next trigger.
  }
}
