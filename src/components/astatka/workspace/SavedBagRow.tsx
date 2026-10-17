import {
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";

import type {
  AstatkaPackage,
  AstatkaPackageStatus,
} from "@/api/services/astatkaFlights";
import { isSentFromAstatka } from "@/lib/astatkaBagSummary";
import { formatKg, formatScanTime } from "@/lib/astatkaFormat";
import { sourceCompanyLabel } from "@/lib/astatkaSource";
import { cn } from "@/lib/utils";

import type { BagSheetMode } from "./BagSheet";
import { SourceCompanyChip } from "./SourceCompanyChip";

/**
 * The wide table: the bag's facts in these columns, then the row's buttons in
 * a column of fixed width, so every row lines up under the header.
 */
const FACT_COLUMNS =
  "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_minmax(0,0.9fr)_7.5rem_minmax(0,0.9fr)]";

/** Edit mode adds "Tahrirlash" and "Tasdiqni bekor qilish" beside "O'chirish": 3 × 44px + 2 × 8px. */
function actionsWidth(editMode: boolean): string {
  return editMode ? "w-[148px]" : "w-11";
}

/** The wide table's header; hidden on a phone, where rows are cards. */
export function SavedBagHeader({ editMode }: { editMode: boolean }) {
  return (
    <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-mc-border bg-mc-surface-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3 @2xl:grid">
      <div className={cn("grid gap-3", FACT_COLUMNS)}>
        <span>Mijoz</span>
        <span>Reys</span>
        <span>Trek</span>
        <span>Og'irlik</span>
        <span>Holati</span>
        <span>Vaqt</span>
      </div>
      <span className={actionsWidth(editMode)}>
        <span className="sr-only">Amallar</span>
      </span>
    </div>
  );
}

function StatusBadge({
  status,
  sent,
}: {
  status: AstatkaPackageStatus | null;
  /** The astatka's own «Yuborish» already notified the client. */
  sent: boolean;
}) {
  const confirmed = status === "confirmed";
  if (confirmed && sent) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mc-brand-soft px-2 py-0.5 text-[11px] font-bold text-mc-brand">
        <Send className="h-3 w-3" />
        Yuborilgan
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        confirmed
          ? "bg-mc-success/12 text-mc-success"
          : "bg-mc-warn-soft text-mc-warn",
      )}
    >
      {confirmed ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {confirmed ? "Tasdiqlangan" : "Kutilmoqda"}
    </span>
  );
}

interface Props {
  pkg: AstatkaPackage;
  editMode: boolean;
  /** False offline: the list is a snapshot and nothing in it can change. */
  canChange: boolean;
  deleting: boolean;
  onOpen: (pkg: AstatkaPackage, mode: BagSheetMode) => void;
  onUnconfirm: (pkg: AstatkaPackage) => void;
  onDelete: (pkg: AstatkaPackage) => void;
}

const iconButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm border border-mc-border active:scale-95 disabled:opacity-40";

/**
 * One saved bag: a table row on a wide panel, a card on a phone. A tap on
 * the facts opens the bag window; the trash is always there, the fixes only
 * in edit mode. The facts are a button of their own beside the row's other
 * buttons, never around them: VoiceOver cannot reach a button inside one.
 */
export function SavedBagRow({
  pkg,
  editMode,
  canChange,
  deleting,
  onOpen,
  onUnconfirm,
  onDelete,
}: Props) {
  const time = formatScanTime(
    pkg.confirmed_at ?? pkg.scanned_at ?? pkg.created_at,
  );
  const partner = sourceCompanyLabel(pkg);
  const sent = isSentFromAstatka(pkg);
  const partnerChip = partner ? (
    <SourceCompanyChip label={partner} api={false} />
  ) : null;

  // Narrow: the buttons drop under the facts when a 320px card has no room
  // beside them. Wide: the facts fill the columns, the buttons the last one.
  return (
    <div className="flex flex-wrap items-center gap-x-2 px-3 @2xl:grid @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:gap-3">
      <button
        type="button"
        onClick={() => onOpen(pkg, "view")}
        className="min-w-0 flex-1 basis-48 py-2.5 text-left active:opacity-70"
      >
        <span className={cn("hidden items-center gap-3 @2xl:grid", FACT_COLUMNS)}>
          <span className="block min-w-0">
            <span className="block break-all text-[14px] font-extrabold text-mc-text">
              {pkg.client_code}
            </span>
            {partnerChip && <span className="mt-0.5 block">{partnerChip}</span>}
            {pkg.client_name && (
              <span className="block truncate text-[11px] font-medium text-mc-text-3">
                {pkg.client_name}
              </span>
            )}
          </span>
          <span className="break-words text-[13px] font-bold text-mc-text">
            {pkg.source_flight_name || "—"}
          </span>
          <span className="text-[13px] font-bold tabular-nums text-mc-text">
            {pkg.track_count} ta
          </span>
          <span className="break-words text-[13px] font-bold tabular-nums text-mc-text">
            {formatKg(pkg.weight_kg)}
          </span>
          <StatusBadge status={pkg.status} sent={sent} />
          <span className="text-[12px] font-medium tabular-nums text-mc-text-3">
            {time}
          </span>
        </span>
        <span className="block @2xl:hidden">
          <span className="flex items-start justify-between gap-2">
            {/* The chip wraps under the code rather than squeeze it at 320px. */}
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 break-all text-[15px] font-extrabold text-mc-text">
                {pkg.client_code}
              </span>
              {partnerChip}
            </span>
            <StatusBadge status={pkg.status} sent={sent} />
          </span>
          <span className="mt-0.5 block break-words text-[12px] font-semibold text-mc-text-2">
            {pkg.source_flight_name || "Reys noma'lum"} · {pkg.track_count} ta
            trek · {formatKg(pkg.weight_kg)}
          </span>
          <span className="block text-[11px] font-medium tabular-nums text-mc-text-3">
            {time}
            {pkg.confirmed_by ? ` · ${pkg.confirmed_by}` : ""}
          </span>
        </span>
      </button>
      <div
        className={cn(
          "ml-auto flex shrink-0 items-center justify-end gap-2 py-1 @2xl:ml-0",
          actionsWidth(editMode),
        )}
      >
        {editMode && canChange && (
          <>
            <button
              type="button"
              onClick={() => onOpen(pkg, "edit")}
              aria-label={`${pkg.client_code}: tahrirlash`}
              title="Tahrirlash"
              className={cn(iconButton, "text-mc-text-2")}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {/* The server keeps a bag the astatka already sent confirmed. */}
            {pkg.status === "confirmed" && !sent && (
              <button
                type="button"
                onClick={() => onUnconfirm(pkg)}
                aria-label={`${pkg.client_code}: tasdiqni bekor qilish`}
                title="Tasdiqni bekor qilish"
                className={cn(iconButton, "text-mc-warn")}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => onDelete(pkg)}
          disabled={!canChange || deleting || pkg.id === null}
          aria-label={`${pkg.client_code}: o'chirish`}
          title={canChange ? "O'chirish" : "O'chirish uchun internet kerak"}
          className={cn(iconButton, "text-mc-danger")}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
