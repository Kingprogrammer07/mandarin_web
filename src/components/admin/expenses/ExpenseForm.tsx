/**
 * «Yangi rasxod qo'shish» / «Rasxodni tahrirlash».
 *
 * One form for both: the page keys it per mode, so every open starts from its
 * initializers. It saves receipts first and the expense second, so a failed
 * upload never leaves an expense without the proof the cashier attached.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Camera, Check, ChevronDown, ImagePlus, Tag, User, X } from 'lucide-react';
import { toast } from 'sonner';

import { useCreateExpense, useUpdateExpense, useUploadExpenseImages } from '@/api/hooks/useExpenses';
import type { Expense, ExpenseCategory, ExpenseEmployee, PaymentMethod } from '@/api/services/expenseService';
import {
  amountInWords,
  dateInWords,
  dmy,
  expenseDateIso,
  formatAmountInput,
  formatMoney,
  parseAmountText,
  spentAt,
  tashkentNow,
} from '@/lib/expenses';
import { cn } from '@/lib/utils';

import { PAYMENT_METHODS } from './expenseUi';

// 48px under a finger, 40px under a mouse. The text stays 16px whatever the
// pointer, so iOS never zooms the page on focus.
const CONTROL =
  'h-12 pointer-fine:h-10 w-full rounded-mc-sm border border-transparent bg-mc-surface-2 px-3.5 text-base font-medium text-mc-text outline-none transition-[border-color,background-color,box-shadow] placeholder:text-mc-text-2 focus:border-mc-brand/60 focus:bg-mc-surface focus:ring-4 focus:ring-mc-brand/10 aria-[invalid=true]:border-mc-danger/70';

function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-mc-text-2">
        {label}
        {required && (
          <span aria-hidden className="text-mc-brand">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1 text-[12px] font-semibold text-mc-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1 text-[12px] font-medium text-mc-text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A native select whose chosen name wraps instead of being cut off. The real
 * <select> lies invisibly over the box, so a tap still opens the phone's own picker.
 */
function SelectBox({
  id,
  icon,
  value,
  display,
  onChange,
  invalid,
  children,
}: {
  id: string;
  icon: ReactNode;
  value: string;
  /** What the box shows: the chosen option's name, or the placeholder. */
  display: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        CONTROL,
        'relative flex h-auto min-h-12 items-center gap-2.5 py-2 pointer-fine:h-auto pointer-fine:min-h-10 pointer-fine:py-1.5',
        'has-[select:focus]:border-mc-brand/60 has-[select:focus]:bg-mc-surface has-[select:focus]:ring-4 has-[select:focus]:ring-mc-brand/10',
        invalid && 'border-mc-danger/70',
      )}
    >
      <span aria-hidden className="flex shrink-0 text-mc-text-2">
        {icon}
      </span>
      <span aria-hidden className={cn('min-w-0 flex-1 break-words leading-snug', !value && 'text-mc-text-2')}>
        {display}
      </span>
      <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-mc-text-2" />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-msg`}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-mc-sm text-base opacity-0"
      >
        {children}
      </select>
    </div>
  );
}

/** Object URLs for picked files, revoked when the files change or the form closes. */
function usePreviews(files: File[]): string[] {
  const urls = useMemo(() => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : '')), [files]);
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);
  return urls;
}

function isPdf(url: string) {
  return url.toLowerCase().split('?')[0].endsWith('.pdf');
}

export interface ExpenseFormProps {
  editing: Expense | null;
  categories: ExpenseCategory[];
  employees: ExpenseEmployee[];
  /** After a successful save. */
  onSaved: () => void;
  /** «Bekor qilish» while editing. */
  onCancelEdit: () => void;
  /** The phone sheet's close button. */
  onClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  titleId: string;
  sheet?: boolean;
}

