
import { formatCurrencySum } from '@/lib/format';

// ─── TodayTotal ───────────────────────────────────────────────────────────────

export function TodayTotal({ total, loading }: { total: number; loading: boolean }) {
  return (
    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-green-500/20">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-green-100/80 mb-1">
        Bugungi tushum
      </p>
      {loading ? (
        <div className="h-8 w-32 bg-white/20 animate-pulse rounded-lg" />
      ) : (
        <p className="text-2xl font-black tracking-tight">
          {formatCurrencySum(total)}
        </p>
      )}
    </div>
  );
}

