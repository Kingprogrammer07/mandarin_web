import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import {
  updateAstatkaPackage,
  type AstatkaBagRef,
} from "@/api/services/astatkaFlights";
import type { AstatkaWorkQueue } from "@/hooks/useAstatkaWorkQueue";
import { summaryFromRow } from "@/lib/astatkaBagSummary";
import {
  canConfirm,
  rowCodes,
  rowView,
  type WorkRow,
  type WorkRowEdits,
} from "@/lib/astatkaWorkQueue";
import { apiErrorMessage } from "@/utils/apiError";

import { BagSheet, type BagSheetMode } from "./BagSheet";
import type { BagEditChanges } from "./BagEditForm";
import { SheetActions, type SheetAction } from "./SheetActions";
import { packageUpdateOf } from "./useSavedBagActions";

interface Props {
  flightName: string;
  /** Only what the window does to the queue: edits, a saved bag's new facts, the weight. */
  queue: Pick<AstatkaWorkQueue, "isOnline" | "replacePackage" | "updateEdits" | "applyBagWeight">;
  /** The row as it is now, or as it was when it left the screen. */
  row: WorkRow;
  /** False once the row is gone from the screen: shown, but not acted on. */
  onScreen: boolean;
  mode: BagSheetMode;
  onModeChange: (mode: BagSheetMode) => void;
  onClose: () => void;
  onConfirm: (row: WorkRow) => void;
  onRemove: (row: WorkRow) => void;
}

/**
 * Which bag the photo report reads: a bag saved in this astatka by id, any
 * other by client and flight. `null` while the row has no client yet.
 */
function bagRefOf(row: WorkRow, flightName: string): AstatkaBagRef | null {
  const pkg = row.pkg;
  const sameAstatka =
    pkg?.astatka_flight_name.trim().toUpperCase() ===
    flightName.trim().toUpperCase();
  if (pkg?.id != null && sameAstatka && !pkg.already_in_astatka)
    return { packageId: pkg.id };
  const view = rowView(row);
  if (!view.clientCode) return null;
  return { clientCode: view.clientCode, sourceFlight: view.sourceFlight };
}

/**
 * What the worker changed, laid over the row's own edits as they are now —
 * not as they were when the form opened — so a weight the photo report fixed
 * meanwhile, or a flight the server resolved, is not written back stale.
 */
function mergeEdits(edits: WorkRowEdits, changes: BagEditChanges): WorkRowEdits {
  const merged: WorkRowEdits = { ...edits };
  if (changes.clientCode !== undefined) merged.clientCode = changes.clientCode;
  if (changes.sourceFlight !== undefined) merged.sourceFlight = changes.sourceFlight;
  if ("weightKg" in changes) merged.weightKg = changes.weightKg ?? null;
  // "" is kept: it clears the bag's comment when the row is confirmed.
  if (changes.comment !== undefined) merged.comment = changes.comment;
  if (changes.trackCodes !== undefined) merged.trackCodes = changes.trackCodes;
  return merged;
}

/** Why a row's edit has to wait; `undefined` when it can be saved now. */
function waitReason(row: WorkRow): string | undefined {
  if (row.state === "saving") return "Yuk saqlanmoqda — tugashi bilan «Saqlash» ni bosing.";
  if (row.state === "queued")
    return "Yuk internetni kutmoqda — yuborilgach «Saqlash» ni bosing.";
  return undefined;
}

/** The bag window for a row of the scan list; its buttons mirror the row's. */
export function WorkRowSheet({
  flightName,
  queue,
  row,
  onScreen,
  mode,
  onModeChange,
  onClose,
  onConfirm,
  onRemove,
}: Props) {
  const [savingEdit, setSavingEdit] = useState(false);
  const view = rowView(row);
  // Same rule as the row: a saving or queued row holds work the server has
  // not seen yet, so it is neither edited nor taken off the screen.
  const editable = onScreen && row.state !== "saving" && row.state !== "queued";

  // After "Saqlash" the window stays open on the bag as saved.
  const saveEdit = async (changes: BagEditChanges) => {
    if (Object.keys(changes).length === 0) {
      onModeChange("view");
      return;
    }
    // A confirmed bag is already saved: the change goes to the server. Any
    // other row only changes on this screen until it is confirmed.
    const savedPkg = row.state === "confirmed" ? row.pkg : null;
    if (savedPkg?.id != null) {
      setSavingEdit(true);
      try {
        const pkg = await updateAstatkaPackage(flightName, savedPkg.id, packageUpdateOf(savedPkg, changes));
        queue.replacePackage(row.id, pkg);
        toast.success("Saqlandi");
        onModeChange("view");
      } catch (error) {
        toast.error(apiErrorMessage(error, "Saqlab bo'lmadi."));
      } finally {
        setSavingEdit(false);
      }
      return;
    }
    queue.updateEdits(row.id, mergeEdits(row.edits, changes));
    onModeChange("view");
  };

  const buttons: SheetAction[] = [];
  if (onScreen && canConfirm(row)) {
    buttons.push({
      key: "confirm",
      label: "Tasdiqlash",
      icon: Check,
      tone: "primary",
      onSelect: () => onConfirm(row),
    });
  }
  if (editable) {
    buttons.push({
      key: "edit",
      label: "Tahrirlash",
      icon: Pencil,
      tone: "neutral",
      onSelect: () => onModeChange("edit"),
    });
    buttons.push({
      key: "remove",
      label: "Ekrandan olib tashlash",
      icon: X,
      tone: "neutral",
      onSelect: () => {
        onRemove(row);
        onClose();
      },
    });
  }

  return (
    <BagSheet
      flightName={flightName}
      title={view.clientCode || row.trackCode}
      summary={summaryFromRow(row)}
      bag={bagRefOf(row, flightName)}
      isOnline={queue.isOnline}
      mode={mode}
      onModeChange={onModeChange}
      onClose={onClose}
      footer={
        buttons.length > 0 ? <SheetActions actions={buttons} /> : undefined
      }
      // Kept while the row is on screen, even while it is being sent: the
      // form keeps what was typed and Saqlash waits for the row instead.
      edit={
        onScreen
          ? {
              current: {
                clientCode: view.clientCode,
                sourceFlight: view.sourceFlight,
                weightKg: view.weightKg,
                comment: row.edits.comment ?? row.pkg?.comment ?? "",
                trackCodes: rowCodes(row),
              },
              locked:
                row.state === "confirmed"
                  ? { clientCode: true, sourceFlight: true, removeCodes: true }
                  : {},
              saving: savingEdit,
              disabledReason: waitReason(row),
              onSave: (changes) => void saveEdit(changes),
            }
          : undefined
      }
      onWeightChanged={(weightKg) => queue.applyBagWeight(row.id, weightKg)}
    />
  );
}
