/**
 * «Rasxodlar ro'yxati»: filters, the period's totals, and the rows — a table
 * where the card is wide enough (container query on the card, not the
 * viewport: the admin sidebar and the form column both take width), stacked
 * rows on a phone. Nothing is computed here: counts and sums come from the
 * server for the same filters the rows were read with.
 */

import { Fragment, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Layers,
  Lock,
  Paperclip,
  Pencil,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { useExpenseHistory } from '@/api/hooks/useExpenses';
import type {
  Expense,
  ExpenseCategory,
  ExpenseEmployee,
  ExpenseFilters,
  ExpenseSummaryResponse,
  PaymentMethod,
} from '@/api/services/expenseService';
import {
  dmy,
  formatMoney,
  rangeLabel,
  rangePresets,
  spentAt,
  tashkentClock,
  wallClockOf,
  type DateRange,
} from '@/lib/expenses';
import { cn } from '@/lib/utils';

import { PAYMENT_LABEL, PAYMENT_METHODS, categoryTint } from './expenseUi';

export type ExpenseSort = NonNullable<ExpenseFilters['sort']>;

const SORTS: { value: ExpenseSort; label: string }[] = [
  { value: 'created_desc', label: 'Eng yangi' },
  { value: 'created_asc', label: 'Eng eski' },
  { value: 'amount_desc', label: 'Summa: kattasi' },
  { value: 'amount_asc', label: 'Summa: kichigi' },
];

const CHIP =
  'h-11 shrink-0 appearance-none rounded-mc-sm border text-base font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-mc-brand/15';
const CHIP_IDLE = 'border-mc-border bg-mc-surface text-mc-text hover:bg-mc-surface-2';
const CHIP_ON = 'border-mc-brand/50 bg-mc-brand-soft text-mc-brand';

function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {formatMoney(value)} <span className="text-[0.8em] font-semibold text-mc-text-2">so'm</span>
    </span>
  );
}

function FilterSelect({
  label,
  value,
  active,
  onChange,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CHIP, 'max-w-[220px] truncate pl-3.5 pr-9', active ? CHIP_ON : CHIP_IDLE)}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2',
          active ? 'text-mc-brand' : 'text-mc-text-2',
        )}
      />
    </label>
  );
}

