import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { replaceTrackCodes } from '@/api/services/expectedCargo';

interface ReplaceTrackCodesModalProps {
  flightName: string;
  clientCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReplaceTrackCodesModal({
  flightName,
  clientCode,
  isOpen,
  onClose,
}: ReplaceTrackCodesModalProps) {
  // Use a key derived from modal identity so React re-mounts the component
  // (and resets all local state) whenever the target client changes — avoids
  // the anti-pattern of calling setState synchronously in an effect.
  const [rawInput, setRawInput] = useState('');

  const parsedCodes = rawInput
    .split(/[\n,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const uniqueCodes = [...new Set(parsedCodes)];

  const replaceMutation = useMutation({
    mutationFn: () =>
      replaceTrackCodes({
        flight_name: flightName,
        client_code: clientCode,
        new_track_codes: uniqueCodes,
      }),
    onSuccess: (data) => {
      toast.success(
        `O'chirildi: ${data.deleted_count} ta · Qo'shildi: ${data.created_count} ta`,
      );
      onClose();
    },
    onError: () => {
      toast.error('Almashtirishda xatolik yuz berdi');
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-orange-500" />
            Trek kodlarini almashtirish
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{clientCode}</span>
            <span>·</span>
            <span className="font-mono text-orange-500">{flightName}</span>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 text-xs">
            Quyidagi yangi trek kodlarni kiriting. Mavjud barcha kodlar{' '}
            <strong>o'chirib tashlanadi</strong> va yangilariga almashtiriladi. Bo'sh
            qoldirish barcha kodlarni o'chiradi.
          </p>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={'AB1234567890CN\nCD9876543210US\n...'}
            rows={8}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
            <span>
              {uniqueCodes.length > 0
                ? `${uniqueCodes.length} ta noyob kod`
                : 'Hali kod kiritilmadi'}
            </span>
            {uniqueCodes.length !== parsedCodes.length && (
              <span className="text-amber-500">
                {parsedCodes.length - uniqueCodes.length} ta takrorlangan olib tashlandi
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={replaceMutation.isPending}
          >
            Bekor qilish
          </Button>
          <Button
            onClick={() => replaceMutation.mutate()}
            disabled={replaceMutation.isPending}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {replaceMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Almashtirish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
