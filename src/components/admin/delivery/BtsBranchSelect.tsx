import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Sparkles } from "lucide-react";
import { getBtsBranchSuggestions } from "@/api/services/adminDeliveryService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBtsBranches, type BtsBranch } from "@/hooks/useBtsBranches";

// 398 offices; a search narrows it long before scrolling matters.
const MAX_ROWS = 60;
/** Tashkent city alone has 88 offices; a region-wide list is cut to a shortcut. */
const MAX_SUGGESTED = 8;

interface BtsBranchSelectProps {
  selected: BtsBranch | null;
  onChange: (branch: BtsBranch | null) => void;
  /** Suggests the offices of the district the client's code was issued for. */
  clientCode?: string | null;
}

/** BTS office for the parcel: the "Qayerga" line of the printed blank. */
export default function BtsBranchSelect({
  selected,
  onChange,
  clientCode = null,
}: BtsBranchSelectProps) {
  const [query, setQuery] = useState("");
  const { data: branches, isLoading, isError, refetch } = useBtsBranches();

  // Same idea as the UzPost picker: the code names the district, so its
  // offices lead. A shortcut above the catalogue, never a filter.
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["admin-bts-branch-suggestions", clientCode],
    queryFn: () => getBtsBranchSuggestions(clientCode as string),
    enabled: Boolean(clientCode),
    staleTime: 5 * 60_000,
  });
  const suggested = useMemo(() => {
    if (!branches || !suggestions?.codes.length || query.trim()) return [];
    const byCode = new Map(branches.map((branch) => [branch.index, branch]));
    return suggestions.codes
      .map((code) => byCode.get(code))
      .filter((branch): branch is BtsBranch => Boolean(branch));
  }, [branches, suggestions, query]);

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

          {suggestionsLoading && clientCode && !query.trim() && (
            <p className="py-1.5 text-[12px] text-gray-400">Mijoz kodiga mos filiallar qidirilmoqda…</p>
          )}

          {suggested.length > 0 && suggestions && (
            <div className="space-y-1 rounded-xl border border-orange-200 bg-orange-50/60 p-2 dark:border-orange-500/25 dark:bg-orange-500/[0.07]">
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {suggestions.match_level === "district"
                  ? `Mijoz kodiga ko'ra — ${suggestions.district}`
                  : suggestions.district
                    ? `${suggestions.district} da filial yo'q — viloyat bo'yicha`
                    : "Mijoz kodiga ko'ra — viloyat filiallari"}
              </p>
              {suggestions.match_level === "region" && (
                <p className="px-1 text-[10px] text-orange-700/70 dark:text-orange-400/70">
                  Kodda tuman ko'rsatilmagan — tekshirib tanlang.
                </p>
              )}
              {suggested.slice(0, MAX_SUGGESTED).map((branch) => (
                <button
                  key={`suggested-${branch.index}`}
                  type="button"
                  onClick={() => onChange(branch)}
                  className="w-full rounded-lg border border-transparent bg-white/70 px-3 py-2 text-left text-sm transition-colors hover:border-orange-300 dark:bg-white/[0.04]"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    <span className="font-mono text-gray-500">{branch.index}</span> · {branch.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {branch.address}
                  </p>
                </button>
              ))}
              {suggested.length > MAX_SUGGESTED && (
                <p className="px-1 pt-0.5 text-[11px] text-orange-700/80 dark:text-orange-400/80">
                  Yana {suggested.length - MAX_SUGGESTED} ta — qidiruvda tuman yoki nomini yozing
                </p>
              )}
            </div>
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
