/**
 * "Onlayn to'lov cheklari" — receipts waiting for the cashier's decision.
 *
 * Two tabs, flight and zayavka, because they are two different jobs: a flight
 * receipt is checked against cargo, a zayavka receipt against a delivery order.
 * The split already existed in the old console and in the database
 * (`pos_notifications.source`); it is carried over rather than rebuilt.
 *
 * The tab is called "Zayavka", not "UzPost". The cashier log labels every
 * delivery payment `uzpost` even when the courier was BTS, Yandex or Mandarin —
 * 55% of delivery requests are not UzPost — so that word on a tab would be
 * wrong for most of what the tab contains.
 *
 * The mockup prints a "Chek raqami" on every card. There is no such field:
 * `pos_notifications` stores an image key, not a bank reference number. The
 * card carries what actually identifies the payment — the flight, or the
 * zayavka number — and the receipt image itself is one tap away.
 */

import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Paperclip,
  Pencil,
  RotateCw,
  X,
} from 'lucide-react';

import type {
  NotificationFilters,
  PosNotificationItem,
} from '@/api/services/posNotificationService';
import { formatTashkentDateTime, formatUzs } from '@/lib/format';
import { triggerSoftHaptic } from '@/utils/haptics';

import { ReceiptFilters } from './ReceiptFilters';
import { PER_PAGE_OPTIONS } from './receiptTabs';
import { RECEIPT_TABS, type ReceiptTab } from './receiptTabs';

const STATUS_META: Record<
  PosNotificationItem['payment_status'],
  { label: string; chip: string }
> = {
  pending: {
    label: 'Yangi',
    chip: 'border-mc-success/25 bg-mc-success/12 text-mc-success',
  },
  partial: {
    label: 'Qisman',
    chip: 'border-mc-warn/25 bg-mc-warn-soft text-mc-warn',
  },
  paid: {
    label: 'To‘langan',
    chip: 'border-mc-border bg-mc-surface-2 text-mc-text-2',
  },
  rejected: {
    label: 'Rad etilgan',
    chip: 'border-mc-danger/25 bg-mc-danger-soft text-mc-danger',
  },
};

