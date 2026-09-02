/**
 * Every page a role can open must actually render for that role.
 *
 * `App.tsx` renders in two branches. Roles that hold `admin-accounts` get the
 * AdminLayout shell; every other role gets a standalone render. A page listed
 * in `isSuperAdminPages` is reached through the shell — but a role WITHOUT the
 * shell can also be allowed to open it, and then it needs a second render in
 * the standalone branch. `flights` is declared twice for exactly this reason.
 *
 * `astatka` shipped with only the standalone one. A `worker` saw the scanner; a
 * `super-admin` clicked the button and got a blank screen. Nothing catches that
 * — TypeScript is happy, the route resolves, `checkAccess` passes, the page
 * type exists. The only thing missing was a line of JSX in the other branch.
 *
 * So this reads App.tsx and checks the invariant directly.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..", "App.tsx");
const source = readFileSync(APP, "utf8");

/** Pages rendered inside the AdminLayout shell. */
function superAdminPages(): string[] {
  const block =
    /const isSuperAdminPages = \[([\s\S]*?)\]\.includes\(currentPage\)/.exec(
      source,
    );
  if (!block) throw new Error("isSuperAdminPages not found in App.tsx");
  return [...block[1].matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
}

/** Role name → the pages it is allowed to open. */
function roleAllowances(): Record<string, string[]> {
  const config = /ROLE_CONFIG[^=]*=\s*\{([\s\S]*?)\n\};/.exec(source);
  if (!config) throw new Error("ROLE_CONFIG not found in App.tsx");

  const roles: Record<string, string[]> = {};
  const pattern = /\n {2}"?([\w-]+)"?: \{([\s\S]*?)\n {2}\},/g;
  for (const match of config[1].matchAll(pattern)) {
    const allowed = /allowed:\s*\[([\s\S]*?)\]/.exec(match[2]);
    roles[match[1]] = allowed
      ? [...allowed[1].matchAll(/"([\w-]+)"/g)].map((m) => m[1])
      : [];
  }
  return roles;
}

/**
 * The source of each render site for a page, so its props can be inspected.
 *
 * Crude on purpose: a fixed window after the match is enough to see whether
 * `embedded` was passed, and parsing JSX properly here would be a worse trade.
 */
function componentsAcceptingEmbedded(root: string): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".tsx")) {
        const text = readFileSync(full, "utf8");
        if (!/embedded\?:\s*boolean/.test(text)) continue;
        for (const m of text.matchAll(/export function (\w+)/g)) names.add(m[1]);
      }
    }
  };
  walk(root);
  return names;
}

function renderBlocks(page: string): string[] {
  const pattern = new RegExp(`currentPage === "${page}" &&`, 'g');
  const blocks: string[] = [];
  for (const match of source.matchAll(pattern)) {
    blocks.push(source.slice(match.index ?? 0, (match.index ?? 0) + 400));
  }
  return blocks;
}

/** How many times a page has a `currentPage === "x"` render site. */
function renderCount(page: string): number {
  const pattern = new RegExp(`currentPage === "${page}"`, "g");
  return (source.match(pattern) ?? []).length;
}

const SHELL_KEY = "admin-accounts";

describe("pages render for every role allowed to open them", () => {
  const shellPages = superAdminPages();
  const roles = roleAllowances();

  const standaloneRoles = Object.entries(roles)
    .filter(([, allowed]) => !allowed.includes(SHELL_KEY))
    .map(([name]) => name);

  it("finds the config it is checking", () => {
    // If a refactor renames either structure, these regexes stop matching and
    // every assertion below would pass vacuously.
    expect(shellPages.length).toBeGreaterThan(3);
    expect(Object.keys(roles).length).toBeGreaterThan(3);
    expect(standaloneRoles.length).toBeGreaterThan(0);
  });

  /**
   * Pages inside the shell that a shell-less role may also open. Each needs a
   * render in BOTH branches.
   */
  const needsBothBranches = shellPages.filter((page) =>
    standaloneRoles.some((role) => (roles[role] ?? []).includes(page)),
  );

  it("includes the pages we know are dual-branch", () => {
    // A sanity check on the derivation itself: `flights` is the textbook case,
    // and `astatka` is the one that shipped broken.
    expect(needsBothBranches).toContain("flights");
    expect(needsBothBranches).toContain("astatka");
  });

  it.each(needsBothBranches)(
    "%s renders in both the shell and the standalone branch",
    (page) => {
      const count = renderCount(page);
      const openers = standaloneRoles.filter((role) =>
        (roles[role] ?? []).includes(page),
      );
      expect(
        count,
        `"${page}" is in isSuperAdminPages and is also allowed for ${openers.join(
          ", ",
        )}, which do not get the AdminLayout shell. It has ${count} render ` +
          "site(s) in App.tsx and needs one in each branch — otherwise it comes " +
          "out blank for one kind of role, with no error anywhere.",
      ).toBeGreaterThanOrEqual(2);
    },
  );

  const embeddable = componentsAcceptingEmbedded(
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  );

  /**
   * Only pages whose component actually takes an `embedded` prop. A page that
   * does not is a plain content block already and needs nothing.
   */
  const dualBranchEmbeddables = needsBothBranches.filter((page) =>
    renderBlocks(page).some((block) =>
      [...embeddable].some((name) => block.includes(`<${name}`)),
    ),
  );

  it("finds the components that take an embedded prop", () => {
    expect(embeddable.size).toBeGreaterThan(0);
    expect(dualBranchEmbeddables).toContain("flights");
    expect(dualBranchEmbeddables).toContain("astatka");
  });

  it.each(dualBranchEmbeddables)(
    "%s is rendered as embedded in the shell and full-page standalone",
    (page) => {
      // The second half of the same lesson. `astatka` was rendered in both
      // branches but WITHOUT `embedded` in the shell one, so it brought its own
      // header, a min-h-dvh column and a fixed floating button into a layout
      // that already had all three: two stacked headers, the button underneath
      // the bottom navigation bar, and the content stranded in a tall empty
      // space. It rendered, and it was unusable.
      const embeddedRenders = renderBlocks(page).filter((block) =>
        block.includes("embedded"),
      );
      expect(
        embeddedRenders.length,
        `"${page}" renders in both branches, so exactly one of those render ` +
          "sites should pass `embedded` — the one inside AdminLayout. Found " +
          `${embeddedRenders.length}.`,
      ).toBe(1);
    },
  );

  it.each(Object.keys(roleAllowances()))(
    "every page %s may open has a render at all",
    (role) => {
      const missing = (roles[role] ?? []).filter(
        (page) => renderCount(page) === 0,
      );
      expect(
        missing,
        `${role} is allowed to open ${missing.join(", ")}, but App.tsx never ` +
          "renders those pages.",
      ).toEqual([]);
    },
  );
});
