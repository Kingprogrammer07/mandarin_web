import type { FastEntryQueueItem } from '@/store/expectedCargoStore';

type OrderFields = Pick<FastEntryQueueItem, 'orderAt' | 'scannedAt'>;

export interface ClientSegmentStats {
  /** How many separate runs the client's rows form in the table. */
  segmentCount: number;
  totalCount: number;
}

function normalizeClientCode(clientCode: string): string {
  return clientCode.trim().toUpperCase();
}

/** Real scan time in epoch ms; 0 when missing or unparsable. */
function getScanTime(item: OrderFields): number {
  const time = item.scannedAt ? Date.parse(item.scannedAt) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** Where a row sits in the newest-first scanner table, in epoch ms. */
export function getQueueOrderKey(item: OrderFields): number {
  return typeof item.orderAt === 'number' ? item.orderAt : getScanTime(item);
}

/**
 * Newest-first table order. Rows of a merged client share one order key, so
 * the real scan time breaks the tie and keeps their scan sequence intact.
 */
export function compareQueueNewestFirst(a: OrderFields, b: OrderFields): number {
  return getQueueOrderKey(b) - getQueueOrderKey(a) || getScanTime(b) - getScanTime(a);
}

/**
 * Order keys that lift every row of `clientCode` to the top of the table as one
 * block, without touching `scannedAt` (that is the real scan time the server
 * stores).
 *
 * The key is half a millisecond above the newest OTHER row and never below
 * `now`. Merge used to restamp the group as `now, now-1, now-2…`, so two
 * clients merged in the same millisecond ("Ajralganlarni birlashtir") got the
 * same stamps and the sort interleaved them row by row, and a group larger than
 * the gap to the previous scan swallowed the other client's rows.
 */
export function buildMergedOrderKeys(
  queue: readonly FastEntryQueueItem[],
  clientCode: string,
  now: number,
): Map<string, number> {
  const normalized = normalizeClientCode(clientCode);
  const keys = new Map<string, number>();
  if (!normalized) return keys;

  let top = now;
  const groupIds: string[] = [];
  for (const item of queue) {
    if (normalizeClientCode(item.clientCode) === normalized) groupIds.push(item.id);
    else top = Math.max(top, getQueueOrderKey(item));
  }

  const groupKey = top + 0.5;
  for (const id of groupIds) keys.set(id, groupKey);
  return keys;
}

/** Client codes with at least one row placed by a merge (normalised). */
export function findMergedClientCodes(queue: readonly FastEntryQueueItem[]): Set<string> {
  const codes = new Set<string>();
  for (const item of queue) {
    const clientCode = normalizeClientCode(item.clientCode);
    if (typeof item.orderAt === 'number' && clientCode) codes.add(clientCode);
  }
  return codes;
}

/**
 * Undo a merge: the queue with `clientCode`'s rows back at their scan-time
 * positions, or null when none of them was merged. Possible only because merge
 * no longer rewrites `scannedAt`.
 */
export function clearMergedOrder(
  queue: readonly FastEntryQueueItem[],
  clientCode: string,
): FastEntryQueueItem[] | null {
  const normalized = normalizeClientCode(clientCode);
  if (!normalized) return null;

  let changed = false;
  const next = queue.map((item) => {
    if (typeof item.orderAt !== 'number' || normalizeClientCode(item.clientCode) !== normalized) {
      return item;
    }
    changed = true;
    return { ...item, orderAt: undefined };
  });
  return changed ? next : null;
}

/** Rows that will be saved under their client code; only these form a client's run. */
function isGroupableRow(item: FastEntryQueueItem): boolean {
  return (
    !item.isWrongClient
    && !item.isAlreadySent
    && !item.notFound
    && normalizeClientCode(item.clientCode) !== ''
  );
}

/**
 * Count, per client, how many separate runs its saveable rows form in the
 * (already sorted) table. More than one run means the client is split.
 *
 * Rows that will not be saved (already sent, wrong owner, not found, still
 * resolving) are skipped WITHOUT ending the current run. They used to end it,
 * so a client with an already-sent row of its own in the middle stayed split
 * forever: merge moves that row together with the client, the run broke at the
 * same place again, and "Birlashtir" looked like it did nothing.
 */
export function countClientSegments(
  sortedQueue: readonly FastEntryQueueItem[],
): Map<string, ClientSegmentStats> {
  const segments = new Map<string, ClientSegmentStats>();
  let previousClientCode: string | null = null;

  for (const item of sortedQueue) {
    if (!isGroupableRow(item)) continue;

    const clientCode = normalizeClientCode(item.clientCode);
    const current = segments.get(clientCode) ?? { segmentCount: 0, totalCount: 0 };
    current.totalCount += 1;
    if (clientCode !== previousClientCode) current.segmentCount += 1;
    segments.set(clientCode, current);
    previousClientCode = clientCode;
  }

  return segments;
}
