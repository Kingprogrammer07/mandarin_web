import { describe, expect, it } from 'vitest';

import { matchesQuery, pageWindow } from './HistoryFilters';

const row = (over: Partial<Parameters<typeof matchesQuery>[0]> = {}) => ({
  client_code: 'M265',
  cashier_name: 'Dilshod Tursunov',
  flight: 'MRX-118',
  ...over,
});

describe('matchesQuery', () => {
  it('keeps every row when the box is empty or only spaces', () => {
    expect(matchesQuery(row(), '')).toBe(true);
    expect(matchesQuery(row(), '   ')).toBe(true);
  });

  it('matches the client code regardless of case', () => {
    expect(matchesQuery(row(), 'm265')).toBe(true);
    expect(matchesQuery(row(), 'M26')).toBe(true);
  });

  it('matches part of a cashier name', () => {
    expect(matchesQuery(row(), 'tursun')).toBe(true);
  });

  it('matches the flight', () => {
    expect(matchesQuery(row(), 'mrx-118')).toBe(true);
  });

  it('rejects a needle that appears in none of the three fields', () => {
    expect(matchesQuery(row(), 'payme')).toBe(false);
  });

  it('survives null fields', () => {
    // NBU entries have no cashier, and a wallet correction has no flight.
    const sparse = row({ cashier_name: null, flight: null, client_code: null });
    expect(matchesQuery(sparse, 'anything')).toBe(false);
    expect(matchesQuery(sparse, '')).toBe(true);
  });
});

describe('pageWindow', () => {
  it('lists every page while they still fit', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the far side into one ellipsis', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20]);
  });

  it('keeps both neighbours of the current page', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('prints the missing page instead of an ellipsis standing for one page', () => {
    // At page 4 the set is {1,3,4,5,20}: the hole between 1 and 3 is a single
    // page, and "1 … 3" is wider than "1 2 3" and one click poorer.
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageWindow(17, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
  });

  it('still collapses a hole of two or more pages', () => {
    expect(pageWindow(5, 20)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20]);
  });

  it('leaves no hole at all when the neighbours reach the ends', () => {
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
    expect(pageWindow(18, 20)).toEqual([1, 'gap', 17, 18, 19, 20]);
  });

  it('never emits a page outside the range', () => {
    for (const current of [1, 2, 19, 20]) {
      for (const entry of pageWindow(current, 20)) {
        if (entry !== 'gap') {
          expect(entry).toBeGreaterThanOrEqual(1);
          expect(entry).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it('never repeats a page', () => {
    const pages = pageWindow(10, 20).filter((entry) => entry !== 'gap');
    expect(new Set(pages).size).toBe(pages.length);
  });
});
