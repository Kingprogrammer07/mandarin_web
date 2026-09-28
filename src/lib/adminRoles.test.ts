/**
 * A role that only grants a permission is never offered as a role to switch into.
 *
 * Capability roles carry one right each. A manager holding one saw it in his
 * role menu, chose it, and got a blank page with no way back. They stay in the
 * token's `roles` claim (the server reads permissions from role names); they
 * just must not be a choice.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isCapabilityRole, switchableRoles } from './adminRoles';

describe('switchableRoles', () => {
  it('drops permission roles and keeps token order', () => {
    expect(
      switchableRoles([
        'worker',
        'manager',
        'delivery-override',
        'warehouse',
        'uzpost-label-config',
      ]),
    ).toEqual(['worker', 'manager', 'warehouse']);
  });

  it('drops it wherever it sits', () => {
    expect(switchableRoles(['uzpost-label-config', 'warehouse', 'worker'])).toEqual([
      'warehouse',
      'worker',
    ]);
  });

  it.each([[['worker', 'manager']], [['worker', 'warehouse', 'accountant']], [['super-admin']]])(
    'leaves an ordinary account untouched: %j',
    (roles) => {
      expect(switchableRoles(roles)).toEqual(roles);
    },
  );

  it('leaves one role when the other one is the grant', () => {
    expect(switchableRoles(['warehouse', 'uzpost-label-config'])).toEqual(['warehouse']);
    expect(switchableRoles(['warehouse', 'delivery-override'])).toEqual(['warehouse']);
  });

  it('handles an empty list', () => {
    expect(switchableRoles([])).toEqual([]);
  });
});

describe('isCapabilityRole', () => {
  it.each(['uzpost-label-config', 'delivery-override'])(
    'is true for the permission-only role %j',
    (role) => {
      expect(isCapabilityRole(role)).toBe(true);
    },
  );

  it.each(['super-admin', 'worker', 'accountant', 'manager', 'warehouse', ''])(
    'is false for %j',
    (role) => {
      expect(isCapabilityRole(role)).toBe(false);
    },
  );
});

/**
 * A third role menu added later must not bring the technical name back. Every
 * component that calls the switch endpoint has to build its list through
 * `switchableRoles`, and none may map the raw claim.
 */
describe('every role menu filters permission-only roles', () => {
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const switchers: Array<{ name: string; text: string }> = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        const text = readFileSync(full, 'utf8');
        if (text.includes('await switchAdminRole(')) {
          switchers.push({ name: entry.name, text });
        }
      }
    }
  };
  walk(SRC);

  it('finds the menus it is checking', () => {
    // If the call is renamed, the guard below would pass without checking anything.
    expect(switchers.map((s) => s.name)).toEqual(
      expect.arrayContaining(['RoleSwitcher.tsx', 'AdminAccountMenu.tsx']),
    );
  });

  it.each(switchers.map((s) => [s.name, s.text] as const))(
    '%s offers only switchable roles',
    (_name, text) => {
      expect(text).toContain('switchableRoles(');
      expect(text).not.toContain('claims.role_names.map(');
    },
  );
});
