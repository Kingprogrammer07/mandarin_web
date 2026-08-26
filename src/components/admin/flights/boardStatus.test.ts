/**
 * Guards the two rules that decide what the Reyslar table shows.
 *
 * Both were live defects. The order comparator did not exist at all, so the
 * table re-rendered in the server's `newest` order after every drag — the save
 * had worked, the row snapped back, and the feature looked broken. The status
 * rule is what the HOLAT column says, and getting it wrong shows a flight as
 * "Yangi" while it is live on the board.
 */

import { describe, expect, it } from 'vitest';

import type { FlightDashboardItem } from '@/api/services/flightSchedule';

import { boardStatusOf, compareBoardOrder } from './boardStatus';

function flight(
  name: string,
  overrides: Partial<FlightDashboardItem> = {},
): FlightDashboardItem {
  return {
    name,
    type: 'custom',
    status: 'active',
    source: 'expected_cargo',
    is_new: false,
    last_activity_at: null,
    stats: {} as FlightDashboardItem['stats'],
    ...overrides,
  };
}

function sortNames(items: FlightDashboardItem[]): string[] {
  const serverIndex = new Map(items.map((item, index) => [item.name, index]));
  return [...items].sort(compareBoardOrder(serverIndex)).map((item) => item.name);
}

describe('compareBoardOrder', () => {
  it('puts placed flights in their stored order', () => {
    const items = [
      flight('C', { sort_order: 2 }),
      flight('A', { sort_order: 0 }),
      flight('B', { sort_order: 1 }),
    ];
    expect(sortNames(items)).toEqual(['A', 'B', 'C']);
  });

  it('sorts a never-placed flight after every placed one', () => {
    // `sort_order: null` is not position 0. Treating the two alike would put
    // every untouched flight above the board the operator arranged.
    const items = [
      flight('untouched', { sort_order: null }),
      flight('placed-last', { sort_order: 9 }),
    ];
    expect(sortNames(items)).toEqual(['placed-last', 'untouched']);
  });

  it('keeps the server order among never-placed flights', () => {
    const items = [
      flight('newest', { sort_order: null }),
      flight('older', { sort_order: null }),
      flight('oldest', { sort_order: null }),
    ];
    expect(sortNames(items)).toEqual(['newest', 'older', 'oldest']);
  });

  it('breaks a tie on stored position with the server order', () => {
    // Two flights can legitimately hold the same number: positions are written
    // per reorder call, and two calls covering different subsets overlap.
    const items = [
      flight('second', { sort_order: 0 }),
      flight('first', { sort_order: 0 }),
    ];
    expect(sortNames(items)).toEqual(['second', 'first']);
  });

  it('tolerates a missing field from an older backend', () => {
    // The frontend ships to Vercel on push; the backend deploys separately.
    const items = [flight('b', { sort_order: 1 }), flight('a')];
    expect(sortNames(items)).toEqual(['b', 'a']);
  });
});

describe('boardStatusOf', () => {
  it('reports a switched-on flight as visible whatever its lifecycle', () => {
    expect(boardStatusOf(flight('x', { is_visible: true, is_new: true }))).toBe(
      'visible',
    );
    expect(
      boardStatusOf(flight('x', { is_visible: true, status: 'completed' })),
    ).toBe('visible');
  });

  it('reports an untouched manifest-only flight as new', () => {
    expect(boardStatusOf(flight('x', { status: 'new' }))).toBe('new');
    expect(boardStatusOf(flight('x', { is_new: true }))).toBe('new');
  });

  it('reports everything else as archived', () => {
    expect(boardStatusOf(flight('x', { status: 'completed' }))).toBe('archived');
    expect(boardStatusOf(flight('x', { status: 'active' }))).toBe('archived');
  });
});
