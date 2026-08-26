/**
 * Payments the system took but never finished — the two backlogs that cost real
 * money while nobody is looking.
 *
 * Super-admin only, gated on the local JWT decode rather than by firing the
 * request and catching a 403: both endpoints sit behind `_require_system_admin`,
 * and an ordinary admin would otherwise watch two tiles break on every load.
 *
 * The UzPost count is split rather than shown raw. `has_approved_sibling` rows
 * are harmless shadows of an already-approved request for the same client and
 * flight; folding them into one number turns a handful of real problems into an
 * alarming figure nobody can act on.
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';

import { systemService } from '@/api/services/systemService';
import { formatUzs } from '@/lib/format';

import { EmptyNote, MetricRow, SectionCard, TileSkeleton } from './DashboardPrimitives';

/** The endpoints clamp `limit` to 500, so ask for the whole allowance. */
const PAGE_LIMIT = 500;

function ageLabel(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} daq`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} soat`;
  return `${Math.round(seconds / 86_400)} kun`;
}

/**
 * `count` saturates at the page limit; `total` is the real backlog. `total` is
 * optional because the SPA deploys independently of the backend — an older
 * server does not send it yet.
 */
function backlogLabel(total: number | undefined, count: number): string {
  const real = total ?? count;
  return real > count ? `${real} (${count} ko‘rsatilmoqda)` : String(real);
}

/**
 * NBU order ids are `uuid4()` (see `payments_nbu.py`), and 36 characters have
 * never fitted this row at any width — the desktop layout loses the last 146px
 * of it. An ellipsed UUID identifies nothing, so only the first block is shown:
 * enough to match the row against the full list on the Tizim screen the header
 * link opens. The whole id stays in `title` for a pointer.
 */
function shortOrderId(orderId: string): string {
  const head = orderId.split('-')[0];
  return head.length < orderId.length ? `${head}…` : orderId;
}

export function StuckMoney({ onNavigate }: { onNavigate: (page: string) => void }) {
  const nbu = useQuery({
    queryKey: ['admin-dashboard', 'nbu-pending'],
    queryFn: () => systemService.getNbuPending(PAGE_LIMIT),
    staleTime: 60_000,
  });

  const uzpost = useQuery({
    queryKey: ['admin-dashboard', 'uzpost-pending'],
    queryFn: () => systemService.listUzpostPending(PAGE_LIMIT),
    staleTime: 60_000,
  });

  const realProblems = (uzpost.data?.rows ?? []).filter(
    (row) => row.is_paid && !row.has_approved_sibling,
  );
  const shadows = (uzpost.data?.rows ?? []).filter((row) => row.has_approved_sibling);

  return (
    <SectionCard
      title="Muammoli to‘lovlar"
      subtitle="Pul olingan, jarayon tugamagan"
      action={{ label: 'Tizim →', onClick: () => onNavigate('system-settings') }}
    >
      {/* `grid-cols-1`, not an implicit `auto` column. Each tile holds a row
          whose label is a 36-character UUID on one unbreakable line, so an auto
          column took ~420px of min-content and pushed the right-hand tile off
          the screen — the "layoutdan chiqib ketgan" the owner reported. It only
          shows with rows present; the empty state fits anywhere. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-mc-text">
              <Clock className="h-3.5 w-3.5 text-mc-danger" strokeWidth={2.2} />
              NBU: to‘lov osilib qolgan
            </span>
            {nbu.data && (
              <span className="text-[15px] font-extrabold tabular-nums text-mc-danger">
                {backlogLabel(nbu.data.total, nbu.data.count)}
              </span>
            )}
          </div>

          {nbu.isLoading ? (
            <TileSkeleton />
          ) : nbu.isError ? (
            <RetryNote onRetry={() => void nbu.refetch()} />
          ) : nbu.data && nbu.data.rows.length === 0 ? (
            <EmptyNote text="Osilib qolgan to‘lov yo‘q" />
          ) : (
            nbu.data?.rows.slice(0, 3).map((row) => (
              <MetricRow
                key={row.id}
                label={`${shortOrderId(row.order_id)} · ${ageLabel(row.age_seconds)}`}
                title={`${row.order_id} · ${ageLabel(row.age_seconds)}`}
                value={formatUzs(row.amount_uzs)}
                tone={(row.age_seconds ?? 0) > 3600 ? 'danger' : 'quiet'}
              />
            ))
          )}
        </div>

        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-mc-text">
              <AlertTriangle className="h-3.5 w-3.5 text-mc-danger" strokeWidth={2.2} />
              UzPost: jo‘natilmagan
            </span>
            {uzpost.data && (
              <span className="text-[15px] font-extrabold tabular-nums text-mc-danger">
                {realProblems.length}
              </span>
            )}
          </div>

          {uzpost.isLoading ? (
            <TileSkeleton />
          ) : uzpost.isError ? (
            <RetryNote onRetry={() => void uzpost.refetch()} />
          ) : realProblems.length === 0 ? (
            <EmptyNote text="To‘langan, lekin yaratilmagan zayavka yo‘q" />
          ) : (
            realProblems.slice(0, 3).map((row) => (
              <MetricRow
                key={row.delivery_request_id}
                label={`${row.client_code ?? '—'} · ${ageLabel(row.age_seconds)}`}
                value={row.amount_uzs === null ? '—' : formatUzs(row.amount_uzs)}
                tone="danger"
              />
            ))
          )}

          {uzpost.data && (
            <p className="mt-2 border-t border-mc-border pt-2 text-[10px] font-medium text-mc-text-3">
              Jami kutayotgan: {backlogLabel(uzpost.data.total, uzpost.data.count)} ·{' '}
              shundan {shadows.length} tasi allaqachon tasdiqlangan zayavka
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function RetryNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-mc-md border border-mc-border bg-mc-surface px-3 py-3 text-center">
      <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
      >
        Qayta urinish
      </button>
    </div>
  );
}
