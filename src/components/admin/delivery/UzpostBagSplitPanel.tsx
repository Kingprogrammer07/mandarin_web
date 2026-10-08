import { useMemo } from "react";
import { AlertCircle, PackageCheck, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { rowWeightKg } from "@/lib/adminDeliveryFlights";

import type {
  DeliveryFlightState,
  DeliveryFlightRow,
} from "@/api/services/adminDeliveryService";

export const UZPOST_BAG_LIMIT_KG = 20;
const WEIGHT_TOLERANCE_KG = 0.01;

export interface UzpostBagDraft {
  transaction_id: number;
  sequence_no: number;
  weight_kg: number;
  flight_name: string;
  row_number: number | null;
  source_weight_kg: number;
}

interface BagGroup {
  key: number;
  transactionId: number;
  flightName: string;
  rowNumber: number | null;
  sourceWeightKg: number;
  bags: Array<{ bag: UzpostBagDraft; index: number }>;
}

interface UzpostBagSplitPanelProps {
  flights: DeliveryFlightState[];
  selectedFlightNames: string[];
  bags: UzpostBagDraft[];
  onChange: (bags: UzpostBagDraft[]) => void;
  disabled?: boolean;
}

function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function splitWeight(weightKg: number): number[] {
  const chunks: number[] = [];
  let remaining = roundKg(weightKg);
  while (remaining > UZPOST_BAG_LIMIT_KG + WEIGHT_TOLERANCE_KG) {
    chunks.push(UZPOST_BAG_LIMIT_KG);
    remaining = roundKg(remaining - UZPOST_BAG_LIMIT_KG);
  }
  if (remaining > 0) {
    chunks.push(roundKg(remaining));
  }
  return chunks;
}

function isSourceRow(row: DeliveryFlightRow): boolean {
  return row.is_weight_source !== false && (rowWeightKg(row) ?? 0) > 0;
}

function normalizeSequences(bags: UzpostBagDraft[]): UzpostBagDraft[] {
  return bags.map((bag, index) => ({ ...bag, sequence_no: index + 1 }));
}

export function buildUzpostBagDrafts(
  flights: DeliveryFlightState[],
  selectedFlightNames: string[],
): UzpostBagDraft[] {
  const selected = new Set(selectedFlightNames);
  const drafts: UzpostBagDraft[] = [];
  let sequenceNo = 1;

  for (const flight of flights) {
    if (!selected.has(flight.flight)) continue;
    for (const row of flight.rows.filter(isSourceRow)) {
      const sourceWeightKg = rowWeightKg(row);
      if (sourceWeightKg === null || sourceWeightKg <= 0) continue;
      for (const weightKg of splitWeight(sourceWeightKg)) {
        drafts.push({
          transaction_id: row.id,
          sequence_no: sequenceNo,
          weight_kg: weightKg,
          flight_name: flight.flight,
          row_number: row.qator_raqami ?? null,
          source_weight_kg: sourceWeightKg,
        });
        sequenceNo += 1;
      }
    }
  }

  return drafts;
}

export function validateUzpostBags(bags: UzpostBagDraft[]): string[] {
  const errors: string[] = [];
  if (bags.length === 0) {
    return ["Qoplar ro'yxati bo'sh. Reys vaznlarini tekshiring."];
  }

  const groups = new Map<number, { expected: number; total: number }>();
  for (const bag of bags) {
    if (!Number.isFinite(bag.weight_kg) || bag.weight_kg <= 0) {
      errors.push(`${bag.sequence_no}-qop vazni 0 dan katta bo'lishi kerak.`);
    }
    if (bag.weight_kg > UZPOST_BAG_LIMIT_KG) {
      errors.push(`${bag.sequence_no}-qop vazni 20 kgdan oshmasligi kerak.`);
    }
    const current = groups.get(bag.transaction_id) ?? {
      expected: bag.source_weight_kg,
      total: 0,
    };
    current.total = roundKg(current.total + bag.weight_kg);
    groups.set(bag.transaction_id, current);
  }

  for (const [transactionId, group] of groups) {
    if (Math.abs(group.total - group.expected) > WEIGHT_TOLERANCE_KG) {
      errors.push(
        `Tranzaksiya #${transactionId} qoplari yig'indisi ${group.expected.toFixed(
          2,
        )} kg bo'lishi kerak.`,
      );
    }
  }

  return [...new Set(errors)];
}

function groupBags(bags: UzpostBagDraft[]): BagGroup[] {
  const groups = new Map<number, BagGroup>();
  bags.forEach((bag, index) => {
    const group = groups.get(bag.transaction_id) ?? {
      key: bag.transaction_id,
      transactionId: bag.transaction_id,
      flightName: bag.flight_name,
      rowNumber: bag.row_number,
      sourceWeightKg: bag.source_weight_kg,
      bags: [],
    };
    group.bags.push({ bag, index });
    groups.set(bag.transaction_id, group);
  });
  return Array.from(groups.values());
}

export default function UzpostBagSplitPanel({
  flights,
  selectedFlightNames,
  bags,
  onChange,
  disabled = false,
}: UzpostBagSplitPanelProps) {
  const errors = useMemo(() => validateUzpostBags(bags), [bags]);
  const groups = useMemo(() => groupBags(bags), [bags]);

  const rebuild = () => {
    onChange(buildUzpostBagDrafts(flights, selectedFlightNames));
  };

  const updateWeight = (index: number, value: string) => {
    const parsed = Number(value.replace(",", "."));
    const nextWeight = Number.isFinite(parsed) ? parsed : 0;
    onChange(
      bags.map((bag, bagIndex) =>
        bagIndex === index ? { ...bag, weight_kg: nextWeight } : bag,
      ),
    );
  };

  const addBagAfter = (index: number) => {
    const source = bags[index];
    if (!source) return;
    const next = [...bags];
    next.splice(index + 1, 0, {
      ...source,
      weight_kg: 1,
      sequence_no: source.sequence_no + 1,
    });
    onChange(normalizeSequences(next));
  };

  const removeBag = (index: number) => {
    onChange(normalizeSequences(bags.filter((_, bagIndex) => bagIndex !== index)));
  };

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Qoplarga ajratish
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Har bir qop 20 kgdan oshmasin. Har qop uchun alohida UzPost order
                yaratiladi.
              </p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={rebuild}
          disabled={disabled}
          className="h-10 shrink-0 rounded-xl border-orange-200 bg-white text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:bg-white/5 dark:text-orange-300"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Avto bo'lish
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const total = group.bags.reduce(
            (sum, item) => sum + item.bag.weight_kg,
            0,
          );
          const groupInvalid =
            Math.abs(total - group.sourceWeightKg) > WEIGHT_TOLERANCE_KG;
          return (
            <div
              key={group.key}
              className="rounded-xl border border-white/70 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/15"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    {group.flightName}
                    {group.rowNumber !== null ? ` · qator ${group.rowNumber}` : ""}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Jami: {group.sourceWeightKg.toFixed(2)} kg · qoplar:{" "}
                    {roundKg(total).toFixed(2)} kg
                  </p>
                </div>
                {groupInvalid && (
                  <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    Yig'indi mos emas
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {group.bags.map(({ bag, index }) => {
                  const invalid =
                    bag.weight_kg <= 0 || bag.weight_kg > UZPOST_BAG_LIMIT_KG;
                  return (
                    <div
                      key={`${bag.transaction_id}-${bag.sequence_no}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm dark:bg-white/10 dark:text-gray-200">
                        {bag.sequence_no}
                      </span>
                      <label className="sr-only" htmlFor={`uzpost-bag-${index}`}>
                        Qop vazni
                      </label>
                      <input
                        id={`uzpost-bag-${index}`}
                        type="number"
                        min="0.01"
                        max={UZPOST_BAG_LIMIT_KG}
                        step="0.01"
                        value={Number.isFinite(bag.weight_kg) ? bag.weight_kg : 0}
                        onChange={(event) => updateWeight(index, event.target.value)}
                        disabled={disabled}
                        className={`h-9 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 dark:bg-black/20 dark:text-white ${
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
                        onClick={() => addBagAfter(index)}
                        disabled={disabled}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                        aria-label="Qop qo'shish"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBag(index)}
                        disabled={disabled || group.bags.length === 1}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 dark:border-white/10 dark:bg-white/5"
                        aria-label="Qopni o'chirish"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
