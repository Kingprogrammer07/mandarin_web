import { useId, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import type { AstatkaBagRef, AstatkaPackage } from "@/api/services/astatkaFlights";
import type { BagSummary } from "@/lib/astatkaBagSummary";

import {
  BagEditForm,
  type BagEditChanges,
  type BagEditHints,
  type BagEditLocks,
  type BagEditValues,
} from "./BagEditForm";
import { BagOwnPhotos } from "./BagOwnPhotos";
import { BagPhotoReport } from "./BagPhotoReport";
import { BagSummaryPanel } from "./BagSummaryPanel";
import { ExternalBagCard, type ExternalBagCardProps } from "./ExternalBagCard";
import { WorkspaceDialog } from "./WorkspaceDialog";

export type BagSheetMode = "view" | "edit";

export interface BagSheetEdit {
  /** The bag as it is now; untouched fields of the form follow it. */
  current: BagEditValues;
  locked?: BagEditLocks;
  hints?: BagEditHints;
  /** Which saved bag `current.trackCodes` lists; see BagEditForm. */
  codesBase?: number | null;
  saving: boolean;
  /**
   * Why "Saqlash" has to wait right now (the row is being sent, no internet).
   * The form stays open with what was typed, and saves once this is gone.
   */
  disabledReason?: string;
  onSave: (changes: BagEditChanges) => void;
}

interface Props {
  flightName: string;
  /** The bag's name in the header: its client code, or a track code. */
  title: string;
  summary: BagSummary;
  /** Which bag the photo report reads; `null` while it has no client. */
  bag: AstatkaBagRef | null;
  /**
   * A partner cargo's bag: its data is shown instead of our photo report,
   * which would read an unrelated client of ours with the same code.
   */
  partner?: ExternalBagCardProps;
  /** The photo report needs the network. */
  isOnline: boolean;
  mode: BagSheetMode;
  onModeChange: (mode: BagSheetMode) => void;
  onClose: () => void;
  /** The footer while viewing: the caller's actions for this bag. */
  footer?: ReactNode;
  /** What "Tahrirlash" edits; without it the window only shows the bag. */
  edit?: BagSheetEdit;
  /** The saved bag as the server holds it after its own photos changed. */
  onPackageChanged?: (pkg: AstatkaPackage) => void;
}

const footerButton =
  "flex h-12 items-center justify-center gap-2 rounded-mc-md text-[14px] active:scale-[0.98] disabled:opacity-60 sm:min-w-40 sm:px-4";

/**
 * The one window for a bag, from the saved list and from the scan list alike:
 * the bag's facts, the photos retaken for it here, then the old flight's
 * photo report (read-only) — photos beside their facts on a wide screen — or,
 * for a partner cargo's bag, what the partner's API says. "Tahrirlash" swaps
 * the facts for the edit form in place, so there is never a second window on
 * top of this one (only a photo opened full screen).
 */
export function BagSheet({
  flightName,
  title,
  summary,
  bag,
  partner,
  isOnline,
  mode,
  onModeChange,
  onClose,
  footer,
  edit,
  onPackageChanged,
}: Props) {
  const formId = useId();
  const reasonId = useId();
  const editing = mode === "edit" && edit !== undefined;

  const description = editing
    ? "O'zgartiring va «Saqlash» ni bosing."
    : [
        summary.clientName,
        summary.sourceCompanyName,
        summary.sourceFlight || "Reys noma'lum",
      ]
        .filter(Boolean)
        .join(" · ");

  const editFooter = editing ? (
    <div className="space-y-2">
      {edit.disabledReason && (
        <p
          id={reasonId}
          role="status"
          className="text-center text-[12px] font-semibold text-mc-warn sm:text-right"
        >
          {edit.disabledReason}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button
          type="button"
          onClick={() => onModeChange("view")}
          disabled={edit.saving}
          className={`${footerButton} border border-mc-border bg-mc-surface font-bold text-mc-text`}
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          form={formId}
          disabled={edit.saving || edit.disabledReason !== undefined}
          aria-describedby={edit.disabledReason ? reasonId : undefined}
          className={`${footerButton} bg-mc-brand font-extrabold text-mc-on-brand`}
        >
          {edit.saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Saqlash
        </button>
      </div>
    </div>
  ) : null;

  return (
    <WorkspaceDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `Tahrirlash · ${title}` : title}
      description={description}
      size="xl"
      footer={editing ? editFooter : footer}
    >
      <div className="@container space-y-5">
        {editing ? (
          <BagEditForm
            id={formId}
            current={edit.current}
            locked={edit.locked}
            hints={edit.hints}
            codesBase={edit.codesBase}
            onSave={edit.onSave}
          />
        ) : (
          <BagSummaryPanel summary={summary} />
        )}
        {partner ? (
          <ExternalBagCard {...partner} />
        ) : (
          <>
            {bag && "packageId" in bag && (
              <BagOwnPhotos
                flightName={flightName}
                packageId={bag.packageId}
                isOnline={isOnline}
                onPackageChanged={onPackageChanged}
              />
            )}
            <BagPhotoReport
              flightName={flightName}
              bag={bag}
              sourceFlight={summary.sourceFlight}
              isOnline={isOnline}
            />
          </>
        )}
      </div>
    </WorkspaceDialog>
  );
}
