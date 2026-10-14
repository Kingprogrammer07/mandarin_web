import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";

import type {
  AstatkaBagRef,
  AstatkaPackage,
} from "@/api/services/astatkaFlights";
import { summaryFromPackage } from "@/lib/astatkaBagSummary";

import { BagSheet, type BagSheetMode } from "./BagSheet";
import { SheetActions, type SheetAction } from "./SheetActions";
import type { SavedBagActions } from "./useSavedBagActions";

interface Props {
  flightName: string;
  /** The bag as it is now: the list's latest copy, or a newer local one. */
  pkg: AstatkaPackage;
  mode: BagSheetMode;
  onModeChange: (mode: BagSheetMode) => void;
  onClose: () => void;
  /** The photo report's weight was fixed in this window. */
  onWeightChanged: (weightKg: number | null) => void;
  /** The photo report needs the network. */
  isOnline: boolean;
  /** False while the list is the offline snapshot: nothing can change. */
  canChange: boolean;
  actions: SavedBagActions;
}

/** A saved bag is read by id; one with no id yet by its client and flight. */
function bagRefOf(pkg: AstatkaPackage): AstatkaBagRef | null {
  if (pkg.id !== null) return { packageId: pkg.id };
  if (!pkg.client_code) return null;
  return { clientCode: pkg.client_code, sourceFlight: pkg.source_flight_name };
}

/** The bag window for a bag of the saved list, with what can be done to it. */
export function SavedBagSheet({
  flightName,
  pkg,
  mode,
  onModeChange,
  onClose,
  onWeightChanged,
  isOnline,
  canChange,
  actions,
}: Props) {
  const confirmed = pkg.status === "confirmed";
  const deleting = pkg.id !== null && actions.deletingIds.has(pkg.id);

  const buttons: SheetAction[] = [];
  if (!confirmed) {
    buttons.push({
      key: "confirm",
      label: "Yuk shu yerda — tasdiqlash",
      icon: Check,
      tone: "primary",
      onSelect: () => actions.confirm.mutate(pkg),
      pending: actions.confirm.isPending,
    });
  }
  buttons.push({
    key: "edit",
    label: "Tahrirlash",
    icon: Pencil,
    tone: "neutral",
    onSelect: () => onModeChange("edit"),
  });
  if (confirmed) {
    buttons.push({
      key: "unconfirm",
      label: "Tasdiqni bekor qilish",
      icon: RotateCcw,
      tone: "warn",
      onSelect: () => void actions.askUnconfirm(pkg),
      pending: actions.unconfirm.isPending,
    });
  }
  buttons.push({
    key: "delete",
    label: "O'chirish",
    icon: Trash2,
    tone: "danger",
    onSelect: () => void actions.askDelete(pkg),
    disabled: pkg.id === null,
    pending: deleting,
  });

  return (
    <BagSheet
      flightName={flightName}
      title={pkg.client_code}
      summary={summaryFromPackage(pkg)}
      bag={bagRefOf(pkg)}
      isOnline={isOnline}
      mode={mode}
      onModeChange={onModeChange}
      onClose={onClose}
      footer={
        canChange ? (
          <SheetActions actions={buttons} />
        ) : (
          <p className="text-center text-[12px] font-semibold text-mc-text-3">
            Internet yo'q — o'zgartirish uchun internet kerak.
          </p>
        )
      }
      edit={{
        current: {
          clientCode: pkg.client_code,
          sourceFlight: pkg.source_flight_name,
          weightKg: pkg.weight_kg,
          comment: pkg.comment ?? "",
          trackCodes: pkg.track_codes,
        },
        locked: confirmed
          ? { clientCode: true, sourceFlight: true }
          : { sourceFlight: true },
        saving: actions.update.isPending,
        // The connection dropping mid-edit must not throw away what was typed.
        disabledReason: canChange
          ? undefined
          : "Internet yo'q — saqlash uchun internet kerak.",
        onSave: (changes) => {
          if (Object.keys(changes).length === 0) onModeChange("view");
          else actions.update.mutate({ pkg, changes });
        },
      }}
      onWeightChanged={onWeightChanged}
    />
  );
}
