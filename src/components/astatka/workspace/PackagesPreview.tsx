import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Images,
  Loader2,
  PackageSearch,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  confirmAstatkaPackages,
  deleteAstatkaPackage,
  getAstatkaPackages,
  unconfirmAstatkaPackage,
  updateAstatkaPackage,
  type AstatkaIndexResponse,
  type AstatkaPackage,
  type AstatkaPackageSort,
  type AstatkaPackageStatus,
} from "@/api/services/astatkaFlights";
import { formatKg, formatScanTime, paymentLabel } from "@/lib/astatkaFormat";
import { filterPackages, totalsOf } from "@/lib/astatkaPackages";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";
import { askConfirm } from "@/utils/askConfirm";

import { BagDetailsDialog } from "./BagDetailsDialog";
import { BagEditDialog, type BagEditValues } from "./BagEditDialog";
import { WorkspaceDialog } from "./WorkspaceDialog";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const SORTS: { key: AstatkaPackageSort; label: string }[] = [
  { key: "recent", label: "Oxirgi o'zgarganlar" },
  { key: "client_asc", label: "Mijoz kodi A→Z" },
  { key: "client_desc", label: "Mijoz kodi Z→A" },
  { key: "weight_desc", label: "Eng og'irlari" },
  { key: "flight_asc", label: "Reys bo'yicha" },
];

type StatusFilter = "all" | AstatkaPackageStatus;

interface Props {
  flightName: string;
  editMode: boolean;
  /** False when the network is down or the worker switched to offline work. */
  isOnline: boolean;
  /** The work mode's copy of this flight's packages, shown while offline. */
  offlineIndex: AstatkaIndexResponse | null;
}

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** A native select (16px, so iOS does not zoom) with the arrow the base reset removed. */
function SelectBox({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-11 w-full min-w-0 rounded-mc-sm border border-mc-border bg-mc-surface pl-3 pr-9 text-[16px] font-semibold text-mc-text"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3" />
    </div>
  );
}

function StatusBadge({ status }: { status: AstatkaPackageStatus | null }) {
  const confirmed = status === "confirmed";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        confirmed ? "bg-mc-success/12 text-mc-success" : "bg-mc-warn-soft text-mc-warn",
      )}
    >
      {confirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {confirmed ? "Tasdiqlangan" : "Kutilmoqda"}
    </span>
  );
}

/**
 * What is already saved in this astatka: the bags "Astatka ajratish" found
 * and the ones confirmed on the shelf. A table on a wide screen, cards on a
 * phone. Tapping a bag shows every track code and what can be done with it.
 */
/**
 * The saved list: every bag of this astatka flight, expected or confirmed,
 * with search, filters and — in edit mode — fixes. Offline it falls back to
 * the copy the work mode keeps on the device, read-only.
 */
