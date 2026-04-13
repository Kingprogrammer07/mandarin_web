import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renameFlight } from '@/api/services/expectedCargo';
import { useExpectedCargoStore } from '@/store/expectedCargoStore';

const renameSchema = z.object({
  newFlightName: z
    .string()
    .min(1, "Reys nomi bo'sh bo'lmasligi kerak")
    .max(255, "Reys nomi juda uzun"),
});

type RenameFormValues = z.infer<typeof renameSchema>;

interface RenameFlightModalProps {
  flightName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RenameFlightModal({ flightName, isOpen, onClose }: RenameFlightModalProps) {
  const queryClient = useQueryClient();
  const { setFlightTabOrder, flightTabOrder, setActiveFlight, activeFlightName } =
    useExpectedCargoStore();

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<RenameFormValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { newFlightName: flightName ?? '' },
  });

  useEffect(() => {
    if (isOpen && flightName) {
      reset({ newFlightName: flightName });
      setTimeout(() => setFocus('newFlightName'), 80);
    }
  }, [isOpen, flightName, reset, setFocus]);

  const renameMutation = useMutation({
    mutationFn: (values: RenameFormValues) => {
      if (!flightName) throw new Error('Joriy reys nomi aniqlanmadi');
      return renameFlight({
        old_flight_name: flightName,
        // Always uppercase so names are consistent across the app and backend
        new_flight_name: values.newFlightName.trim().toUpperCase(),
      });
    },
    onSuccess: (data) => {
      toast.success(`Reys "${data.old_flight_name}" → "${data.new_flight_name}" deb o'zgartirildi`);

      // Update the persisted tab order with the new name
      const updatedOrder = flightTabOrder.map((name) =>
        name === data.old_flight_name ? data.new_flight_name : name,
      );
      setFlightTabOrder(updatedOrder);

      // If the renamed flight was active, update the active selection
      if (activeFlightName === data.old_flight_name) {
        setActiveFlight(data.new_flight_name);
      }

      queryClient.invalidateQueries({ queryKey: ['expectedCargo', 'flights'] });
      queryClient.invalidateQueries({
        queryKey: ['expectedCargo', 'summary', data.old_flight_name],
      });

      onClose();
    },
    onError: () => {
      toast.error("Nomni o'zgartirishda xatolik yuz berdi");
    },
  });

  const onSubmit = (values: RenameFormValues) => {
    if (values.newFlightName.trim().toUpperCase() === flightName) {
      toast.info("Reys nomi o'zgarmadi");
      onClose();
      return;
    }
    renameMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reys nomini o'zgartirish</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentFlightName" className="text-xs text-zinc-500">
              Joriy nom
            </Label>
            <Input
              id="currentFlightName"
              value={flightName ?? ''}
              disabled
              className="font-mono text-sm bg-zinc-50 dark:bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newFlightName">Yangi nom</Label>
            <Input
              id="newFlightName"
              {...register('newFlightName')}
              placeholder="M124-2025"
              className="font-mono text-sm uppercase"
              autoComplete="off"
            />
            {errors.newFlightName && (
              <p className="text-xs text-red-500">{errors.newFlightName.message}</p>
            )}
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={renameMutation.isPending}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              disabled={renameMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {renameMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
