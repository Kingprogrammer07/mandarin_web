import { memo } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  WifiOff,
  X,
} from "lucide-react";

import {
  canConfirm,
  rowView,
  stateLabel,
  type WorkRow,
  type WorkRowState,
} from "@/lib/astatkaWorkQueue";
import { formatKg, formatScanTime, paymentLabel } from "@/lib/astatkaFormat";
import { cn } from "@/lib/utils";

interface Props {
  row: WorkRow;
  highlighted: boolean;
  /** Opens the bag's photos and photo-report facts. */
  onOpen: (row: WorkRow) => void;
  onConfirm: (row: WorkRow) => void;
  onEdit: (row: WorkRow) => void;
  onRemove: (row: WorkRow) => void;
}

const ACCENT: Record<WorkRowState, string> = {
  checking: "bg-mc-text-3",
  waiting_net: "bg-mc-warn",
  ready: "bg-mc-brand",
  saving: "bg-mc-text-3",
  queued: "bg-mc-warn",
  confirmed: "bg-mc-success",
  other_astatka: "bg-mc-danger",
  not_found: "bg-mc-danger",
  failed: "bg-mc-danger",
};

const CHIP: Record<WorkRowState, string> = {
  checking: "bg-mc-surface-2 text-mc-text-2",
  waiting_net: "bg-mc-warn-soft text-mc-warn",
  ready: "bg-mc-brand-soft text-mc-brand",
  saving: "bg-mc-surface-2 text-mc-text-2",
  queued: "bg-mc-warn-soft text-mc-warn",
  confirmed: "bg-mc-success/12 text-mc-success",
  other_astatka: "bg-mc-danger-soft text-mc-danger",
  not_found: "bg-mc-danger-soft text-mc-danger",
  failed: "bg-mc-danger-soft text-mc-danger",
};

function StateChip({ state }: { state: WorkRowState }) {
  const busy = state === "checking" || state === "saving";
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        CHIP[state],
      )}
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === "waiting_net" && <WifiOff className="h-3 w-3" />}
      {state === "queued" && <Clock className="h-3 w-3" />}
      {state === "confirmed" && <CheckCircle2 className="h-3 w-3" />}
      {stateLabel(state)}
    </span>
  );
}

