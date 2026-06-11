import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ReceiptText,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
} from "lucide-react";
import { QuickDatePresets } from "@/components/ui/QuickDatePresets";
import { formatCurrencySum } from "@/lib/format";
import type { CashierLogResponse, CashierLogProvider } from "@/api/pos";
import { exportCashierLog } from "@/api/pos";
import {
  getSelectedProviderTotal,
  toIsoDateBound,
  LOG_PROVIDER_FILTERS,
} from "./utils";
import { LogEntry } from "./LogEntry";
import { POSStatsCards } from "./POSStatsCards";

interface CashierLogPanelProps {
  logData: CashierLogResponse | undefined;
  logLoading: boolean;
  onRefresh: () => void;
  onEntryClick: (code: string) => void;
  currentAdminId: number | null;
  logDateFrom: string;
  setLogDateFrom: (v: string) => void;
  logDateTo: string;
  setLogDateTo: (v: string) => void;
  logProvider: CashierLogProvider | "all";
  setLogProvider: (v: CashierLogProvider | "all") => void;
  page: number;
  onPageChange: (p: number) => void;
}

export function CashierLogPanel({
  logData,
  logLoading,
  onRefresh,
  onEntryClick,
  currentAdminId,
  logDateFrom,
  setLogDateFrom,
  logDateTo,
  setLogDateTo,
  logProvider,
  setLogProvider,
  page,
  onPageChange,
}: CashierLogPanelProps) {
  // Default collapsed on mobile, expanded on desktop
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
  });
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportCashierLog({
        date_from: toIsoDateBound(logDateFrom, "start"),
        date_to: toIsoDateBound(logDateTo, "end"),
        payment_provider: logProvider === "all" ? undefined : logProvider,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kassir_hisobot_${logDateFrom || "all"}_${logDateTo || "all"}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Excel yuklab bo'lmadi");
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = Boolean(logDateFrom || logDateTo || logProvider !== "all");
  const entryCount = logData?.items.length ?? 0;
  const totalPages = logData?.total_pages ?? 1;

  // Re-evaluate on resize (debounced, keeps state sane if user rotates device)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const isDesktop = window.innerWidth >= 1024;
        setIsExpanded((prev) => {
          // Only auto-expand when crossing into desktop; never auto-collapse
          if (isDesktop && !prev) return true;
          return prev;
        });
      }, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const handlePresetChange = (from: string, to: string) => {
    setLogDateFrom(from);
    setLogDateTo(to);
  };

  const handleClearFilters = () => {
    setLogDateFrom("");
    setLogDateTo("");
    setLogProvider("all");
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ── Stats cards ─────────────────────────────────────────────────── */}
      <POSStatsCards
        todayTotal={logData?.today_total ?? 0}
        todayCashTotal={logData?.today_cash_total ?? 0}
        yesterdayTotal={logData?.yesterday_total ?? 0}
        changePercent={logData?.today_change_percent ?? null}
        loading={logLoading}
      />

      {/* ── Cashier Log Panel ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden">
        {/* ── Header (always visible) ── */}
        <button
          type="button"
          onClick={() => setIsExpanded((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <ReceiptText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              So&apos;nggi to&apos;lovlar
            </span>
            {entryCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-500/10 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                {entryCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors"
              title="Yangilash"
            >
              <RefreshCw className="w-3 h-3" />
            </span>
            <span className="text-gray-300 dark:text-gray-700">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </div>
        </button>

        {/* ── Expanded content ── */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden flex flex-col min-h-0"
            >
              {/* Filters */}
              <div className="px-4 py-3 border-t border-gray-50 dark:border-white/[0.05] space-y-2">
                {/* Filter toggle header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowFilters((p) => !p)}
                  onKeyDown={(e) => e.key === "Enter" && setShowFilters((p) => !p)}
                  className="w-full flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Filter
                    </span>
                    {hasFilters && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearFilters();
                        }}
                        className="text-[10px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
                      >
                        Tozalash
                      </button>
                    )}
                    <span className="text-gray-300 dark:text-gray-700">
                      {showFilters ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden space-y-2"
                    >
                      {/* Quick presets */}
                      <QuickDatePresets
                        dateFrom={logDateFrom}
                        dateTo={logDateTo}
                        onChange={handlePresetChange}
                      />

                      <select
                        value={logProvider}
                        onChange={(e) =>
                          setLogProvider(e.target.value as CashierLogProvider | "all")
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[12px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                      >
                        {LOG_PROVIDER_FILTERS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      {/* Date range */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={logDateFrom}
                          max={logDateTo || undefined}
                          onChange={(e) => setLogDateFrom(e.target.value)}
                          className="min-w-0 px-2.5 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                        />
                        <input
                          type="date"
                          value={logDateTo}
                          min={logDateFrom || undefined}
                          onChange={(e) => setLogDateTo(e.target.value)}
                          className="min-w-0 px-2.5 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[11px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-gray-700 dark:text-gray-200"
                        />
                      </div>

                      {/* Filter total */}
                      {logData?.summary && (
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-gray-400 dark:text-gray-500">
                            Filter jami
                          </span>
                          <span className="font-black text-gray-700 dark:text-gray-200">
                            {formatCurrencySum(
                              getSelectedProviderTotal(logData.summary, logProvider),
                            )}
                          </span>
                        </div>
                      )}

                      {/* Excel export — filtered range + provider, with NBU
                          pending/expired worksheets */}
                      <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {exporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Excel yuklab olish
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Log list (flex-1 so pagination always stays visible) */}
              <div className="px-4 py-2 flex-1 min-h-0 overflow-y-auto overscroll-contain border-t border-gray-50 dark:border-white/[0.05]">
                {logLoading ? (
                  <div className="space-y-3 py-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-14 bg-gray-50 dark:bg-white/[0.04] rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : logData && logData.items.length > 0 ? (
                  <div className="space-y-2">
                    {logData.items.map((item) => (
                      <LogEntry
                        key={item.id}
                        item={item}
                        onSelect={onEntryClick}
                        currentAdminId={currentAdminId}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <ReceiptText
                      className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                      strokeWidth={1.5}
                    />
                    <p className="text-[12px] text-gray-400">
                      Bugun hali to&apos;lov yo&apos;q
                    </p>
                  </div>
                )}
              </div>

              {/* ── Fixed Pagination Bar ───────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-50 dark:border-white/[0.06] bg-white/95 dark:bg-[#161616]/95 backdrop-blur-sm z-10">
                  <button
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
