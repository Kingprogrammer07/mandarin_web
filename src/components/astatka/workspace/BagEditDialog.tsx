import { useState } from "react";
import { Loader2 } from "lucide-react";

import { parseTrackCodes } from "@/lib/astatkaWorkQueue";

import { WorkspaceDialog } from "./WorkspaceDialog";

export interface BagEditValues {
  clientCode: string;
  sourceFlight: string;
  /** null = take the photo report's weight. */
  weightKg: number | null;
  comment: string;
  trackCodes: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: BagEditValues;
  /** Fields a saved, confirmed bag can no longer change. */
  locked?: { clientCode?: boolean; sourceFlight?: boolean; removeCodes?: boolean };
  saving?: boolean;
  onSave: (values: BagEditValues) => void;
}

const fieldClass =
  "mt-1 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-2.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand disabled:opacity-60";
const labelClass = "text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3";

/**
 * "Tahrirlash" for one bag — before it is confirmed (a scan row) or after
 * (a saved bag). Every input is 16px so iOS does not zoom the page on focus.
 */
export function BagEditDialog({
  open,
  onOpenChange,
  title,
  initial,
  locked = {},
  saving = false,
  onSave,
}: Props) {
  const [clientCode, setClientCode] = useState(initial.clientCode);
  const [sourceFlight, setSourceFlight] = useState(initial.sourceFlight);
  const [weight, setWeight] = useState(initial.weightKg === null ? "" : String(initial.weightKg));
  const [comment, setComment] = useState(initial.comment);
  const [codesText, setCodesText] = useState(initial.trackCodes.join("\n"));
  const [error, setError] = useState<string | null>(null);

  const codes = parseTrackCodes(codesText);

  const submit = () => {
    const client = clientCode.trim().toUpperCase();
    if (!client) {
      setError("Mijoz kodini yozing.");
      return;
    }
    const weightText = weight.trim().replace(",", ".");
    const weightKg = weightText === "" ? null : Number(weightText);
    if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100000)) {
      setError("Og'irlik noto'g'ri. Masalan: 4.5");
      return;
    }
    if (locked.removeCodes) {
      const missing = initial.trackCodes.filter((code) => !codes.includes(code));
      if (missing.length > 0) {
        setError(
          "Tasdiqlangan yukdan trek kod olib bo'lmaydi. Avval tasdiqni bekor qiling.",
        );
        return;
      }
    }
    setError(null);
    onSave({
      clientCode: client,
      sourceFlight: sourceFlight.trim().toUpperCase(),
      weightKg,
      comment: comment.trim(),
      trackCodes: codes,
    });
  };

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="O'zgartiring va «Saqlash» ni bosing."
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-mc-md border border-mc-border bg-mc-surface text-[14px] font-bold text-mc-text active:scale-[0.98]"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex h-12 items-center justify-center gap-2 rounded-mc-md bg-mc-brand text-[14px] font-extrabold text-mc-on-brand active:scale-[0.98] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Saqlash
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Mijoz kodi</span>
            <input
              value={clientCode}
              onChange={(event) => setClientCode(event.target.value)}
              disabled={locked.clientCode}
              autoCapitalize="characters"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Qaysi reysdan</span>
            <input
              value={sourceFlight}
              onChange={(event) => setSourceFlight(event.target.value)}
              disabled={locked.sourceFlight}
              placeholder="Masalan: M210"
              autoCapitalize="characters"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Og'irligi (kg)</span>
          <input
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            inputMode="decimal"
            placeholder="Masalan: 12.5"
            className={fieldClass}
          />
          <span className="mt-1 block text-[11px] font-medium text-mc-text-3">
            Bo'sh qolsa, foto hisobotdagi og'irlik olinadi.
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>Trek kodlar · {codes.length} ta</span>
          <textarea
            value={codesText}
            onChange={(event) => setCodesText(event.target.value)}
            rows={5}
            placeholder="Har bir qatorga bitta kod"
            className={`${fieldClass} resize-y font-mono`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Izoh</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Masalan: qopi yirtilgan"
            className={`${fieldClass} resize-y`}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-bold text-mc-danger">
            {error}
          </p>
        )}
      </div>
    </WorkspaceDialog>
  );
}
