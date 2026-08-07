import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Phone, Search, MapPin, Check, PackageCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClientDeliveryContext } from "@/api/services/adminDeliveryService";
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
