import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Moon,
  MoreVertical,
  PackagePlus,
  Pencil,
  ScanLine,
  Sun,
} from "lucide-react";

import type { AstatkaPackageStatus } from "@/api/services/astatkaFlights";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatKg } from "@/lib/astatkaFormat";
import { cn } from "@/lib/utils";

export interface WorkspaceCounts {
  expected: number;
  confirmed: number;
  expectedKg: number;
  confirmedKg: number;
}

interface Props {
  flightName: string;
  counts: WorkspaceCounts | null;
  workMode: boolean;
  onToggleWorkMode: () => void;
  /** Bags scanned on this device and not on the server yet. */
  pendingCount: number;
  editMode: boolean;
  onToggleEditMode: () => void;
  onExtract: () => void;
  onSend: () => void;
  onDownload: (status?: AstatkaPackageStatus) => void;
  isDownloading: boolean;
  isOnline: boolean;
  onBack: () => void;
}

/** Menu rows tall enough for a thumb; the shared item is sized for a mouse. */
const MENU_ITEM = "min-h-11 gap-2.5 px-3 text-[14px] font-semibold";

const DOWNLOADS: { status?: AstatkaPackageStatus; label: string }[] = [
  { label: "Hammasi" },
  { status: "confirmed", label: "Faqat tasdiqlanganlar" },
  { status: "expected", label: "Faqat kutilayotganlar" },
];

function ModeToggle({
  pressed,
  onClick,
  icon,
  label,
  badge,
  className,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "relative flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-mc-sm border px-3 text-[13px] font-extrabold active:scale-[0.97]",
        pressed
          ? "border-mc-brand bg-mc-brand-soft text-mc-brand"
          : "border-mc-border bg-mc-surface text-mc-text-2",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      {/* An on/off pip, so the state reads without relying on colour alone. */}
      <span
        aria-hidden
        className={cn(
          "ml-0.5 h-2 w-2 shrink-0 rounded-full",
          pressed ? "bg-mc-brand" : "border border-mc-text-3",
        )}
      />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-mc-warn px-1 text-[11px] font-extrabold tabular-nums text-mc-on-warn">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

/**
 * The astatka window's top bar. On a desktop every action is a labelled
 * button; on a phone the two mode switches stay in sight and the rest moves
 * into the "⋮" menu.
 */
export function WorkspaceHeader({
  flightName,
  counts,
  workMode,
  onToggleWorkMode,
  pendingCount,
  editMode,
  onToggleEditMode,
  onExtract,
  onSend,
  onDownload,
  isDownloading,
  isOnline,
  onBack,
}: Props) {
  const { theme, toggle } = useAppTheme();
  const themeLabel = theme === "dark" ? "Kunduzgi rejimga o'tish" : "Tungi rejimga o'tish";
  const offlineHint = isOnline ? undefined : "Internet kerak";

  const workToggle = (
    <ModeToggle
      pressed={workMode}
      onClick={onToggleWorkMode}
      icon={<ScanLine className="h-4 w-4 shrink-0" />}
      label="Ish rejimi"
      badge={workMode ? undefined : pendingCount}
    />
  );
  const editToggle = (
    <ModeToggle
      pressed={editMode}
      onClick={onToggleEditMode}
      icon={<Pencil className="h-4 w-4 shrink-0" />}
      label="Tahrirlash"
    />
  );

  const themeButton = (
    <button
      type="button"
      onClick={toggle}
      aria-label={themeLabel}
      title={themeLabel}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );

  const downloadItems = DOWNLOADS.map(({ status, label }) => (
    <DropdownMenuItem
      key={label}
      className={MENU_ITEM}
      disabled={!isOnline || isDownloading}
      onClick={() => onDownload(status)}
    >
      <FileSpreadsheet className="size-4" />
      {label}
    </DropdownMenuItem>
  ));

  return (
    <header className="shrink-0 border-b border-mc-border bg-mc-surface px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Orqaga"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
              Astatka reysi
            </p>
            {/* Wrapped, never truncated: the name tells two astatka flights apart. */}
            <h1 className="break-words text-[17px] font-extrabold leading-tight text-mc-text">
              {flightName}
            </h1>
            {counts && (
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] font-semibold tabular-nums text-mc-text-3">
                <span>
                  <span className="text-mc-success">{counts.confirmed} ta tasdiqlandi</span>
                  {counts.confirmedKg > 0 && ` · ${formatKg(counts.confirmedKg)}`}
                </span>
                <span>
                  <span className="text-mc-warn">{counts.expected} ta kutilmoqda</span>
                  {counts.expectedKg > 0 && ` · ${formatKg(counts.expectedKg)}`}
                </span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center md:hidden">
            {themeButton}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Boshqa amallar"
                  className="flex h-11 w-11 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-1rem))]">
                <DropdownMenuItem className={MENU_ITEM} disabled={!isOnline} onClick={onExtract}>
                  <PackagePlus className="size-4" />
                  Astatka ajratish
                </DropdownMenuItem>
                <DropdownMenuItem className={MENU_ITEM} onClick={onSend}>
                  <Bell className="size-4" />
                  Mijozlarga yuborish
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-extrabold uppercase tracking-wide text-mc-text-3">
                  Excel yuklab olish
                </DropdownMenuLabel>
                {downloadItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop: everything labelled, wrapping under the title when narrow. */}
        <div className="hidden flex-wrap items-center justify-end gap-1.5 md:flex">
          {workToggle}
          {editToggle}
          <span aria-hidden className="mx-1 h-7 w-px bg-mc-border" />
          <button
            type="button"
            onClick={onExtract}
            disabled={!isOnline}
            title={offlineHint ?? "Eski reyslardan olib ketilmagan yuklarni shu astatkaga qo'shish"}
            className="flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97] disabled:opacity-50"
          >
            <PackagePlus className="h-4 w-4" />
            Astatka ajratish
          </button>
          <button
            type="button"
            onClick={onSend}
            title="Mijozlarga yuk haqida xabar yuborish"
            className="flex h-11 items-center gap-1.5 rounded-mc-sm bg-mc-brand px-3 text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] active:scale-[0.97]"
          >
            <Bell className="h-4 w-4" />
            Yuborish
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={offlineHint ?? "Excel faylini yuklab olish"}
                className="flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97]"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Excel
                <ChevronDown className="h-3.5 w-3.5 text-mc-text-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[15rem]">
              {downloadItems}
            </DropdownMenuContent>
          </DropdownMenu>
          {themeButton}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 md:hidden">
        {workToggle}
        {editToggle}
      </div>
    </header>
  );
}