function DateRangeFilter({
  value,
  today,
  onChange,
}: {
  value: DateRange;
  today: string;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const presets = rangePresets(today);
  const activeKey = presets.find((p) => p.from === value.from && p.to === value.to)?.key;
  const input =
    'h-12 w-full rounded-mc-sm border border-transparent bg-mc-surface-2 px-3 text-base font-medium text-mc-text outline-none focus:border-mc-brand/60 focus:bg-mc-surface';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(CHIP, CHIP_IDLE, 'flex items-center gap-2 pl-3 pr-3 tabular-nums')}
        aria-label={`Davr: ${rangeLabel(value)}`}
      >
        <CalendarDays className="h-[18px] w-[18px] text-mc-text-2" />
        <span className="whitespace-nowrap">{rangeLabel(value)}</span>
        <ChevronDown className="h-4 w-4 text-mc-text-2" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[1000] w-[min(320px,calc(100vw-24px))] rounded-mc-lg border border-mc-border bg-mc-surface p-3 text-mc-text shadow-[var(--mc-shadow-card)] outline-none"
        >
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onChange({ from: p.from, to: p.to });
                  setOpen(false);
                }}
                className={cn(
                  'h-11 rounded-mc-sm px-3 text-left text-[14px] font-semibold transition-colors',
                  activeKey === p.key ? 'bg-mc-brand-soft text-mc-brand' : 'bg-mc-surface-2 text-mc-text hover:bg-mc-border',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <label className="text-[12px] font-semibold text-mc-text-2">
              Dan
              <input
                type="date"
                value={value.from ?? ''}
                max={today}
                onChange={(e) => {
                  const from = e.target.value || undefined;
                  onChange({ from, to: from && value.to && value.to < from ? from : value.to });
                }}
                className={cn(input, 'mt-1')}
              />
            </label>
            <label className="text-[12px] font-semibold text-mc-text-2">
              Gacha
              <input
                type="date"
                value={value.to ?? ''}
                max={today}
                onChange={(e) => {
                  const to = e.target.value || undefined;
                  onChange({ from: to && value.from && value.from > to ? to : value.from, to });
                }}
                className={cn(input, 'mt-1')}
              />
            </label>
          </div>
          <p className="mt-2 text-[12px] font-medium text-mc-text-2">Kassaga kiritilgan kun bo'yicha, Toshkent vaqti.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CategoryChip({ id, name, className }: { id: number; name: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex max-w-[180px] items-center rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none',
        categoryTint(id),
        className,
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

function PaymentChip({ method }: { method: PaymentMethod }) {
  const m = PAYMENT_METHODS.find((p) => p.value === method);
  const Icon = m?.Icon;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-mc-surface-2 px-2.5 py-1 text-[12px] font-semibold leading-none text-mc-text">
      {Icon && <Icon className="h-3.5 w-3.5 text-mc-text-2" />}
      {m?.label ?? method}
    </span>
  );
}

const HISTORY_FIELD: Record<string, string> = {
  category: 'Rasxod turi',
  employee: 'Kim oldi',
  amount: 'Summa',
  payment_method: "To'lov usuli",
  description: 'Tavsif',
  expense_date: 'Sana',
  images: 'Cheklar soni',
};

function historyValue(field: string, value: string | null): string {
  if (!value) return '—';
  if (field === 'amount' && /^\d+(\.\d+)?$/.test(value)) return `${formatMoney(Number(value))} so'm`;
  if (field === 'payment_method') return PAYMENT_LABEL[value as PaymentMethod] ?? value;
  const wc = wallClockOf(value);
  return wc ? `${dmy(wc.ymd)} ${wc.hm}` : value;
}

function moment(iso: string | null): string {
  const c = iso ? tashkentClock(iso) : null;
  return c ? `${dmy(c.ymd)} ${c.hm}` : '—';
}

function History({ expenseId }: { expenseId: number }) {
  const { data, isLoading, isError } = useExpenseHistory(expenseId);
  if (isLoading) return <p className="text-[13px] text-mc-text-2">Tarix yuklanmoqda…</p>;
  if (isError) return <p className="text-[13px] text-mc-danger">Tarixni yuklab bo'lmadi.</p>;
  if (!data?.length) return null;
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-mc-text-2">O'zgarishlar tarixi</p>
      <ul className="space-y-2">
        {data.map((h) => (
          <li key={h.id} className="text-[13px] leading-snug">
            <span className="font-semibold text-mc-text">{HISTORY_FIELD[h.field_name] ?? h.field_name}:</span>{' '}
            <span className="text-mc-text-2 line-through">{historyValue(h.field_name, h.old_value)}</span>
            {' → '}
            <span className="font-semibold text-mc-text">{historyValue(h.field_name, h.new_value)}</span>
            <span className="block text-[12px] text-mc-text-2">
              {h.changed_by_username ?? '—'} · {moment(h.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Details({
  expense,
  onOpenReceipt,
  actions,
}: {
  expense: Expense;
  onOpenReceipt: (url: string) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-mc-md bg-mc-surface-2 p-4">
      <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-mc-text-2">Tavsif</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words font-medium text-mc-text">{expense.description || '—'}</dd>
        </div>
        <div>
          <dt className="text-mc-text-2">Kiritgan kassir</dt>
          <dd className="mt-0.5 font-medium text-mc-text">
            {expense.created_by_username ?? '—'} · {moment(expense.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-mc-text-2">Kim oldi · to'lov</dt>
          <dd className="mt-0.5 font-medium text-mc-text">
            {expense.employee_name ?? '—'} · {PAYMENT_LABEL[expense.payment_method]}
          </dd>
        </div>
        {expense.edited_at && (
          <div className="sm:col-span-2">
            <dt className="text-mc-text-2">Oxirgi tahrir</dt>
            <dd className="mt-0.5 break-words font-medium text-mc-text">
              {expense.edit_reason ?? '—'} · {expense.edited_by_username ?? '—'}, {moment(expense.edited_at)}
            </dd>
          </div>
        )}
      </dl>

      {expense.images.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] text-mc-text-2">Cheklar</p>
          <div className="flex flex-wrap gap-2">
            {expense.images.map((url, i) =>
              url.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-mc-sm bg-mc-surface text-[12px] font-bold text-mc-text-2"
                >
                  <FileText className="h-5 w-5" />
                  PDF
                </a>
              ) : (
                <button
                  key={url}
                  type="button"
                  onClick={() => onOpenReceipt(url)}
                  aria-label={`Chek ${i + 1} ni ochish`}
                  className="h-16 w-16 overflow-hidden rounded-mc-sm bg-mc-surface"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {expense.edited_at && <History expenseId={expense.id} />}
      {actions}
    </div>
  );
}

/** The phone's edit and delete: inside the opened row, wide, away from the scroll path. */
function WideActions({
  expense,
  locked,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  locked: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(expense)}
          disabled={locked}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface text-[14px] font-semibold text-mc-text active:scale-[0.98] disabled:opacity-40"
        >
          <Pencil className="h-4 w-4" />
          Tahrirlash
        </button>
        <button
          type="button"
          onClick={() => onDelete(expense)}
          disabled={locked}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-mc-sm bg-mc-danger-soft text-[14px] font-semibold text-mc-danger active:scale-[0.98] disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          O'chirish
        </button>
      </div>
      {locked && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-mc-text-2">
          <Lock className="h-3.5 w-3.5" />
          24 soatdan keyin faqat super-admin o'zgartira oladi.
        </p>
      )}
    </div>
  );
}

function RowActions({
  expense,
  locked,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  locked: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const box = 'h-9 w-9';
  const lockNote = "24 soatdan keyin faqat super-admin o'zgartiradi";
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(expense);
        }}
        disabled={locked}
        title={locked ? lockNote : 'Tahrirlash'}
        aria-label={`№${expense.id} ni tahrirlash`}
        className={cn(
          box,
          'flex items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text transition-colors hover:bg-mc-border active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        {locked ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(expense);
        }}
        disabled={locked}
        title={locked ? lockNote : "O'chirish"}
        aria-label={`№${expense.id} ni o'chirish`}
        className={cn(
          box,
          'flex items-center justify-center rounded-mc-sm bg-mc-danger-soft text-mc-danger transition-opacity hover:opacity-80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Meta({ expense }: { expense: Expense }) {
  const bits: ReactNode[] = [];
  if (expense.images.length) {
    bits.push(
      <span key="r" className="inline-flex items-center gap-1">
        <Paperclip className="h-3.5 w-3.5" />
        {expense.images.length} chek
      </span>,
    );
  }
  if (expense.edited_at) bits.push(<span key="e" className="font-semibold text-mc-warn">tahrirlangan</span>);
  if (!bits.length) return null;
  return <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[12px] text-mc-text-2">{bits}</span>;
}

export interface ExpenseListProps {
  rows: Expense[];
  total: number;
  page: number;
  perPage: number;
  onPage: (page: number) => void;
  loading: boolean;
  /** New filters are loading while the old rows stay on screen. */
  refreshing: boolean;
  error: boolean;
  onRetry: () => void;
  summary: ExpenseSummaryResponse | undefined;
  summaryLoading: boolean;

  today: string;
  range: DateRange;
  onRange: (range: DateRange) => void;
  categoryId: number | undefined;
  onCategory: (id: number | undefined) => void;
  payment: PaymentMethod | undefined;
  onPayment: (m: PaymentMethod | undefined) => void;
  employeeId: number | undefined;
  onEmployee: (id: number | undefined) => void;
  search: string;
  onSearch: (text: string) => void;
  sort: ExpenseSort;
  onSort: (sort: ExpenseSort) => void;
  onReset: () => void;
  categories: ExpenseCategory[];
  employees: ExpenseEmployee[];

  canModify: (e: Expense) => boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  onOpenReceipt: (url: string) => void;
  onExport: () => void;
  exporting: boolean;
  onPrint: () => void;
  printing: boolean;
}

export function ExpenseList(props: ExpenseListProps) {
  const {
    rows,
    total,
    page,
    perPage,
    onPage,
    loading,
    refreshing,
    error,
    onRetry,
    summary,
    summaryLoading,
    today,
    range,
    categoryId,
    payment,
    employeeId,
    search,
    sort,
    categories,
    employees,
  } = props;
  const [openId, setOpenId] = useState<number | null>(null);
  const toggle = (id: number) => setOpenId((cur) => (cur === id ? null : id));
  const pages = Math.max(1, Math.ceil(total / perPage));
  const filtered = categoryId !== undefined || payment !== undefined || employeeId !== undefined || search.trim() !== '';
  const isToday = range.from === today && range.to === today;
  const cash = summary?.payment_method_breakdown.cash;
  const card = summary?.payment_method_breakdown.card;

  return (
    <section
      aria-labelledby="expense-list-title"
      className="@container/list min-w-0 rounded-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]"
    >
      <header className="flex items-center gap-3 px-4 pb-4 pt-5 @lg/list:px-5">
        <span
          aria-hidden
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mc-brand-soft text-mc-brand @sm/list:flex"
        >
          <Layers className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>
        <h2 id="expense-list-title" className="min-w-0 flex-1 text-[18px] font-extrabold leading-tight tracking-tight text-mc-text">
          Rasxodlar ro'yxati
        </h2>
        <button
          type="button"
          onClick={props.onExport}
          disabled={props.exporting}
          aria-label="Excelga yuklab olish"
          className="flex h-11 shrink-0 items-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[14px] font-semibold text-mc-text transition-colors hover:bg-mc-surface-2 disabled:opacity-50 @lg/list:px-4"
        >
          <Download className="h-[18px] w-[18px]" />
          <span className="hidden @md/list:inline">{props.exporting ? 'Yuklanmoqda…' : 'Excel'}</span>
        </button>
        <button
          type="button"
          onClick={props.onPrint}
          disabled={props.printing}
          aria-label="Chop etish"
          className="flex h-11 shrink-0 items-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[14px] font-semibold text-mc-text transition-colors hover:bg-mc-surface-2 disabled:opacity-50 @lg/list:px-4"
        >
          <Printer className="h-[18px] w-[18px]" />
          <span className="hidden @md/list:inline">{props.printing ? 'Tayyorlanmoqda…' : 'Chop etish'}</span>
        </button>
      </header>

      {/* Filters: search on its own line and a sideways-scrolling chip row on a
          phone; one wrapping row on a wide card. */}
      <div className="flex flex-col gap-2 px-4 @3xl/list:flex-row @3xl/list:flex-wrap @3xl/list:items-center @lg/list:px-5">
        <div className="relative @3xl/list:order-last @3xl/list:min-w-[220px] @3xl/list:flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-mc-text-2" />
          <input
            type="search"
            value={search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder="Tavsif, toifa, xodim, summa…"
            aria-label="Qidirish"
            maxLength={100}
            className="h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface pl-11 pr-11 text-base font-medium text-mc-text outline-none placeholder:text-mc-text-2 focus:border-mc-brand/60 focus:ring-4 focus:ring-mc-brand/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => props.onSearch('')}
              aria-label="Qidiruvni tozalash"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-mc-sm text-mc-text-2 hover:bg-mc-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @xl/list:mx-0 @xl/list:flex-wrap @xl/list:overflow-visible @xl/list:px-0 @xl/list:pb-0 @3xl/list:contents [&::-webkit-scrollbar]:hidden">
          <DateRangeFilter value={range} today={today} onChange={props.onRange} />
          <FilterSelect
            label="Rasxod turi"
            value={categoryId === undefined ? '' : String(categoryId)}
            active={categoryId !== undefined}
            onChange={(v) => props.onCategory(v ? Number(v) : undefined)}
          >
            <option value="">Barcha rasxod turlari</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="To'lov usuli"
            value={payment ?? ''}
            active={payment !== undefined}
            onChange={(v) => props.onPayment((v || undefined) as PaymentMethod | undefined)}
          >
            <option value="">Barcha to'lov usullari</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Kim oldi"
            value={employeeId === undefined ? '' : String(employeeId)}
            active={employeeId !== undefined}
            onChange={(v) => props.onEmployee(v ? Number(v) : undefined)}
          >
            <option value="">Barcha xodimlar</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Saralash" value={sort} active={false} onChange={(v) => props.onSort(v as ExpenseSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      {/* The period's totals, read from the server for the same filters. */}
      <div
        aria-live="polite"
        className="mx-4 mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-mc-md bg-mc-surface-2 px-4 py-3 @lg/list:mx-5"
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-mc-text-2">Jami rasxod</p>
          <p className="text-[22px] font-extrabold leading-tight tracking-tight text-mc-text">
            {summary ? <Money value={summary.total_amount} /> : summaryLoading ? '…' : '—'}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <div className="flex gap-1.5">
            <dt className="text-mc-text-2">Naqd</dt>
            <dd className="font-semibold text-mc-text">{summary ? <Money value={cash?.amount ?? 0} /> : '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-mc-text-2">Karta</dt>
            <dd className="font-semibold text-mc-text">{summary ? <Money value={card?.amount ?? 0} /> : '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-mc-text-2">Yozuvlar</dt>
            <dd className="font-semibold tabular-nums text-mc-text">{summary ? summary.total_count : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-2">
        {error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[15px] font-semibold text-mc-text">Rasxodlarni yuklab bo'lmadi.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 h-11 rounded-mc-sm border border-mc-border px-4 text-[14px] font-semibold text-mc-text hover:bg-mc-surface-2"
            >
              Qayta urinish
            </button>
          </div>
        ) : loading && rows.length === 0 ? (
          <div aria-busy className="space-y-3 px-5 py-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-20 animate-pulse rounded bg-mc-surface-2" />
                <div className="h-4 flex-1 animate-pulse rounded bg-mc-surface-2" />
                <div className="h-4 w-24 animate-pulse rounded bg-mc-surface-2" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[15px] font-semibold text-mc-text">
              {filtered ? 'Filtrga mos rasxod topilmadi.' : isToday ? "Bugun hali rasxod yo'q." : "Bu davrda rasxod yo'q."}
            </p>
            {(filtered || isToday) && (
              <button
                type="button"
                onClick={() => {
                  if (filtered) return props.onReset();
                  const month = rangePresets(today).find((p) => p.key === 'month');
                  props.onRange({ from: month?.from, to: month?.to });
                }}
                className="mt-3 h-11 rounded-mc-sm border border-mc-border px-4 text-[14px] font-semibold text-mc-text hover:bg-mc-surface-2"
              >
                {filtered ? 'Filtrlarni tozalash' : "Bu oyni ko'rish"}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Phone: stacked rows. */}
            <ul className={cn('divide-y divide-mc-border @min-[680px]/list:hidden', refreshing && 'opacity-60 transition-opacity')}>
              {rows.map((e) => {
                const when = spentAt(e);
                const open = openId === e.id;
                return (
                  <li key={e.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => toggle(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          toggle(e.id);
                        }
                      }}
                      className="px-4 py-3.5 outline-none focus-visible:bg-mc-surface-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 min-w-0 break-words text-[15px] font-semibold leading-snug text-mc-text">
                          {e.description || '—'}
                        </p>
                        <Money value={e.amount} className="shrink-0 text-[15px] font-extrabold text-mc-text" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <CategoryChip id={e.category_id} name={e.category_name} />
                        <PaymentChip method={e.payment_method} />
                        <Meta expense={e} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="min-w-0 break-words text-[13px] text-mc-text-2">
                          {when ? `${dmy(when.ymd)} ${when.hm}` : '—'}
                          {e.employee_name && ` · ${e.employee_name}`}
                        </p>
                        <ChevronDown
                          aria-hidden
                          className={cn('h-4 w-4 shrink-0 text-mc-text-2 transition-transform', open && 'rotate-180')}
                        />
                      </div>
                    </div>
                    {open && (
                      <div className="px-4 pb-4">
                        <Details
                          expense={e}
                          onOpenReceipt={props.onOpenReceipt}
                          actions={
                            <WideActions expense={e} locked={!props.canModify(e)} onEdit={props.onEdit} onDelete={props.onDelete} />
                          }
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Wide card: the table. Payment and "Kim oldi" get their own
                columns from @5xl; below that they ride under the description. */}
            <div className={cn('hidden px-2 @min-[680px]/list:block', refreshing && 'opacity-60 transition-opacity')}>
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-mc-text-2">
                    <th scope="col" className="w-10 px-3 py-3 text-right font-semibold">#</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Sana / vaqt</th>
                    <th scope="col" className="w-full px-3 py-3 font-semibold">Tavsif</th>
                    <th scope="col" className="hidden px-3 py-3 font-semibold @5xl/list:table-cell">Rasxod turi</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Summa</th>
                    <th scope="col" className="hidden px-3 py-3 font-semibold @5xl/list:table-cell">To'lov usuli</th>
                    <th scope="col" className="hidden px-3 py-3 font-semibold @5xl/list:table-cell">Kim oldi</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e, i) => {
                    const when = spentAt(e);
                    const open = openId === e.id;
                    const cell = cn('border-t border-mc-border px-3 py-3 align-middle', open && 'bg-mc-surface-2/60');
                    return (
                      <Fragment key={e.id}>
                        <tr onClick={() => toggle(e.id)} className="cursor-pointer transition-colors hover:bg-mc-surface-2/60">
                          <td className={cn(cell, 'text-right text-[13px] tabular-nums text-mc-text-2')}>
                            {(page - 1) * perPage + i + 1}
                          </td>
                          <td className={cn(cell, 'whitespace-nowrap tabular-nums')}>
                            <span className="block text-[13px] font-semibold text-mc-text">{when ? dmy(when.ymd) : '—'}</span>
                            <span className="block text-[12px] text-mc-text-2">{when?.hm}</span>
                          </td>
                          <td className={cn(cell, 'max-w-0')}>
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                toggle(e.id);
                              }}
                              title={e.description ?? undefined}
                              className="block w-full truncate text-left text-[14px] font-semibold text-mc-text outline-none focus-visible:underline"
                            >
                              {e.description || '—'}
                            </button>
                            <span className="mt-1 flex min-w-0 items-center gap-2 text-[12px] text-mc-text-2">
                              <CategoryChip
                                id={e.category_id}
                                name={e.category_name}
                                className="max-w-[160px] shrink-0 @5xl/list:hidden"
                              />
                              <span className="truncate @5xl/list:hidden">
                                {PAYMENT_LABEL[e.payment_method]}
                                {e.employee_name && ` · ${e.employee_name}`}
                              </span>
                              <Meta expense={e} />
                            </span>
                          </td>
                          <td className={cn(cell, 'hidden @5xl/list:table-cell')}>
                            <CategoryChip id={e.category_id} name={e.category_name} />
                          </td>
                          <td className={cn(cell, 'text-right')}>
                            <Money value={e.amount} className="text-[14px] font-extrabold text-mc-text" />
                          </td>
                          <td className={cn(cell, 'hidden @5xl/list:table-cell')}>
                            <PaymentChip method={e.payment_method} />
                          </td>
                          <td className={cn(cell, 'hidden max-w-[160px] @5xl/list:table-cell')}>
                            <span className="block truncate text-[13px] text-mc-text">{e.employee_name ?? '—'}</span>
                          </td>
                          <td className={cell}>
                            <div className="flex justify-end">
                              <RowActions expense={e} locked={!props.canModify(e)} onEdit={props.onEdit} onDelete={props.onDelete} />
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={8} className="px-3 pb-3">
                              <Details expense={e} onOpenReceipt={props.onOpenReceipt} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-mc-border px-4 py-3 @lg/list:px-5">
        <p className="text-[13px] font-semibold text-mc-text-2">
          Jami: <span className="tabular-nums text-mc-text">{total}</span> ta yozuv
          {pages > 1 && (
            <span className="font-medium">
              {' '}
              · {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} ko'rsatilgan
            </span>
          )}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              aria-label="Oldingi sahifa"
              className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text hover:bg-mc-surface-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <span className="min-w-[64px] text-center text-[13px] font-semibold tabular-nums text-mc-text">
              {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => onPage(page + 1)}
              disabled={page >= pages}
              aria-label="Keyingi sahifa"
              className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text hover:bg-mc-surface-2 disabled:opacity-40"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </footer>
    </section>
  );
}
