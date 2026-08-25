/**
 * Status colours and formatters shared by the POS notification surfaces.
 *
 * These lived inside `PaymentNotificationDrawer.tsx` and were imported from it
 * by two other modules. A file that exports both components and plain values
 * breaks Fast Refresh — React cannot tell which half changed, so it falls back
 * to a full reload and loses the drawer's open state on every edit. ESLint
 * (`react-refresh/only-export-components`) had been reporting it as an error,
 * and the repo's pre-push ratchet blocks a push once the branch touches the
 * file. Splitting the values out fixes the cause rather than the symptom.
 */

export const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  pending: {
    label: "To'lanmagan",
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    border: "border-red-200 dark:border-red-500/30",
  },
  partial: {
    label: "Qisman",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-500/30",
  },
  paid: {
    label: "To'langan",
    bg: "bg-green-50 dark:bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
    border: "border-green-200 dark:border-green-500/30",
  },
  rejected: {
    label: "Rad etildi",
    bg: "bg-gray-50 dark:bg-gray-500/10",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
    border: "border-gray-200 dark:border-gray-500/20",
  },
};

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    // Pinned, not inherited from the machine. The till closes on Tashkent
    // hours and the backend stores Tashkent time; a counter PC with a stale
    // or wrong system timezone would otherwise shift every timestamp on the
    // screen while the totals stayed put.
    timeZone: "Asia/Tashkent",
  });
}

export function formatSum(n: number): string {
  return `${n.toLocaleString("uz-UZ")} so'm`;
}
