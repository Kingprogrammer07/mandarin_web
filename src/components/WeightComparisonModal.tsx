import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Download,
  Loader2,
  Scale,
  Search,
  X,
} from 'lucide-react';
import {
  exportWeightComparisonExcel,
  getWeightComparison,
  type WeightComparisonRow,
  type WeightStatus,
} from '@/api/services/expectedCargo';

/**
 * Weight reconciliation for one flight: what China declared against what
 * Tashkent reported, per customer.
 *
 * Two panes on purpose. The right-hand table is the answer — one row per
 * customer with both totals and the gap — and the left is the evidence for
 * whichever customer is selected, because the first question after seeing a
 * 2 kg gap is always "which parcel?".
 */

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<WeightStatus, string> = {
  match: 'text-gray-500 dark:text-white/40',
  manifest_heavier: 'text-red-600 dark:text-red-400 font-bold',
  report_heavier: 'text-amber-600 dark:text-amber-300 font-bold',
};

function kg(value: number): string {
  return value.toFixed(2);
}

function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-300'
        : tone === 'bad'
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-white/40">
        {label}
      </p>
      <p className={`text-lg font-black leading-tight ${toneClass}`}>{value}</p>
      {hint && (
        <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30">{hint}</p>
      )}
    </div>
  );
}

