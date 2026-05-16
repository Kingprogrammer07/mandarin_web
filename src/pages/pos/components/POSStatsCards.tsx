
import { Wallet, Banknote, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencySum } from "@/lib/format";

// ─── POSStatsCards ────────────────────────────────────────────────────────────

interface POSStatsCardsProps {
  todayTotal: number;
  todayCashTotal: number;
  yesterdayTotal: number;
  changePercent: number | null;
  loading: boolean;
}

export function POSStatsCards({
  todayTotal,
  todayCashTotal,
  yesterdayTotal,
  changePercent,
  loading,
}: POSStatsCardsProps) {
  const isGrowth = changePercent !== null && changePercent >= 0;
  const changeAbs = changePercent !== null ? Math.abs(changePercent) : 0;

  return (
    <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden">
      {/* ── Hero: Today's total ─────────────────────────────────────────── */}
      <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <Wallet className="w-6 h-6 text-white" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100/80">
              Bugungi jami tushum
            </p>
            {loading ? (
              <div className="h-8 w-32 bg-white/20 animate-pulse rounded-lg mt-1" />
            ) : (
              <p className="text-2xl font-black tracking-tight">
                {formatCurrencySum(todayTotal)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Cash total ───────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-50 dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Bugungi naqd tushum
            </p>
            {loading ? (
              <div className="h-5 w-24 bg-gray-100 dark:bg-white/[0.06] animate-pulse rounded mt-0.5" />
            ) : (
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                {formatCurrencySum(todayCashTotal)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Yesterday comparison ─────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Kechagi tushum
            </p>
            {loading ? (
              <div className="h-4 w-20 bg-gray-100 dark:bg-white/[0.06] animate-pulse rounded mt-0.5" />
            ) : (
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                {formatCurrencySum(yesterdayTotal)}
              </p>
            )}
          </div>

          {!loading && changePercent !== null && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                isGrowth
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {isGrowth ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isGrowth ? "+" : "−"}
              {changeAbs}%
            </div>
          )}

          {!loading && changePercent === null && yesterdayTotal === 0 && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              Ma&apos;lumot yo&apos;q
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
