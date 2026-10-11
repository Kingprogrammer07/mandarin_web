import { describe, expect, it } from 'vitest';

import { isAstatkaFlightName } from './astatkaFlight';

describe('isAstatkaFlightName', () => {
  it.each(['OSTATKA-11.10', 'o-11.10.2026', '  Ostatka 12'])(
    '%s is an astatka flight',
    (name) => {
      expect(isAstatkaFlightName(name)).toBe(true);
    },
  );

  it.each([
    'M265',
    'M262-M263',
    // The older leftover naming. Not an "O" flight, so not on the astatka page.
    'A-OSTATKA-29.07',
    'MAXSUS REYS',
    '',
    '   ',
    null,
    undefined,
  ])('%s is not', (name) => {
    expect(isAstatkaFlightName(name)).toBe(false);
  });
});
