import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteAstatkaFlight,
  type AstatkaDeleteResult,
  type AstatkaFlightStats,
} from "@/api/services/astatkaFlights";
import { WorkspaceDialog } from "@/components/astatka/workspace/WorkspaceDialog";
import { apiErrorMessage } from "@/utils/apiError";

interface Props {
  flightName: string;
  /** The card's counts; null when they did not load. */
  stats: AstatkaFlightStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (result: AstatkaDeleteResult) => void;
}

const sameName = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * Deletes a whole astatka. There is no undo, so the user types the name
 * again — a tap on the wrong card, or a second tap, cannot do it.
 */
export function AstatkaDeleteDialog({ flightName, stats, open, onOpenChange, onDeleted }: Props) {
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const matches = sameName(typed, flightName);

  const remove = useMutation({
    mutationFn: () => deleteAstatkaFlight(flightName, typed.trim()),
    onSuccess: (result) => {
      toast.success(`${result.flight_name} astatkasi o'chirildi.`);
      onDeleted(result);
      handleOpenChange(false);
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTyped("");
      remove.reset();
    }
    onOpenChange(next);
  }

  const expected = stats?.expected ?? 0;
  const confirmed = stats?.confirmed ?? 0;
  const sent = stats?.sent ?? 0;

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={(next) => {
        if (!remove.isPending) handleOpenChange(next);
      }}
      title="Astatkani o'chirish"
      description={flightName}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={remove.isPending}
            className="h-12 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[14px] font-bold text-mc-text active:scale-[0.98] disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={!matches || remove.isPending}
            className="flex h-12 items-center justify-center gap-2 rounded-mc-md bg-mc-danger-fill px-3 text-[14px] font-extrabold text-mc-on-danger active:scale-[0.98] disabled:opacity-50"
          >
            {remove.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            O'chirish
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-mc-text">
          Astatka ro'yxatdan va undagi barcha yuklar bilan birga o'chadi. Bu amalni qaytarib
          bo'lmaydi.
        </p>

        {stats && expected + confirmed > 0 && (
          // Wraps instead of three fixed columns: "TASDIQLANGAN" alone is
          // wider than a third of a 320px sheet.
          <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-mc-md bg-mc-surface-2 p-3">
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                Kutilmoqda
              </dt>
              <dd className="text-[15px] font-extrabold tabular-nums text-mc-text">{expected}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                Tasdiqlangan
              </dt>
              <dd className="text-[15px] font-extrabold tabular-nums text-mc-text">{confirmed}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                Yuborilgan
              </dt>
              <dd
                className={
                  sent > 0
                    ? "text-[15px] font-extrabold tabular-nums text-mc-danger"
                    : "text-[15px] font-extrabold tabular-nums text-mc-text"
                }
              >
                {sent}
              </dd>
            </div>
          </dl>
        )}

        <ul className="list-disc space-y-1 pl-5 text-[12px] font-medium text-mc-text-2">
          {sent > 0 && (
            <li>
              {sent} ta yuk haqida mijozlarga xabar yuborilgan. Xabar ularda qoladi, astatkadagi
              yozuvi o'chadi.
            </li>
          )}
          <li>Astatkada olingan rasmlar ham o'chadi.</li>
          <li>Eski reyslardagi foto hisobot, trek kodlar va to'lovlarga tegilmaydi.</li>
        </ul>

        <div>
          <label htmlFor={inputId} className="block text-[12px] font-semibold text-mc-text-2">
            Tasdiqlash uchun astatka nomini yozing:
            {/* Its own line, wrapped at hyphens: the user copies it letter by letter. */}
            <span className="mt-0.5 block break-words text-[13px] font-extrabold text-mc-text">
              {flightName}
            </span>
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches && !remove.isPending) remove.mutate();
            }}
            disabled={remove.isPending}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 h-12 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-danger"
          />
        </div>

        {remove.isError && (
          <p role="alert" className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
            {apiErrorMessage(remove.error, "Astatkani o'chirib bo'lmadi.")}
          </p>
        )}
      </div>
    </WorkspaceDialog>
  );
}
