import { useMemo } from "react";
import { AlertCircle, PackageCheck, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  bagsTotalKg,
  roundKg,
  splitUzpostParcel,
  UZPOST_BAG_LIMIT_KG,
  validateUzpostBags,
  type UzpostBagDraft,
} from "@/lib/uzpostBagSplit";

interface UzpostBagSplitPanelProps {
  /** The parcel's weight: what the bags must add up to. */
  parcelKg: number;
  bags: UzpostBagDraft[];
  onChange: (bags: UzpostBagDraft[]) => void;
  disabled?: boolean;
}

function renumber(bags: UzpostBagDraft[]): UzpostBagDraft[] {
  return bags.map((bag, index) => ({ ...bag, sequence_no: index + 1 }));
}

export default function UzpostBagSplitPanel({
  parcelKg,
  bags,
  onChange,
  disabled = false,
}: UzpostBagSplitPanelProps) {
  const errors = useMemo(() => validateUzpostBags(bags, parcelKg), [bags, parcelKg]);
  const totalKg = bagsTotalKg(bags);
  const remainingKg = roundKg(parcelKg - totalKg);
  // Fewer bags than this cannot carry the parcel without one going over the limit.
  const minBagCount = Math.ceil(parcelKg / UZPOST_BAG_LIMIT_KG - 1e-9);

  const updateWeight = (index: number, value: string) => {
    const text = value.trim().replace(",", ".");
    const parsed = text === "" ? Number.NaN : Number(text);
    onChange(
      bags.map((bag, bagIndex) =>
        bagIndex === index ? { ...bag, weight_kg: parsed } : bag,
      ),
    );
  };

  // A new bag takes whatever is not yet bagged, so adding one never breaks a
  // sum that was right; with nothing left it starts empty for the manager to fill.
  const addBag = () => {
    onChange(
      renumber([
        ...bags,
        { sequence_no: bags.length + 1, weight_kg: Math.max(remainingKg, 0) },
      ]),
    );
  };

  const removeBag = (index: number) => {
    onChange(renumber(bags.filter((_, bagIndex) => bagIndex !== index)));
  };

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Qoplarga ajratish
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Yuk {parcelKg.toFixed(2)} kg — {UZPOST_BAG_LIMIT_KG} kgdan og'ir. Har bir qop uchun
              alohida UzPost order va chek chiqadi.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(splitUzpostParcel(parcelKg))}
          disabled={disabled}
          className="h-11 shrink-0 rounded-xl border-orange-200 bg-white text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:bg-white/5 dark:text-orange-300"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Avto bo'lish
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {bags.map((bag, index) => {
          const invalid =
            !Number.isFinite(bag.weight_kg) ||
            bag.weight_kg <= 0 ||
            bag.weight_kg > UZPOST_BAG_LIMIT_KG;
          return (
            <div
              key={bag.sequence_no}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-black/15"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                {bag.sequence_no}
              </span>
              <label className="sr-only" htmlFor={`uzpost-bag-${index}`}>
                Qop vazni
              </label>
              <input
                id={`uzpost-bag-${index}`}
                type="number"
                inputMode="decimal"
                min="0.01"
                max={UZPOST_BAG_LIMIT_KG}
                step="0.01"
                value={Number.isFinite(bag.weight_kg) ? bag.weight_kg : ""}
                onChange={(event) => updateWeight(index, event.target.value)}
                disabled={disabled}
                aria-invalid={invalid}
                className={`h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-base font-semibold text-gray-900 outline-none focus:ring-2 dark:bg-black/20 dark:text-white ${
                  invalid
                    ? "border-red-300 focus:ring-red-200 dark:border-red-500/60"
                    : "border-gray-200 focus:ring-orange-200 dark:border-white/10"
                }`}
              />
              <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
                kg
              </span>
              <button
                type="button"
                onClick={() => removeBag(index)}
                disabled={disabled || bags.length <= minBagCount}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 dark:border-white/10 dark:bg-white/5"
                aria-label="Qopni o'chirish"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {bags.length} ta qop · {totalKg.toFixed(2)} / {parcelKg.toFixed(2)} kg
          {Math.abs(remainingKg) > 0.005 && (
            <span className="font-semibold text-red-600 dark:text-red-300">
              {" "}
              · {remainingKg > 0 ? "qoldi" : "ortiqcha"}{" "}
              {Math.abs(remainingKg).toFixed(2)} kg
            </span>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={addBag}
          disabled={disabled}
          className="h-11 rounded-xl border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Qop qo'shish
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Qoplarni tekshiring
          </div>
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
