import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Info, RefreshCw } from 'lucide-react';

import {
  courierMonitorKeys,
  courierMonitorService,
  type MonitorMileageCourier,
} from '@/api/services/courierMonitor';
import { SectionCard } from '@/components/admin/dashboard/DashboardPrimitives';
import { getTashkentDateIso } from '@/lib/format';
import {
  buildMileageCsv,
  costFor,
  courierCost,
  courierName,
  dayLabel,
  formatKm,
  formatSom,
  monthLabel,
  monthRange,
  parseRate,
  shiftMonth,
  shiftSpan,
} from '@/lib/courierMonitor';
import { triggerSoftHaptic } from '@/utils/haptics';

/** This browser only: a convenience for the person doing the car expenses, not a setting. */
export const KM_RATE_STORAGE_KEY = 'courier_km_rate';

function readRate(): string {
  try {
    return localStorage.getItem(KM_RATE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeRate(text: string): void {
  try {
    if (text) localStorage.setItem(KM_RATE_STORAGE_KEY, text);
    else localStorage.removeItem(KM_RATE_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the price just is not remembered.
  }
}

function downloadCsv(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: some browsers start the download only after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function CourierMonth({ courier, rate }: { courier: MonitorMileageCourier; rate: number | null }) {
  const worked = courier.days.filter((day) => day.driven_m > 0);
  const average = worked.length ? courier.total_m / worked.length : 0;
  const days = [...courier.days].reverse();
  return (
    <SectionCard title={courierName(courier)} subtitle={courier.car ?? undefined} bodyClassName="px-4 pb-2 pt-3">
      <div className="border-b border-mc-border pb-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-mc-text-3">Oy bo'yicha</p>
        <p className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-tight tabular-nums text-mc-text">
          {formatKm(courier.total_m)}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-mc-text-3">
          {worked.length} kun yurgan{worked.length > 0 && ` · o'rtacha ${formatKm(average)} kuniga`}
        </p>
        {rate && (
          <p className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-mc-md bg-mc-brand-soft px-3 py-2">
            <span className="text-[11px] font-semibold text-mc-text-2">1 km = {formatSom(rate)}</span>
            <span className="text-[15px] font-extrabold tabular-nums text-mc-brand">{formatSom(courierCost(courier, rate))}</span>
          </p>
        )}
      </div>
      <ul className="divide-y divide-mc-border">
        {days.map((day) => (
          <li key={day.date} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-mc-text">{dayLabel(day.date)}</p>
              <p className="mt-0.5 break-words text-[11px] font-medium text-mc-text-3">
                {shiftSpan(day.shift_started_at, day.shift_ended_at)}
                {day.delivered > 0 && ` · ${day.delivered} ta yetkazildi`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-[13px] font-extrabold tabular-nums ${day.driven_m > 0 ? 'text-mc-text' : 'text-mc-text-3'}`}>
                {formatKm(day.driven_m)}
              </p>
              {rate && day.driven_m > 0 && (
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-mc-text-3">{formatSom(costFor(day.driven_m, rate))}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** «Kilometrlar»: each courier's month, day by day, for the car expenses. */
export default function CourierMileageBoard() {
  const thisMonth = getTashkentDateIso().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [rateText, setRateText] = useState(readRate);
  const rate = parseRate(rateText);
  const { from, to } = monthRange(month);

  const mileage = useQuery({
    queryKey: courierMonitorKeys.mileage(from, to),
    queryFn: () => courierMonitorService.mileage(from, to),
  });
  const couriers = useMemo(() => mileage.data?.couriers ?? [], [mileage.data]);
  const totalM = couriers.reduce((sum, c) => sum + c.total_m, 0);

  const step = (delta: number) => {
    triggerSoftHaptic();
    setMonth((current) => shiftMonth(current, delta));
  };
  const changeRate = (text: string) => {
    const clean = text.replace(/[^\d\s]/g, '').slice(0, 12);
    setRateText(clean);
    writeRate(clean.trim());
  };
  const exportCsv = () => {
    triggerSoftHaptic();
    downloadCsv(`kuryer-km-${month}.csv`, buildMileageCsv(couriers, rate));
  };

  const stepClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-md border border-mc-border bg-mc-surface text-mc-text transition-transform active:scale-95 disabled:opacity-40';

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-3 rounded-mc-lg border border-mc-border bg-mc-surface p-4 shadow-[var(--mc-shadow-card)]">
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
          <button type="button" onClick={() => step(-1)} aria-label="Oldingi oy" className={stepClass}>
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
          </button>
          <p className="flex h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-mc-md bg-mc-surface-2 px-3 text-[13px] font-extrabold text-mc-text sm:w-[150px] sm:flex-none">
            {monthLabel(month)}
          </p>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={month >= thisMonth}
            aria-label="Keyingi oy"
            className={stepClass}
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[240px]">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-mc-text-3">1 km narxi</span>
          <span className="flex h-11 items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={rateText}
              onChange={(event) => changeRate(event.target.value)}
              placeholder="masalan 1500"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums text-mc-text outline-none placeholder:text-mc-text-3"
            />
            <span className="shrink-0 text-[12px] font-bold text-mc-text-3">so'm</span>
          </span>
        </label>

        <button
          type="button"
          onClick={exportCsv}
          disabled={couriers.length === 0}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-mc-md bg-mc-brand px-4 text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-transform active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <Download className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          Excel (CSV)
        </button>
      </section>

      {mileage.isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
          ))}
        </div>
      )}

      {mileage.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-mc-lg border border-mc-border bg-mc-surface px-4 py-3">
          <p className="text-[12px] font-semibold text-mc-danger">Kilometrlar olinmadi.</p>
          <button
            type="button"
            onClick={() => void mileage.refetch()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-mc-sm px-3 text-[12px] font-bold text-mc-brand active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${mileage.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            Qayta urinish
          </button>
        </div>
      )}

      {mileage.isSuccess && couriers.length === 0 && (
        <p className="rounded-mc-lg border border-mc-border bg-mc-surface px-4 py-6 text-center text-[12px] font-medium text-mc-text-2">
          {monthLabel(month)} oyida kuryer ish kuni yo'q.
        </p>
      )}

      {couriers.length > 1 && (
        <p className="text-[12px] font-semibold text-mc-text-2">
          Hammasi: <span className="font-extrabold tabular-nums text-mc-text">{formatKm(totalM)}</span>
          {rate && (
            <>
              {' · '}
              <span className="font-extrabold tabular-nums text-mc-brand">
                {formatSom(couriers.reduce((sum, c) => sum + courierCost(c, rate), 0))}
              </span>
            </>
          )}
        </p>
      )}

      {couriers.length > 0 && (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {couriers.map((courier) => (
            <CourierMonth key={courier.id} courier={courier} rate={rate} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-mc-md bg-mc-surface-2 px-3 py-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-mc-text-3" strokeWidth={2.2} aria-hidden="true" />
        <p className="text-[11px] font-medium leading-relaxed text-mc-text-2">
          Km kuryer telefonining GPS'idan, faqat smena davomida hisoblanadi. Turgan joydagi tebranish va GPS
          sakrashlari chiqarib tashlanadi; signal uzilgan joylar to'g'ri chiziq bilan qo'shiladi, shuning uchun
          haqiqiy yo'l biroz uzunroq bo'lishi mumkin. 1 km narxi faqat shu brauzerda saqlanadi.
        </p>
      </div>
    </div>
  );
}
