/**
 * The spreadsheet console.
 *
 * Read-only on purpose. Every write still goes through /pos until this view has
 * been watched against it in production — a second UI that can move money is a
 * second way to move it wrongly, and the ledger has already paid for one of
 * those (4,101,804 so'm of duplicate events, July 2026).
 *
 * The shape here is the point: this file fetches and arranges, `DataGrid`
 * renders, `columns.ts` describes. The screen it replaces put all three in one
 * 1,937-line function, which is why nothing new could be added to it.
 */

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { getCashierLog, type CashierLogItem } from "@/api/pos";
import { DataGrid } from "@/components/grid/DataGrid";
import { QuickDatePresets } from "@/components/ui/QuickDatePresets";
import { buildDatePresets } from "@/lib/datePresets";
import { formatCurrencySum } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CASHIER_LOG_COLUMNS } from "./columns";

/** The endpoint's maximum. Anything larger is rejected by the query validator. */
const PAGE_SIZE = 100;

/**
 * Ceiling on how many rows the grid will assemble for one range.
 *
 * A spreadsheet shows everything or it is not a spreadsheet — a footer total
 * that silently covered only the first page would be a total meaning something
 * other than what it says, which is the failure this whole rewrite exists to
 * stop. So the page walks the endpoint until the range is exhausted, and when
 * a range is genuinely too big it says so instead of quietly truncating.
 *
 * 5 000 rows is roughly four months of till activity at the current rate and
 * renders in one frame because the body is virtualised.
 */
const MAX_ROWS = 5_000;

/** Walk every page of a date range, so the footer covers what it claims to. */
async function fetchAllCashierLogRows(dateFrom: string, dateTo: string) {
  const first = await getCashierLog({
    page: 1,
    size: PAGE_SIZE,
    date_from: dateFrom,
    date_to: dateTo,
  });

  const pagesNeeded = Math.min(
    first.total_pages,
    Math.ceil(MAX_ROWS / PAGE_SIZE),
  );

  const items = [...first.items];
  for (let page = 2; page <= pagesNeeded; page += 1) {
    const next = await getCashierLog({
      page,
      size: PAGE_SIZE,
      date_from: dateFrom,
      date_to: dateTo,
    });
    items.push(...next.items);
  }

  return {
    ...first,
    items,
    /** True when the range holds more than this page was willing to load. */
    capped: first.total_count > items.length,
  };
}

interface Pos2PageProps {
  onNavigate: (page: string) => void;
}

