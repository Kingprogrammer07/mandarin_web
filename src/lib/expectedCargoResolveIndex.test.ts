import { describe, expect, it } from 'vitest';
import {
  buildSharedResolveIndexRecord,
  mergeResolveIndexEntries,
  planResolveIndexSync,
  SHARED_RESOLVE_INDEX_KEY,
} from '@/lib/expectedCargoResolveIndex';
import type { ResolveIndexRecord } from '@/utils/expectedCargoScanStore';

const NOW = Date.parse('2026-10-17T12:00:00Z');

function shared(overrides: Partial<ResolveIndexRecord> = {}): ResolveIndexRecord {
  return {
    flightName: SHARED_RESOLVE_INDEX_KEY,
    entries: [],
    alreadySent: [],
    syncedAt: '2026-10-17T11:00:00Z',
    fullSyncedAt: '2026-10-10T00:00:00Z',
    coveredFlights: ['M214'],
    ...overrides,
  };
}

describe('planResolveIndexSync', () => {
  it('downloads everything when nothing is stored or the copy is older than 30 days', () => {
    expect(planResolveIndexSync(null, 'M214', NOW)).toEqual({ isFull: true, includeFlightRows: true });
    expect(planResolveIndexSync(shared({ fullSyncedAt: '2026-09-01T00:00:00Z' }), 'M214', NOW).isFull)
      .toBe(true);
  });

  it('asks only for changes since the last sync, with a small overlap', () => {
    const plan = planResolveIndexSync(shared(), 'M214', NOW);
    expect(plan).toEqual({ isFull: false, since: '2026-10-17T10:55:00.000Z', includeFlightRows: false });
  });

  it('adds a flight tab’s own cargo the first time that flight is synced', () => {
    expect(planResolveIndexSync(shared(), 'M215', NOW).includeFlightRows).toBe(true);
  });
});

describe('mergeResolveIndexEntries', () => {
  it('overrides changed owners and fills client info from the compact map', () => {
    const base = [{ track_code: 'T1', client_code: 'SS1', client_id: 1, client_name: 'Ali' }];
    const merged = mergeResolveIndexEntries(base, {
      entries: [['t1', 'SS2'], ['T2', 'a11']],
      clients: { SS2: [2, 'Vali'] },
    });
    expect(merged).toEqual([
      { track_code: 'T1', client_code: 'SS2', client_id: 2, client_name: 'Vali' },
      { track_code: 'T2', client_code: 'a11', client_id: null, client_name: null },
    ]);
  });
});

describe('buildSharedResolveIndexRecord', () => {
  it('resets covered flights on a full download and extends them on a delta', () => {
    const full = buildSharedResolveIndexRecord(shared(), { isFull: true, includeFlightRows: true }, 'M300', [], 'S1');
    expect(full).toMatchObject({ fullSyncedAt: 'S1', coveredFlights: ['M300'] });

    const delta = buildSharedResolveIndexRecord(shared(), { isFull: false, includeFlightRows: true }, 'M215', [], 'S2');
    expect(delta).toMatchObject({ fullSyncedAt: '2026-10-10T00:00:00Z', syncedAt: 'S2', coveredFlights: ['M214', 'M215'] });
  });
});
