import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, PackageSearch, Search, WifiOff, X } from "lucide-react";

import {
  astatkaPackagesQueryKey,
  getAstatkaPackages,
  type AstatkaIndexResponse,
  type AstatkaPackage,
  type AstatkaPackageSort,
  type AstatkaPackageStatus,
} from "@/api/services/astatkaFlights";
import { formatKg, formatScanTime } from "@/lib/astatkaFormat";
import { filterPackages, totalsOf } from "@/lib/astatkaPackages";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";

import type { BagSheetMode } from "./BagSheet";
import { SavedBagHeader, SavedBagRow } from "./SavedBagRow";
import { SavedBagSheet } from "./SavedBagSheet";
import { useSavedBagActions } from "./useSavedBagActions";

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

/** The bag window's state: which saved bag, and whether it is being edited. */
interface OpenBag {
  /** The newest copy known: the list's, or a local one not refetched yet. */
  pkg: AstatkaPackage;
  mode: BagSheetMode;
  /** The list entry `pkg` was last taken from. */
  synced: AstatkaPackage;
}

/** Saved bags are matched by id; one with no id yet is never re-read. */
function sameBag(a: AstatkaPackage, b: AstatkaPackage): boolean {
  return a.id !== null && a.id === b.id;
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

/**
 * The saved list: every bag of this astatka flight, expected or confirmed,
 * with search, filters and — in edit mode — fixes. A table on a wide screen,
 * cards on a phone; a tap opens the bag window. Offline it falls back to the
 * copy the work mode keeps on the device, read-only.
 */
export function PackagesPreview({ flightName, editMode, isOnline, offlineIndex }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<string>("__all__");
  const [sort, setSort] = useState<AstatkaPackageSort>("recent");
  const [opened, setOpened] = useState<OpenBag | null>(null);

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
  // The per-row fixes need the server, so offline they are not offered.
  const fixing = editMode && canChange;
  const listReady = offline ? offlineIndex !== null : query.isSuccess;

  const patchOpened = (pkg: AstatkaPackage, patch: Partial<OpenBag>) =>
    setOpened((current) => (current && sameBag(current.pkg, pkg) ? { ...current, ...patch } : current));
  const actions = useSavedBagActions({
    flightName,
    onDone: (pkg) =>
      setOpened((current) =>
        current && (sameBag(current.pkg, pkg) || current.pkg === pkg) ? null : current,
      ),
    onPackageChanged: (pkg) => patchOpened(pkg, { pkg }),
    // The window stays open on the bag as saved; the list catches up on its own.
    onSaved: (pkg) => patchOpened(pkg, { pkg, mode: "view" }),
  });

  // The open bag follows the list, so its facts and its edit form never show
  // a weight the photo report below has already replaced. An unchanged entry
  // keeps its identity across refetches, so a local copy that is newer (the
  // saved edit, the weight just typed) holds until the list really changes.
  const listed = opened && !offline ? onlineItems.find((item) => sameBag(item, opened.pkg)) : undefined;
  if (opened && listed && listed !== opened.synced) {
    setOpened({ ...opened, pkg: listed, synced: listed });
  }

  const openBag = (pkg: AstatkaPackage, mode: BagSheetMode) => setOpened({ pkg, mode, synced: pkg });

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
      <div className="flex flex-wrap items-center gap-2">
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
              "inline-flex h-11 items-center gap-1 rounded-full border px-3 text-[12px] font-bold active:scale-[0.97]",
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

      {fixing && (
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
          <SavedBagHeader editMode={fixing} />
          <ul className="divide-y divide-mc-border">
            {items.map((pkg) => (
              <li key={pkg.id ?? `${pkg.client_code}-${pkg.source_flight_name}`}>
                <SavedBagRow
                  pkg={pkg}
                  editMode={fixing}
                  canChange={canChange}
                  deleting={pkg.id !== null && actions.deletingIds.has(pkg.id)}
                  onOpen={openBag}
                  onUnconfirm={(target) => void actions.askUnconfirm(target)}
                  onDelete={(target) => void actions.askDelete(target)}
                />
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
        <SavedBagSheet
          flightName={flightName}
          pkg={opened.pkg}
          mode={opened.mode}
          onModeChange={(mode) => setOpened((current) => (current ? { ...current, mode } : current))}
          onClose={() => setOpened(null)}
          // The server has already re-weighed the bag; show it before the list does.
          onWeightChanged={(weightKg) =>
            setOpened((current) =>
              current
                ? { ...current, pkg: { ...current.pkg, weight_kg: weightKg, weight_edited: false } }
                : current,
            )
          }
          isOnline={isOnline}
          canChange={canChange}
          actions={actions}
        />
      )}
    </div>
  );
}
