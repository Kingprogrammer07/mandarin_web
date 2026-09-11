import { useState } from "react";
import { AlertTriangle, Printer, RotateCcw } from "lucide-react";
import { useUzPostLabelSettings } from "@/api/hooks/useWarehouse";
import UzPostLabelCopiesDialog from "./UzPostLabelCopiesDialog";

/**
 * The one control for how many copies of a UzPost label print.
 *
 * Shown only to the account allowed to change it, and the server says who that
 * is. Nothing renders while that answer is on its way: until it arrives there is
 * no telling whether this viewer gets the card at all, and a placeholder that
 * then vanished for everyone else would only shove the orders list around.
 */
export default function UzPostLabelCopiesCard() {
  const { data, isError, error, refetch, isFetching } =
    useUzPostLabelSettings();
  const [open, setOpen] = useState(false);

  if (isError) {
    // 403: this account cannot read the setting, so it has nothing to change.
    if ((error as { status?: number }).status === 403) return null;
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10"
      >
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
          Chek nusxasi sozlamasini yuklab bo'lmadi
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold text-amber-800 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 motion-reduce:transition-none dark:text-amber-300"
        >
          <RotateCcw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Qayta
        </button>
      </div>
    );
  }

  if (!data?.can_configure) return null;

  const unset = data.copies === null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 sm:flex dark:bg-orange-500/10">
        <Printer
          className="h-5 w-5 text-orange-500"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white">
          UzPost chek nusxasi
        </p>
        <p
          className={`text-[12px] font-semibold ${
            unset
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {unset ? "Tanlanmagan" : `${data.copies} ta nusxa`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:focus-visible:ring-offset-[#0a0a0a]"
      >
        {unset ? "Tanlash" : "O'zgartirish"}
      </button>
      <UzPostLabelCopiesDialog
        open={open}
        mode="change"
        currentCopies={data.copies}
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
