import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPinPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addUzpostBranch,
  uzpostBranchConflict,
  type AddedUzpostBranchEntry,
  type UzpostBranchConflict,
} from "@/api/services/uzpostBranches";
import { UZPOST_BRANCHES_QUERY_KEY } from "@/hooks/useUzpostBranches";
import {
  parseCoordinates,
  validateUzpostBranchForm,
  type UzpostBranchFormErrors,
  type UzpostBranchFormValues,
} from "@/lib/uzpostBranchForm";
import type { UzpostBranch } from "@/types/uzpostBranch";

interface AddUzpostBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved branch, already in the picker's list, ready to select. */
  onAdded: (branch: UzpostBranch) => void;
  /** The index was already listed; the manager chose that branch instead. */
  onUseExisting: (branchId: number) => void;
}

const EMPTY_FORM: UzpostBranchFormValues = {
  name: "",
  postcodeIndex: "",
  address: "",
  coordinates: "",
  workdays: "",
};

function toBranch(entry: AddedUzpostBranchEntry): UzpostBranch {
  return {
    id: entry.ID,
    name: entry.Name,
    index: entry.Index,
    address: entry.Address,
    longitude: entry.Longitude,
    latitude: entry.Latitude,
    workdays: entry.Workdays,
    lunch: null,
    saturday: null,
    dayOff: null,
    otherScheduleNotes: null,
    isCustom: true,
  };
}

export default function AddUzpostBranchDialog({
  open,
  onOpenChange,
  onAdded,
  onUseExisting,
}: AddUzpostBranchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto overscroll-contain p-4 sm:max-w-md sm:p-6">
        {/* Mounted only while open, so every opening starts from an empty form. */}
        <AddBranchForm
          onCancel={() => onOpenChange(false)}
          onAdded={onAdded}
          onUseExisting={onUseExisting}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AddBranchFormProps {
  onCancel: () => void;
  onAdded: (branch: UzpostBranch) => void;
  onUseExisting: (branchId: number) => void;
}

function AddBranchForm({ onCancel, onAdded, onUseExisting }: AddBranchFormProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<UzpostBranchFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<UzpostBranchFormErrors>({});
  const [conflict, setConflict] = useState<UzpostBranchConflict | null>(null);

  const mutation = useMutation({
    mutationFn: addUzpostBranch,
    onSuccess: (entry) => {
      const branch = toBranch(entry);
      queryClient.setQueryData<UzpostBranch[]>(UZPOST_BRANCHES_QUERY_KEY, (current) =>
        current ? [branch, ...current] : current,
      );
      toast.success(`${branch.name} filiali qo'shildi`);
      onAdded(branch);
    },
    onError: (error: unknown) => {
      const listed = uzpostBranchConflict(error);
      if (listed) {
        setConflict(listed);
        return;
      }
      toast.error(
        (error as { message?: string }).message ?? "Filialni saqlab bo'lmadi",
      );
    },
  });

  const update = (field: keyof UzpostBranchFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === "postcodeIndex") setConflict(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateUzpostBranchForm(values);
    setErrors(found);
    const point = parseCoordinates(values.coordinates);
    if (Object.keys(found).length > 0 || !point) return;
    mutation.mutate({
      name: values.name.trim(),
      postcode_index: values.postcodeIndex.trim(),
      address: values.address.trim(),
      latitude: point.latitude,
      longitude: point.longitude,
      workdays: values.workdays.trim() || null,
    });
  };

  const saving = mutation.isPending;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader className="items-start text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
          <MapPinPlus className="h-5 w-5 text-orange-500" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">
          UzPost filial qo'shish
        </DialogTitle>
        <DialogDescription className="text-[13px] leading-relaxed">
          Posilka indeks bo'yicha yuboriladi. Indeks noto'g'ri bo'lsa, UzPost
          uni boshqa bo'limga jo'natadi, shuning uchun indeksni bo'lim
          peshtaxtasidagi yoki chekdagi 6 xonali raqamdan tekshirib yozing.
        </DialogDescription>
      </DialogHeader>

      <Field
        id="uzpost-branch-name"
        label="Filial nomi"
        value={values.name}
        error={errors.name}
        placeholder="Masalan: Toshkent 215-bo'lim"
        disabled={saving}
        onChange={(value) => update("name", value)}
      />
      <Field
        id="uzpost-branch-index"
        label="Indeks"
        value={values.postcodeIndex}
        error={errors.postcodeIndex}
        placeholder="100215"
        inputMode="numeric"
        maxLength={6}
        disabled={saving}
        onChange={(value) => update("postcodeIndex", value.replace(/\D/g, ""))}
      />

      {conflict && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">{conflict.message}</p>
          {(conflict.name || conflict.address) && (
            <p className="mt-0.5 break-words">
              {[conflict.name, conflict.address].filter(Boolean).join(" · ")}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-11 w-full"
            onClick={() => onUseExisting(conflict.branch_id)}
          >
            Shu filialni tanlash
          </Button>
        </div>
      )}

      <Field
        id="uzpost-branch-address"
        label="Manzil"
        value={values.address}
        error={errors.address}
        placeholder="Viloyat, tuman, ko'cha, uy"
        disabled={saving}
        onChange={(value) => update("address", value)}
      />
      <Field
        id="uzpost-branch-coordinates"
        label="Koordinata yoki Google Maps havolasi"
        value={values.coordinates}
        error={errors.coordinates}
        placeholder="41.311, 69.279"
        hint="Narx shu nuqtadan hisoblanadi."
        disabled={saving}
        onChange={(value) => update("coordinates", value)}
      />
      <Field
        id="uzpost-branch-workdays"
        label="Ish kunlari (ixtiyoriy)"
        value={values.workdays}
        placeholder="Dushanba-Shanba"
        disabled={saving}
        onChange={(value) => update("workdays", value)}
      />

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={saving}
          onClick={onCancel}
        >
          Bekor qilish
        </Button>
        <Button
          type="submit"
          className="h-11 bg-orange-500 text-white hover:bg-orange-600"
          disabled={saving}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Saqlash
        </Button>
      </DialogFooter>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function Field({
  id,
  label,
  value,
  error,
  hint,
  placeholder,
  inputMode = "text",
  maxLength,
  disabled,
  onChange,
}: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl text-base"
      />
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
