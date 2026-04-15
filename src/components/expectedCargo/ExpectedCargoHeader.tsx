import { Search, Pencil, X, FileDown, ScanBarcode, ChevronLeft, Moon, Sun, Trash2, DatabaseBackup, MoreVertical } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/expectedCargo/NotificationPanel';

interface ExpectedCargoHeaderProps {
  activeFlightName: string | null;
  searchQuery: string;
  isEditMode: boolean;
  isFastEntryOpen: boolean;
  queueCount: number;
  onSearchChange: (query: string) => void;
  onToggleEditMode: () => void;
  onToggleFastEntry: () => void;
  onExport: () => void;
  onExportAll: () => void;
  onDeleteFlight: () => void;
  onBack: () => void;
  onOpenNotifications: () => void;
}

export function ExpectedCargoHeader({
  activeFlightName,
  searchQuery,
  isEditMode,
  isFastEntryOpen,
  queueCount,
  onSearchChange,
  onToggleEditMode,
  onToggleFastEntry,
  onExport,
  onExportAll,
  onDeleteFlight,
  onBack,
  onOpenNotifications,
}: ExpectedCargoHeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-[#ffffff]/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
      {/* Title row: back | flight name (prominent) | actions */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            className="flex-shrink-0 text-zinc-500 dark:text-zinc-400"
          >
            <ChevronLeft className="size-5" />
          </Button>

          <div className="min-w-0">
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
              {activeFlightName ?? '—'}
            </h1>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">
              Kutilayotgan yuklar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-zinc-500 dark:text-zinc-400"
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          {/* Notification bell */}
          <NotificationBell onClick={onOpenNotifications} />

          {/* Fast entry / scanner toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFastEntry}
            className={cn(
              'relative',
              isFastEntryOpen
                ? 'text-orange-600 bg-orange-50 dark:bg-orange-950/40'
                : 'text-zinc-500 dark:text-zinc-400',
            )}
          >
            <ScanBarcode className="size-5" />
            {queueCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-orange-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center px-1">
                {queueCount > 99 ? '99+' : queueCount}
              </span>
            )}
          </Button>

          {/* Edit mode toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleEditMode}
            className={cn(
              isEditMode
                ? 'text-orange-600 bg-orange-50 dark:bg-orange-950/40'
                : 'text-zinc-500 dark:text-zinc-400',
            )}
          >
            {isEditMode ? <X className="size-5" /> : <Pencil className="size-4" />}
          </Button>

          {/* Overflow menu — houses dangerous/secondary actions to keep the toolbar tidy */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-zinc-500 dark:text-zinc-400"
                title="Ko'proq"
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {/* Export current flight */}
              <DropdownMenuItem onClick={onExport}>
                <FileDown className="size-4" />
                Bu reysni eksport
              </DropdownMenuItem>

              {/* Export all flights */}
              <DropdownMenuItem onClick={onExportAll}>
                <DatabaseBackup className="size-4" />
                Barchasini eksport
              </DropdownMenuItem>

              {/* Delete flight — only shown when a flight is active */}
              {activeFlightName && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={onDeleteFlight}
                  >
                    <Trash2 className="size-4" />
                    Reysni o'chirish
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search row — always visible for quick client lookups */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Mijoz kodi bo'yicha qidirish..."
            className="pl-9 h-9 text-sm bg-[#ffffff] dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 focus:ring-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {isEditMode && (
        <div className="px-3 pb-2">
          <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-300">
            Tahrirlash rejimi yoqilgan — qatorni uzoq bosib ushlab turing
          </div>
        </div>
      )}
    </div>
  );
}
