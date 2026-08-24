/**
 * Balance adjustments ride in the `reys` (flight) column.
 *
 * The backend writes them as `PENALTY:<reason>:<microseconds>` and
 * `BONUS:<reason>:<microseconds>` (client_router.py) — the numeric suffix only
 * exists to keep the unique index on (client_code, reys) from colliding when
 * the same reason is used twice. Rendered raw, a client saw
 * "PENALTY:kechikish:1756134912345678" where a flight name should be.
 *
 * SYS_ADJ and WALLET_ADJ never reach the client: `apply_public_transaction_filter`
 * strips them server-side.
 */

export type LedgerKind = 'flight' | 'bonus' | 'penalty';

export interface ParsedLedgerFlight {
  kind: LedgerKind;
  /** Flight name for real flights; empty for adjustments. */
  flightName: string;
  /** Staff-entered reason. Empty when the adjustment was saved without one. */
  reason: string;
}

const PREFIXES: Record<string, LedgerKind> = {
  BONUS: 'bonus',
  PENALTY: 'penalty',
};

export function parseLedgerFlight(raw: string | null | undefined): ParsedLedgerFlight {
  const value = (raw ?? '').trim();
  if (!value) return { kind: 'flight', flightName: '', reason: '' };

  const parts = value.split(':');
  const kind = parts.length > 1 ? PREFIXES[parts[0].trim().toUpperCase()] : undefined;
  if (!kind) return { kind: 'flight', flightName: value, reason: '' };

  // The uniqueness token is a bare integer and is always the last segment; a
  // reason may itself contain colons, so the reason is everything in between
  // rather than just parts[1]. Dropping the tail whenever it is a long integer
  // also covers `PENALTY:1756…` — a shape with no reason at all, which would
  // otherwise print the timestamp where the reason belongs.
  const rest = parts.slice(1);
  if (rest.length > 0 && /^\d{6,}$/.test(rest[rest.length - 1])) rest.pop();

  return { kind, flightName: '', reason: rest.join(':').trim() };
}
