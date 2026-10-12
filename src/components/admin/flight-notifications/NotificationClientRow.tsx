import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, Clock, Globe, MessageCircleOff } from "lucide-react";

import type { ClientNotificationStatus } from "@/api/services/flightNotifications";
import { cn } from "@/lib/utils";

import { SelectionMark } from "./SelectionControls";

function StatusChip({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className: string;
  children: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

interface NotificationClientRowProps {
  client: ClientNotificationStatus;
  isSelected: boolean;
  onToggle: (clientId: string) => void;
}

/**
 * One client of the flight. The whole row is a single checkbox control, so a
 * tap anywhere on it — or Space/Enter from the keyboard — selects the client.
 */
export const NotificationClientRow = memo(function NotificationClientRow({
  client,
  isSelected,
  onToggle,
}: NotificationClientRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      onClick={() => onToggle(client.client_id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-mc-md border px-3 py-3 text-left transition-transform duration-150 active:scale-[0.99] motion-reduce:transition-none",
        isSelected
          ? "border-mc-brand bg-mc-surface ring-1 ring-inset ring-mc-brand"
          : "border-mc-border bg-mc-surface",
      )}
    >
      <SelectionMark checked={isSelected} />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* The client code is an identifier: it wraps, it is never cut. */}
          <span className="break-words text-[15px] font-extrabold leading-tight text-mc-text">
            {client.client_id}
          </span>
          {!client.telegram_id && (
            <StatusChip
              icon={MessageCircleOff}
              className="bg-mc-danger-soft text-mc-danger"
            >
              TG yo'q
            </StatusChip>
          )}
          <span className="ml-auto flex flex-wrap justify-end gap-1">
            {!client.is_sent && (
              <StatusChip icon={Clock} className="bg-mc-warn-soft text-mc-warn">
                Kutmoqda
              </StatusChip>
            )}
            {client.is_sent_bot && (
              <StatusChip icon={Bot} className="bg-mc-brand-soft text-mc-brand">
                Bot
              </StatusChip>
            )}
            {client.is_sent_web && (
              <StatusChip
                icon={Globe}
                className="bg-mc-success/12 text-mc-success"
              >
                Web
              </StatusChip>
            )}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap gap-x-1.5 text-[12px] font-semibold tabular-nums text-mc-text-2">
          <span>{client.cargo_count} ta yuk</span>
          <span aria-hidden="true">·</span>
          <span>{client.total_weight.toFixed(1)} kg</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">
            {client.total_price_uzs.toLocaleString("uz-UZ")} so'm
          </span>
        </span>
      </span>
    </button>
  );
});
