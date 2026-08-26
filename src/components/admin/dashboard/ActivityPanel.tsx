/**
 * "What just happened" across payments, staff actions, clients and cargo.
 *
 * The API returns structured items, not sentences — the wording lives here so
 * the backend holds no display strings. Each row carries a domain badge, which
 * is the only thing that makes a mixed feed readable at a glance.
 *
 * Audit action codes are shown through a label map with a deliberate fallback:
 * the backend writes 57 distinct action strings and no frontend map has ever
 * covered them all, so an unmapped code renders as the raw constant rather than
 * being hidden. A missing translation is a smaller failure than a missing row.
 */

import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Package,
  PackageSearch,
  RotateCw,
  UserCog,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  getRecentActivity,
  type ActivityItem,
  type ActivityKind,
} from '@/api/services/adminDashboard';
import { formatTashkentDateTime, formatUzs, formatWeightKg } from '@/lib/format';

import {
  EmptyNote,
  SectionCard,
  SectionFooterLink,
  TileSkeleton,
} from './DashboardPrimitives';

const KIND_META: Record<
  ActivityKind,
  { badge: string; Icon: LucideIcon; chip: string }
> = {
  payment: {
    badge: 'Kassa',
    Icon: Banknote,
    chip: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  },
  admin_action: {
    badge: 'Xodim',
    Icon: UserCog,
    chip: 'border-mc-border bg-mc-surface-2 text-mc-text-2',
  },
  client_registered: {
    badge: 'Mijozlar',
    Icon: UserPlus,
    chip: 'border-mc-brand/25 bg-mc-brand-soft text-mc-brand',
  },
  cargo_weighed: {
    badge: 'Ombor',
    Icon: Package,
    chip: 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn',
  },
  cargo_expected: {
    badge: 'Kutilmoqda',
    Icon: PackageSearch,
    chip: 'border-mc-border bg-mc-surface-2 text-mc-text-2',
  },
};

/** The audit actions that actually appear in volume, in Uzbek. */
const ACTION_LABELS: Record<string, string> = {
  bulk_mark_cargo_taken: 'Yuklar topshirildi',
  undo_takeaway: 'Topshirish bekor qilindi',
  POS_BULK_PAYMENT: 'Kassada to‘lov qabul qilindi',
  PICKUP_QUEUE_READY: 'Navbat tayyor deb belgilandi',
  CREATED_DELIVERY_REQUEST: 'Zayavka yaratildi',
  CREATED_CLIENT: 'Mijoz qo‘shildi',
  UPDATED_CLIENT: 'Mijoz ma’lumoti o‘zgartirildi',
  WAREHOUSE_UZPOST_PRINTER_JOB_CREATED: 'UzPost yorlig‘i chop etishga yuborildi',
  ADMIN_UZPOST_AUTO_RELEASE: 'UzPost avtomatik topshirildi',
  ADMIN_UZPOST_AUTO_RELEASE_STARTED: 'UzPost avtomatik topshirish boshlandi',
  LOGIN_FAILED: 'Tizimga kirish urinishi muvaffaqiyatsiz',
};

function describe(item: ActivityItem): string {
  switch (item.kind) {
    case 'payment':
      return [
        item.amount_uzs !== null ? formatUzs(item.amount_uzs) : 'To‘lov',
        item.provider,
        item.flight_name,
        item.client_code,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'admin_action':
      return ACTION_LABELS[item.action ?? ''] ?? item.action ?? '—';
    case 'client_registered':
      return [item.client_name, item.client_code].filter(Boolean).join(' · ');
    case 'cargo_weighed':
      return [
        item.flight_name,
        item.client_code,
        item.weight_kg !== null ? formatWeightKg(item.weight_kg) : null,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'cargo_expected':
      return [
        item.flight_name,
        item.client_code,
        item.count !== null ? `${item.count} trek kod` : null,
      ]
        .filter(Boolean)
        .join(' · ');
  }
}

export function ActivityPanel({
  onNavigate,
  language,
}: {
  onNavigate: (page: string) => void;
  language?: string;
}) {
  const feed = useQuery({
    queryKey: ['admin-dashboard', 'activity', 10],
    queryFn: () => getRecentActivity(10),
    staleTime: 60_000,
  });

  return (
    <SectionCard
      title="So‘nggi faoliyat"
      subtitle="To‘lovlar, xodimlar, mijozlar va yuklar"
      footer={
        <div className="flex items-center">
          <SectionFooterLink
            label="Barcha faoliyat"
            onClick={() => onNavigate('admin-audit')}
          />
        </div>
      }
    >
      {feed.isLoading ? (
        <div className="space-y-2">
          <TileSkeleton />
          <TileSkeleton />
        </div>
      ) : feed.isError ? (
        <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-5 text-center">
          <p className="text-[12px] font-semibold text-mc-text-3">Yuklanmadi</p>
          <button
            type="button"
            onClick={() => void feed.refetch()}
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
          >
            <RotateCw className="h-3 w-3" strokeWidth={2.2} />
            Qayta urinish
          </button>
        </div>
      ) : !feed.data || feed.data.items.length === 0 ? (
        <EmptyNote text="Hozircha harakat yo‘q" />
      ) : (
        <ul className="space-y-1">
          {feed.data.items.map((item, index) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.Icon;
            const sentence = describe(item);
            const meta_line = `${item.actor ?? 'Tizim'} · ${formatTashkentDateTime(item.at, language)}`;
            return (
              <li
                key={`${item.kind}-${item.at}-${index}`}
                className="flex items-center gap-2.5 rounded-mc-sm bg-mc-surface-2 p-2"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface"
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4 text-mc-text-2" strokeWidth={2} />
                </span>

                <span className="min-w-0 flex-1">
                  {/* A payment sentence runs to ~50 characters and the row has
                      ~33 on a phone, so the sentence is the first thing lost. */}
                  <span
                    className="block truncate text-[12px] font-bold text-mc-text"
                    title={sentence}
                  >
                    {sentence}
                  </span>
                  <span
                    className="block truncate text-[11px] font-medium text-mc-text-3"
                    title={meta_line}
                  >
                    {meta_line}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${meta.chip}`}
                >
                  {meta.badge}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {feed.data && feed.data.forbidden.length > 0 && (
        // Not every quiet domain is quiet — some were never queried.
        <p className="mt-2 border-t border-mc-border pt-2 text-[10px] font-medium text-mc-text-3">
          Ruxsat yo‘qligi uchun ko‘rsatilmadi: {feed.data.forbidden.join(', ')}
        </p>
      )}
    </SectionCard>
  );
}
