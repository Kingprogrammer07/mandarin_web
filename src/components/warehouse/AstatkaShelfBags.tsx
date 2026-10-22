import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, PackageCheck, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  undoAstatkaHandOut,
  type AstatkaShelfBag,
  type AstatkaShelfState,
} from "../../api/services/warehouse";
import { warehouseKeys } from "../../api/hooks/useWarehouse";
import { formatDateTime } from "../../lib/astatkaFormat";
import { formatWeightKg } from "../../lib/format";
import AstatkaHandoutModal from "./AstatkaHandoutModal";

const STATE: Record<AstatkaShelfState, { label: string; chip: string }> = {
  on_shelf: {
    label: "Javonda",
    chip: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  },
  left_behind: {
    label: "Javonda qolgan",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
  },
  taken: {
    label: "Javondan berilgan",
    chip: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:border-white/[0.08]",
  },
  handed_out: {
    label: "Ostatkadan berilgan",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  },
};

function Thumbs({
  urls,
  label,
  onOpen,
}: {
  urls: string[];
  label: string;
  onOpen: (url: string) => void;
}) {
  if (urls.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => onOpen(url)}
            aria-label={`${label}: ${index + 1}-rasm`}
            className="size-14 rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] hover:opacity-90 transition-opacity"
          >
            <img src={url} alt="" className="size-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

interface AstatkaShelfBagsProps {
  bags: AstatkaShelfBag[];
  clientCode: string;
  flightName: string;
  canMarkTaken: boolean;
  onOpenPhoto: (url: string) => void;
}

/**
 * The client's bags from this flight that an astatka confirmed: the photos
 * retaken on the shelf, and «Ostatkadan berish» for a bag left behind.
 */
export default function AstatkaShelfBags({
  bags,
  clientCode,
  flightName,
  canMarkTaken,
  onOpenPhoto,
}: AstatkaShelfBagsProps) {
  const queryClient = useQueryClient();
  const [handingOut, setHandingOut] = useState<AstatkaShelfBag | null>(null);
  const undo = useMutation({
    mutationFn: (bag: AstatkaShelfBag) => undoAstatkaHandOut(bag.package_id),
    onSuccess: (res) => {
      toast.success(res.message, { description: `${clientCode} · ${flightName}` });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.groupedTransactionSearch({}) });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Bekor qilishda xatolik");
    },
  });

  return (
    <div className="px-3 sm:px-4 py-3 space-y-2.5 border-b border-gray-100 dark:border-white/[0.05] bg-sky-50/30 dark:bg-sky-500/[0.03]">
      {bags.map((bag) => {
        const state = STATE[bag.state];
        const weight = bag.weight_kg ? formatWeightKg(bag.weight_kg) : null;
        return (
          <section
            key={bag.package_id}
            aria-label={`Ostatka ${bag.astatka_flight_name}`}
            className="rounded-xl border border-gray-200/70 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.02] p-3 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Package className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <span className="text-[13px] font-bold text-gray-900 dark:text-white break-words">
                  {bag.astatka_flight_name}
                </span>
                {weight && (
                  <span className="text-[12px] text-gray-500 dark:text-gray-400 tabular-nums">{weight} kg</span>
                )}
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${state.chip}`}>
                {state.label}
              </span>
            </div>

            {bag.state === "left_behind" && (
              <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300/90">
                To'lov yozuvi «berilgan», lekin yuk ostatka javonida qolgan. Mijozga «Ostatkadan berish» orqali bering.
              </p>
            )}

            <Thumbs urls={bag.photos} label="Ostatkada olingan rasmlar" onOpen={onOpenPhoto} />

            {bag.state === "handed_out" && (
              <div className="space-y-2">
                <p className="text-[12px] text-gray-600 dark:text-gray-300">
                  Berildi
                  {bag.handed_out_at && <> · {formatDateTime(bag.handed_out_at)}</>}
                  {bag.handed_out_by && <> · {bag.handed_out_by}</>}
                </p>
                {bag.handout_comment && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 break-words">“{bag.handout_comment}”</p>
                )}
                <Thumbs urls={bag.handout_photos} label="Berilganda olingan rasmlar" onOpen={onOpenPhoto} />
              </div>
            )}

            {canMarkTaken && (bag.state === "left_behind" || bag.state === "taken") && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setHandingOut(bag)}
                  className={
                    bag.state === "left_behind"
                      ? "flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors active:scale-95"
                      : "flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.1] dark:text-gray-300 dark:hover:bg-white/[0.04] transition-colors active:scale-95"
                  }
                >
                  <PackageCheck className="h-4 w-4" />
                  Ostatkadan berish
                </button>
              </div>
            )}

            {canMarkTaken && bag.state === "handed_out" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={undo.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `${clientCode} - ${flightName}: «Ostatkadan berish»ni bekor qilasizmi? Yuk yana javonda deb ko'rinadi.`,
                      )
                    ) {
                      undo.mutate(bag);
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-60 active:scale-95"
                >
                  {undo.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                  Bekor
                </button>
              </div>
            )}
          </section>
        );
      })}

      {handingOut && (
        <AstatkaHandoutModal
          bag={handingOut}
          clientCode={clientCode}
          flightName={flightName}
          onClose={() => setHandingOut(null)}
        />
      )}
    </div>
  );
}