function ConfirmButton({ row, onConfirm }: { row: WorkRow; onConfirm: (row: WorkRow) => void }) {
  if (row.state === "confirmed") {
    return (
      <span className="flex h-11 items-center justify-center gap-1 rounded-mc-sm bg-mc-success/12 px-2 text-[13px] font-extrabold text-mc-success">
        <Check className="h-4 w-4" />
        Tasdiqlandi
      </span>
    );
  }
  if (row.state === "saving" || row.state === "queued") {
    return (
      <span className="flex h-11 items-center justify-center gap-1 rounded-mc-sm bg-mc-surface-2 px-2 text-[13px] font-bold text-mc-text-2">
        {row.state === "saving" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {row.state === "saving" ? "Saqlanmoqda" : "Navbatda"}
      </span>
    );
  }
  const enabled = canConfirm(row);
  return (
    <button
      type="button"
      onClick={() => onConfirm(row)}
      disabled={!enabled}
      className="flex h-11 items-center justify-center gap-1 rounded-mc-sm bg-mc-brand px-2 text-[13px] font-extrabold text-mc-on-brand active:scale-[0.97] disabled:bg-mc-surface-2 disabled:text-mc-text-3"
    >
      <Check className="h-4 w-4" />
      Tasdiqlash
    </button>
  );
}

/**
 * One bag in the work list. On a wide panel it is the five-column row the
 * warehouse asked for — client | flight | track codes | weight | actions over
 * time — and on a phone the same facts stacked as a card.
 */
export const WorkRowItem = memo(function WorkRowItem({
  row,
  highlighted,
  onOpen,
  onConfirm,
  onEdit,
  onRemove,
}: Props) {
  const view = rowView(row);
  const payment = paymentLabel(row.pkg?.payment_state);
  const removable = row.state !== "saving" && row.state !== "queued" && row.state !== "confirmed";
  const editable = row.state !== "saving" && row.state !== "queued";
  const problem =
    row.state === "failed" ||
    row.state === "not_found" ||
    row.state === "other_astatka" ||
    view.takenAway;
  const note = problem || row.state === "waiting_net" || row.warnings.length > 0;

  // The keyboard and screen-reader way into the details; a tap anywhere on
  // the row does the same.
  const clientBlock = (
    <button
      type="button"
      onClick={() => onOpen(row)}
      title="Rasmlar va foto hisobot ma'lumotlari"
      className="block min-w-0 max-w-full text-left"
    >
      {/* Never truncated: the code is what the worker writes on the bag. */}
      <span className="block break-all text-[16px] font-extrabold leading-tight text-mc-text">
        {view.clientCode || "Mijoz noma'lum"}
      </span>
      {view.clientName && (
        <span className="mt-0.5 block truncate text-[12px] font-medium text-mc-text-3">
          {view.clientName}
        </span>
      )}
    </button>
  );

  const editButton = (
    <button
      type="button"
      onClick={() => onEdit(row)}
      disabled={!editable}
      className="flex h-11 items-center justify-center gap-1 rounded-mc-sm border border-mc-border bg-mc-surface px-2 text-[13px] font-bold text-mc-text active:scale-[0.97] disabled:opacity-50"
    >
      <Pencil className="h-4 w-4" />
      Tahrirlash
    </button>
  );

  const removeButton = (
    <button
      type="button"
      onClick={() => onRemove(row)}
      disabled={!removable}
      aria-label="Ro'yxatdan olib tashlash"
      title="Ro'yxatdan olib tashlash"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-3 active:scale-95 disabled:opacity-30"
    >
      <X className="h-4 w-4" />
    </button>
  );

  const time = (
    <span className="text-[12px] font-semibold tabular-nums text-mc-text-3">
      {formatScanTime(view.timeIso)}
    </span>
  );

  return (
    <li
      onClick={(event) => {
        // The row's own buttons do their own thing.
        if (event.target instanceof Element && event.target.closest("button")) return;
        onOpen(row);
      }}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-mc-md border bg-mc-surface pl-4 pr-2 py-2.5 transition-shadow active:bg-mc-surface-2",
        highlighted ? "border-mc-brand shadow-[var(--mc-shadow-cta)]" : "border-mc-border",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", ACCENT[row.state])} />

      {/* Wide panel: the five columns. */}
      <div className="hidden items-center gap-3 @xl:grid @xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_12.5rem]">
        <div className="min-w-0 space-y-1">
          {clientBlock}
          <StateChip state={row.state} />
        </div>
        <div className="min-w-0">
          <p className="break-words text-[14px] font-bold text-mc-text">
            {view.sourceFlight || "—"}
          </p>
          {payment && <p className="text-[11px] font-medium text-mc-text-3">{payment}</p>}
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold tabular-nums text-mc-text">{view.trackCount} ta</p>
          <p className="text-[11px] font-medium text-mc-text-3">
            {view.scannedCount} tasi skanerlandi
          </p>
        </div>
        <div className="min-w-0">
          <p className="break-words text-[16px] font-extrabold tabular-nums text-mc-text">
            {formatKg(view.weightKg)}
          </p>
          {view.weightEdited && (
            <p className="text-[11px] font-medium text-mc-warn">qo'lda kiritilgan</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <ConfirmButton row={row} onConfirm={onConfirm} />
          {editButton}
          <div className="col-span-2 flex items-center justify-between pl-1">
            {time}
            {removeButton}
          </div>
        </div>
      </div>

      {/* Phone: the same facts, stacked. */}
      <div className="@xl:hidden">
        <div className="flex items-start justify-between gap-2">
          {clientBlock}
          <StateChip state={row.state} />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">Reys</dt>
            <dd className="break-words text-[13px] font-bold text-mc-text">{view.sourceFlight || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">Trek</dt>
            <dd className="text-[13px] font-bold tabular-nums text-mc-text">
              {view.trackCount} ta
              <span className="block text-[11px] font-medium text-mc-text-3">
                {view.scannedCount} skan
              </span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">Og'irlik</dt>
            <dd className="break-words text-[13px] font-bold tabular-nums text-mc-text">
              {formatKg(view.weightKg)}
            </dd>
          </div>
        </dl>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
          <ConfirmButton row={row} onConfirm={onConfirm} />
          {editButton}
          {removeButton}
        </div>
        <div className="mt-1 pl-1">{time}</div>
      </div>

      {note && (
        <div
          className={cn(
            "mt-2 flex items-start gap-1.5 rounded-mc-sm px-2 py-1.5 text-[12px] font-semibold",
            problem ? "bg-mc-danger-soft text-mc-danger" : "bg-mc-warn-soft text-mc-warn",
          )}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">
            {view.takenAway && row.state === "ready"
              ? "Diqqat: tizimda bu yuk mijozga berilgan deb turibdi. Tekshirib tasdiqlang."
              : row.message}
            {row.warnings.map((warning) => (
              <span key={warning} className="block">
                {warning}
              </span>
            ))}
          </span>
        </div>
      )}
    </li>
  );
});
