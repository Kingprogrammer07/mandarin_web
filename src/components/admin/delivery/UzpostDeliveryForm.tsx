import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Phone, Search, MapPin, Check, PackageCheck, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBranchSuggestions,
  getClientDeliveryContext,
} from "@/api/services/adminDeliveryService";
import { useUzpostBranches } from "@/hooks/useUzpostBranches";
import type { UzpostBranch } from "@/types/uzpostBranch";

interface UzpostDeliveryFormProps {
  phone: string;
  onPhoneChange: (v: string) => void;
  selectedBranch: UzpostBranch | null;
  onBranchChange: (branch: UzpostBranch | null) => void;
  /** Whose request this is. Used only to look up whether this filer's
   *  submission will also release the cargo — see the notice below. */
  clientCode: string | null;
}

export default function UzpostDeliveryForm({
  phone,
  onPhoneChange,
  selectedBranch,
  onBranchChange,
  clientCode,
}: UzpostDeliveryFormProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: branches, isLoading, isError } = useUzpostBranches();

  // Same key as ClientDeliveryHistory, so this reads the cached context rather
  // than issuing a second request for the same client.
  const { data: deliveryContext } = useQuery({
    queryKey: ["admin-delivery-context", clientCode],
    queryFn: () => getClientDeliveryContext(clientCode as string),
    enabled: Boolean(clientCode),
    staleTime: 30_000,
  });

  // Branches near the district the client's code was issued for. STCH3 is
  // Chilonzor, so the picker can lead with the few offices there instead of
  // 231 in catalogue order.
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["admin-branch-suggestions", clientCode],
    queryFn: () => getBranchSuggestions(clientCode as string),
    enabled: Boolean(clientCode),
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    if (!branches || !query.trim()) return branches ?? [];
    const q = query.trim().toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        String(b.index).includes(q),
    );
  }, [branches, query]);

  /**
   * The suggested ids, resolved against the real catalogue.
   *
   * Resolved rather than rendered from the API payload directly so a suggested
   * row is the same object as the one in the list below — selecting it stores
   * the identical branch, whichever place the manager clicks.
   *
   * Hidden while searching: the manager has started typing a specific branch,
   * and a "recommended" block above their own results only gets in the way.
   */
  const suggestedBranches = useMemo(() => {
    if (!branches || !suggestions?.branches.length || query.trim()) return [];
    const ids = new Set(suggestions.branches.map((b) => b.id));
    return branches.filter((b) => ids.has(b.id));
  }, [branches, suggestions, query]);

  // UzPost has hundreds of branches — virtualize so only on-screen rows mount.
  const listRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 76,
    overscan: 6,
  });

  return (
    <div className="space-y-5">
      {/* Stated before the button, not after it.
          For a filer holding delivery_requests:override_state this form does
          more than file a request: it creates the UzPost order, prints the
          label, and marks the cargo collected with no proof photo. That is not
          something to discover from a toast once it has already happened. */}
      {deliveryContext?.may_override && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <PackageCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed text-blue-900 dark:text-blue-200">
            <p className="font-semibold">
              Yuborilgach yuk avtomatik ombordan chiqariladi.
            </p>
            <p className="mt-0.5 text-blue-800/80 dark:text-blue-300/80">
              UzPost buyurtmasi yaratiladi, chek printerdan chiqadi va yuk
              &ldquo;olib ketilgan&rdquo; deb belgilanadi — rasm so&apos;ralmaydi.
              Buyurtma yaratilmasa, yuk ombordan chiqarilmaydi.
            </p>
          </div>
        </div>
      )}

      {/* Phone */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          {t("adminDeliveryRequest.uzpostForm.phoneLabel", "Qabul qiluvchi telefon")}
        </Label>
        <Input
          type="tel"
          placeholder="+998901234567"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="h-12 rounded-xl"
        />
      </div>

      {/* Branch search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          {t("adminDeliveryRequest.uzpostForm.branchLabel", "UzPost filialini tanlash")}
        </Label>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t(
              "adminDeliveryRequest.uzpostForm.branchSearchPlaceholder",
              "Filial nomi, manzil yoki indeks...",
            )}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-xl pl-10"
            disabled={isLoading || isError}
          />
        </div>

        {isLoading && (
          <p className="text-sm text-gray-500 py-2">{t("common.loading", "Yuklanmoqda...")}</p>
        )}
        {isError && (
          <p className="text-sm text-red-500 py-2">{t("common.error", "Xatolik yuz berdi")}</p>
        )}

        {/* Suggestions, above the catalogue and never instead of it.
            The code says where the client registered, not where they will
            collect — plenty of people take a parcel near their office. So this
            is a shortcut for the common case, and the full list stays open
            underneath. */}
        {suggestionsLoading && clientCode && !query.trim() && (
          <p className="text-[12px] text-gray-400 py-1.5">
            Mijoz kodiga mos filiallar qidirilmoqda…
          </p>
        )}

        {suggestedBranches.length > 0 && suggestions && (
          <div className="rounded-xl border border-orange-200 dark:border-orange-500/25 bg-orange-50/60 dark:bg-orange-500/[0.07] p-2 space-y-1">
            <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              <Sparkles className="w-3.5 h-3.5" />
              {suggestions.match_level === "district"
                ? `Mijoz kodiga ko'ra — ${suggestions.district}`
                : suggestions.district
                  ? `${suggestions.district} da filial yo'q — viloyat bo'yicha`
                  : "Mijoz kodiga ko'ra — viloyat filiallari"}
            </p>
            {suggestions.match_level === "region" && (
              // Said plainly: a region-wide list is a weaker answer than a
              // district one and must not read as precise. Most clients land
              // here — a bare regional code like SS1234 names no district —
              // so the wording has to be honest without sounding broken.
              <p className="px-1 text-[10px] text-orange-700/70 dark:text-orange-400/70">
                Kodda tuman ko'rsatilmagan — tekshirib tanlang.
              </p>
            )}
            {suggestedBranches.map((branch) => {
              const isSelected = selectedBranch?.id === branch.id;
              return (
                <button
                  key={`suggested-${branch.id}`}
                  type="button"
                  onClick={() => onBranchChange(isSelected ? null : branch)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors border ${
                    isSelected
                      ? "bg-orange-100 dark:bg-orange-500/15 border-orange-300 dark:border-orange-500/40"
                      : "bg-white/70 dark:bg-white/[0.04] border-transparent hover:border-orange-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {branch.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {branch.address}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        Indeks: {branch.index}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            <p className="px-1 pt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              Barcha filiallar pastda —{" "}
              {branches ? branches.length : 0} ta
            </p>
          </div>
        )}

        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-1"
        >
          {filtered.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 py-4 text-center">
              {t("adminDeliveryRequest.uzpostForm.noBranches", "Filial topilmadi")}
            </p>
          )}
          {filtered.length > 0 && (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
                width: "100%",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const branch = filtered[virtualRow.index];
                const isSelected = selectedBranch?.id === branch.id;
                return (
                  <div
                    key={branch.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <button
                      onClick={() => onBranchChange(isSelected ? null : branch)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 text-sm transition-colors ${
                        isSelected
                          ? "bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20"
                          : "hover:bg-gray-50 dark:hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{branch.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {branch.address}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 font-mono">
                            Indeks: {branch.index}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
