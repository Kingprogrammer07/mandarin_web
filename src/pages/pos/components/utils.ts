import type {
  CashierLogProvider,
  CashierLogSummary,
  PaymentProvider,
} from '@/api/pos';
import type {
  DeliveryProofMethod,
  DeliveryRequestType,
  FilterType,
} from '@/api/transactions';
import type { UnpaidCargoItem } from '@/api/verification';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_TYPES: { id: PaymentProvider; label: string }[] = [
  { id: "cash", label: "Naqd" },
  { id: "card", label: "Karta" },
  { id: "terminal", label: "Terminal" },
  { id: "click", label: "Click" },
  { id: "payme", label: "Payme" },
];

export const PROVIDER_CHIP: Record<string, string> = {
  cash: "bg-green-50  dark:bg-green-500/10  text-green-600  dark:text-green-400",
  card: "bg-blue-50   dark:bg-blue-500/10   text-blue-600   dark:text-blue-400",
  terminal:
    "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  click:
    "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  payme:
    "bg-cyan-50   dark:bg-cyan-500/10   text-cyan-600   dark:text-cyan-400",
  nbu:
    "bg-rose-50   dark:bg-rose-500/10   text-rose-600   dark:text-rose-400",
  wallet:
    "bg-amber-50  dark:bg-amber-500/10  text-amber-600  dark:text-amber-400",
};

/**
 * Deterministic color palette assigned to other cashiers' log rows.
 * Index is derived from `cashier_id % PEER_CASHIER_PALETTE.length`.
 */
export const PEER_CASHIER_PALETTE = [
  {
    row: "border-l-2 border-blue-400 bg-blue-50/40 dark:bg-blue-500/[0.06]",
    dot: "bg-blue-400",
    label: "text-blue-500 dark:text-blue-400",
  },
  {
    row: "border-l-2 border-purple-400 bg-purple-50/40 dark:bg-purple-500/[0.06]",
    dot: "bg-purple-400",
    label: "text-purple-500 dark:text-purple-400",
  },
  {
    row: "border-l-2 border-teal-400 bg-teal-50/40 dark:bg-teal-500/[0.06]",
    dot: "bg-teal-400",
    label: "text-teal-500 dark:text-teal-400",
  },
  {
    row: "border-l-2 border-rose-400 bg-rose-50/40 dark:bg-rose-500/[0.06]",
    dot: "bg-rose-400",
    label: "text-rose-500 dark:text-rose-400",
  },
  {
    row: "border-l-2 border-indigo-400 bg-indigo-50/40 dark:bg-indigo-500/[0.06]",
    dot: "bg-indigo-400",
    label: "text-indigo-500 dark:text-indigo-400",
  },
] as const;

/** Style applied to the current user's own log rows. */
export const OWN_CASHIER_STYLE = {
  row: "border-l-2 border-orange-400 bg-orange-50/40 dark:bg-orange-500/[0.06]",
  dot: "bg-orange-400",
  label: "text-orange-500 dark:text-orange-400",
} as const;

/** Returns the colour tokens for a log entry given the entry's cashier_id and the current admin's id. */
export function resolveCashierStyle(
  cashierId: number | null,
  currentAdminId: number | null,
): { row: string; dot: string; label: string } {
  if (cashierId === null) {
    return { row: "", dot: "bg-gray-300 dark:bg-gray-600", label: "text-gray-400" };
  }
  if (cashierId === currentAdminId) {
    return OWN_CASHIER_STYLE;
  }
  return PEER_CASHIER_PALETTE[cashierId % PEER_CASHIER_PALETTE.length]!;
}

export const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  paid: {
    bg: "bg-green-50 dark:bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    label: "To'landi",
  },
  partial: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    label: "Qisman",
  },
  pending: {
    bg: "bg-red-50   dark:bg-red-500/10",
    text: "text-red-500   dark:text-red-400",
    label: "Qarzdor",
  },
};

export const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "not_taken", label: "Olib ketilmagan" },
  { id: "taken", label: "Olib ketilgan" },
  { id: "partial", label: "Qisman to'langan" },
];

// ─── Payment provider / status localisation ───────────────────────────────────

export const PAYMENT_LABEL: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  terminal: "Terminal",
  click: "Click",
  payme: "Payme",
  nbu: "NBU (karta)",
  wallet: "Hamyon",
  online: "Online",
};