export default function WeightComparisonModal({
  flightName,
  onClose,
}: {
  flightName: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [onlyMismatched, setOnlyMismatched] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['weight-comparison', flightName],
    queryFn: () => getWeightComparison(flightName),
    enabled: flightName.length > 0,
  });

  const filtered = useMemo<WeightComparisonRow[]>(() => {
    const rows = data?.rows ?? [];
    const needle = search.trim().toUpperCase();
    return rows.filter(
      (row) =>
        (!onlyMismatched || row.status !== 'match')
        && (!needle || row.client_code.toUpperCase().includes(needle)),
    );
  }, [data?.rows, search, onlyMismatched]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // The detail pane follows the selection; with nobody selected it shows the
  // parcels of whoever is at the top of the current page, so the pane is never
  // an empty box asking to be clicked.
  const detailCode = selected ?? visible[0]?.client_code ?? null;
  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => p.client_code === detailCode),
    [data?.parcels, detailCode],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportWeightComparisonExcel(flightName);
      toast.success('Excel yuklandi');
    } catch {
      toast.error("Excelni yuklab bo'lmadi");
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4">
      <div className="relative w-full max-w-7xl rounded-2xl bg-white shadow-2xl dark:bg-[#0f172a]">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4 dark:border-white/10">
          <Scale className="h-5 w-5 text-orange-500" />
          <div className="mr-auto">
            <h2 className="text-base font-black text-gray-900 dark:text-white">
              Og'irlik solishtirish — {flightName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-white/45">
              Xitoy manifesti (cargo_items) ↔ hisobot (flight_cargos), ikkalasida ham
              bor mijozlar
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || !data || data.rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Excel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500 dark:text-white/45">
            <Loader2 className="h-4 w-4 animate-spin" /> Hisoblanmoqda…
          </div>
        ) : isError || !data ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              Ma'lumotni yuklab bo'lmadi.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 dark:border-white/10 dark:text-white"
            >
              Qayta urinish
            </button>
          </div>
        ) : data.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Solishtiradigan mijoz topilmadi.
            </p>
            <p className="mx-auto mt-2 max-w-lg text-xs font-semibold text-gray-500 dark:text-white/45">
              Bu reys uchun ikkala jadvalda ham bor mijoz yo'q — odatda hisobot
              (flight_cargos) hali yaratilmagan bo'ladi. Hisobot tayyor bo'lgach shu
              yerda ko'rinadi.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">
              <Tile label="Mijoz" value={summary!.clients} />
              <Tile label="Mos" value={summary!.matched} tone="good" />
              <Tile
                label="Farqli"
                value={summary!.mismatched}
                tone={summary!.mismatched > 0 ? 'warn' : 'neutral'}
                hint={`manifest ${summary!.manifest_heavier} · hisobot ${summary!.report_heavier}`}
              />
              <Tile
                label="Manifest"
                value={`${kg(summary!.manifest_weight)} kg`}
                hint={`hisobot ${kg(summary!.report_weight)} kg`}
              />
              <Tile
                label="Umumiy farq"
                value={`${summary!.difference > 0 ? '+' : ''}${kg(summary!.difference)} kg`}
                tone={Math.abs(summary!.difference) > summary!.tolerance_kg ? 'bad' : 'good'}
                hint={`chegara ±${summary!.tolerance_kg} kg`}
              />
            </div>

            {summary!.unreadable_rows > 0 && (
              <p className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {summary!.unreadable_rows} ta manifest qatorining og'irligi raqam
                emas (import chala kelgan) — ular 0 kg deb hisoblandi, ya'ni farq
                aslidan kattaroq ko'rinishi mumkin.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Mijoz kodi bo'yicha filtrlash"
                  className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-[#111827] dark:text-white"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 dark:border-white/10 dark:text-white">
                <input
                  type="checkbox"
                  checked={onlyMismatched}
                  onChange={(event) => {
                    setOnlyMismatched(event.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 accent-orange-500"
                />
                Faqat farqlilar
              </label>
            </div>

            <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
              {/* Right-hand answer first in the DOM on small screens: the totals
                  are what the operator came for; the parcel list is evidence. */}
              <section className="order-2 lg:order-1">
                <h3 className="mb-1 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/40">
                  Manifest qatorlari{detailCode ? ` — ${detailCode}` : ''}
                </h3>
                <div className="max-h-[52vh] overflow-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-white/70">
                      <tr>
                        <th className="px-2 py-2 text-left font-black">Trek kodi</th>
                        <th className="px-2 py-2 text-left font-black">Mahsulot</th>
                        <th className="px-2 py-2 text-right font-black">kg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {parcels.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-2 py-6 text-center text-gray-400">
                            Mijoz tanlanmagan
                          </td>
                        </tr>
                      ) : (
                        parcels.map((parcel, index) => (
                          <tr key={`${parcel.track_code}-${index}`}>
                            <td className="px-2 py-1.5 font-mono text-[11px] text-gray-800 dark:text-white/80">
                              {parcel.track_code || '—'}
                            </td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-white/60">
                              {parcel.item_name || '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-bold text-gray-900 dark:text-white">
                              {parcel.readable ? (
                                kg(parcel.weight)
                              ) : (
                                <span
                                  className="text-amber-600 dark:text-amber-300"
                                  title="Og'irlik raqam emas — 0 deb olindi"
                                >
                                  ?
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="order-1 lg:order-2">
                <h3 className="mb-1 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/40">
                  Mijoz bo'yicha jami ({filtered.length})
                </h3>
                <div className="max-h-[52vh] overflow-auto rounded-xl border border-gray-200 dark:border-white/10">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-white/70">
                      <tr>
                        <th className="px-2 py-2 text-left font-black">Mijoz</th>
                        <th className="px-2 py-2 text-right font-black">Manifest</th>
                        <th className="px-2 py-2 text-right font-black">Hisobot</th>
                        <th className="px-2 py-2 text-right font-black">Farq</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {visible.map((row) => (
                        <tr
                          key={row.client_code}
                          onClick={() => setSelected(row.client_code)}
                          className={`cursor-pointer transition-colors ${
                            row.client_code === detailCode
                              ? 'bg-orange-50 dark:bg-orange-500/10'
                              : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          <td className="px-2 py-1.5 font-bold text-gray-900 dark:text-white">
                            {row.client_code}
                            {row.manifest_unreadable > 0 && (
                              <span
                                className="ml-1 text-amber-500"
                                title={`${row.manifest_unreadable} ta qatorning og'irligi o'qilmadi`}
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-700 dark:text-white/70">
                            {kg(row.manifest_weight)}
                            <span className="ml-1 text-[10px] text-gray-400">
                              ({row.manifest_parcels})
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-700 dark:text-white/70">
                            {kg(row.report_weight)}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right tabular-nums ${STATUS_STYLES[row.status]}`}
                          >
                            {row.status === 'match' ? (
                              <Check className="ml-auto h-3.5 w-3.5" />
                            ) : (
                              `${row.difference > 0 ? '+' : ''}${kg(row.difference)}`
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-gray-600 dark:text-white/60">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={safePage <= 1}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
                    >
                      ‹ Oldingi
                    </button>
                    <span>
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={safePage >= totalPages}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
                    >
                      Keyingi ›
                    </button>
                  </div>
                )}

                <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-white/40">
                  <ArrowLeftRight className="mt-0.5 h-3 w-3 shrink-0" />
                  Farq = manifest − hisobot. <span className="text-red-600 dark:text-red-400">Qizil</span>:
                  Xitoy ko'proq deb yozgan (yuk yetmayapti).{' '}
                  <span className="text-amber-600 dark:text-amber-300">Sariq</span>: hisobot
                  ko'proq (ortiqcha yoki boshqa reysdan).
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
