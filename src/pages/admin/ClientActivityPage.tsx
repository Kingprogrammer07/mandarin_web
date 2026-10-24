/**
 * «Mijozlar faolligi»: who is online now, when clients come (busiest, quietest
 * and average hours and weekdays), and each client's own activity.
 *
 * Activity = a Mini App request or a private message / button press in the bot.
 * Every figure is counted on the backend from those recorded requests; the
 * page only formats them, and says over which days an average was taken.
 */

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Lock, Search } from 'lucide-react';

import { getAdminJwtClaims } from '@/api/services/adminManagement';
import {
  getClientActivityList,
  getClientActivityStats,
  getClientsOverview,
  type ClientFilter,
  type ClientSort,
} from '@/api/services/presence';
import { SectionCard, TileSkeleton } from '@/components/admin/dashboard/DashboardPrimitives';
import { Bars, Heatmap } from '@/components/admin/presence/ActivityCharts';
import { ClientActivitySheet } from '@/components/admin/presence/ClientActivitySheet';
import { ClientDetailDrawer } from '@/components/manager/ClientDetailDrawer';
import {
  WEEKDAYS,
  WEEKDAYS_SHORT,
  exactTime,
  formatAvg,
  formatDay,
  formatSeen,
  hourRange,
  weekdayOf,
} from '@/lib/presence';
import { useManagerStore } from '@/store/useManagerStore';

const PERIODS = [7, 30, 90] as const;
const LIST_PERIODS = [7, 30, 90] as const;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-mc-lg border border-mc-border bg-mc-surface px-3.5 py-3 shadow-[var(--mc-shadow-card)]">
      <p className="truncate text-[11px] font-semibold text-mc-text-3">{label}</p>
      <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-mc-text">{value}</p>
      {hint && <p className="mt-1 truncate text-[10px] font-medium text-mc-text-3">{hint}</p>}
    </div>
  );
}

function Insight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-mc-text-3">{label}</p>
      <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-mc-text">{value}</p>
      <p className="text-[11px] font-medium text-mc-text-2">{detail}</p>
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  render: (v: T) => string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-mc-md border border-mc-border bg-mc-surface-2 p-1">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`min-h-[36px] flex-1 whitespace-nowrap rounded-mc-sm px-3 text-[12px] font-extrabold ${
            value === o ? 'bg-mc-surface text-mc-text shadow-[var(--mc-shadow-card)]' : 'text-mc-text-2'
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

function ErrorNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-6 text-center">
      <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
      <button type="button" onClick={onRetry} className="mt-1 min-h-[44px] text-[12px] font-bold text-mc-brand">
        Qayta urinish
      </button>
    </div>
  );
}

