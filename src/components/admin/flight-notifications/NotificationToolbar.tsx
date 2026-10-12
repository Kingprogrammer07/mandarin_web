import { useId, useRef, type Ref } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bot,
  Clock,
  Globe,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import type { NotificationSummary } from "@/api/services/flightNotifications";
import { cn } from "@/lib/utils";

import {
  NOTIFICATION_FILTERS,
  type NotificationFilter,
} from "./notificationFilters";
import { ChannelCheckbox } from "./SelectionControls";

type ChipTone = "neutral" | "warn" | "brand" | "success";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-mc-surface-2 text-mc-text-2",
  warn: "bg-mc-warn-soft text-mc-warn",
  brand: "bg-mc-brand-soft text-mc-brand",
  success: "bg-mc-success/12 text-mc-success",
};

const SECONDARY_BUTTON =
  "flex h-11 flex-[1_1_auto] items-center justify-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none";

function StatChip({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: ChipTone;
  children: string;
}) {
  return (
    <li
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold tabular-nums",
        CHIP_TONE[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </li>
  );
}

interface NotificationToolbarProps {
  summary: NotificationSummary | null;
  /** The first summary is still on its way — stat placeholders pulse meanwhile. */
  isLoadingSummary: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filter: NotificationFilter;
  onFilterChange: (value: NotificationFilter) => void;
  markWeb: boolean;
  markBot: boolean;
  onMarkWebChange: (checked: boolean) => void;
  onMarkBotChange: (checked: boolean) => void;
  onSelectPending: () => void;
  onAddForgotten: () => void;
  /** The forgotten-cargo dialog hands the focus back to this button. */
  addForgottenRef?: Ref<HTMLButtonElement>;
  isOstatka: boolean;
}

export function NotificationToolbar({
  summary,
  isLoadingSummary,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  markWeb,
  markBot,
  onMarkWebChange,
  onMarkBotChange,
  onSelectPending,
  onAddForgotten,
  addForgottenRef,
  isOstatka,
}: NotificationToolbarProps) {
  const searchId = useId();
  const channelLabelId = useId();
  const channelErrorId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const noChannel = !markWeb && !markBot;

  const clearSearch = () => {
    onSearchChange("");
    // The clear button unmounts with the text; without this, keyboard focus
    // would fall back to the top of the page.
    searchRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      {summary ? (
        <ul aria-label="Reys bo'yicha holat" className="flex flex-wrap gap-1.5">
          <StatChip icon={Users} tone="neutral">
            {`${summary.total_clients} ta mijoz`}
          </StatChip>
          <StatChip icon={Clock} tone="warn">
            {`${summary.pending_count} kutmoqda`}
          </StatChip>
          <StatChip icon={Bot} tone="brand">
            {`${summary.bot_sent_count} bot`}
          </StatChip>
          <StatChip icon={Globe} tone="success">
            {`${summary.web_sent_count} web`}
          </StatChip>
        </ul>
      ) : (
        isLoadingSummary && (
          <div aria-hidden="true" className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className="h-7 w-20 rounded-full bg-mc-surface-2 motion-safe:animate-pulse"
              />
            ))}
          </div>
        )
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">
            Mijoz kodini qidirish
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3"
          />
          <input
            ref={searchRef}
            id={searchId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Mijoz kodini qidirish"
            className="h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface pl-9 pr-11 text-base text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Qidiruvni tozalash"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="Holat bo'yicha filtr"
          className="grid grid-cols-3 gap-2 sm:w-80 sm:shrink-0"
        >
          {NOTIFICATION_FILTERS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(key)}
                className={cn(
                  "h-11 min-w-0 rounded-mc-sm border px-1 text-[13px] font-bold transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none",
                  isActive
                    ? "border-mc-brand bg-mc-brand text-mc-on-brand"
                    : "border-mc-border bg-mc-surface text-mc-text-2",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Below 360px the icons give way so both actions share one row; the
          labels alone still say what each does. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectPending}
          disabled={!summary}
          aria-label="Yuborilmaganlarning hammasini tanlash"
          title="Yuborilmaganlarning hammasini tanlash"
          className={SECONDARY_BUTTON}
        >
          <Clock
            className="h-4 w-4 shrink-0 text-mc-warn max-[359px]:hidden"
            aria-hidden="true"
          />
          Yuborilmaganlar
        </button>
        <button
          ref={addForgottenRef}
          type="button"
          onClick={onAddForgotten}
          disabled={isOstatka}
          className={SECONDARY_BUTTON}
        >
          <Plus
            className="h-4 w-4 shrink-0 text-mc-brand max-[359px]:hidden"
            aria-hidden="true"
          />
          Unutilgan yuk
        </button>
      </div>

      <div
        role="group"
        aria-labelledby={channelLabelId}
        aria-describedby={noChannel ? channelErrorId : undefined}
        className="flex flex-wrap items-center gap-2"
      >
        <span
          id={channelLabelId}
          className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3"
        >
          Kanal
        </span>
        <ChannelCheckbox
          label="Web"
          icon={Globe}
          checked={markWeb}
          onCheckedChange={onMarkWebChange}
        />
        <ChannelCheckbox
          label="Bot"
          icon={Bot}
          checked={markBot}
          onCheckedChange={onMarkBotChange}
        />
        {noChannel && (
          <p
            id={channelErrorId}
            role="alert"
            className="flex basis-full items-center gap-1.5 text-[12px] font-bold text-mc-danger"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Kamida bittasini tanlang
          </p>
        )}
      </div>
    </div>
  );
}
