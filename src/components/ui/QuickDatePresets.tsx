import { buildDatePresets } from "@/lib/datePresets";
import { cn } from "@/lib/utils";

interface QuickDatePresetsProps {
  dateFrom: string | undefined;
  dateTo: string | undefined;
  onChange: (dateFrom: string, dateTo: string) => void;
  className?: string;
}

export function QuickDatePresets({
  dateFrom,
  dateTo,
  onChange,
  className,
}: QuickDatePresetsProps) {
  const presets = buildDatePresets();
  const activePreset =
    presets.find((p) => p.dateFrom === dateFrom && p.dateTo === dateTo)?.label ?? null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {presets.map((preset) => {
        const isActive = activePreset === preset.label;
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.dateFrom, preset.dateTo)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
              isActive
                ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                : "bg-white dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08] hover:border-orange-300 dark:hover:border-orange-500/30"
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