function ActivityAnalytics() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const stats = useQuery({
    queryKey: ['client-activity-stats', days],
    queryFn: () => getClientActivityStats(days),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  const range = s?.start && s?.end ? `${formatDay(s.start)} – ${formatDay(s.end)}, ${s.days_counted} to‘liq kun` : '';

  return (
    <SectionCard
      title="Faollik vaqtlari"
      subtitle="Faqat to‘liq kunlar: bugun va kuzatuv boshlangan kun hisobga kirmaydi"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="w-full sm:w-auto">
            <Segmented options={PERIODS} value={days} onChange={setDays} label="Davr" render={(p) => `${p} kun`} />
          </div>
          {range && <p className="text-[11px] font-medium tabular-nums text-mc-text-3">{range}</p>}
        </div>

        {stats.isError ? (
          <ErrorNote onRetry={() => void stats.refetch()} />
        ) : !s ? (
          <TileSkeleton />
        ) : s.days_counted === 0 ? (
          <p className="rounded-mc-md border border-dashed border-mc-border px-3 py-8 text-center text-[12px] font-medium leading-relaxed text-mc-text-2">
            {s.tracking_since
              ? `Kuzatuv ${formatDay(s.tracking_since)} kuni boshlangan. Tahlil birinchi to‘liq kun tugagach chiqadi.`
              : 'Hali faollik qayd etilmagan. Tahlil birinchi to‘liq kun tugagach chiqadi.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Insight
                label="Eng gavjum soat"
                value={s.peak_hour === null ? '—' : hourRange(s.peak_hour)}
                detail={s.peak_hour === null ? '' : `o‘rtacha ${formatAvg(s.by_hour[s.peak_hour])} mijoz`}
              />
              <Insight
                label="Eng sust soat"
                value={s.quiet_hour === null ? '—' : hourRange(s.quiet_hour)}
                detail={s.quiet_hour === null ? '' : `o‘rtacha ${formatAvg(s.by_hour[s.quiet_hour])} mijoz`}
              />
              <Insight
                label="O‘rtacha kuniga"
                value={`${formatAvg(s.average_daily)} mijoz`}
                detail={`soatiga o‘rtacha ${formatAvg(s.average_hourly)}`}
              />
              <Insight
                label="Rekord kun"
                value={s.record_day ? `${s.record_day.active_clients} mijoz` : '—'}
                detail={s.record_day ? `${WEEKDAYS[weekdayOf(s.record_day.day)]}, ${formatDay(s.record_day.day)}` : ''}
              />
              <Insight
                label="Eng gavjum kun"
                value={s.busiest_weekday === null ? '—' : WEEKDAYS[s.busiest_weekday]}
                detail={
                  s.busiest_weekday === null
                    ? ''
                    : `o‘rtacha ${formatAvg(s.by_weekday[s.busiest_weekday])} mijoz · ${s.weekday_days[s.busiest_weekday]} kun`
                }
              />
              <Insight
                label="Eng sust kun"
                value={s.quietest_weekday === null ? '—' : WEEKDAYS[s.quietest_weekday]}
                detail={
                  s.quietest_weekday === null
                    ? ''
                    : `o‘rtacha ${formatAvg(s.by_weekday[s.quietest_weekday])} mijoz · ${s.weekday_days[s.quietest_weekday]} kun`
                }
              />
              <Insight
                label="Rekord soat"
                value={s.record_hour ? `${s.record_hour.active_clients} mijoz` : '—'}
                detail={s.record_hour ? `${formatDay(s.record_hour.day)}, ${hourRange(s.record_hour.hour)}` : ''}
              />
              <Insight label="Hisoblangan kunlar" value={String(s.days_counted)} detail={`so‘ralgan: ${s.days_requested}`} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="min-w-0 rounded-mc-md border border-mc-border p-3">
                <h3 className="text-[13px] font-extrabold text-mc-text">Kun soatlari bo‘yicha</h3>
                <p className="text-[11px] font-medium text-mc-text-3">Har soatda o‘rtacha nechta mijoz faol bo‘lgan</p>
                <div className="mt-2">
                  <Bars
                    values={s.by_hour}
                    ticks={s.by_hour.map((_, h) => (h % 3 === 0 ? String(h) : ''))}
                    marked={s.peak_hour === null ? [] : [s.peak_hour]}
                    idle="Ustunni bosing yoki ustiga olib boring"
                    describe={(h) => `${hourRange(h)}: o‘rtacha ${formatAvg(s.by_hour[h])} mijoz`}
                    ariaLabel="Soatlar bo‘yicha o‘rtacha faol mijozlar"
                  />
                </div>
              </div>
              <div className="min-w-0 rounded-mc-md border border-mc-border p-3">
                <h3 className="text-[13px] font-extrabold text-mc-text">Hafta kunlari bo‘yicha</h3>
                <p className="text-[11px] font-medium text-mc-text-3">Kuniga o‘rtacha nechta mijoz faol bo‘lgan</p>
                <div className="mt-2">
                  <Bars
                    values={s.by_weekday}
                    ticks={WEEKDAYS_SHORT}
                    marked={s.busiest_weekday === null ? [] : [s.busiest_weekday]}
                    idle="Ustunni bosing yoki ustiga olib boring"
                    describe={(w) =>
                      `${WEEKDAYS[w]}: o‘rtacha ${formatAvg(s.by_weekday[w])} mijoz (${s.weekday_days[w]} kun)`
                    }
                    ariaLabel="Hafta kunlari bo‘yicha o‘rtacha faol mijozlar"
                  />
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-mc-md border border-mc-border p-3">
              <h3 className="text-[13px] font-extrabold text-mc-text">Hafta × soat</h3>
              <p className="text-[11px] font-medium text-mc-text-3">Har katak — o‘sha kun va soatda o‘rtacha faol mijozlar</p>
              <div className="mt-2">
                <Heatmap
                  values={s.heatmap}
                  rowLabels={WEEKDAYS_SHORT}
                  idle="Katakni bosing yoki ustiga olib boring"
                  describe={(w, h) =>
                    `${WEEKDAYS[w]}, ${hourRange(h)}: o‘rtacha ${formatAvg(s.heatmap[w][h])} mijoz (${s.weekday_days[w]} kun)`
                  }
                />
              </div>
            </div>

            <div className="min-w-0 rounded-mc-md border border-mc-border p-3">
              <h3 className="text-[13px] font-extrabold text-mc-text">Kunlar bo‘yicha</h3>
              <p className="text-[11px] font-medium text-mc-text-3">Har kuni nechta turli mijoz faol bo‘lgan</p>
              <div className="mt-2">
                <Bars
                  values={s.daily.map((d) => d.active_clients)}
                  ticks={s.daily.map((d, i) =>
                    i === 0 || i === s.daily.length - 1 || s.daily.length <= 10 ? formatDay(d.day).slice(0, 5) : '',
                  )}
                  height={100}
                  idle="Ustunni bosing yoki ustiga olib boring"
                  describe={(i) =>
                    `${WEEKDAYS[weekdayOf(s.daily[i].day)]}, ${formatDay(s.daily[i].day)}: ${s.daily[i].active_clients} mijoz`
                  }
                  ariaLabel="Kunlar bo‘yicha faol mijozlar"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function ClientsTable({ onOpen }: { onOpen: (id: number) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [days, setDays] = useState<(typeof LIST_PERIODS)[number]>(30);
  const [sort, setSort] = useState<ClientSort>('last_seen');
  const [only, setOnly] = useState<ClientFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const list = useQuery({
    queryKey: ['client-activity-list', query, days, sort, only, page],
    queryFn: () => getClientActivityList({ q: query, days, sort, only, page, size: 30 }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total_count / list.data.size)) : 1;

  return (
    <SectionCard title="Har bir mijoz" subtitle={`Faollik so‘nggi ${days} kunda, bugun bilan. Mijozni bosing — batafsil.`}>
      <div className="space-y-3">
        <label className="flex min-h-[44px] items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface-2 px-3">
          <Search className="h-4 w-4 shrink-0 text-mc-text-3" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kod, ism yoki telefon"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-mc-text outline-none placeholder:text-mc-text-3"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Segmented
            options={['all', 'active', 'inactive'] as const}
            value={only}
            onChange={(v) => {
              setOnly(v);
              setPage(1);
            }}
            label="Filtr"
            render={(v) => ({ all: 'Barchasi', active: 'Faol', inactive: 'Faol emas' })[v]}
          />
          <Segmented
            options={['last_seen', 'active_days', 'active_hours'] as const}
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            label="Saralash"
            render={(v) => ({ last_seen: 'Oxirgi', active_days: 'Kunlar', active_hours: 'Soatlar' })[v]}
          />
          <Segmented
            options={LIST_PERIODS}
            value={days}
            onChange={(v) => {
              setDays(v);
              setPage(1);
            }}
            label="Davr"
            render={(p) => `${p} kun`}
          />
        </div>

        {list.isError ? (
          <ErrorNote onRetry={() => void list.refetch()} />
        ) : !list.data ? (
          <TileSkeleton />
        ) : list.data.items.length === 0 ? (
          <p className="py-8 text-center text-[12px] font-medium text-mc-text-3">Mijoz topilmadi</p>
        ) : (
          <>
            <p className="text-[11px] font-medium tabular-nums text-mc-text-3">{list.data.total_count} ta mijoz</p>
            <ul className="divide-y divide-mc-border overflow-hidden rounded-mc-md border border-mc-border">
              {list.data.items.map((c) => (
                <li key={c.client_id}>
                  <button
                    type="button"
                    onClick={() => onOpen(c.client_id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 bg-mc-surface px-3 py-2.5 text-left active:bg-mc-surface-2 md:grid-cols-[minmax(0,1fr)_170px_90px_90px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-extrabold text-mc-text">
                        {c.code} <span className="font-semibold text-mc-text-2">· {c.full_name}</span>
                      </span>
                      <span
                        className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-mc-text-3 md:hidden"
                        title={c.last_seen_at ? exactTime(c.last_seen_at) : undefined}
                      >
                        {c.online && <span className="h-1.5 w-1.5 rounded-full bg-mc-success" aria-hidden />}
                        {c.online ? 'Online' : formatSeen(c.last_seen_at)}
                      </span>
                    </span>
                    <span
                      className="hidden items-center gap-1.5 text-[12px] font-semibold text-mc-text-2 md:flex"
                      title={c.last_seen_at ? exactTime(c.last_seen_at) : undefined}
                    >
                      {c.online && <span className="h-2 w-2 rounded-full bg-mc-success" aria-hidden />}
                      {c.online ? <span className="text-mc-success-text">Online</span> : formatSeen(c.last_seen_at)}
                    </span>
                    <span className="text-right text-[12px] font-bold tabular-nums text-mc-text">
                      {c.active_days} <span className="font-medium text-mc-text-3">kun</span>
                    </span>
                    <span className="hidden text-right text-[12px] font-bold tabular-nums text-mc-text md:block">
                      {c.active_hours} <span className="font-medium text-mc-text-3">soat</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label="Oldingi sahifa"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-11 w-11 items-center justify-center rounded-mc-md border border-mc-border bg-mc-surface text-mc-text-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[12px] font-semibold tabular-nums text-mc-text-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Keyingi sahifa"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-11 w-11 items-center justify-center rounded-mc-md border border-mc-border bg-mc-surface text-mc-text-2 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

export default function ClientActivityPage() {
  const claims = useMemo(() => getAdminJwtClaims(), []);
  const allowed = claims.isSuperAdmin || claims.permissions.has('statistics:read');
  const canOpenProfile = claims.isSuperAdmin || claims.permissions.has('clients:read');
  const [selected, setSelected] = useState<number | null>(null);
  const setDrawerClient = useManagerStore((st) => st.setSelectedClientId);
  // The drawer's store is shared with the manager page; do not leave it open there.
  useEffect(() => () => setDrawerClient(null), [setDrawerClient]);

  const overview = useQuery({
    queryKey: ['clients-overview'],
    queryFn: getClientsOverview,
    enabled: allowed,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const o = overview.data;

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-mc-text">Mijozlar faolligi</h1>
        <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
          Bot va Mini App orqali: kim hozir online, qachon gavjum, har bir mijoz qachon kiradi
        </p>
      </div>

      {!allowed ? (
        <section className="flex items-start gap-3 rounded-mc-lg border border-mc-border bg-mc-surface p-4 shadow-[var(--mc-shadow-card)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mc-surface-2 text-mc-text-2">
            <Lock className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-mc-text">Ruxsat yo'q</h2>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-mc-text-2">
              Bu sahifani superadmin yoki «Rollar» bo'limida{' '}
              <span className="font-bold text-mc-text">statistics:read</span> huquqi berilgan rol ko'radi.
            </p>
          </div>
        </section>
      ) : (
        <>
          {overview.isError ? (
            <ErrorNote onRetry={() => void overview.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {!o ? (
                Array.from({ length: 5 }, (_, i) => <TileSkeleton key={i} />)
              ) : (
                <>
                  <Tile
                    label="Hozir online"
                    value={String(o.online_count)}
                    hint={`so‘nggi ${Math.round(o.online_seconds / 60)} daqiqada`}
                  />
                  <Tile label="Bugun faol" value={String(o.active_today)} hint="Toshkent vaqti bilan" />
                  <Tile label="7 kunda faol" value={String(o.active_7_days)} hint="bugun bilan" />
                  <Tile label="30 kunda faol" value={String(o.active_30_days)} hint="bugun bilan" />
                  <Tile
                    label="Jami mijozlar"
                    value={String(o.registered_clients)}
                    hint={o.tracking_since ? `kuzatuv ${formatDay(o.tracking_since)}dan` : 'kuzatuv hali boshlanmagan'}
                  />
                </>
              )}
            </div>
          )}

          <SectionCard
            title="Hozir online"
            subtitle={o ? `So‘nggi ${Math.round(o.online_seconds / 60)} daqiqada bot yoki Mini App ishlatganlar` : undefined}
          >
            <div>
              {!o ? (
                <TileSkeleton />
              ) : o.online.length === 0 ? (
                <p className="py-4 text-center text-[12px] font-medium text-mc-text-3">Hozir hech kim online emas</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {o.online.map((c) => (
                    <li key={c.client_id} className="max-w-full">
                      <button
                        type="button"
                        onClick={() => setSelected(c.client_id)}
                        title={exactTime(c.last_seen_at)}
                        className="flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border border-mc-border bg-mc-surface-2 px-3 text-[12px] font-bold text-mc-text active:scale-[0.98]"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mc-success" aria-hidden />
                        <span className="shrink-0">{c.code}</span>
                        <span className="truncate font-medium text-mc-text-2">{c.full_name}</span>
                        <span className="shrink-0 font-medium tabular-nums text-mc-text-3">{formatSeen(c.last_seen_at)}</span>
                      </button>
                    </li>
                  ))}
                  {o.online_count > o.online.length && (
                    <li className="flex items-center px-2 text-[12px] font-semibold text-mc-text-3">
                      va yana {o.online_count - o.online.length} ta
                    </li>
                  )}
                </ul>
              )}
            </div>
          </SectionCard>

          <ActivityAnalytics />
          <ClientsTable onOpen={setSelected} />

          <ClientActivitySheet
            clientId={selected}
            onClose={() => setSelected(null)}
            onOpenProfile={
              canOpenProfile
                ? (id) => {
                    setSelected(null);
                    setDrawerClient(id);
                  }
                : undefined
            }
          />
          <ClientDetailDrawer />
        </>
      )}
    </div>
  );
}
