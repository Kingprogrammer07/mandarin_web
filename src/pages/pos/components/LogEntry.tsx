
import { formatCurrencySum, formatTashkentDateTime } from '@/lib/format';
import { resolveCashierStyle, PROVIDER_CHIP, translatePayment } from './utils';
import type { CashierLogItem } from '@/api/pos';

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

  return (
    <div
      onClick={() => hasCode && onSelect(item.client_code!)}
      className={`flex items-center justify-between gap-3 py-3 rounded-lg px-2 -mx-1 transition-colors ${cashierStyle.row} ${
        hasCode ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Coloured dot — visually groups rows by cashier */}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cashierStyle.dot}`} />
          <span className="text-[13px] font-bold text-gray-800 dark:text-white font-mono">
            {item.client_code ?? "—"}
          </span>
          {item.flight && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[80px]">
              · {item.flight}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            {formatTashkentDateTime(item.created_at)}
          </p>
          {/* "Men" badge for own entries; cashier_id number for peers */}
          {item.cashier_id !== null && (
            <span className={`text-[9px] font-bold ${cashierStyle.label}`}>
              {isOwn ? "Men" : `#${item.cashier_id}`}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-[13px] font-bold ${
            item.paid_amount < 0
              ? "text-red-500 dark:text-red-400"
              : "text-gray-800 dark:text-white"
          }`}
        >
          {item.paid_amount < 0
            ? `−${formatCurrencySum(Math.abs(item.paid_amount))}`
            : formatCurrencySum(item.paid_amount)}
        </p>
        <span
          className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
            PROVIDER_CHIP[item.payment_provider] ??
            "bg-gray-50 dark:bg-white/[0.05] text-gray-500"
          }`}
        >
          {translatePayment(item.payment_provider)}
        </span>
      </div>
    </div>
  );
}

