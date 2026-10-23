import { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeMinus, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  astatkaCleanupQueryKey,
  getAstatkaWriteOffPlan,
  undoAstatkaWriteOff,
  writeOffAstatkaCleanupDebt,
  type CleanupRun,
  type WriteOffSkipReason,
} from "@/api/services/astatkaCleanup";
import { formatDateTime } from "@/lib/astatkaFormat";
import { formatUzs } from "@/lib/format";
import { apiErrorMessage } from "@/utils/apiError";

const SKIP_LABELS: Record<WriteOffSkipReason, string> = {
  changed: "Shu orada berilgan yoki o'zgargan",
  receipt_pending: "Kassada chek kutilmoqda",
  in_delivery: "Navbatda yoki yetkazishda",
  flight_credit: "Shu reysda ortiqcha to'lovi bor",
};

const sameName = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * «Qarzni o'chirish» on one cleanup run: the bags it marked taken stop being a
 * debt in the kassa and in the client's balance. Shows what it would close,
 * asks for the astatka's name, and can be undone.
 */
export function CleanupWriteOff({
  flightName,
  run,
  onChanged,
}: {
  flightName: string;
  run: CleanupRun;
  onChanged: () => void;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [armedUndo, setArmedUndo] = useState(false);

  const plan = useQuery({
    queryKey: [...astatkaCleanupQueryKey(flightName), "write-off", run.id],
    queryFn: () => getAstatkaWriteOffPlan(flightName, run.id),
    enabled: open,
    staleTime: 0,
  });
  const writeOff = useMutation({
    mutationFn: () => writeOffAstatkaCleanupDebt(flightName, run.id, typed.trim()),
    onSuccess: (done) => {
      setOpen(false);
      setTyped("");
      toast.success(`Qarz o'chirildi: ${formatUzs(done.write_off?.amount ?? 0)}`);
      onChanged();
    },
  });
  const undo = useMutation({
    mutationFn: () => undoAstatkaWriteOff(flightName, run.id),
    onSuccess: (done) => {
      setArmedUndo(false);
      const result = done.write_off;
      toast.success(
        result?.kept
          ? `Qarz qaytdi: ${result.reverted} ta yozuv, ${result.kept} tasi shu orada o'zgargani uchun qoldi.`
          : `Qarz qaytdi: ${result?.reverted ?? 0} ta yozuv.`,
      );
      onChanged();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Qarzni qaytarib bo'lmadi.")),
  });

  const active = run.write_off && !run.write_off.undone_at ? run.write_off : null;

  if (active) {
    return (
      <div className="mt-2 rounded-mc-sm bg-mc-surface-2 px-3 py-2">
        <p className="text-[12px] font-bold text-mc-text">
          Qarz o'chirilgan: {formatUzs(active.amount)} · {active.bags} yuk
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-mc-text-3">
          {formatDateTime(active.created_at)}
          {active.admin_username && ` · ${active.admin_username}`}
          {active.skipped > 0 && ` · ${active.skipped} ta yukning qarzi qoldi`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {armedUndo ? (
            <>
              <button
                type="button"
                onClick={() => undo.mutate()}
                disabled={undo.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-mc-md bg-mc-danger-fill px-3 text-[13px] font-extrabold text-mc-on-danger active:scale-[0.98] disabled:opacity-50"
              >
                {undo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Ha, qarzni qaytarish
              </button>
              <button
                type="button"
                onClick={() => setArmedUndo(false)}
                disabled={undo.isPending}
                className="h-11 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98]"
              >
                Yo'q
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setArmedUndo(true)}
              className="inline-flex h-11 items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98]"
            >
              <Undo2 className="h-4 w-4" />
              Qarzni qaytarish
            </button>
          )}
        </div>
      </div>
    );
  }

  if (run.undone_at || run.unpaid_bags === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex h-11 items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98]"
      >
        <BadgeMinus className="h-4 w-4" />
        Qarzni o'chirish
      </button>
    );
  }

  const data = plan.data;
  const canWriteOff = Boolean(data && data.transactions > 0 && sameName(typed, flightName));
  return (
    <section
      aria-label={`№${run.id} qarzini o'chirish`}
      className="mt-2 space-y-3 rounded-mc-md border border-mc-danger/40 bg-mc-surface-2 p-3"
    >
      <p className="text-[12px] font-medium leading-relaxed text-mc-text-2">
        <span className="font-extrabold text-mc-text">Qarzni o'chirish.</span> Shu tozalashda
        «olib ketilgan» deb belgilangan to'lanmagan yuklarning qarzi kassadan va mijoz balansidan
        o'chadi: to'lov yozuvi «to'langan» bo'ladi, lekin kassaga pul tushgan deb hisoblanmaydi,
        kunlik hisobotga ham kirmaydi. Mijoz ilovasida bu reyslar to'langan bo'lib ko'rinadi.
        Keyin «Qarzni qaytarish» bilan bekor qilish mumkin.
      </p>

      {plan.isLoading && (
        <p className="flex items-center gap-2 text-[13px] font-semibold text-mc-text-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Hisoblanmoqda…
        </p>
      )}
      {plan.isError && (
        <p role="alert" className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
          {apiErrorMessage(plan.error, "Hisoblab bo'lmadi.")}
        </p>
      )}

      {data && (
        <>
          <p className="text-[15px] font-extrabold tabular-nums text-mc-text">
            {formatUzs(data.amount)}
            <span className="ml-1.5 text-[12px] font-semibold text-mc-text-3">
              {data.bags} yuk · {data.transactions} ta to'lov yozuvi
            </span>
          </p>
          {data.skipped.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-mc-text-2">
                {data.skipped.length} ta yukning qarzi qoladi:
              </p>
              <ul className="mt-1 max-h-40 divide-y divide-mc-border overflow-y-auto rounded-mc-sm border border-mc-border">
                {data.skipped.map((item) => (
                  <li
                    key={`${item.flight_name}|${item.client_code}`}
                    className="flex flex-wrap justify-between gap-x-3 px-3 py-1.5 text-[12px]"
                  >
                    <span className="font-bold text-mc-text">
                      {item.client_code} · {item.flight_name}
                    </span>
                    <span className="font-medium text-mc-text-3">
                      {SKIP_LABELS[item.reason]} · {formatUzs(item.debt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.transactions > 0 ? (
            <div>
              <label htmlFor={inputId} className="block text-[12px] font-semibold text-mc-text-2">
                Tasdiqlash uchun astatka nomini yozing:
                <span className="mt-0.5 block break-words text-[13px] font-extrabold text-mc-text">
                  {flightName}
                </span>
              </label>
              <input
                id={inputId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canWriteOff) writeOff.mutate();
                }}
                disabled={writeOff.isPending}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1.5 h-12 w-full rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-danger"
              />
            </div>
          ) : (
            <p className="text-[13px] font-semibold text-mc-text-3">O'chiriladigan qarz qolmagan.</p>
          )}
        </>
      )}

      {writeOff.isError && (
        <p role="alert" className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
          {apiErrorMessage(writeOff.error, "Qarzni o'chirib bo'lmadi.")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {data && data.transactions > 0 && (
          <button
            type="button"
            onClick={() => writeOff.mutate()}
            disabled={!canWriteOff || writeOff.isPending}
            className="inline-flex h-11 items-center gap-2 rounded-mc-md bg-mc-danger-fill px-3 text-[13px] font-extrabold text-mc-on-danger active:scale-[0.98] disabled:opacity-50"
          >
            {writeOff.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {formatUzs(data.amount)} qarzni o'chirish
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
            writeOff.reset();
          }}
          disabled={writeOff.isPending}
          className="h-11 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98]"
        >
          Yopish
        </button>
      </div>
    </section>
  );
}
