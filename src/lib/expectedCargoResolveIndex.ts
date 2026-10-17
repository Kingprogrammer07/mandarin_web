import type { CompactResolveIndexResponse } from '@/api/services/expectedCargo';
import type { ResolveIndexEntryRecord, ResolveIndexRecord } from '@/utils/expectedCargoScanStore';

/** IndexedDB key of the track→client map shared by every flight tab. */
export const SHARED_RESOLVE_INDEX_KEY = '__SHARED__';

// The server's full snapshot covers cargo changed in the last 30 days; after
// that a stored copy is dropped and downloaded again, which also clears deletes
// that a delta cannot report.
const FULL_REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
// Rows committed while the previous sync was reading must not fall in the gap.
const SINCE_OVERLAP_MS = 5 * 60 * 1000;

export interface ResolveIndexSyncPlan {
  isFull: boolean;
  since?: string;
  includeFlightRows: boolean;
}

/** Decide what the next sync of `flightKey` must download. */
export function planResolveIndexSync(
  shared: ResolveIndexRecord | null,
  flightKey: string,
  now: number,
): ResolveIndexSyncPlan {
  const fullAt = shared?.fullSyncedAt ? Date.parse(shared.fullSyncedAt) : Number.NaN;
  const lastAt = shared ? Date.parse(shared.syncedAt) : Number.NaN;
  if (!shared || Number.isNaN(fullAt) || Number.isNaN(lastAt) || now - fullAt > FULL_REFRESH_AFTER_MS) {
    return { isFull: true, includeFlightRows: true };
  }
  return {
    isFull: false,
    since: new Date(lastAt - SINCE_OVERLAP_MS).toISOString(),
    includeFlightRows: !(shared.coveredFlights ?? []).includes(flightKey),
  };
}

/** Apply a downloaded snapshot (full or delta) on top of the stored entries. */
export function mergeResolveIndexEntries(
  base: readonly ResolveIndexEntryRecord[],
  data: Pick<CompactResolveIndexResponse, 'entries' | 'clients'>,
): ResolveIndexEntryRecord[] {
  const byTrack = new Map(base.map((entry) => [entry.track_code.toUpperCase(), entry]));
  for (const [rawTrack, clientCode] of data.entries) {
    const track = rawTrack.toUpperCase();
    const [clientId, clientName] = data.clients[clientCode.trim().toUpperCase()] ?? [null, null];
    byTrack.set(track, {
      track_code: track,
      client_code: clientCode,
      client_id: clientId,
      client_name: clientName,
    });
  }
  return [...byTrack.values()];
}

/** The shared record to store after a sync of `flightKey`. */
export function buildSharedResolveIndexRecord(
  previous: ResolveIndexRecord | null,
  plan: ResolveIndexSyncPlan,
  flightKey: string,
  entries: ResolveIndexEntryRecord[],
  syncedAt: string,
): ResolveIndexRecord {
  const covered = plan.isFull ? [] : previous?.coveredFlights ?? [];
  return {
    flightName: SHARED_RESOLVE_INDEX_KEY,
    entries,
    alreadySent: [],
    syncedAt,
    fullSyncedAt: plan.isFull ? syncedAt : previous?.fullSyncedAt ?? syncedAt,
    coveredFlights: covered.includes(flightKey) ? covered : [...covered, flightKey],
  };
}
