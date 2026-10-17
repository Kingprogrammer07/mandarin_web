import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";

import type {
  AstatkaBagRef,
  AstatkaPackage,
} from "@/api/services/astatkaFlights";
import { isSentFromAstatka, summaryFromPackage } from "@/lib/astatkaBagSummary";
import { isPartnerPackage, sourceCompanyLabel } from "@/lib/astatkaSource";

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
  /** The bag's own photos were retaken in this window. */
  onPackageChanged: (pkg: AstatkaPackage) => void;
  /** The photo report needs the network. */
  isOnline: boolean;
  /** False while the list is the offline snapshot: nothing can change. */
  canChange: boolean;
  actions: SavedBagActions;
}

/**
 * A saved bag is read by id; one with no id yet by its client and flight. A
 * partner cargo's bag never: our photo report would read an unrelated client
 * of ours with the same code.
 */
function bagRefOf(pkg: AstatkaPackage): AstatkaBagRef | null {
  if (isPartnerPackage(pkg)) return null;
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
  onPackageChanged,
  isOnline,
  canChange,
  actions,
}: Props) {
  const confirmed = pkg.status === "confirmed";
  const deleting = pkg.id !== null && actions.deletingIds.has(pkg.id);
  const partner = sourceCompanyLabel(pkg);

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
  // The server keeps a bag the astatka already sent confirmed.
  if (confirmed && !isSentFromAstatka(pkg)) {
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
      partner={
        partner
          ? {
              companyName: partner,
              bag: pkg.external ?? null,
              storedPhotos:
                pkg.id !== null ? { flightName, packageId: pkg.id } : undefined,
            }
          : undefined
      }
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
        // A partner's bag: its API named the client.
        locked: confirmed
          ? { clientCode: true, sourceFlight: true, byConfirm: true }
          : partner
            ? { clientCode: true, sourceFlight: true }
            : { sourceFlight: true },
        hints: partner
          ? { weight: `Bo'sh qolsa, ${partner} ma'lumotidagi og'irlik olinadi.` }
          : undefined,
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
      onPackageChanged={onPackageChanged}
    />
  );
}
