import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateUzPostLabelSettings } from "@/api/hooks/useWarehouse";
import { cn } from "@/lib/utils";

/** The bounds the backend and the print service both enforce. */
const COPY_OPTIONS = [1, 2, 3, 4, 5] as const;

type DialogMode = "ask" | "change";

interface UzPostLabelCopiesDialogProps {
  open: boolean;
  /**
   * `ask`: shown right before a label prints, with a way to skip for now.
   * `change`: opened on purpose from the warehouse settings card.
   */
  mode: DialogMode;
  currentCopies: number | null;
  /** Saved, or skipped in `ask` mode: the caller carries on. */
  onDone: () => void;
  /** Closed without an answer: nothing is saved, and nothing held prints. */
  onCancel: () => void;
}

export default function UzPostLabelCopiesDialog({
  open,
  mode,
  currentCopies,
  onDone,
  onCancel,
}: UzPostLabelCopiesDialogProps) {
  const mutation = useUpdateUzPostLabelSettings();

  const handleSave = (copies: number) => {
    mutation.mutate(copies, {
      onSuccess: (settings) => {
        toast.success(
          `UzPost cheklari endi ${settings.copies ?? copies} nusxada chiqadi`,
        );
        onDone();
      },
      onError: (error: unknown) => {
        toast.error(
          (error as { message?: string }).message ??
            "Nusxa sonini saqlab bo'lmadi",
        );
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !mutation.isPending) onCancel();
      }}
    >
      <DialogContent className="gap-5 p-5 sm:max-w-sm sm:p-6">
        {/* Radix mounts this only while open, so each opening starts from the
            saved value rather than whatever was tapped last time. */}
        <CopiesForm
          mode={mode}
          currentCopies={currentCopies}
          isSaving={mutation.isPending}
          onSave={handleSave}
          onSkip={onDone}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
}

interface CopiesFormProps {
  mode: DialogMode;
  currentCopies: number | null;
  isSaving: boolean;
  onSave: (copies: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

function CopiesForm({
  mode,
  currentCopies,
  isSaving,
  onSave,
  onSkip,
  onCancel,
}: CopiesFormProps) {
  const [selected, setSelected] = useState<number | null>(currentCopies);
  const unchanged = mode === "change" && selected === currentCopies;

  return (
    <>
      <DialogHeader className="items-start text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
          <Printer
            className="h-5 w-5 text-orange-500"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </span>
        <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">
          {mode === "ask"
            ? "UzPost chek nechta nusxada chiqsin?"
            : "UzPost chek nusxasi"}
        </DialogTitle>
        <DialogDescription className="text-[13px] leading-relaxed">
          {mode === "ask"
            ? "Bir marta tanlanadi va barcha UzPost cheklari uchun saqlanadi, keyin so'ralmaydi. Ombor → UzPost bo'limidan o'zgartirish mumkin."
            : "Yangi son keyingi chop etiladigan barcha UzPost cheklariga qo'llanadi, navbatda turganlariga ham."}
        </DialogDescription>
      </DialogHeader>

      <div
        role="group"
        aria-label="Nusxalar soni"
        className="grid grid-cols-5 gap-1.5"
      >
        {COPY_OPTIONS.map((copies) => {
          const active = selected === copies;
          return (
            <button
              key={copies}
              type="button"
              aria-pressed={active}
              aria-label={`${copies} nusxa`}
              disabled={isSaving}
              onClick={() => setSelected(copies)}
              className={cn(
                "h-12 rounded-xl border text-base font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 motion-reduce:transition-none",
                active
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-gray-200 bg-gray-50 text-gray-700 hover:border-orange-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200",
              )}
            >
              {copies}
            </button>
          );
        })}
      </div>

      {mode === "ask" && (
        <p className="-mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          O'tkazib yuborsangiz, bu chek printerning o'z sozlamasi bilan chiqadi
          va keyingi safar yana so'raladi.
        </p>
      )}

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={isSaving}
          onClick={mode === "ask" ? onSkip : onCancel}
        >
          {mode === "ask" ? "Hozircha o'tkazib yuborish" : "Bekor qilish"}
        </Button>
        <Button
          type="button"
          className="h-11 bg-orange-500 text-white hover:bg-orange-600"
          disabled={selected === null || unchanged || isSaving}
          onClick={() => {
            if (selected !== null) onSave(selected);
          }}
        >
          {isSaving && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {mode === "ask" ? "Saqlash va davom etish" : "Saqlash"}
        </Button>
      </DialogFooter>
    </>
  );
}
