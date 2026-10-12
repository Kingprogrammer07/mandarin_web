import type { ReactNode } from "react";
import { ArrowLeft, Moon, RefreshCw, Sun } from "lucide-react";

import { useAppTheme } from "@/hooks/useAppTheme";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 transition-transform duration-150 active:scale-95 disabled:opacity-50 motion-reduce:transition-none";

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={ICON_BUTTON}
    >
      {children}
    </button>
  );
}

/**
 * Full-screen mode has no app navigation bar above it, so the theme switch
 * that bar normally carries lives here — the same as in the astatka window
 * this screen is opened from.
 */
function ThemeButton() {
  const { theme, toggle } = useAppTheme();
  const label =
    theme === "dark" ? "Kunduzgi rejimga o'tish" : "Tungi rejimga o'tish";
  return (
    <IconButton label={label} onClick={toggle}>
      {theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </IconButton>
  );
}

interface NotificationHeaderProps {
  flightName: string;
  onBack: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  fullScreen: boolean;
}

export function NotificationHeader({
  flightName,
  onBack,
  onRefresh,
  isRefreshing,
  fullScreen,
}: NotificationHeaderProps) {
  return (
    <header
      className={cn(
        "shrink-0",
        fullScreen
          ? "border-b border-mc-border bg-mc-surface pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]"
          : "pt-1",
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-2 sm:px-4">
        <IconButton label="Orqaga" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </IconButton>
        <h1 className="min-w-0 flex-1 px-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
            Bildirishnomalar
          </span>
          {/* Wrapped, never truncated: the name is what tells two flights apart. */}
          <span className="block break-words text-[17px] font-extrabold leading-tight text-mc-text">
            {flightName}
          </span>
        </h1>
        <IconButton
          label="Yangilash"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5",
              isRefreshing && "motion-safe:animate-spin",
            )}
          />
        </IconButton>
        {fullScreen && <ThemeButton />}
      </div>
    </header>
  );
}
