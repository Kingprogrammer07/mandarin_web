import { useState } from 'react';
import { Save, Loader2, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { bulkCreateExpectedCargo } from '@/api/services/expectedCargo';
import { useExpectedCargoStore, type FastEntryQueueItem } from '@/store/expectedCargoStore';
import { playSuccessSound } from '@/utils/audioUtils';

interface BulkSaveFABProps {
  flightName: string | null;
}

function triggerHapticSuccess(): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  } catch {
    // Not available outside Telegram
  }
}

/**
 * Groups queue items by client_code so we can issue one bulk request per client.
 * Items with an empty clientCode are skipped and reported back as invalid.
 */
function groupQueueByClient(
  queue: FastEntryQueueItem[],
  flightName: string,
): {
  groups: Array<{ flightName: string; clientCode: string; trackCodes: string[] }>;
  invalidItems: FastEntryQueueItem[];
} {
  const groups = new Map<string, string[]>();
  const invalidItems: FastEntryQueueItem[] = [];

  for (const item of queue) {
    if (!item.clientCode.trim()) {
      invalidItems.push(item);
      continue;
    }
    const key = item.clientCode.trim().toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item.trackCode);
  }

  return {
    groups: Array.from(groups.entries()).map(([clientCode, trackCodes]) => ({
      flightName,
      clientCode,
      trackCodes,
    })),
    invalidItems,
  };
}

export function BulkSaveFAB({ flightName }: BulkSaveFABProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const { entryQueue, clearQueue, removeFromQueue } = useExpectedCargoStore();

  const readyItems = entryQueue.filter((i) => i.clientCode.trim());
  const unreadyItems = entryQueue.filter((i) => !i.clientCode.trim());

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!flightName) throw new Error('Reys tanlanmagan');

      const { groups, invalidItems } = groupQueueByClient(entryQueue, flightName);

      if (groups.length === 0) {
        throw new Error("Saqlash uchun tayyor yozuv yo'q");
      }

      // Remove items without client codes before saving
      for (const item of invalidItems) {
        removeFromQueue(item.id);
      }

      // Send one bulk request per unique client
      const results = await Promise.allSettled(
        groups.map((g) =>
          bulkCreateExpectedCargo({
            flight_name: g.flightName,
            client_code: g.clientCode,
            track_codes: g.trackCodes,
          }),
        ),
      );

      const totalCreated = results.reduce((acc, r) => {
        if (r.status === 'fulfilled') return acc + r.value.created_count;
        return acc;
      }, 0);

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      return { totalCreated, failedCount, totalGroups: groups.length };
    },
    onSuccess: ({ totalCreated, failedCount }) => {
      triggerHapticSuccess();

      if (failedCount > 0) {
        toast.warning(
          `${totalCreated} ta saqlandi, ${failedCount} ta guruhda xatolik`,
        );
      } else {
        playSuccessSound();
        toast.success(`${totalCreated} ta trek kodi saqlandi`);
      }

      clearQueue();
      setIsConfirmOpen(false);

      // Refresh the summary list for the active flight
      if (flightName) {
        queryClient.invalidateQueries({
          queryKey: ['expectedCargo', 'summary', flightName],
        });
        queryClient.invalidateQueries({
          queryKey: ['expectedCargo', 'flights'],
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Saqlashda xatolik yuz berdi');
    },
  });

  if (entryQueue.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.button
          key="fab"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsConfirmOpen(true)}
          className="fixed bottom-[72px] right-4 z-50 flex items-center gap-2 h-12 pl-4 pr-5 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
        >
          <Save className="size-5" />
          Saqlash
          <span className="ml-1 bg-white/20 rounded-full min-w-[20px] h-5 px-1.5 text-xs font-bold flex items-center justify-center">
            {entryQueue.length}
          </span>
        </motion.button>
      </AnimatePresence>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Topshirishni tasdiqlash</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {readyItems.length}
              </span>{' '}
              ta trek kodi saqlanadi
              {flightName && (
                <>
                  {' '}
                  <span className="font-mono text-orange-600 dark:text-orange-400">
                    {flightName}
                  </span>{' '}
                  reysiga
                </>
              )}
              .
            </p>

            {unreadyItems.length > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {unreadyItems.length} ta element mijoz kodi yo'qligi sababli o'tkazib
                yuboriladi.
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              className="flex-1"
              disabled={saveMutation.isPending}
            >
              Bekor qilish
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || readyItems.length === 0}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
