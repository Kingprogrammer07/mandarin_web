/**
 * The super-admin landing screen.
 *
 * Answers one question — *what needs me today* — and shares no metric with the
 * Statistics page. Statistics owns the period deep-dive (six tabs, ~40
 * aggregates); this owns headline counts, work queues, stuck money and recent
 * activity. The only bridge is the "Statistika" quick action.
 *
 * Load order is part of the design. The status strip, the headline cards and
 * the queue tiles come from two cheap aggregates and paint first; every other
 * block owns its own query, its own three states and its own retry, so a slow
 * or failing section never holds up the rest of the page.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCashierLog } from '@/api/pos';
import {
  getDailyRevenue,
  getDashboardSummary,
  getFlightVolumeSummary,
} from '@/api/services/adminDashboard';
import { getAdminJwtClaims } from '@/api/services/adminManagement';
import { expenseService } from '@/api/services/expenseService';
import { getClientStats } from '@/api/services/stats';
import { ActivityPanel } from '@/components/admin/dashboard/ActivityPanel';
import { ClientStatsGrid } from '@/components/admin/dashboard/ClientStatsGrid';
import {
  EmptyNote,
  SectionCard,
  TileSkeleton,
} from '@/components/admin/dashboard/DashboardPrimitives';
import { KpiRow } from '@/components/admin/dashboard/KpiRow';
import { QuickAccess } from '@/components/admin/dashboard/QuickAccess';
import { RevenueSparkline } from '@/components/admin/dashboard/RevenueSparkline';
import { StuckMoney } from '@/components/admin/dashboard/StuckMoney';
import { SystemStatusStrip } from '@/components/admin/dashboard/SystemStatusStrip';
import { WarehousePanel } from '@/components/admin/dashboard/WarehousePanel';
import { getTashkentDateIso } from '@/lib/format';

const REVENUE_DAYS = 30;

export default function AdminDashboardPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const language = i18n.language;

  // Decoded locally, never by firing a request and reading the 403. The stuck
  // money endpoints are super-admin only, and both statistics endpoints now sit
  // behind `statistics:read`, which is deliberately granted to no role by
  // default — firing those requests anyway would show every ordinary admin two
  // panels stuck on "Yuklanmadi · Qayta urinish" that no retry can fix.
  const { isSuperAdmin, canReadStatistics } = useMemo(() => {
    const claims = getAdminJwtClaims();
    return {
      isSuperAdmin: claims.isSuperAdmin,
      canReadStatistics: claims.isSuperAdmin || claims.permissions.has('statistics:read'),
    };
  }, []);

  // One Tashkent day boundary for everything that says "today". Not
  // `toISOString().slice(0,10)` — in a UTC+5 product that rolls over at 19:00
  // local and would report an empty day all evening.
  const today = getTashkentDateIso();
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);

  const summary = useQuery({
    queryKey: ['admin-dashboard', 'summary'],
    queryFn: getDashboardSummary,
    // Live updates arrive over SSE (`useGlobalEvents` invalidates this key on
    // queue, POS, maintenance, NBU and bot-mode events), so the interval is a
    // slow safety net rather than the primary refresh.
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const volume = useQuery({
    queryKey: ['admin-dashboard', 'flight-volume'],
    queryFn: getFlightVolumeSummary,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const till = useQuery({
    queryKey: ['admin-dashboard', 'cashier-log', today],
    // Explicit instants, not a bare date. The endpoint types both bounds as
    // `datetime` and applies them raw, so `date_from=date_to='2026-08-25'`
    // became `created_at >= midnight AND created_at <= midnight` — a zero-width
    // window that matched nothing and left the provider breakdown empty.
    queryFn: () =>
      getCashierLog({
        page: 1,
        size: 1,
        date_from: `${today}T00:00:00+05:00`,
        date_to: `${today}T23:59:59+05:00`,
      }),
    staleTime: 30_000,
  });

  const expenses = useQuery({
    queryKey: ['admin-dashboard', 'expenses', today],
    queryFn: () => expenseService.getSummary({ date_from: today, date_to: today }),
    staleTime: 60_000,
  });

  const clients = useQuery({
    queryKey: ['admin-dashboard', 'client-stats', monthStart, today],
    queryFn: () => getClientStats(monthStart, today),
    enabled: canReadStatistics,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const revenue = useQuery({
    queryKey: ['admin-dashboard', 'daily-revenue', REVENUE_DAYS],
    queryFn: () => getDailyRevenue(REVENUE_DAYS),
    enabled: canReadStatistics,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-mc-text">
            Boshqaruv paneli
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-mc-text-2">
            Asosiy ko‘rsatkichlar va kunlik nazorat
          </p>
        </div>
      </div>

      <SystemStatusStrip
        flags={summary.data?.flags}
        updatedAt={summary.dataUpdatedAt || undefined}
        isFetching={summary.isFetching}
        onRefresh={refreshAll}
        language={language}
      />

      <KpiRow
        summary={summary.data}
        summaryLoading={summary.isLoading}
        summaryError={summary.isError}
        onSummaryRetry={() => void summary.refetch()}
        volume={volume.data}
        volumeLoading={volume.isLoading}
        volumeError={volume.isError}
        onVolumeRetry={() => void volume.refetch()}
        till={till.data}
        expenseTotal={expenses.data?.total_amount ?? null}
        tillLoading={till.isLoading || expenses.isLoading}
      />

      {/* Mockup row 2: the warehouse and the client base, side by side.
       *
       * A wrapper grid is applied only when BOTH halves will render. An admin
       * without `statistics:read` would otherwise get the warehouse stranded in
       * a half column beside an empty one, which reads as a panel that failed
       * to load. */}
      <div className={canReadStatistics ? 'grid gap-4 xl:grid-cols-2' : ''}>
        <WarehousePanel onNavigate={onNavigate} language={language} />

        {canReadStatistics && (
          <SectionCard
            title="Mijozlar statistikasi"
            subtitle="Hozirgi holat va shu oyda qo‘shilganlar"
            action={{ label: 'Mijozlar →', onClick: () => onNavigate('manager-page') }}
          >
            <ClientStatsGrid
              stats={clients.data}
              isLoading={clients.isLoading}
              isError={clients.isError}
              onRetry={() => void clients.refetch()}
              periodLabel="Shu oy"
            />
          </SectionCard>
        )}
      </div>

      {/* Mockup row 3. Both halves are always rendered, so the grid is static. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ActivityPanel onNavigate={onNavigate} language={language} />
        <QuickAccess onNavigate={onNavigate} />
      </div>

      {/* Below the mockup: the money that is stuck, and what was billed.
       *
       * The work-queue card that used to sit here was removed at the owner's
       * request — the sidebar already leads to every one of those screens, and
       * a second set of links to them was a duplicate, not a summary. */}
      {(isSuperAdmin || canReadStatistics) && (
        <div
          className={isSuperAdmin && canReadStatistics ? 'grid gap-4 xl:grid-cols-2' : ''}
        >
          {isSuperAdmin && <StuckMoney onNavigate={onNavigate} />}

          {canReadStatistics && (
            <SectionCard
              title="Kunlik hisoblangan summa"
              subtitle={`So‘nggi ${REVENUE_DAYS} kun — mijozlarga qancha yozildi. Kassaga tushgan pul emas: yuk narxlangan kunga yoziladi.`}
              action={{ label: 'Statistika →', onClick: () => onNavigate('statistics') }}
            >
              {revenue.isLoading ? (
                <TileSkeleton />
              ) : revenue.isError ? (
                <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-6 text-center">
                  <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
                  <button
                    type="button"
                    onClick={() => void revenue.refetch()}
                    className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
                  >
                    Qayta urinish
                  </button>
                </div>
              ) : revenue.data?.days?.length ? (
                <RevenueSparkline points={revenue.data.days} language={language} />
              ) : (
                // A successful response with no days is not the same as a broken
                // panel, and an empty card body reads as one.
                <EmptyNote text="Bu davr uchun ma’lumot yo‘q" />
              )}
            </SectionCard>
          )}
        </div>
      )}

    </div>
  );
}
