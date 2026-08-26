import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A source-level invariant, not a render test, and deliberately so.
 *
 * The bug this guards is a CSS containing-block rule: an ancestor with a
 * `transform` becomes the containing block for every `position: fixed`
 * descendant. jsdom has no layout engine, so no amount of rendering here can
 * demonstrate it — the only honest automated guard is to assert the shape of
 * the code that caused it.
 *
 * What happened: the page wrapper in AdminLayout animated `y: 6 → 0`. Framer
 * writes that as a transform, so every full-screen overlay on every admin page
 * — eight of them, including WarehousePage's `fixed inset-0` panel — anchored
 * to that scrolling box instead of the viewport. They painted over the wrong
 * region and swallowed clicks aimed at the controls underneath, which read as
 * "the Strict button does nothing".
 */

// Read from the vitest root, not `import.meta.url`: under jsdom the module URL
// is an http:// origin and `fileURLToPath` rejects it.
const SOURCE = readFileSync(
  join(process.cwd(), 'src/components/admin/AdminLayout.tsx'),
  'utf8',
);

/**
 * The props of the `<motion.div key={currentPage} …>` that wraps `{children}`.
 *
 * Located by anchor and window rather than by a multi-line literal: this file
 * is stored with CRLF endings, so a `\n`-joined needle finds nothing and the
 * guard would pass vacuously while the bug sat right there.
 */
function pageWrapperProps(): string {
  const anchor = SOURCE.indexOf('key={currentPage}');
  expect(anchor, 'the keyed page wrapper should still exist').toBeGreaterThan(-1);
  const end = SOURCE.indexOf('{children}', anchor);
  expect(end, 'the wrapper should still wrap {children}').toBeGreaterThan(anchor);
  return SOURCE.slice(anchor, end);
}

/**
 * Every prop that Framer compiles into a `transform`.
 *
 * Rotation and skew are here for completeness: whoever reaches for a fancier
 * entrance must not have to rediscover this the hard way.
 */
const TRANSFORM_PROPS = [
  'y:',
  'x:',
  'scale',
  'rotate',
  'skew',
  'translate',
  'perspective',
];

describe('AdminLayout page wrapper', () => {
  it('animates opacity only — a transform would re-anchor every fixed overlay', () => {
    const props = pageWrapperProps();

    // `opacity:` ends in "y:", so it is removed before the search. Without this
    // the check fails on the CORRECT code, and the obvious way to make a test
    // like that pass is to delete the assertion.
    const withoutOpacity = props.split('opacity').join('');

    for (const property of TRANSFORM_PROPS) {
      expect(
        withoutOpacity,
        `page wrapper must not animate \`${property}\` — see the comment above it`,
      ).not.toContain(property);
    }

    expect(props, 'the fade itself should still be there').toContain('opacity');
  });

  it('keeps the shell root free of a transform', () => {
    // The root is `fixed inset-0`; a transform there would break fixed
    // positioning for the whole admin panel rather than for one page.
    const rootIndex = SOURCE.indexOf('fixed inset-0 z-50');
    expect(rootIndex, 'the admin shell root should still be fixed').toBeGreaterThan(-1);
    const rootTag = SOURCE.slice(Math.max(0, rootIndex - 200), rootIndex + 200);
    expect(rootTag).not.toContain('transform');
    expect(rootTag).not.toContain('will-change');
  });
});