export default function Pos2Page({ onNavigate }: Pos2PageProps) {
  const today = buildDatePresets()[0];
  const [dateFrom, setDateFrom] = useState(today.dateFrom);
  const [dateTo, setDateTo] = useState(today.dateTo);
  // Reported by the grid, which owns the per-column filter boxes. The page only
  // needs the counts, to say whether the footer total covers the whole range.
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["pos2-cashier-log", dateFrom, dateTo],
    queryFn: () => fetchAllCashierLogRows(dateFrom, dateTo),
    staleTime: 20_000,
  });

  const rows = useMemo<CashierLogItem[]>(() => data?.items ?? [], [data?.items]);

  const capped = data?.capped ?? false;
  const filtered = visibleCount !== null && visibleCount < rows.length;
  /** True when the footer total describes fewer rows than the chosen range —
   *  either the range exceeded the load ceiling, or a column filter is on. */
  const partialTotal = capped || filtered;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0d0d0d] p-3 gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <button
          type="button"
          onClick={() => onNavigate("pos-dashboard")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kassa
        </button>

        <h1 className="text-[15px] font-black text-gray-900 dark:text-white tracking-tight">
          KASSA JADVALI
        </h1>

        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide">
          Sinov · faqat ko'rish
        </span>

        <div className="flex-1" />

        <QuickDatePresets
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />

        {/* No global search box: filtering lives in the row under the header,
            one box per column, which is where a spreadsheet user looks for it.
            A single box searching three columns at once also cannot express
            "this client code exactly" — the case that motivated the change. */}

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:border-orange-300 disabled:opacity-50 transition-colors"
          title="Yangilash"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
        </button>

        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-[12px] font-semibold text-gray-400 cursor-not-allowed"
          title="Keyingi bosqichda"
        >
          <Download className="w-4 h-4" />
          Excel
        </button>
      </div>

      {/* Day summary.
          These three come from the endpoint's own day totals, which take only
          admin_id — they ignore date_from/date_to and every other filter on
          this screen. Placing them beside the grid unlabelled would invite the
          obvious reading, that they describe the rows below, and they do not.
          Hence "butun kassa" and the separator before the row count, which is
          the only figure here that does describe the grid.

          yesterday_total is deliberately absent: the backend anchors it at UTC
          midnight while today_total anchors at Tashkent midnight, so the two
          are five hours out of step and a comparison between them is noise. */}
      {data && (
        <div className="flex items-center gap-4 flex-wrap shrink-0 px-1 text-[12px]">
          <Metric
            label="Bugun · butun kassa"
            value={formatCurrencySum(data.today_total)}
          />
          <Metric label="Shundan naqd" value={formatCurrencySum(data.today_cash_total)} />
          <span className="text-gray-300 dark:text-white/20">│</span>
          <Metric
            label="Tanlangan oraliq"
            value={`${rows.length} / ${data.total_count} qator`}
            muted
          />
        </div>
      )}

      {/* The footer total is only trustworthy when every row of the range is
          loaded and unfiltered. Whenever it is not — the range exceeded
          MAX_ROWS, or a column filter is on — say so beside the grid rather
          than let a partial sum sit under the word JAMI. */}
      {partialTotal && (
        <p className="shrink-0 px-1 text-[11px] text-amber-600 dark:text-amber-400">
          {capped
            ? `Oraliqda ${data?.total_count} ta yozuv bor, ${rows.length} tasi yuklandi. Pastdagi JAMI shu yuklanganlarniki — sanani toraytiring.`
            : `Filtr yoqilgan: ${visibleCount} / ${rows.length} qator. Pastdagi JAMI faqat ko'rinayotganlarniki.`}
        </p>
      )}

      <DataGrid
        columns={CASHIER_LOG_COLUMNS}
        rows={rows}
        rowKey={(row) => `${row.entry_kind}:${row.id}`}
        loading={isLoading}
        error={error ? "Ma'lumotni yuklab bo'lmadi. Qayta urinib ko'ring." : null}
        emptyMessage="Tanlangan sanada yozuv yo'q"
        onFilteredCountChange={(visible) => setVisibleCount(visible)}
        className="flex-1 min-h-0"
      />

      <div className="shrink-0 px-1 space-y-0.5">
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          Strelkalar — yurish · Tab — o'ngga · Enter — pastga · F2 — tahrir ·
          Ctrl+C — nusxa · Home/End — qator boshi/oxiri
        </p>
        {/* Spelled out because the whole point of the `=` prefix is that it is
            discoverable without a dropdown. STCH3 is the example on purpose —
            it is the case that has no answer without it. */}
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          Filtr: <b>STCH3</b> — ichida (STCH3, STCH30, STCH330) ·{" "}
          <b>=STCH3</b> — faqat aynan shu · <b>&gt;50000</b> / <b>&lt;50000</b> —
          summa bo'yicha
        </p>
        {/* Stated, not hidden: an NBU UzPost row's amount is the gateway amount
            plus wallet_used, so the JAMI figure is money booked, not money in
            the drawer. A cashier counting cash against it would come up short
            and have no way to see why. */}
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          JAMI — hisobga olingan summa. UzPost/NBU qatorlarida hamyondan
          ishlatilgan pul ham kiradi, u kassaga tushmagan.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <span
        className={cn(
          "font-black tabular-nums",
          muted
            ? "text-gray-500 dark:text-gray-400"
            : "text-gray-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </span>
  );
}