function ReceiptCard({
  item,
  isBusy,
  canEdit,
  onConfirm,
  onReject,
  onEdit,
  onOpen,
}: {
  item: PosNotificationItem;
  isBusy: boolean;
  /** `pos:process` — the same permission the edit endpoint requires. */
  canEdit: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: () => void;
  onOpen: () => void;
}) {
  const meta = STATUS_META[item.payment_status];
  const hasReceipt = Boolean(item.receipt_s3_key);
  const isSettled = item.payment_status === 'paid';
  const isRejected = item.payment_status === 'rejected';
  const name = item.client_name?.trim() || item.client_code;
  const reference =
    item.source === 'zayafka' && item.delivery_request_id
      ? `Zayavka #${item.delivery_request_id}`
      : item.flight_name;

  return (
    <li className="border-t border-mc-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2.5">
        {/*
          Whether a receipt image is attached is the first thing the cashier
          needs, and it was nowhere on the card — every row looked identical, so
          finding the one with proof meant tapping each in turn and waiting for
          a toast saying there was none.
        */}
        <button
          type="button"
          onClick={() => {
            triggerSoftHaptic();
            onOpen();
          }}
          title={
            hasReceipt ? 'Chek rasmini ochish' : 'Bu to‘lovga chek biriktirilmagan'
          }
          className={`min-w-0 flex-1 rounded-mc-sm text-left ${
            hasReceipt ? '' : 'cursor-default'
          }`}
        >
          {/*
            Code and flight lead, the name follows.
            
            A cashier matches a receipt against cargo, and cargo is keyed by
            client code and flight — the name is how they greet the person, not
            how they find the payment. It was the other way round, so the two
            fields that identify the row were the two smallest on the card.
          */}
          <span className="flex items-baseline justify-between gap-2">
            <span
              className="truncate text-[13px] font-extrabold tabular-nums text-mc-text"
              title={item.client_code}
            >
              {item.client_code}
            </span>
            <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-mc-text">
              {formatUzs(item.amount_paid)}
            </span>
          </span>

          <span
            className="mt-0.5 block truncate text-[12px] font-bold text-mc-text-2"
            title={reference}
          >
            {reference}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-extrabold ${
                hasReceipt
                  ? 'border-mc-success/25 bg-mc-success/12 text-mc-success'
                  : 'border-mc-border bg-mc-surface-2 text-mc-text-3'
              }`}
            >
              {hasReceipt ? (
                <Paperclip className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <ImageOff className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              )}
              {hasReceipt ? 'Chek bor' : 'Chek yo‘q'}
            </span>
            {item.payment_type && (
              <span className="rounded-full border border-mc-brand/25 bg-mc-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-mc-brand">
                {item.payment_type}
              </span>
            )}
            <span className="text-[11px] font-semibold tabular-nums text-mc-text-2">
              {formatTashkentDateTime(item.created_at)}
            </span>
          </span>

          <span
            className="mt-1 block truncate text-[11px] font-medium text-mc-text-3"
            title={name}
          >
            {name}
          </span>

          {item.admin_comment && (
            <span
              className="mt-0.5 block truncate text-[11px] font-medium text-mc-text-3"
              title={item.admin_comment}
            >
              Izoh: {item.admin_comment}
            </span>
          )}
        </button>

        <div className="flex w-[96px] shrink-0 flex-col items-stretch gap-1.5 sm:w-[112px]">
          <span
            className={`rounded-full border px-1.5 py-0.5 text-center text-[10px] font-extrabold ${meta.chip}`}
          >
            {meta.label}
          </span>

          {/*
            A settled receipt has nothing left to confirm — what it can still
            need is a correction, which is also the only place the edit API's
            `notification_id` is available. A rejected one is terminal and
            offers neither.
          */}
          {isSettled ? (
            canEdit && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  triggerSoftHaptic();
                  onEdit();
                }}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-mc-sm border border-mc-border bg-mc-surface-2 text-[11px] font-bold text-mc-text-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                Tahrirlash
              </button>
            )
          ) : isRejected ? null : (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  triggerSoftHaptic();
                  onConfirm();
                }}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-mc-sm bg-mc-brand text-[11px] font-extrabold text-mc-on-brand transition-transform active:scale-95 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                Tasdiqlash
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  triggerSoftHaptic();
                  onReject();
                }}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-mc-sm border border-mc-danger/30 text-[11px] font-bold text-mc-danger transition-transform active:scale-95 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                Rad etish
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function ReceiptQueue({
  items,
  total,
  counts,
  page,
  perPage,
  onPage,
  onPerPage,
  activeTab,
  onTabChange,
  filters,
  defaultFilters,
  onFilters,
  onResetFilters,
  isLoading,
  isError,
  isRefetching,
  onRefresh,
  onConfirm,
  onReject,
  onEdit,
  onOpen,
  canEdit,
  busyId,
}: {
  items: PosNotificationItem[];
  total: number;
  /** Pending count per tab, so the inactive one is not silently empty. */
  counts: Record<ReceiptTab, number>;
  page: number;
  perPage: number;
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
  activeTab: ReceiptTab;
  onTabChange: (tab: ReceiptTab) => void;
  filters: NotificationFilters;
  defaultFilters: NotificationFilters;
  onFilters: (next: NotificationFilters) => void;
  onResetFilters: () => void;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onConfirm: (item: PosNotificationItem) => void;
  onReject: (item: PosNotificationItem) => void;
  onEdit: (item: PosNotificationItem) => void;
  onOpen: (item: PosNotificationItem) => void;
  /** `pos:process` — gates the edit action on settled receipts. */
  canEdit: boolean;
  /** Id of the receipt whose decision is in flight, so only that card locks. */
  busyId: number | null;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <section className="flex h-full min-h-0 flex-col rounded-mc-lg border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-mc-border px-3 pb-2.5 pt-3">
        <h2 className="text-[15px] font-extrabold tracking-tight text-mc-text">
          Onlayn to‘lov cheklari
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Yangilash"
          className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
        >
          <RotateCw
            className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
        </button>
      </div>

      {/*
        Plain buttons with `aria-pressed`, not role="tab".
        The ARIA tab pattern also requires ids, aria-controls, a labelled
        tabpanel, roving tabIndex and arrow-key handling; announcing the role
        without them tells a screen-reader user a relationship exists and then
        gives them no way to follow it. `aria-pressed` describes exactly what
        these are, and is what PeriodPicker already uses for the same choice.
      */}
      <div className="flex shrink-0 gap-2 px-3 pt-2.5">
        {RECEIPT_TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                triggerSoftHaptic();
                onTabChange(key);
              }}
              className={`h-11 flex-1 rounded-mc-sm border text-[12px] font-bold transition-colors ${
                isActive
                  ? 'border-mc-brand bg-mc-brand-soft text-mc-brand'
                  : 'border-mc-border bg-mc-surface-2 text-mc-text-2'
              }`}
            >
              {label}
              {/*
                Shown on BOTH tabs. With the badge only on the active one, a
                cashier working the flight queue had no signal that zayavka
                receipts had arrived — the tab looked the same holding zero or
                twenty payments a client was already waiting on.
              */}
              {count > 0 && (
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/*
        ONE scroll region for the filters AND the list.

        They were two siblings before, and flexbox shrank the filter wrapper
        below its content while nothing clipped the overflow — so an expanded
        filter painted straight over the receipt rows. Two boxes competing for
        the same vertical space is the whole bug; sharing one scroll context
        removes the competition rather than tuning it.
      */}
      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ReceiptFilters
          filters={filters}
          defaultFilters={defaultFilters}
          onChange={onFilters}
          onReset={onResetFilters}
        />

        <div className="p-3">
        {isLoading && items.length === 0 ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-[104px] animate-pulse rounded-mc-md bg-mc-surface-2" />
            <div className="h-[104px] animate-pulse rounded-mc-md bg-mc-surface-2" />
          </div>
        ) : isError ? (
          /*
            A failed fetch must never render as an empty queue. `items` falls
            back to [], so without this branch a 500 or an expired token told
            the cashier there was nothing to confirm while clients waited on
            payments they had already made.
          */
          <div
            role="alert"
            className="rounded-mc-md border border-mc-danger/25 bg-mc-danger-soft px-3 py-6 text-center"
          >
            <p className="text-[12px] font-semibold text-mc-danger">
              Cheklar yuklanmadi
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-1 inline-flex min-h-[44px] items-center text-[12px] font-bold text-mc-danger underline active:scale-95"
            >
              Qayta urinish
            </button>
          </div>
        ) : items.length === 0 && page > totalPages ? (
          /*
            Confirming receipts removes them from a status-filtered queue, so a
            cashier working page 3 of "pending" empties it under their own feet.
            Rendering "no receipts to confirm" there is the one message that
            must never be shown falsely — it is a statement that the work is
            done, while clients wait on money they have already sent.
          */
          <div className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-6 text-center">
            <p className="text-[12px] font-medium text-mc-text-2">
              {page}-sahifa bo‘sh — bu ro‘yxatda {totalPages} ta sahifa bor
            </p>
            <button
              type="button"
              onClick={() => onPage(1)}
              className="mt-1 min-h-[44px] text-[12px] font-bold text-mc-brand active:scale-95"
            >
              Birinchi sahifaga qaytish
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-8 text-center text-[12px] font-medium text-mc-text-2">
            {activeTab === 'flight'
              ? 'Tasdiq kutayotgan reys cheki yo‘q'
              : 'Tasdiq kutayotgan zayavka cheki yo‘q'}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <ReceiptCard
                key={item.id}
                item={item}
                isBusy={busyId === item.id}
                canEdit={canEdit}
                onConfirm={() => onConfirm(item)}
                onReject={() => onReject(item)}
                onEdit={() => onEdit(item)}
                onOpen={() => onOpen(item)}
              />
            ))}
          </ul>
        )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-mc-border px-3 py-2">
        {/*
          How many receipts a page is a working preference, not a constant: at a
          quiet counter three at a time keeps the whole card visible without
          scrolling, and on a busy day the same cashier wants twenty.
        */}
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-mc-text-2">
            Sahifada
          </span>
          {/* 16px: below that iOS zooms on focus and does not zoom back. */}
          <select
            value={perPage}
            onChange={(event) => onPerPage(Number(event.target.value))}
            aria-label="Sahifadagi cheklar soni"
            className="h-9 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-1.5 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand"
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Oldingi sahifa"
            className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
          </button>

          <span className="text-[11px] font-semibold tabular-nums text-mc-text-2">
            {page} / {totalPages} · jami {total} ta
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="Keyingi sahifa"
            className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 active:scale-95 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        )}
      </div>
    </section>
  );
}
