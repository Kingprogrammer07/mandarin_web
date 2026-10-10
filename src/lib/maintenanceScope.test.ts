/**
 * The "Texnik ishlar" screens show on client pages and nowhere else.
 *
 * `isMaintenanceScreenPath` is a path rule, but which pages are client pages
 * is decided in `App.tsx` (`USER_PAGES` plus the login and register screens).
 * So this reads App.tsx, takes every page's URL from `getPathForPage`, and
 * checks the two agree: a client page outside `/user/` that is missing here would lose its
 * maintenance screen, and a staff page that matched would get one back.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isMaintenanceScreenPath } from "./maintenanceScope";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..", "App.tsx");
const source = readFileSync(APP, "utf8");

/** Page → URL, from `getPathForPage`, with route params filled with a sample. */
function pagePaths(): Map<string, string> {
  const body =
    /function getPathForPage\([\s\S]*?\n\}\n/.exec(source)?.[0] ?? "";
  const paths = new Map<string, string>();
  const pattern =
    /if \(page === "([\w-]+)"[^)]*\)\s*return\s*[`"]([^`"]+)[`"]/g;
  for (const [, page, path] of body.matchAll(pattern)) {
    if (!paths.has(page)) paths.set(page, path.replace(/\$\{[^}]+\}/g, "X"));
  }
  // The fall-through `return "/auth/login"` is the client login screen.
  paths.set("login", "/auth/login");
  return paths;
}

/** The pages App.tsx treats as the client surface. */
function clientPages(): Set<string> {
  const block = /const USER_PAGES: Page\[\] = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error("USER_PAGES not found in App.tsx");
  const pages = [...block[1].matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
  return new Set([...pages, "login", "register"]);
}

describe("maintenance screens are for clients only", () => {
  const paths = pagePaths();
  const clients = clientPages();

  it("finds the config it is checking", () => {
    // A renamed function or list would make every case below pass vacuously.
    expect(paths.size).toBeGreaterThan(20);
    expect(clients.size).toBeGreaterThan(4);
  });

  it.each([...paths.entries()])("%s (%s)", (page, path) => {
    expect(isMaintenanceScreenPath(path)).toBe(clients.has(page));
  });

  it.each([
    "/admin",
    "/admin/login",
    "/admin/dashboard",
    "/admin/clients",
    "/admin/warehouse",
    "/admin/expected-cargo",
    "/admin/system-settings",
    "/warehouse",
    "/flights",
    "/flights/M123/photos",
    "/astatka",
    "/statistics",
    "/import",
    "/client/add",
    "/pos",
    "/kassa",
    "/pickup-tv",
    "/payment/nbu/success",
    "/payment/nbu/failure",
  ])("staff or standalone path %s never shows a maintenance screen", (path) => {
    expect(isMaintenanceScreenPath(path)).toBe(false);
  });

  it.each(["/", "/auth/login", "/auth/register", "/user/home", "/user/home/"])(
    "client path %s keeps its maintenance screen",
    (path) => {
      expect(isMaintenanceScreenPath(path)).toBe(true);
    },
  );
});
