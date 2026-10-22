import { useState } from "react";
import { Check, Pencil, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import {
  updateAstatkaPackage,
  type AstatkaBagRef,
} from "@/api/services/astatkaFlights";
import type { AstatkaPendingPhotos } from "@/hooks/useAstatkaPendingPhotos";
import type { AstatkaWorkQueue } from "@/hooks/useAstatkaWorkQueue";
import { ownWeightHint, summaryFromRow } from "@/lib/astatkaBagSummary";
import { isPartnerPackage } from "@/lib/astatkaSource";
import {
  canConfirm,
  canRecheck,
  ownPackageId,
  rowCodes,
  rowView,
  type WorkRow,
  type WorkRowEdits,
} from "@/lib/astatkaWorkQueue";
import { apiErrorMessage } from "@/utils/apiError";

import { BagSheet, type BagSheetMode } from "./BagSheet";
import type { BagEditChanges } from "./BagEditForm";
import { BagPendingPhotos } from "./BagPendingPhotos";
import type { ExternalBagCardProps } from "./ExternalBagCard";
import { SheetActions, type SheetAction } from "./SheetActions";
import { packageUpdateOf } from "./useSavedBagActions";

interface Props {
  flightName: string;
  /** Only what the window does to the queue: edits, a saved bag's new facts, the weight. */
  queue: Pick<AstatkaWorkQueue, "isOnline" | "replacePackage" | "updateEdits">;
  /** Photos taken before the row's bag is saved here; they go to it on confirm. */
  pendingPhotos: Pick<AstatkaPendingPhotos, "entries" | "add" | "remove" | "retry">;
  /** The row as it is now, or as it was when it left the screen. */
  row: WorkRow;
  /** False once the row is gone from the screen: shown, but not acted on. */
  onScreen: boolean;
  mode: BagSheetMode;
  onModeChange: (mode: BagSheetMode) => void;
  onClose: () => void;
  onConfirm: (row: WorkRow) => void;
  onRemove: (row: WorkRow) => void;
  /** "Qayta tekshirish": asks the server about the row's code again. */
  onRecheck: (row: WorkRow) => void;
}

/**
 * Which bag the photo report reads: a bag saved in this astatka by id, any
 * other by client and flight. `null` while the row has no client yet, and
 * for a partner cargo's bag: our photo report would read an unrelated client
 * of ours with the same code.
 */
function bagRefOf(row: WorkRow, flightName: string): AstatkaBagRef | null {
  if (isPartnerPackage(row.pkg)) return null;
  const packageId = ownPackageId(row, flightName);
  if (packageId !== null) return { packageId };
  const view = rowView(row);
  if (!view.clientCode) return null;
  return { clientCode: view.clientCode, sourceFlight: view.sourceFlight };
}

/**
 * What the worker changed, laid over the row's own edits as they are now —
 * not as they were when the form opened — so a flight the server resolved
 * meanwhile is not written back stale.
 */
function mergeEdits(edits: WorkRowEdits, changes: BagEditChanges): WorkRowEdits {
  const merged: WorkRowEdits = { ...edits };
  if (changes.clientCode !== undefined) merged.clientCode = changes.clientCode;
  if (changes.sourceFlight !== undefined) merged.sourceFlight = changes.sourceFlight;
  if ("weightKg" in changes) merged.weightKg = changes.weightKg ?? null;
  // "" is kept: it clears the bag's comment when the row is confirmed.
  if (changes.comment !== undefined) merged.comment = changes.comment;
  if (changes.trackCodes !== undefined) {
    merged.trackCodes = changes.trackCodes;
    merged.trackCodesBase = changes.trackCodesBase ?? null;
  }
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
  pendingPhotos,
  row,
  onScreen,
  mode,
  onModeChange,
  onClose,
  onConfirm,
  onRemove,
  onRecheck,
}: Props) {
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingCameraOpen, setPendingCameraOpen] = useState(false);
  const view = rowView(row);
  // Same rule as the row: a saving or queued row holds work the server has
  // not seen yet, so it is neither edited nor taken off the screen.
  const editable = onScreen && row.state !== "saving" && row.state !== "queued";
  const partner = view.sourceCompany !== "";
  // The flight is the worker's choice until the bag is confirmed.
  const flightPickable = editable && row.state !== "confirmed";

  const partnerCard: ExternalBagCardProps | undefined = partner
    ? {
        companyName: view.sourceCompanyName,
        bag: view.external,
        options: row.externalOptions,
        selectedFlight: view.sourceFlight,
        flightKnown: row.externalFlightKnown ?? true,
        onPickFlight: flightPickable
          ? (sourceFlight) => queue.updateEdits(row.id, mergeEdits(row.edits, { sourceFlight }))
          : undefined,
        // A bag held by another astatka is read through that astatka.
        storedPhotos:
          row.pkg?.id != null
            ? { flightName: row.pkg.astatka_flight_name || flightName, packageId: row.pkg.id }
            : undefined,
      }
    : undefined;

  // A bag already saved here takes photos straight onto itself (BagOwnPhotos);
  // one that will be saved by "Tasdiqlash" keeps them until then. A partner's
  // bag, or a code a partner may own, has no photos of ours.
  const savedHere = ownPackageId(row, flightName);
  const pendingEntry = pendingPhotos.entries.get(row.id);
  const awaitingConfirm = canConfirm(row) || row.state === "queued" || row.state === "saving";
  const canHoldPhotos =
    onScreen && !partner && !row.partnerState && savedHere === null && awaitingConfirm;
  const pendingSection =
    canHoldPhotos || pendingEntry || pendingCameraOpen ? (
      <BagPendingPhotos
        entry={pendingEntry}
        canAdd={canHoldPhotos}
        onAdd={(files) => pendingPhotos.add(row.id, files, savedHere)}
        onRemove={(index) => pendingPhotos.remove(row.id, index)}
        onRetry={() => pendingPhotos.retry(row.id)}
        cameraOpen={pendingCameraOpen}
        onCameraOpenChange={setPendingCameraOpen}
      />
    ) : undefined;

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
  if (onScreen && canRecheck(row)) {
    buttons.push({
      key: "recheck",
      label: "Qayta tekshirish",
      icon: RefreshCw,
      tone: "neutral",
      onSelect: () => onRecheck(row),
      disabled: !queue.isOnline,
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
      partner={partnerCard}
      pendingPhotos={pendingSection}
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
              // A partner's bag: its API names the client, and the flight
              // is picked in the partner's data below the form. A code a
              // partner may own is not typed onto one of our clients at all.
              locked:
                row.state === "confirmed"
                  ? { clientCode: true, sourceFlight: true, byConfirm: true }
                  : partner || row.partnerState
                    ? { clientCode: true, sourceFlight: true }
                    : {},
              hints: partner
                ? {
                    sourceFlight: flightPickable
                      ? `Reys pastdagi «${view.sourceCompanyName} ma'lumoti» bo'limida tanlanadi.`
                      : undefined,
                    weight: `Bo'sh qolsa, ${view.sourceCompanyName} ma'lumotidagi og'irlik olinadi.`,
                  }
                : row.partnerState
                  ? {
                      clientCode:
                        "Bu kod boshqa kargoniki bo'lishi mumkin — mijozni qo'lda yozib bo'lmaydi. «Qayta tekshirish» ni bosing.",
                    }
                  : { weight: ownWeightHint(view.sourceFlight) },
              // The list shown is the saved bag's own, or the worker's
              // earlier list — which keeps the bag that one was written on.
              codesBase:
                row.edits.trackCodes !== undefined
                  ? (row.edits.trackCodesBase ?? null)
                  : (row.pkg?.id ?? null),
              saving: savingEdit,
              disabledReason: waitReason(row),
              onSave: (changes) => void saveEdit(changes),
            }
          : undefined
      }
    />
  );
}
