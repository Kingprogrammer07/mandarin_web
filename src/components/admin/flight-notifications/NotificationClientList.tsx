import type { ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FilterX,
  RefreshCw,
  Users,
} from "lucide-react";

import type { ClientNotificationStatus } from "@/api/services/flightNotifications";
import { cn } from "@/lib/utils";

import { NotificationClientRow } from "./NotificationClientRow";
import { PAGE_SIZE, type SelectionState } from "./notificationFilters";
import { SelectionMark } from "./SelectionControls";

const SKELETON_ROWS = 6;

const ACTION_BUTTON =
  "flex h-11 items-center justify-center gap-2 rounded-mc-sm px-4 text-[13px] font-extrabold transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none";

const PAGER_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border bg-mc-surface text-mc-text-2 transition-transform duration-150 active:scale-95 disabled:opacity-40 motion-reduce:transition-none";

export type ListStatus = "loading" | "error" | "ready";

function SkeletonRows() {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">Mijozlar yuklanmoqda</span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center gap-3 rounded-mc-md border border-mc-border bg-mc-surface px-3 py-3"
        >
          <span className="h-6 w-6 shrink-0 rounded-full bg-mc-surface-2 motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-4 w-24 rounded-mc-sm bg-mc-surface-2 motion-safe:animate-pulse" />
            <span className="block h-3 w-44 max-w-full rounded-mc-sm bg-mc-surface-2 motion-safe:animate-pulse" />
          </span>
          <span className="h-5 w-20 shrink-0 rounded-full bg-mc-surface-2 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ListMessage({
  icon: Icon,
  tone,
  title,
  text,
  action,
  role,
}: {
  icon: LucideIcon;
  tone: "neutral" | "danger";
  title: string;
  text: string;
  action: ReactNode;
  role?: "alert";
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center gap-3 rounded-mc-lg border border-mc-border bg-mc-surface px-4 py-8 text-center"
    >
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-mc-md",
          tone === "danger"
            ? "bg-mc-danger-soft text-mc-danger"
            : "bg-mc-surface-2 text-mc-text-2",
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="max-w-sm">
        <p className="text-[15px] font-extrabold text-mc-text">{title}</p>
        <p className="mt-1 break-words text-[12px] font-medium leading-relaxed text-mc-text-2">
          {text}
        </p>
      </div>
      {action}
    </div>
  );
}

interface NotificationClientListProps {
  status: ListStatus;
  errorMessage: string | null;
  onRetry: () => void;
  /** Every client of the flight, before filtering. */
  totalClients: number;
  /** How many clients match the current filter and search. */
  matchingCount: number;
  pageClients: ClientNotificationStatus[];
  selected: ReadonlySet<string>;
  selectionState: SelectionState;
  onToggleClient: (clientId: string) => void;
  onToggleAll: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  listTopRef: Ref<HTMLElement>;
  /** Keeps the list's top clear of the app's fixed navigation bar when a page change scrolls to it. */
  scrollMarginClassName: string;
}

export function NotificationClientList({
  status,
  errorMessage,
  onRetry,
  totalClients,
  matchingCount,
  pageClients,
  selected,
  selectionState,
  onToggleClient,
  onToggleAll,
  page,
  totalPages,
  onPageChange,
  onClearFilters,
  listTopRef,
  scrollMarginClassName,
}: NotificationClientListProps) {
  let body: ReactNode;
  if (status === "loading") {
    body = <SkeletonRows />;
  } else if (status === "error") {
    body = (
      <ListMessage
        role="alert"
        icon={AlertCircle}
        tone="danger"
        title="Mijozlar ro'yxatini yuklab bo'lmadi"
        text={errorMessage ?? "Ma'lumotlarni yuklab bo'lmadi"}
        action={
          <button
            type="button"
            onClick={onRetry}
            className={cn(ACTION_BUTTON, "bg-mc-brand text-mc-on-brand")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Qayta urinish
          </button>
        }
      />
    );
  } else if (totalClients === 0) {
    body = (
      <ListMessage
        icon={Users}
        tone="neutral"
        title="Bu reysda mijozlar yo'q"
        text="Reysga yuk biriktirilgach, mijozlar shu yerda ko'rinadi."
        action={
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              ACTION_BUTTON,
              "border border-mc-border bg-mc-surface text-mc-text",
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Yangilash
          </button>
        }
      />
    );
  } else if (matchingCount === 0) {
    body = (
      <ListMessage
        icon={FilterX}
        tone="neutral"
        title="Mos mijoz topilmadi"
        text="Qidiruv yoki tanlangan holatga mos mijoz yo'q."
        action={
          <button
            type="button"
            onClick={onClearFilters}
            className={cn(
              ACTION_BUTTON,
              "border border-mc-border bg-mc-surface text-mc-text",
            )}
          >
            <FilterX className="h-4 w-4" aria-hidden="true" />
            Filtrni tozalash
          </button>
        }
      />
    );
  } else {
    const firstIndex = (page - 1) * PAGE_SIZE + 1;
    const lastIndex = firstIndex + pageClients.length - 1;
    const allChecked =
      selectionState === "all"
        ? true
        : selectionState === "some"
          ? "mixed"
          : false;
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={allChecked}
            onClick={onToggleAll}
            className="-ml-1 flex h-11 items-center gap-2.5 rounded-mc-sm px-1 text-[13px] font-bold text-mc-text transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none"
          >
            <SelectionMark checked={allChecked} />
            <span>
              Barchasini tanlash{" "}
              <span className="tabular-nums text-mc-text-3">
                ({matchingCount})
              </span>
            </span>
          </button>
          <span className="text-[11px] font-semibold tabular-nums text-mc-text-3">
            {firstIndex}–{lastIndex} / {matchingCount}
          </span>
        </div>

        <ul aria-label="Mijozlar" className="space-y-2">
          {pageClients.map((client) => (
            <li key={client.client_id}>
              <NotificationClientRow
                client={client}
                isSelected={selected.has(client.client_id)}
                onToggle={onToggleClient}
              />
            </li>
          ))}
        </ul>

        {totalPages > 1 && (
          <nav
            aria-label="Sahifalar"
            className="flex items-center justify-center gap-3 pt-1"
          >
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Oldingi sahifa"
              className={PAGER_BUTTON}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-16 text-center text-[13px] font-bold tabular-nums text-mc-text-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Keyingi sahifa"
              className={PAGER_BUTTON}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        )}
      </>
    );
  }

  return (
    <section
      ref={listTopRef}
      // A landing spot for the focus once the send dialog closes: the send
      // button is disabled by then, and <body> would lose the operator's place.
      tabIndex={-1}
      aria-label="Mijozlar ro'yxati"
      className={cn("space-y-2", scrollMarginClassName)}
    >
      {body}
    </section>
  );
}
