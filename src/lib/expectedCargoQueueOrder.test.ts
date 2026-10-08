import { describe, it, expect } from 'vitest';
import type { FastEntryQueueItem } from '@/store/expectedCargoStore';
import {
  buildMergedOrderKeys,
  clearMergedOrder,
  compareQueueNewestFirst,
  countClientSegments,
  findMergedClientCodes,
} from './expectedCargoQueueOrder';

const T0 = Date.parse('2026-10-08T09:00:00.000Z');

function row(id: string, clientCode: string, secondsAfterT0: number, extra: Partial<FastEntryQueueItem> = {}): FastEntryQueueItem {
  return {
    id,
    scannedAt: new Date(T0 + secondsAfterT0 * 1000).toISOString(),
    trackCode: `TRK-${id}`,
    clientCode,
    resolvedClientName: null,
    resolvedClientId: null,
    isResolved: true,
    notFound: false,
    isAlreadySent: false,
    alreadySentClientCode: null,
    alreadySentFlight: null,
    isContinuation: false,
    priorCountForClient: 0,
    isWrongClient: false,
    conflictClientCode: null,
    ...extra,
  };
}

/** What the store does: apply the merge keys, then the table sorts. */
function merge(queue: FastEntryQueueItem[], clientCode: string, now: number): FastEntryQueueItem[] {
  const keys = buildMergedOrderKeys(queue, clientCode, now);
  return queue.map((item) => {
    const orderAt = keys.get(item.id);
    return orderAt === undefined ? item : { ...item, orderAt };
  });
}

function tableOrder(queue: FastEntryQueueItem[]): string[] {
  return [...queue].sort(compareQueueNewestFirst).map((item) => item.id);
}

function splitClients(queue: FastEntryQueueItem[]): string[] {
  const segments = countClientSegments([...queue].sort(compareQueueNewestFirst));
  return [...segments.entries()]
    .filter(([, stats]) => stats.segmentCount > 1)
    .map(([code]) => code)
    .sort();
}

describe('merge', () => {
  it('brings a split client together on top and keeps its scan order', () => {
    const queue = [row('a1', 'SS1', 1), row('b1', 'ST2', 2), row('a2', 'SS1', 3)];
    expect(splitClients(queue)).toEqual(['SS1']);

    const merged = merge(queue, 'ss1', T0 + 10_000);
    expect(tableOrder(merged)).toEqual(['a2', 'a1', 'b1']);
    expect(splitClients(merged)).toEqual([]);
  });

  it('never rewrites the real scan time that is saved to the server', () => {
    const queue = [row('a1', 'SS1', 1), row('b1', 'ST2', 2), row('a2', 'SS1', 3)];
    const merged = merge(queue, 'SS1', T0 + 10_000);
    expect(merged.map((item) => item.scannedAt)).toEqual(queue.map((item) => item.scannedAt));
  });

  it('merging every split client in the same millisecond leaves no client split', () => {
    // "Ajralganlarni birlashtir" merges all split clients in one loop, so they
    // all get the same Date.now(). The old restamping gave both groups the same
    // times and the sort interleaved them row by row.
    let queue = [
      row('a1', 'SS1', 1), row('b1', 'GGX2', 2), row('a2', 'SS1', 3),
      row('b2', 'GGX2', 4), row('a3', 'SS1', 5), row('b3', 'GGX2', 6),
    ];
    expect(splitClients(queue)).toEqual(['GGX2', 'SS1']);

    const now = T0 + 60_000;
    queue = merge(queue, 'SS1', now);
    queue = merge(queue, 'GGX2', now);

    expect(splitClients(queue)).toEqual([]);
    expect(tableOrder(queue)).toEqual(['b3', 'b2', 'b1', 'a3', 'a2', 'a1']);
  });

  it('a large group never swallows rows scanned just before the merge', () => {
    // 300 old rows of one client, then another client's row 100 ms before the
    // merge: the old "now - index" stamps reached back past that row.
    let queue = Array.from({ length: 300 }, (_, i) => row(`a${i}`, 'SS1', i * 0.01));
    queue.push(row('b1', 'ST2', 59.8), row('aNew', 'SS1', 59.9));
    queue = merge(queue, 'SS1', T0 + 60_000);

    expect(splitClients(queue)).toEqual([]);
    expect(tableOrder(queue).at(-1)).toBe('b1');
  });

  it('a scan after the merge still lands on top', () => {
    let queue = [row('a1', 'SS1', 1), row('b1', 'ST2', 2), row('a2', 'SS1', 3)];
    queue = merge(queue, 'SS1', T0 + 10_000);
    queue = [row('c1', 'ST9', 11), ...queue];
    expect(tableOrder(queue)[0]).toBe('c1');
  });
});

