/**
 * Every translation key the manager delivery page asks for exists in both locales.
 *
 * The page calls `t(key, "Uzbek fallback")`, so a missing key never breaks it:
 * it quietly shows Uzbek to Russian-speaking staff. Tests render with no i18n
 * instance and only ever see the fallback, so nothing else would notice.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = [
  resolve(SRC, "pages/admin/AdminDeliveryRequestPage.tsx"),
  ...readdirSync(resolve(SRC, "components/admin/delivery"))
    .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
    .map((name) => resolve(SRC, "components/admin/delivery", name)),
];

/** Literal keys only: template keys such as `labels.${type}` are checked by hand. */
const KEY_PATTERN = /\bt\(\s*["'](adminDeliveryRequest\.[A-Za-z0-9_.]+)["']/g;

function usedKeys(): string[] {
  const keys = new Set<string>();
  for (const file of SOURCES) {
    for (const match of readFileSync(file, "utf8").matchAll(KEY_PATTERN)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function lookup(tree: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      tree,
    );
}

function locale(name: "uz" | "ru"): unknown {
  return JSON.parse(readFileSync(resolve(SRC, `i18n/locales/${name}.json`), "utf8"));
}

describe("manager delivery page translations", () => {
  const keys = usedKeys();

  it("finds the keys it is meant to check", () => {
    expect(keys).toContain("adminDeliveryRequest.recipient.phoneMissing");
    expect(keys.length).toBeGreaterThan(40);
  });

  it.each(["uz", "ru"] as const)("has every key in %s.json", (name) => {
    const tree = locale(name);
    const missing = keys.filter((key) => typeof lookup(tree, key) !== "string");
    expect(missing).toEqual([]);
  });
});