export function PackagesPreview({ flightName, editMode, isOnline, offlineIndex }: Props) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<string>("__all__");
  const [sort, setSort] = useState<AstatkaPackageSort>("recent");
  const [opened, setOpened] = useState<AstatkaPackage | null>(null);
  const [editing, setEditing] = useState<AstatkaPackage | null>(null);
  const [photosFor, setPhotosFor] = useState<AstatkaPackage | null>(null);

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      source_flight: source === "__all__" ? undefined : source,
      q: search || undefined,
      sort,
    }),
    [status, source, search, sort],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // How much of the offline copy is shown; a new filter starts from one page.
  const paramsKey = JSON.stringify(params);
  const [offlinePaging, setOfflinePaging] = useState({ key: paramsKey, limit: PAGE_SIZE });
  const offlineLimit = offlinePaging.key === paramsKey ? offlinePaging.limit : PAGE_SIZE;

  const query = useInfiniteQuery({
    queryKey: [...astatkaPackagesQueryKey(flightName), params],
    queryFn: ({ pageParam }) =>
      getAstatkaPackages(flightName, { ...params, page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    staleTime: 15_000,
    // The worker's "work offline" switch exists for a connection that is up
    // but hangs; asking the server anyway would hang this list the same way.
    enabled: isOnline,
  });

  // Offline, or the server failed while a device copy exists: show the copy.
  // It is a snapshot, so nothing in it can be changed until the line is back.
  const offline = !isOnline || (query.isError && offlineIndex !== null);
  const offlineAll = useMemo(
    () =>
      offline && offlineIndex
        ? filterPackages(offlineIndex.packages, {
            status: params.status,
            sourceFlight: params.source_flight,
            search: params.q,
            sort: params.sort,
          })
        : [],
    [offline, offlineIndex, params],
  );
  const offlineTotals = useMemo(
    () => (offline && offlineIndex ? totalsOf(offlineIndex.packages) : null),
    [offline, offlineIndex],
  );

  const first = query.data?.pages[0];
  const onlineItems = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const items = offline ? offlineAll.slice(0, offlineLimit) : onlineItems;
  const remaining = offline ? offlineAll.length - items.length : first ? first.total - items.length : 0;
  const counts = offlineTotals?.counts ?? first?.counts;
  const weights = offlineTotals?.weights ?? first?.weights;
  const sourceFlights = offlineTotals?.sourceFlights ?? first?.source_flights ?? [];
  const canChange = !offline;
  const listReady = offline ? offlineIndex !== null : query.isSuccess;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: astatkaPackagesQueryKey(flightName) });
    void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
  };

  const unconfirm = useMutation({
    mutationFn: (pkg: AstatkaPackage) => unconfirmAstatkaPackage(flightName, pkg.id ?? 0),
    onSuccess: (result) => {
      toast.success(result.message);
      result.warnings.forEach((warning) => toast.warning(warning));
      setOpened(null);
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Bekor qilib bo'lmadi.")),
  });

  const remove = useMutation({
    mutationFn: (pkg: AstatkaPackage) => deleteAstatkaPackage(flightName, pkg.id ?? 0),
    onSuccess: () => {
      toast.success("Ro'yxatdan o'chirildi");
      setOpened(null);
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "O'chirib bo'lmadi.")),
  });

  const confirm = useMutation({
    mutationFn: (pkg: AstatkaPackage) =>
      confirmAstatkaPackages(flightName, [
        {
          idempotency_key: newKey(),
          client_code: pkg.client_code,
          source_flight_name: pkg.source_flight_name,
          track_codes: pkg.track_codes,
          scanned_at: new Date().toISOString(),
        },
      ]),
    onSuccess: ([result]) => {
      if (result && (result.outcome === "conflict" || result.outcome === "error")) {
        toast.error(result.message);
        return;
      }
      toast.success("Tasdiqlandi");
      result?.warnings.forEach((warning) => toast.warning(warning));
      setOpened(null);
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Tasdiqlab bo'lmadi.")),
  });

  const update = useMutation({
    mutationFn: ({ pkg, values }: { pkg: AstatkaPackage; values: BagEditValues }) =>
      updateAstatkaPackage(flightName, pkg.id ?? 0, {
        weight_kg: values.weightKg,
        comment: values.comment || null,
        track_codes: values.trackCodes,
        ...(pkg.status === "confirmed" ? {} : { client_code: values.clientCode }),
      }),
    onSuccess: () => {
      toast.success("Saqlandi");
      setEditing(null);
      setOpened(null);
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Saqlab bo'lmadi.")),
  });

  const askUnconfirm = async (pkg: AstatkaPackage) => {
    if (
      await askConfirm(
        `${pkg.client_code} yukining tasdig'i bekor qilinsinmi? Yuk ${pkg.source_flight_name || "o'z"} reysiga qaytadi.`,
      )
    ) {
      unconfirm.mutate(pkg);
    }
  };

  const askDelete = async (pkg: AstatkaPackage) => {
    if (await askConfirm(`${pkg.client_code} ro'yxatdan o'chirilsinmi?`)) remove.mutate(pkg);
  };

  const rowActions = (pkg: AstatkaPackage) =>
    editMode && canChange && (
      <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => setEditing(pkg)}
          aria-label="Tahrirlash"
          title="Tahrirlash"
          className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 active:scale-95"
        >
          <Pencil className="h-4 w-4" />
        </button>
        {pkg.status === "confirmed" ? (
          <button
            type="button"
            onClick={() => void askUnconfirm(pkg)}
            aria-label="Tasdiqni bekor qilish"
            title="Tasdiqni bekor qilish"
            className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-warn active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void askDelete(pkg)}
            aria-label="O'chirish"
            title="O'chirish"
            className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-danger active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 @container">
      {/* ── Totals ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-mc-md border border-mc-border bg-mc-surface p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">Tasdiqlangan</p>
          <p className="text-[17px] font-extrabold tabular-nums text-mc-success">
            {counts?.confirmed ?? 0} ta
          </p>
          <p className="break-words text-[12px] font-semibold tabular-nums text-mc-text-2">
            {formatKg(weights?.confirmed ?? 0)}
          </p>
        </div>
        <div className="rounded-mc-md border border-mc-border bg-mc-surface p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">Kutilmoqda</p>
          <p className="text-[17px] font-extrabold tabular-nums text-mc-warn">
            {counts?.expected ?? 0} ta
          </p>
          <p className="break-words text-[12px] font-semibold tabular-nums text-mc-text-2">
            {formatKg(weights?.expected ?? 0)}
          </p>
        </div>
      </div>

      {offline && (
        <div className="flex items-start gap-2 rounded-mc-sm border border-mc-warn/40 bg-mc-warn-soft px-3 py-2 text-[12px] font-semibold text-mc-warn">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            {offlineIndex
              ? `Internet yo'q. ${formatScanTime(offlineIndex.synced_at)} dagi nusxa ko'rsatilmoqda. O'zgartirish uchun internet kerak.`
              : "Internet yo'q va bu qurilmada ro'yxat nusxasi yo'q. Internet bo'lganda ish rejimida «Ro'yxatni yangilash» ni bosing."}
          </span>
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3" />
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Mijoz kodi yoki trek kod"
          aria-label="Saqlanganlardan qidirish"
          enterKeyHint="search"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface pl-9 pr-11 text-[16px] font-semibold text-mc-text placeholder:font-medium placeholder:text-mc-text-3"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            aria-label="Qidiruvni tozalash"
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-mc-text-3 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", "Hammasi", counts?.all],
            ["expected", "Kutilmoqda", counts?.expected],
            ["confirmed", "Tasdiqlangan", counts?.confirmed],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            aria-pressed={status === key}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[12px] font-bold active:scale-[0.97]",
              status === key
                ? "border-mc-brand bg-mc-brand text-mc-on-brand"
                : "border-mc-border bg-mc-surface text-mc-text-2",
            )}
          >
            {label}
            <span className="tabular-nums">{count ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
        <SelectBox label="Qaysi reysdan" value={source} onChange={setSource}>
          <option value="__all__">Barcha reyslardan</option>
          {sourceFlights.map((name) => (
            <option key={name || "unknown"} value={name}>
              {name || "Reysi noma'lum"}
            </option>
          ))}
        </SelectBox>
        <SelectBox
          label="Tartib"
          value={sort}
          onChange={(value) => setSort(value as AstatkaPackageSort)}
        >
          {SORTS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectBox>
      </div>

      {editMode && canChange && (
        <p className="rounded-mc-sm border border-mc-brand/40 bg-mc-brand-soft px-3 py-2 text-[12px] font-semibold text-mc-brand">
          Tahrirlash rejimi: har bir qator yonida tahrirlash, bekor qilish va o'chirish tugmalari.
        </p>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {!offline && query.isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-[68px] animate-pulse rounded-mc-md bg-mc-surface-2" />
          ))}
        </div>
      )}
      {!offline && query.isError && (
        <div className="rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
          <p className="text-[13px] font-semibold text-mc-danger">
            {apiErrorMessage(query.error, "Ro'yxatni olib bo'lmadi.")}
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface text-[13px] font-bold text-mc-text"
          >
            Qayta urinish
          </button>
        </div>
      )}
      {listReady && items.length === 0 && (
        <div className="rounded-mc-lg border border-dashed border-mc-border bg-mc-surface px-4 py-8 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-mc-text-3" />
          <p className="mt-2 text-[14px] font-bold text-mc-text-2">
            {search ? "Hech narsa topilmadi" : "Hali saqlangan yuk yo'q"}
          </p>
          {!search && (
            <p className="mx-auto mt-1 max-w-[320px] text-[12px] font-medium text-mc-text-3">
              «Astatka ajratish» tugmasi bilan eski reyslardan olib ketilmagan yuklarni qo'shing
              yoki ish rejimida skanerlab tasdiqlang.
            </p>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface">
          <div className="hidden border-b border-mc-border bg-mc-surface-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3 @2xl:grid @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_minmax(0,0.9fr)_7.5rem_minmax(0,0.9fr)_auto] @2xl:gap-3">
            <span>Mijoz</span>
            <span>Reys</span>
            <span>Trek</span>
            <span>Og'irlik</span>
            <span>Holati</span>
            <span>Vaqt</span>
            <span className={editMode ? "w-[92px]" : "w-0"} />
          </div>
          <ul className="divide-y divide-mc-border">
            {items.map((pkg) => (
              <li key={pkg.id ?? `${pkg.client_code}-${pkg.source_flight_name}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpened(pkg)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpened(pkg);
                    }
                  }}
                  className="cursor-pointer px-3 py-2.5 outline-none focus-visible:bg-mc-surface-2 active:bg-mc-surface-2"
                >
                  {/* Wide */}
                  <div className="hidden items-center gap-3 @2xl:grid @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_minmax(0,0.9fr)_7.5rem_minmax(0,0.9fr)_auto]">
                    <div className="min-w-0">
                      <p className="break-all text-[14px] font-extrabold text-mc-text">{pkg.client_code}</p>
                      {pkg.client_name && (
                        <p className="truncate text-[11px] font-medium text-mc-text-3">{pkg.client_name}</p>
                      )}
                    </div>
                    <p className="break-words text-[13px] font-bold text-mc-text">
                      {pkg.source_flight_name || "—"}
                    </p>
                    <p className="text-[13px] font-bold tabular-nums text-mc-text">{pkg.track_count} ta</p>
                    <p className="break-words text-[13px] font-bold tabular-nums text-mc-text">
                      {formatKg(pkg.weight_kg)}
                    </p>
                    <StatusBadge status={pkg.status} />
                    <p className="text-[12px] font-medium tabular-nums text-mc-text-3">
                      {formatScanTime(pkg.confirmed_at ?? pkg.scanned_at ?? pkg.created_at)}
                    </p>
                    <div className={editMode ? "w-[92px]" : "w-0"}>{rowActions(pkg)}</div>
                  </div>
                  {/* Narrow */}
                  <div className="flex items-center gap-2 @2xl:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-all text-[15px] font-extrabold text-mc-text">
                          {pkg.client_code}
                        </p>
                        <StatusBadge status={pkg.status} />
                      </div>
                      <p className="mt-0.5 break-words text-[12px] font-semibold text-mc-text-2">
                        {pkg.source_flight_name || "Reys noma'lum"} · {pkg.track_count} ta trek ·{" "}
                        {formatKg(pkg.weight_kg)}
                      </p>
                      <p className="text-[11px] font-medium tabular-nums text-mc-text-3">
                        {formatScanTime(pkg.confirmed_at ?? pkg.scanned_at ?? pkg.created_at)}
                        {pkg.confirmed_by ? ` · ${pkg.confirmed_by}` : ""}
                      </p>
                    </div>
                    {rowActions(pkg)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {offline && remaining > 0 && (
        <button
          type="button"
          onClick={() => setOfflinePaging({ key: paramsKey, limit: offlineLimit + PAGE_SIZE })}
          className="flex h-11 items-center justify-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface text-[13px] font-bold text-mc-text active:scale-[0.98]"
        >
          Yana ko'rsatish ({remaining} ta qoldi)
        </button>
      )}
      {!offline && query.hasNextPage && (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="flex h-11 items-center justify-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface text-[13px] font-bold text-mc-text active:scale-[0.98] disabled:opacity-60"
        >
          {query.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
          Yana ko'rsatish ({remaining} ta qoldi)
        </button>
      )}

      {opened && (
        <WorkspaceDialog
          open
          onOpenChange={(open) => !open && setOpened(null)}
          title={opened.client_code}
          description={opened.client_name ?? undefined}
          footer={
            !canChange ? (
              <p className="text-center text-[12px] font-semibold text-mc-text-3">
                Internet yo'q — o'zgartirish uchun internet kerak.
              </p>
            ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {opened.status !== "confirmed" && (
                <button
                  type="button"
                  onClick={() => confirm.mutate(opened)}
                  disabled={confirm.isPending}
                  className="flex h-12 items-center justify-center gap-2 rounded-mc-md bg-mc-brand text-[14px] font-extrabold text-mc-on-brand active:scale-[0.98] disabled:opacity-60 sm:col-span-2"
                >
                  {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Yuk shu yerda — tasdiqlash
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(opened)}
                className="flex h-12 items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface text-[14px] font-bold text-mc-text active:scale-[0.98]"
              >
                <Pencil className="h-4 w-4" />
                Tahrirlash
              </button>
              {opened.status === "confirmed" ? (
                <button
                  type="button"
                  onClick={() => void askUnconfirm(opened)}
                  disabled={unconfirm.isPending}
                  className="flex h-12 items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface text-[14px] font-bold text-mc-warn active:scale-[0.98] disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Tasdiqni bekor qilish
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void askDelete(opened)}
                  disabled={remove.isPending}
                  className="flex h-12 items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface text-[14px] font-bold text-mc-danger active:scale-[0.98] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Ro'yxatdan o'chirish
                </button>
              )}
            </div>
            )
          }
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {(
              [
                ["Holati", <StatusBadge key="s" status={opened.status} />],
                ["Qaysi reysdan", opened.source_flight_name || "Noma'lum"],
                ["Og'irligi", `${formatKg(opened.weight_kg)}${opened.weight_edited ? " (qo'lda)" : ""}`],
                ["Foto hisobot", opened.has_photo ? `Bor · ${opened.bags} ta` : "Yo'q"],
                ["To'lov", paymentLabel(opened.payment_state) ?? "Yozuv yo'q"],
                ["Olib ketilganmi", opened.taken_away ? "Ha — tekshiring!" : "Yo'q"],
                ["Tasdiqlagan", opened.confirmed_by ?? "—"],
                ["Vaqti", formatScanTime(opened.confirmed_at ?? opened.created_at)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">{label}</dt>
                <dd className="break-words text-[13px] font-bold text-mc-text">{value}</dd>
              </div>
            ))}
          </dl>
          {opened.comment && (
            <p className="mt-3 rounded-mc-sm bg-mc-surface-2 px-3 py-2 text-[13px] font-medium text-mc-text-2">
              {opened.comment}
            </p>
          )}
          {opened.id !== null && (
            <button
              type="button"
              onClick={() => {
                setPhotosFor(opened);
                setOpened(null);
              }}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface-2 text-[13px] font-bold text-mc-text active:scale-[0.98]"
            >
              <Images className="h-4 w-4" />
              Rasmlar va foto hisobot ma'lumotlari
            </button>
          )}
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
            Trek kodlar · {opened.track_count} ta
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {opened.track_codes.map((code) => (
              <li
                key={code}
                className="break-all rounded-mc-sm bg-mc-surface-2 px-2 py-1 font-mono text-[12px] font-bold text-mc-text"
              >
                {code}
              </li>
            ))}
          </ul>
        </WorkspaceDialog>
      )}

      {photosFor?.id != null && (
        <BagDetailsDialog
          flightName={flightName}
          bag={{ packageId: photosFor.id }}
          title={photosFor.client_code}
          isOnline={isOnline}
          onClose={() => setPhotosFor(null)}
        />
      )}

      {editing && (
        <BagEditDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={`Tahrirlash · ${editing.client_code}`}
          saving={update.isPending}
          locked={
            editing.status === "confirmed"
              ? { clientCode: true, sourceFlight: true, removeCodes: true }
              : { sourceFlight: true }
          }
          initial={{
            clientCode: editing.client_code,
            sourceFlight: editing.source_flight_name,
            weightKg: editing.weight_kg,
            comment: editing.comment ?? "",
            trackCodes: editing.track_codes,
          }}
          onSave={(values) => update.mutate({ pkg: editing, values })}
        />
      )}
    </div>
  );
}
