/**
 * One client's activity: when they come, how often, and every active day.
 *
 * Money, cargo and profile already live in the manager's client drawer; this
 * sheet links to it instead of recounting them, so both screens always agree.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, X } from 'lucide-react';

import { getClientActivityDetail } from '@/api/services/presence';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Bars, HourStrip } from '@/components/admin/presence/ActivityCharts';
import {
  WEEKDAYS,
  WEEKDAYS_SHORT,
  exactTime,
  formatDay,
  formatSeen,
  hourRange,
  weekdayOf,
} from '@/lib/presence';

const PERIODS = [30, 90, 365] as const;

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-mc-text-3">{label}</p>
      <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-mc-text">{value}</p>
      {hint && <p className="text-[10px] font-medium text-mc-text-3">{hint}</p>}
    </div>
  );
}

export function ClientActivitySheet({
  clientId,
  onClose,
  onOpenProfile,
}: {
  clientId: number | null;
  onClose: () => void;
  /** Absent when the admin may not read client profiles. */
  onOpenProfile?: (clientId: number) => void;
}) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(90);
  const detail = useQuery({
    queryKey: ['client-activity-detail', clientId, days],
    queryFn: () => getClientActivityDetail(clientId as number, days),
    enabled: clientId !== null,
    refetchInterval: 60_000,
  });
  const d = detail.data;

  return (
    <Sheet open={clientId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 border-l border-mc-border bg-mc-bg p-0 sm:max-w-lg"
      >
        <SheetHeader className="flex-shrink-0 border-b border-mc-border bg-mc-surface px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate text-[16px] font-extrabold text-mc-text">
                {d ? `${d.code} · ${d.full_name}` : 'Mijoz faolligi'}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[12px] font-medium text-mc-text-2">
                {d ? (
                  d.online ? (
                    <span className="font-bold text-mc-success-text">Hozir online</span>
                  ) : (
                    <span title={d.last_seen_at ? exactTime(d.last_seen_at) : undefined}>
                      Oxirgi faollik: {formatSeen(d.last_seen_at)}
                    </span>
                  )
                ) : (
                  'Yuklanmoqda…'
                )}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div role="tablist" aria-label="Davr" className="flex rounded-mc-md border border-mc-border bg-mc-surface-2 p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={days === p}
                onClick={() => setDays(p)}
                className={`min-h-[36px] flex-1 rounded-mc-sm text-[12px] font-extrabold ${
                  days === p ? 'bg-mc-surface text-mc-text shadow-[var(--mc-shadow-card)]' : 'text-mc-text-2'
                }`}
              >
                {p === 365 ? '1 yil' : `${p} kun`}
              </button>
            ))}
          </div>

          {detail.isError ? (
            <div className="rounded-mc-md border border-mc-border bg-mc-surface px-3 py-6 text-center">
              <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
              <button
                type="button"
                onClick={() => void detail.refetch()}
                className="mt-1 min-h-[44px] text-[12px] font-bold text-mc-brand"
              >
                Qayta urinish
              </button>
            </div>
          ) : !d ? (
            <div className="h-40 animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Fact label="Faol kunlar" value={String(d.active_days)} hint={`so‘nggi ${d.days} kunda, bugun bilan`} />
                <Fact label="Faol soatlar" value={String(d.active_hours)} hint="har kunning har soati bir marta" />
                <Fact
                  label="Ko‘p kiradigan vaqti"
                  value={d.top_hour === null ? '—' : hourRange(d.top_hour)}
                  hint={d.top_hour === null ? undefined : `${d.by_hour[d.top_hour]} kun shu soatda kirgan`}
                />
                <Fact
                  label="Birinchi qayd"
                  value={d.first_active_day ? formatDay(d.first_active_day) : '—'}
                  hint="kuzatuv boshlangandan beri"
                />
              </div>

              {d.active_days === 0 ? (
                <p className="rounded-mc-md border border-dashed border-mc-border px-3 py-6 text-center text-[12px] font-medium text-mc-text-3">
                  Bu davrda bot yoki Mini App orqali faollik qayd etilmagan
                </p>
              ) : (
                <>
                  <section className="rounded-mc-lg border border-mc-border bg-mc-surface p-3.5">
                    <h3 className="text-[13px] font-extrabold text-mc-text">Qaysi soatlarda kiradi</h3>
                    <div className="mt-2">
                      <Bars
                        values={d.by_hour}
                        ticks={d.by_hour.map((_, h) => (h % 3 === 0 ? String(h) : ''))}
                        marked={d.top_hour === null ? [] : [d.top_hour]}
                        idle="Ustun ustiga bosing — o‘sha soatda necha kun kirgani"
                        describe={(h) => `${hourRange(h)}: ${d.by_hour[h]} kun`}
                        ariaLabel="Soatlar bo‘yicha faol kunlar"
                      />
                    </div>
                  </section>

                  <section className="rounded-mc-lg border border-mc-border bg-mc-surface p-3.5">
                    <h3 className="text-[13px] font-extrabold text-mc-text">Hafta kunlari</h3>
                    <div className="mt-2">
                      <Bars
                        values={d.by_weekday}
                        ticks={WEEKDAYS_SHORT}
                        height={90}
                        idle="Ustun ustiga bosing"
                        describe={(w) => `${WEEKDAYS[w]}: ${d.by_weekday[w]} faol kun`}
                        ariaLabel="Hafta kunlari bo‘yicha faol kunlar"
                      />
                    </div>
                  </section>

                  <section className="rounded-mc-lg border border-mc-border bg-mc-surface p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[13px] font-extrabold text-mc-text">Kunma-kun</h3>
                      <span className="text-[10px] font-medium tabular-nums text-mc-text-3">0 · 6 · 12 · 18 · 23</span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {d.timeline.map((day) => (
                        <li key={day.day} className="grid grid-cols-[92px_1fr] items-center gap-2">
                          <span className="text-[11px] font-semibold tabular-nums text-mc-text-2">
                            {WEEKDAYS_SHORT[weekdayOf(day.day)]} {formatDay(day.day).slice(0, 5)}
                          </span>
                          <HourStrip
                            hours={day.hours}
                            label={`${formatDay(day.day)}: ${day.hours.map(hourRange).join(', ')}`}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              {onOpenProfile && (
                <button
                  type="button"
                  onClick={() => onOpenProfile(d.client_id)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-mc-md border border-mc-border bg-mc-surface text-[13px] font-extrabold text-mc-text active:scale-[0.99]"
                >
                  Profil va moliya
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