describe('unmerge', () => {
  it('puts a merged client back where it was scanned', () => {
    const queue = [row('a1', 'SS1', 1), row('b1', 'ST2', 2), row('a2', 'SS1', 3)];
    const merged = merge(queue, 'SS1', T0 + 10_000);
    expect(findMergedClientCodes(merged)).toEqual(new Set(['SS1']));

    const unmerged = clearMergedOrder(merged, ' ss1 ');
    expect(unmerged).not.toBeNull();
    expect(tableOrder(unmerged ?? [])).toEqual(tableOrder(queue));
    expect(findMergedClientCodes(unmerged ?? [])).toEqual(new Set());
    expect(splitClients(unmerged ?? [])).toEqual(['SS1']);
  });

  it('leaves other merged clients merged', () => {
    let queue = [
      row('a1', 'SS1', 1), row('b1', 'GGX2', 2), row('a2', 'SS1', 3), row('b2', 'GGX2', 4),
    ];
    queue = merge(queue, 'SS1', T0 + 10_000);
    queue = merge(queue, 'GGX2', T0 + 10_000);
    const unmerged = clearMergedOrder(queue, 'SS1') ?? [];
    expect(findMergedClientCodes(unmerged)).toEqual(new Set(['GGX2']));
    expect(tableOrder(unmerged).slice(0, 2)).toEqual(['b2', 'b1']);
  });

  it('returns null when the client was never merged', () => {
    const queue = [row('a1', 'SS1', 1), row('b1', 'ST2', 2)];
    expect(clearMergedOrder(queue, 'SS1')).toBeNull();
  });
});

describe('countClientSegments', () => {
  it("does not split a client around its own already-sent row", () => {
    const queue = [
      row('a1', 'SS1', 1),
      row('a2', 'SS1', 2, { isAlreadySent: true, isResolved: false, isCrossFlight: true }),
      row('a3', 'SS1', 3),
    ];
    expect(splitClients(queue)).toEqual([]);
  });

  it('does not split a client around a row that is still resolving or not found', () => {
    const queue = [
      row('a1', 'SS1', 1),
      row('x1', '', 2, { isResolved: false }),
      row('x2', '', 3, { isResolved: false, notFound: true }),
      row('a2', 'SS1', 4),
    ];
    expect(splitClients(queue)).toEqual([]);
  });

  it("still reports a split when another client's saveable row sits in between", () => {
    const queue = [row('a1', 'SS1', 1), row('b1', 'ST2', 2), row('a2', 'SS1', 3)];
    expect(splitClients(queue)).toEqual(['SS1']);
  });

  it('a client split only around its already-sent row becomes whole after merge', () => {
    // Before: the already-sent row ended the run, merge moved it along with
    // the client, and the client stayed split no matter how often it was merged.
    let queue = [
      row('a1', 'SS1', 1),
      row('b1', 'ST2', 2),
      row('a2', 'SS1', 3, { isAlreadySent: true, isResolved: false }),
      row('a3', 'SS1', 4),
    ];
    expect(splitClients(queue)).toEqual(['SS1']);
    queue = merge(queue, 'SS1', T0 + 10_000);
    expect(splitClients(queue)).toEqual([]);
  });
});
