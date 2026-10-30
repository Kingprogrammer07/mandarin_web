import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBtsBranches, type BtsBranch } from "@/hooks/useBtsBranches";

// 398 offices; a search narrows it long before scrolling matters.
const MAX_ROWS = 60;

interface BtsBranchSelectProps {
  selected: BtsBranch | null;
  onChange: (branch: BtsBranch | null) => void;
}

/** BTS office for the parcel: the "Qayerga" line of the printed blank. */
export default function BtsBranchSelect({ selected, onChange }: BtsBranchSelectProps) {
  const [query, setQuery] = useState("");
  const { data: branches, isLoading, isError, refetch } = useBtsBranches();

  const filtered = useMemo(() => {
    const all = branches ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((b) =>
      `${b.index} ${b.name} ${b.region} ${b.address}`.toLowerCase().includes(q),
    );
  }, [branches, query]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-gray-400" aria-hidden="true" />
        BTS filiali
        <span className="text-red-500" aria-hidden="true">*</span>
      </Label>

      {selected && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-orange-200 dark:border-orange-500/25 bg-orange-50 dark:bg-orange-500/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              <span className="font-mono">{selected.index}</span> · {selected.name}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {selected.region}, {selected.address}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 shrink-0 px-2 text-xs font-semibold text-orange-700 dark:text-orange-400"
          >
            O'zgartirish
          </button>
        </div>
      )}

      {!selected && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Kod, nom, viloyat yoki manzil..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 rounded-xl pl-10"
              disabled={isLoading || isError}
              aria-label="BTS filialini qidirish"
            />
          </div>

          {isLoading && <p className="text-sm text-gray-500 py-2">Yuklanmoqda...</p>}
          {isError && (
            <button
              type="button"
              onClick={() => void refetch()}
              className="min-h-11 text-sm font-semibold text-red-600"
            >
              BTS filiallarini yuklab bo'lmadi — qayta urinish
            </button>
          )}

          {branches && (
            <div className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-1">
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">Filial topilmadi</p>
              )}
              {filtered.slice(0, MAX_ROWS).map((branch) => (
                <button
                  key={branch.index}
                  type="button"
                  onClick={() => {
                    onChange(branch);
                    setQuery("");
                  }}
                  className="w-full text-left rounded-lg px-3 py-2.5 mb-1 text-sm border border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    <span className="font-mono text-gray-500">{branch.index}</span> · {branch.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {branch.region}, {branch.address}
                  </p>
                </button>
              ))}
              {filtered.length > MAX_ROWS && (
                <p className="px-3 py-2 text-[11px] text-gray-500">
                  Yana {filtered.length - MAX_ROWS} ta — qidiruvni aniqlashtiring
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
