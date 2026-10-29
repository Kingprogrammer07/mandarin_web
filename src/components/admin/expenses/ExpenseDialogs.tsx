import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Trash2, X } from 'lucide-react';

import type { Expense } from '@/api/services/expenseService';
import { dmy, formatMoney, spentAt } from '@/lib/expenses';
import { cn } from '@/lib/utils';

import { PAYMENT_LABEL } from './expenseUi';

/** Bottom sheet on a phone, centred card from `sm` up. */
function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-mc-xl border border-mc-border bg-mc-surface text-mc-text outline-none',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-mc-xl sm:shadow-[var(--mc-shadow-card)]',
            wide ? 'sm:max-w-[520px]' : 'sm:max-w-[440px]',
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
            <Dialog.Title className="text-[17px] font-extrabold tracking-tight">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Yopish"
              className="flex h-11 w-11 items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text-2 transition-transform active:scale-95"
            >
              <X className="h-[18px] w-[18px]" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DeleteExpenseDialog({
  expense,
  onClose,
  onConfirm,
  pending,
}: {
  expense: Expense | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const when = expense ? spentAt(expense) : null;
  return (
    <Modal open={!!expense} onOpenChange={(o) => !o && !pending && onClose()} title="Rasxodni o'chirish">
      {expense && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim() && !pending) onConfirm(reason.trim());
          }}
        >
          <div className="rounded-mc-md bg-mc-surface-2 p-4">
            <p className="break-words text-[15px] font-semibold text-mc-text">{expense.description || '—'}</p>
            <p className="mt-1 text-[13px] text-mc-text-2">
              {when && `${dmy(when.ymd)} ${when.hm} · `}
              {expense.category_name} · {PAYMENT_LABEL[expense.payment_method]}
              {expense.employee_name && ` · ${expense.employee_name}`}
            </p>
            <p className="mt-3 text-[22px] font-extrabold tabular-nums tracking-tight text-mc-text">
              {formatMoney(expense.amount)} <span className="text-[14px] font-semibold text-mc-text-2">so'm</span>
            </p>
          </div>
          <label htmlFor="expense-delete-reason" className="mb-1.5 mt-4 block text-[13px] font-semibold text-mc-text-2">
            O'chirish sababi <span className="text-mc-brand">*</span>
          </label>
          <input
            id="expense-delete-reason"
            autoFocus
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: ikki marta kiritilgan"
            className="h-12 w-full rounded-mc-sm border border-transparent bg-mc-surface-2 px-3.5 text-base font-medium text-mc-text outline-none placeholder:text-mc-text-2 focus:border-mc-danger/60 focus:bg-mc-surface focus:ring-4 focus:ring-mc-danger/10"
          />
          <p className="mt-2 text-[12px] font-medium text-mc-text-2">
            Rasxod jami summadan chiqadi. Sabab va kim o'chirgani saqlanib qoladi.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-12 flex-1 rounded-mc-sm border border-mc-border bg-mc-surface text-[15px] font-semibold text-mc-text transition-colors hover:bg-mc-surface-2 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || pending}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-mc-sm bg-mc-danger-fill text-[15px] font-bold text-mc-on-danger transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="h-[18px] w-[18px]" />
              {pending ? "O'chirilmoqda…" : "O'chirish"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function ReferenceDialog({
  open,
  onClose,
  title,
  addPlaceholder,
  removeNote,
  items,
  onAdd,
  onRemove,
  adding,
  removingId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  addPlaceholder: string;
  removeNote: string;
  items: { id: number; name: string }[];
  onAdd: (name: string) => void;
  onRemove: (id: number) => void;
  adding: boolean;
  removingId: number | null;
}) {
  const [name, setName] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const confirmItem = items.find((i) => i.id === confirmId);

  const add = () => {
    const value = name.trim();
    if (!value || adding) return;
    onAdd(value);
    setName('');
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={title} wide>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={name}
          maxLength={128}
          onChange={(e) => setName(e.target.value)}
          placeholder={addPlaceholder}
          aria-label={addPlaceholder}
          className="h-12 min-w-0 flex-1 rounded-mc-sm border border-transparent bg-mc-surface-2 px-3.5 text-base font-medium text-mc-text outline-none placeholder:text-mc-text-2 focus:border-mc-brand/60 focus:bg-mc-surface focus:ring-4 focus:ring-mc-brand/10"
        />
        <button
          type="submit"
          disabled={!name.trim() || adding}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-mc-sm bg-mc-brand px-4 text-[15px] font-bold text-mc-on-brand transition-colors hover:bg-mc-brand-strong disabled:opacity-50"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
          Qo'shish
        </button>
      </form>

      <ul className="mt-4 divide-y divide-mc-border">
        {items.map((item) => (
          <li key={item.id} className="flex min-h-12 items-center gap-3 py-1">
            <span className="min-w-0 flex-1 break-words text-[15px] font-medium text-mc-text">{item.name}</span>
            <button
              type="button"
              onClick={() => setConfirmId(item.id)}
              disabled={removingId === item.id}
              aria-label={`${item.name} ni o'chirish`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 transition-colors hover:bg-mc-danger-soft hover:text-mc-danger disabled:opacity-40"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="py-6 text-center text-[14px] text-mc-text-2">Hali hech narsa qo'shilmagan.</li>}
      </ul>

      {confirmItem && (
        <div role="alertdialog" aria-label="O'chirishni tasdiqlang" className="mt-4 rounded-mc-md bg-mc-danger-soft p-4">
          <p className="text-[14px] font-semibold text-mc-text">«{confirmItem.name}» o'chirilsinmi?</p>
          <p className="mt-1 text-[12px] font-medium text-mc-text-2">{removeNote}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmId(null)}
              className="h-11 flex-1 rounded-mc-sm border border-mc-border bg-mc-surface text-[14px] font-semibold text-mc-text"
            >
              Yo'q
            </button>
            <button
              type="button"
              onClick={() => {
                onRemove(confirmItem.id);
                setConfirmId(null);
              }}
              className="h-11 flex-1 rounded-mc-sm bg-mc-danger-fill text-[14px] font-bold text-mc-on-danger"
            >
              Ha, o'chirish
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ReceiptViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Dialog.Root open={!!url} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/85" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 outline-none"
          onClick={onClose}
        >
          <Dialog.Title className="sr-only">Chek rasmi</Dialog.Title>
          {url && (
            <img
              src={url}
              alt="Chek rasmi"
              className="max-h-[90dvh] max-w-full rounded-mc-md object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Dialog.Close
            aria-label="Yopish"
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
