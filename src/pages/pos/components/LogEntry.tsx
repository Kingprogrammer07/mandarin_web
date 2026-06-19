
import { formatCurrencySum, formatTashkentDateTime } from '@/lib/format';
import { resolveCashierStyle, PROVIDER_CHIP, translatePayment } from './utils';
import type { CashierLogItem } from '@/api/pos';

// ─── Provider color theme (full border + subtle bg) ───────────────────────────

const PROVIDER_THEME: Record<string, { border: string; bg: string; dot: string; labelText: string }> = {
  cash: {
    border: "border-amber-400 dark:border-amber-500/50",
    bg: "bg-amber-50/60 dark:bg-amber-500/[0.06]",
    dot: "bg-amber-400",
    labelText: "text-amber-700 dark:text-amber-400",
  },
  card: {
    border: "border-blue-400 dark:border-blue-500/50",
    bg: "bg-blue-50/60 dark:bg-blue-500/[0.06]",
    dot: "bg-blue-400",
    labelText: "text-blue-700 dark:text-blue-400",
  },
  click: {
    border: "border-sky-400 dark:border-sky-500/50",
    bg: "bg-sky-50/60 dark:bg-sky-500/[0.06]",
    dot: "bg-sky-400",
    labelText: "text-sky-700 dark:text-sky-400",
  },
  payme: {
    border: "border-cyan-400 dark:border-cyan-500/50",
    bg: "bg-cyan-50/60 dark:bg-cyan-500/[0.06]",
    dot: "bg-cyan-400",
    labelText: "text-cyan-700 dark:text-cyan-400",
  },
  uzum: {
    border: "border-purple-400 dark:border-purple-500/50",
    bg: "bg-purple-50/60 dark:bg-purple-500/[0.06]",
    dot: "bg-purple-400",
    labelText: "text-purple-700 dark:text-purple-400",
  },
  wallet: {
    border: "border-teal-400 dark:border-teal-500/50",
    bg: "bg-teal-50/60 dark:bg-teal-500/[0.06]",
    dot: "bg-teal-400",
    labelText: "text-teal-700 dark:text-teal-400",
  },
  nbu: {
    border: "border-rose-400 dark:border-rose-500/50",
    bg: "bg-rose-50/60 dark:bg-rose-500/[0.06]",
    dot: "bg-rose-400",
    labelText: "text-rose-700 dark:text-rose-400",
  },
  online: {
    border: "border-violet-400 dark:border-violet-500/50",
    bg: "bg-violet-50/60 dark:bg-violet-500/[0.06]",
    dot: "bg-violet-400",
    labelText: "text-violet-700 dark:text-violet-400",
  },
};

function getProviderTheme(provider: string) {
  const key = provider?.toLowerCase() ?? "";
  return PROVIDER_THEME[key] ?? {
    border: "border-gray-200 dark:border-white/[0.08]",
    bg: "bg-white dark:bg-[#111]",
    dot: "bg-gray-300 dark:bg-gray-600",
    labelText: "text-gray-500 dark:text-gray-400",
  };
}

// ─── LogEntry ─────────────────────────────────────────────────────────────────

export function LogEntry({
  item,
  onSelect,
  currentAdminId,
}: {
  item: CashierLogItem;
  onSelect: (code: string) => void;
  /** The current user's Admin DB PK — used to colour-code own vs. peer entries. */
  currentAdminId: number | null;
}) {
  const hasCode = !!item.client_code;
  const isOwn = item.cashier_id !== null && item.cashier_id === currentAdminId;
  const cashierStyle = resolveCashierStyle(item.cashier_id, currentAdminId);
  const theme = getProviderTheme(item.payment_provider);

  return (
    <div
      onClick={() => hasCode && onSelect(item.client_code!)}
      className={`flex flex-col gap-1.5 py-2.5 px-3 rounded-xl border-2 transition-all ${theme.border} ${theme.bg} ${
        hasCode ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      {/* ── Row 1: client code + name + flight badge ──────────────────── */}
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        {/* Cashier dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cashierStyle.dot}`} />

        {/* Client code */}
        <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono shrink-0">
          {item.client_code ?? "—"}
        </span>

        {/* Flight badge — always visible */}
        {item.flight && (
          <span className="min-w-0 max-w-full break-words inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.08] text-[10px] font-bold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.06]">
            {item.flight}
          </span>
        )}

        {item.payment_source === "uzpost" && (
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/20">
            UzPost
          </span>
        )}

        {/* Own badge */}
        {isOwn && (
          <span className="shrink-0 text-[9px] font-bold text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-1 py-0.5 rounded">
            Men
          </span>
        )}
      </div>

      {/* ── Row 2: amount + provider + cashier + time ─────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Amount */}
          <span
            className={`text-[13px] font-bold ${
              item.paid_amount < 0
                ? "text-red-500 dark:text-red-400"
                : "text-gray-800 dark:text-white"
            }`}
          >
            {item.paid_amount < 0
              ? `−${formatCurrencySum(Math.abs(item.paid_amount))}`
              : formatCurrencySum(item.paid_amount)}
          </span>

          {/* Provider chip */}
          <span
            className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
              PROVIDER_CHIP[item.payment_provider] ??
              "bg-gray-50 dark:bg-white/[0.05] text-gray-500"
            }`}
          >
            {translatePayment(item.payment_provider)}
          </span>

          {/* Cashier label */}
          {item.cashier_id !== null && !isOwn && (
            <span className={`text-[9px] font-bold ${cashierStyle.label}`}>
              #{item.cashier_id}
            </span>
          )}
        </div>

        {/* Time — right bottom */}
        <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
          {formatTashkentDateTime(item.created_at)}
        </span>
      </div>
    </div>
  );
}