export const LOG_PROVIDER_FILTERS: { value: CashierLogProvider | "all"; label: string }[] = [
  { value: "all", label: "Barchasi" },
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "terminal", label: "Terminal" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
  { value: "nbu", label: "NBU" },
  { value: "wallet", label: "Hamyon" },
];

export const DELIVERY_REQUEST_OPTIONS: DeliveryRequestType[] = [
  "uzpost",
  "bts",
  "mandarin",
  "yandex",
];

export const DELIVERY_PROOF_OPTIONS: DeliveryProofMethod[] = [
  "uzpost",
  "bts",
  "mandarin",
  "yandex",
  "self_pickup",
];

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  uzpost: "UzPost",
  bts: "BTS",
  mandarin: "Mandarin",
  yandex: "Yandex",
  self_pickup: "O'zi olib ketish",
};


/** Translates raw backend payment_provider / payment_type strings to Uzbek. */
export function translatePayment(raw: string): string {
  if (!raw) return "—";
  if (raw.toUpperCase().startsWith("SYS_ADJ")) return "Hamyon tahriri";
  return PAYMENT_LABEL[raw.toLowerCase()] ?? raw;
}

export const RECENT_KEY = "pos_recent_searches";
export const MAX_RECENT = 5;
export const SOUND_KEY = "pos_sound_enabled";
export const PENDING_NOTIFS_KEY = "pos_pending_notifs";

/**
 * A single warehouse→cashier notification that has been received but not yet
 * acted on (dismissed or opened).  Persisted in localStorage so the cashier
 * does not lose notifications if they briefly leave or refresh the page.
 */
export interface PendingNotif {
  id: string;
  clientCode: string;
  flightName: string;
  amount?: number;
  currency?: string;
}

export function loadPendingNotifs(): PendingNotif[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_NOTIFS_KEY) ?? "[]") as PendingNotif[];
  } catch {
    return [];
  }
}

export function persistPendingNotifs(notifs: PendingNotif[]): void {
  localStorage.setItem(PENDING_NOTIFS_KEY, JSON.stringify(notifs));
}

/**
 * Plays a two-tone notification chime using the Web Audio API.
 * No external audio file needed — the sound is synthesised on-the-fly.
 * Silently no-ops if AudioContext is unavailable or blocked by the browser.
 */
export function playNotificationChime(): void {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.35, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

    // First tone — higher pitch
    const osc1 = ctx.createOscillator();
    osc1.connect(master);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1318, ctx.currentTime);        // E6
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.18);

    // Second tone — lower pitch, slight delay
    const osc2 = ctx.createOscillator();
    osc2.connect(master);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987, ctx.currentTime + 0.18);  // B5
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.7);

    // Release the AudioContext after the sound completes.
    osc2.onended = () => void ctx.close();
  } catch {
    // AudioContext may be blocked before a user gesture on some browsers.
  }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveRecentSearch(code: string): void {
  const next = [code, ...getRecentSearches().filter((c) => c !== code)].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function deleteRecentSearch(code: string): void {
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(getRecentSearches().filter((c) => c !== code)),
  );
}

// ─── Waterfall distribution ───────────────────────────────────────────────────

/** Spread `received` across cargo debts sequentially; last item absorbs remainder. */
export function waterfallDistribute(
  cargos: UnpaidCargoItem[],
  received: number,
): number[] {
  if (cargos.length === 0) return [];
  const result: number[] = new Array(cargos.length).fill(0.01);
  let remaining = received - 0.01 * cargos.length;

  for (let i = 0; i < cargos.length && remaining > 0; i++) {
    const canTake = Math.max(0, (cargos[i]?.total_payment ?? 0) - 0.01);
    const take = Math.min(canTake, remaining);
    result[i] = (result[i] ?? 0.01) + take;
    remaining -= take;
  }
  if (remaining > 0) {
    result[result.length - 1] = (result[result.length - 1] ?? 0.01) + remaining;
  }
  return result;
}

export function formatCard(raw: string): string {
  return raw
    .replace(/\s/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** 8600123456789012 → 8600 **** **** 9012 */
export function maskCard(raw: string): string {
  const d = raw.replace(/\s/g, "");
  return `${d.slice(0, 4)} **** **** ${d.slice(-4)}`;
}

export function toIsoDateBound(date: string, boundary: "start" | "end"): string | undefined {
  if (!date) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const localDate =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  return localDate.toISOString();
}

export function getSelectedProviderTotal(
  summary: CashierLogSummary,
  provider: CashierLogProvider | "all",
): number {
  return provider === "all" ? summary.total : summary[provider];
}