export function ExpenseForm({
  editing,
  categories,
  employees,
  onSaved,
  onCancelEdit,
  onClose,
  onDirtyChange,
  titleId,
  sheet = false,
}: ExpenseFormProps) {
  const initialWhen = editing ? spentAt(editing) : null;
  const now = tashkentNow();
  // An amount with tiyin (entered by the old form) is kept exactly unless the
  // field is changed; this field itself takes whole so'm only.
  const initialAmount = editing
    ? Number.isInteger(editing.amount)
      ? formatAmountInput(String(editing.amount))
      : formatMoney(editing.amount)
    : '';

  const [categoryId, setCategoryId] = useState(editing ? String(editing.category_id) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amountText, setAmountText] = useState(initialAmount);
  const [amountTouched, setAmountTouched] = useState(false);
  const [ymd, setYmd] = useState(initialWhen?.ymd ?? now.ymd);
  const [hm, setHm] = useState(initialWhen?.hm ?? now.hm);
  const [dateTouched, setDateTouched] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>(editing?.payment_method ?? 'cash');
  const [employeeId, setEmployeeId] = useState(editing?.employee_id ? String(editing.employee_id) : '');
  const [images, setImages] = useState<string[]>(editing?.images ?? []);
  const [pending, setPending] = useState<File[]>([]);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const busyRef = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const previews = usePreviews(pending);

  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const uploadMut = useUploadExpenseImages();

  useEffect(() => {
    onDirtyChange?.(touched);
  }, [touched, onDirtyChange]);

  const touch = () => setTouched(true);

  // Deactivated categories and staff are not offered for new rows, but the
  // row being edited keeps its own.
  const categoryOptions =
    editing && !categories.some((c) => c.id === editing.category_id)
      ? [...categories, { id: editing.category_id, name: `${editing.category_name} (faol emas)`, is_active: false }]
      : categories;
  const employeeOptions =
    editing?.employee_id && !employees.some((e) => e.id === editing.employee_id)
      ? [...employees, { id: editing.employee_id, full_name: `${editing.employee_name ?? 'Xodim'} (faol emas)`, is_active: false }]
      : employees;

  const amount = editing && !amountTouched ? ({ ok: true, value: editing.amount } as const) : parseAmountText(amountText);
  const checkDate = !editing || dateTouched;
  const errors = {
    category: categoryId ? null : 'Rasxod turini tanlang',
    description: description.trim() ? null : 'Tavsifni yozing',
    amount: amount.ok ? null : amount.error,
    date: !ymd ? 'Sanani tanlang' : checkDate && ymd > now.ymd ? "Kelgusi sana bo'lmaydi" : !hm ? 'Vaqtni kiriting' : null,
    reason: editing && !reason.trim() ? "O'zgarish sababini yozing" : null,
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null);
  // A refused paste or an oversized number is said at once, not on save.
  const amountError = show('amount') ?? (amountText && !amount.ok && amountTouched ? amount.error : null);

  const ids = {
    category: `${titleId}-category`,
    description: `${titleId}-description`,
    amount: `${titleId}-amount`,
    date: `${titleId}-date`,
    time: `${titleId}-time`,
    payment: `${titleId}-payment`,
    employee: `${titleId}-employee`,
    files: `${titleId}-files`,
    reason: `${titleId}-reason`,
  };

  const handleAmount = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/\D/g, '').length;
    const next = formatAmountInput(el.value);
    setAmountText(next);
    setAmountTouched(true);
    touch();
    // Grouping adds spaces; keep the caret after the same digit it followed.
    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      let pos = 0;
      for (let seen = 0; pos < next.length && seen < digitsBefore; pos += 1) {
        if (/\d/.test(next[pos])) seen += 1;
      }
      el.setSelectionRange(pos, pos);
    });
  };

  const addFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) {
      setPending((prev) => [...prev, ...files]);
      touch();
    }
  };

  const resetNew = () => {
    const fresh = tashkentNow();
    setCategoryId('');
    setDescription('');
    setAmountText('');
    setAmountTouched(false);
    setYmd(fresh.ymd);
    setHm(fresh.hm);
    setDateTouched(false);
    setPayment('cash');
    setEmployeeId('');
    setImages([]);
    setPending([]);
    setTouched(false);
    setSubmitted(false);
  };

  const handleCancel = () => {
    if (editing) onCancelEdit();
    else {
      resetNew();
      onClose?.();
    }
  };

  const handleSubmit = async () => {
    if (busyRef.current) return;
    setSubmitted(true);
    const order: [keyof typeof errors, string][] = [
      ['category', ids.category],
      ['description', ids.description],
      ['amount', ids.amount],
      ['date', ids.date],
      ['reason', ids.reason],
    ];
    const firstInvalid = order.find(([key]) => errors[key]);
    if (firstInvalid || !amount.ok) {
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus();
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      let urls = images;
      if (pending.length) {
        try {
          const uploaded = await uploadMut.mutateAsync(pending);
          urls = [...images, ...uploaded];
          // Kept, so a retry after a failed save does not upload twice.
          setImages(urls);
          setPending([]);
        } catch {
          toast.error("Chek rasmlarini yuklab bo'lmadi. Rasxod saqlanmadi.");
          return;
        }
      }

      const common = {
        category_id: Number(categoryId),
        employee_id: employeeId ? Number(employeeId) : null,
        amount: amount.value,
        payment_method: payment,
        description: description.trim(),
        images: urls,
      };
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          data: {
            ...common,
            // A row saved without a date keeps it empty unless one is chosen.
            expense_date: editing.expense_date || dateTouched ? expenseDateIso(ymd, hm) : null,
            edit_reason: reason.trim(),
          },
        });
      } else {
        await createMut.mutateAsync({ ...common, note: null, expense_date: expenseDateIso(ymd, hm) });
        resetNew();
      }
      onSaved();
    } catch {
      // The mutation hooks already showed the server's message.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const amountWas =
    editing && amountTouched && amount.ok && amount.value !== editing.amount
      ? ` · avval ${formatMoney(editing.amount)} so'm`
      : '';
  const amountHint =
    amount.ok && (amountTouched || !editing) ? (
      <span className="block first-letter:uppercase">
        {amountInWords(amount.value)}
        {amountWas}
      </span>
    ) : null;

  return (
    <section aria-labelledby={titleId} className="@container/form flex min-h-0 flex-1 flex-col">
      <header className={cn('flex shrink-0 items-center gap-3 px-4 pb-3', sheet ? 'pt-2' : 'pt-4')}>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="break-words text-[17px] font-extrabold leading-tight tracking-tight text-mc-text">
            {editing ? 'Rasxodni tahrirlash' : "Yangi rasxod qo'shish"}
          </h2>
          {editing && initialWhen && (
            <p className="mt-0.5 break-words text-[12px] font-medium text-mc-text-2">
              №{editing.id} · {dmy(initialWhen.ymd)} {initialWhen.hm} ·{' '}
              <span className="whitespace-nowrap">{formatMoney(editing.amount)} so'm</span>
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-95"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        )}
      </header>

      <div className={cn('min-h-0 flex-1 px-4', sheet && 'overflow-y-auto overscroll-contain')}>
        <div className="grid items-start gap-3.5 pointer-fine:gap-3 @2xl/form:grid-cols-2 @2xl/form:gap-x-5">
          <Field id={ids.category} label="Rasxod turi" required error={show('category')}>
            <SelectBox
              id={ids.category}
              icon={<Tag className="h-[18px] w-[18px]" />}
              value={categoryId}
              display={categoryOptions.find((c) => String(c.id) === categoryId)?.name ?? 'Rasxod turini tanlang'}
              invalid={!!show('category')}
              onChange={(v) => {
                setCategoryId(v);
                touch();
              }}
            >
              <option value="" disabled>
                Rasxod turini tanlang
              </option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectBox>
          </Field>

          <Field
            id={ids.description}
            label="Tavsif"
            required
            error={show('description')}
            hint={description.length > 200 ? `${description.length}/250` : null}
          >
            <textarea
              id={ids.description}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch();
              }}
              rows={2}
              maxLength={250}
              placeholder="Masalan: M72 reys – Xitoydan tashish"
              aria-invalid={!!show('description') || undefined}
              aria-describedby={`${ids.description}-msg`}
              className={cn(CONTROL, 'h-auto min-h-12 resize-none py-2.5 leading-snug pointer-fine:h-auto pointer-fine:py-2')}
            />
          </Field>

          <Field id={ids.amount} label="Summa" required error={amountError} hint={amountHint}>
            <div className="relative">
              <input
                id={ids.amount}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                value={amountText}
                onChange={handleAmount}
                placeholder="0"
                aria-invalid={!!amountError || undefined}
                aria-describedby={`${ids.amount}-msg`}
                className={cn(CONTROL, 'pr-16 text-[18px] font-bold tabular-nums tracking-tight')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[14px] font-semibold text-mc-text-2">
                so'm
              </span>
            </div>
          </Field>

          <Field id={ids.date} label="Sana va vaqt" required error={show('date')} hint={dateInWords(ymd, now.ymd)}>
            <div className="grid grid-cols-[minmax(0,1fr)_136px] gap-2 @max-[21.75rem]/form:grid-cols-1">
              <input
                id={ids.date}
                type="date"
                value={ymd}
                max={now.ymd}
                onChange={(e) => {
                  setYmd(e.target.value);
                  setDateTouched(true);
                  touch();
                }}
                aria-invalid={!!show('date') || undefined}
                aria-describedby={`${ids.date}-msg`}
                className={cn(CONTROL, 'px-3 tabular-nums dark:[color-scheme:dark]')}
              />
              <input
                id={ids.time}
                type="time"
                value={hm}
                onChange={(e) => {
                  setHm(e.target.value);
                  setDateTouched(true);
                  touch();
                }}
                aria-label="Vaqt"
                className={cn(CONTROL, 'px-3 tabular-nums dark:[color-scheme:dark]')}
              />
            </div>
          </Field>

          <div className="min-w-0">
            <p id={ids.payment} className="mb-1 text-[13px] font-semibold text-mc-text-2">
              To'lov usuli
            </p>
            <div role="radiogroup" aria-labelledby={ids.payment} className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(({ value, label, Icon }) => {
                const active = payment === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setPayment(value);
                      touch();
                    }}
                    className={cn(
                      'flex h-12 items-center justify-center gap-2 rounded-mc-sm border text-[15px] font-semibold pointer-fine:h-10 transition-[border-color,background-color] active:scale-[0.98]',
                      active
                        ? 'border-mc-brand/70 bg-mc-brand-soft text-mc-brand'
                        : 'border-transparent bg-mc-surface-2 text-mc-text hover:border-mc-border',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field id={ids.employee} label="Kim oldi">
            <SelectBox
              id={ids.employee}
              icon={<User className="h-[18px] w-[18px]" />}
              value={employeeId}
              display={employeeOptions.find((e) => String(e.id) === employeeId)?.full_name ?? 'Xodimni tanlang'}
              onChange={(v) => {
                setEmployeeId(v);
                touch();
              }}
            >
              <option value="">Xodimni tanlang</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </SelectBox>
          </Field>

          <div className="min-w-0">
            <p id={ids.files} className="mb-1 text-[13px] font-semibold text-mc-text-2">
              Chek yoki rasm <span className="font-medium">(ixtiyoriy)</span>
            </p>
            <div
              role="group"
              aria-labelledby={ids.files}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                'flex flex-wrap gap-2 rounded-mc-sm transition-shadow',
                dragging && 'ring-2 ring-mc-brand/50 ring-offset-4 ring-offset-mc-surface',
              )}
            >
              {images.map((url, i) => (
                <div key={url} className="relative h-16 w-16 overflow-hidden rounded-mc-sm bg-mc-surface-2 pointer-fine:h-14 pointer-fine:w-14">
                  {isPdf(url) ? (
                    <span className="flex h-full items-center justify-center text-[12px] font-bold text-mc-text-2">PDF</span>
                  ) : (
                    <img src={url} alt={`Chek ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    aria-label={`Chek ${i + 1} ni olib tashlash`}
                    onClick={() => {
                      setImages((prev) => prev.filter((u) => u !== url));
                      touch();
                    }}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {pending.map((file, i) => (
                <div key={`${file.name}-${i}`} className="relative h-16 w-16 overflow-hidden rounded-mc-sm bg-mc-surface-2 pointer-fine:h-14 pointer-fine:w-14">
                  {previews[i] ? (
                    <img src={previews[i]} alt={file.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[12px] font-bold text-mc-text-2">PDF</span>
                  )}
                  <button
                    type="button"
                    aria-label={`${file.name} ni olib tashlash`}
                    onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-mc-sm border border-dashed pointer-fine:h-14 pointer-fine:w-14 border-mc-text-3/50 text-[11px] font-semibold text-mc-text-2 transition-colors hover:border-mc-brand/60 hover:text-mc-text active:scale-95"
              >
                <Camera className="h-[18px] w-[18px]" />
                Kamera
              </button>
              <button
                type="button"
                onClick={() => filesRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-mc-sm border border-dashed pointer-fine:h-14 pointer-fine:w-14 border-mc-text-3/50 text-[11px] font-semibold text-mc-text-2 transition-colors hover:border-mc-brand/60 hover:text-mc-text active:scale-95"
              >
                <ImagePlus className="h-[18px] w-[18px]" />
                Fayl
              </button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={filesRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {editing && (
            <Field id={ids.reason} label="O'zgarish sababi" required error={show('reason')}>
              <input
                id={ids.reason}
                type="text"
                value={reason}
                maxLength={500}
                onChange={(e) => {
                  setReason(e.target.value);
                  touch();
                }}
                placeholder="Nima uchun o'zgartirilmoqda?"
                aria-invalid={!!show('reason') || undefined}
                aria-describedby={`${ids.reason}-msg`}
                className={CONTROL}
              />
            </Field>
          )}
        </div>
      </div>

      <footer
        className={cn(
          'flex shrink-0 gap-3 px-4 pt-4 @2xl/form:justify-end',
          sheet ? 'border-t border-mc-border pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3' : 'pb-4',
        )}
      >
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="h-12 flex-1 rounded-mc-sm border border-mc-border bg-mc-surface text-[15px] font-semibold pointer-fine:h-10 text-mc-text transition-colors hover:bg-mc-surface-2 active:scale-[0.98] disabled:opacity-50 @2xl/form:max-w-[180px]"
        >
          Bekor qilish
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          aria-busy={busy}
          className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-mc-sm bg-mc-brand pointer-fine:h-10 text-[15px] font-bold text-mc-on-brand transition-[background-color,transform] hover:bg-mc-brand-strong active:scale-[0.98] disabled:opacity-60 @2xl/form:max-w-[260px]"
        >
          <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
          {busy ? 'Saqlanmoqda…' : editing ? "O'zgarishni saqlash" : 'Rasxodni saqlash'}
        </button>
      </footer>
    </section>
  );
}
