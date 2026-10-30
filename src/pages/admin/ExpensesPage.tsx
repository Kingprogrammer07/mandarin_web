/**
 * /admin/expenses — «Rasxodlar».
 *
 * The form sits beside the list when the page is wide, above it on a laptop
 * with the sidebar open, and in a bottom sheet on a phone. The layout follows
 * the page's own width, not the window's: the admin sidebar and a cashier's
 * full-screen view leave very different room.
 *
 * Money rules live in `@/lib/expenses`; the list, its totals and the Excel
 * file all go to the server with one filter object.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Plus, Tags, Users } from 'lucide-react';
import { toast } from 'sonner';

import {
  useCreateExpenseCategory,
  useCreateExpenseEmployee,
  useDeactivateExpenseEmployee,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useExpenseEmployees,
  useExpenses,
  useExpenseSummary,
} from '@/api/hooks/useExpenses';
import {
  expenseService,
  type Expense,
  type ExpenseFilters,
  type PaymentMethod,
} from '@/api/services/expenseService';
import { DeleteExpenseDialog, ReceiptViewer, ReferenceDialog } from '@/components/admin/expenses/ExpenseDialogs';
import { ExpenseForm } from '@/components/admin/expenses/ExpenseForm';
import { ExpenseList, type ExpenseSort } from '@/components/admin/expenses/ExpenseList';
import { ExpensePrint, type PrintJob } from '@/components/admin/expenses/ExpensePrint';
import { PAYMENT_LABEL } from '@/components/admin/expenses/expenseUi';
import { rangeLabel, tashkentNow, within24h, type DateRange } from '@/lib/expenses';
import { cn } from '@/lib/utils';

const PER_PAGE = 50;
/**
 * Below PHONE the form moves into a sheet. From SPLIT up it stands beside the
 * list: a 352px form column (date and time still fit side by side) plus the
 * 640px the table needs. A 1366px laptop with the sidebar open clears it.
 */
const PHONE = 768;
const SPLIT = 1008;

function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useLayoutEffect(() => {
    const el = ref.current;
    // jsdom has no ResizeObserver: the window's width stands in.
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The first report arrives before the first paint, so there is no flash.
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function readIsSuperAdmin(): boolean {
  try {
    return localStorage.getItem('admin_role') === 'super-admin';
  } catch {
    return false;
  }
}

/** Every page of the filtered list, for paper. Refuses a list that moved while it was read. */
async function fetchAllRows(filters: ExpenseFilters): Promise<Expense[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const first = await expenseService.getExpenses(1, 100, filters);
    const pages = Math.ceil(first.total / 100);
    if (pages > 50) throw new Error('too-many');
    let rows = first.items;
    for (let p = 2; p <= pages; p += 1) {
      rows = rows.concat((await expenseService.getExpenses(p, 100, filters)).items);
    }
    const seen = new Set<number>();
    const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    if (unique.length === first.total) return unique;
  }
  throw new Error('changed');
}

function PhoneSheet({
  open,
  onClose,
  titleId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      back?.focus?.();
    };
  }, [open]);

  // Always mounted, only hidden: a half-typed expense survives closing the sheet.
  return createPortal(
    <div className={cn('fixed inset-0 z-50', !open && 'hidden')}>
      <div aria-hidden className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-mc-xl border-t border-mc-border bg-mc-surface text-mc-text outline-none"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-mc-border" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function ExpensesPage({ standalone = false }: { standalone?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const mode = width < PHONE ? 'phone' : width < SPLIT ? 'stacked' : 'split';
  const titleId = useId();
  const isSuperAdmin = useMemo(readIsSuperAdmin, []);
  const today = tashkentNow().ymd;

  // ── Filters: one object for the list, the totals, Excel and print ──────────
  const [range, setRange] = useState<DateRange>({ from: today, to: today });
  const [categoryId, setCategoryId] = useState<number>();
  const [payment, setPayment] = useState<PaymentMethod>();
  const [employeeId, setEmployeeId] = useState<number>();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<ExpenseSort>('created_desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo<ExpenseFilters>(
    () => ({
      date_from: range.from,
      date_to: range.to,
      category_id: categoryId,
      employee_id: employeeId,
      payment_method: payment,
      q: q || undefined,
    }),
    [range, categoryId, employeeId, payment, q],
  );
  const withPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const list = useExpenses(page, PER_PAGE, { ...filters, sort });
  const summary = useExpenseSummary(filters);
  const { data: categories = [] } = useExpenseCategories();
  const { data: employees = [] } = useExpenseEmployees();

  // A delete or a narrower filter can leave the page past the end.
  const total = list.data?.total ?? 0;
  useEffect(() => {
    const last = Math.max(1, Math.ceil(total / PER_PAGE));
    if (list.data && page > last) setPage(last);
  }, [list.data, total, page]);

  // ── Form: new or editing, inline or in the phone sheet ─────────────────────
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const dirtyRef = useRef(false);
  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const canModify = useCallback((e: Expense) => isSuperAdmin || within24h(e.created_at), [isSuperAdmin]);

  const closeForm = useCallback(() => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setSheetOpen(false);
  }, []);

  const closeSheet = useCallback(() => {
    // Closing an edit drops it; closing a new entry keeps the draft.
    if (editing) closeForm();
    else setSheetOpen(false);
  }, [editing, closeForm]);

  const startEdit = (e: Expense) => {
    if (!canModify(e)) {
      toast.error("24 soatdan oshgan rasxodni faqat super-admin o'zgartira oladi");
      return;
    }
    if (dirtyRef.current && !window.confirm("Formadagi kiritilgan ma'lumotlar o'chadi. Davom etasizmi?")) return;
    setEditing(e);
    setFormKey((k) => k + 1);
    if (mode === 'phone') setSheetOpen(true);
    else requestAnimationFrame(() => formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const deleteMut = useDeleteExpense();
  const startDelete = (e: Expense) => {
    if (!canModify(e)) {
      toast.error("24 soatdan oshgan rasxodni faqat super-admin o'chira oladi");
      return;
    }
    setDeleting(e);
  };
  const confirmDelete = (reason: string) => {
    if (!deleting) return;
    const id = deleting.id;
    deleteMut.mutate(
      { id, reason },
      {
        onSuccess: () => {
          setDeleting(null);
          if (editing?.id === id) closeForm();
        },
      },
    );
  };

  // ── Reference lists ────────────────────────────────────────────────────────
  const [manage, setManage] = useState<'categories' | 'employees' | null>(null);
  const createCategory = useCreateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const createEmployee = useCreateExpenseEmployee();
  const deactivateEmployee = useDeactivateExpenseEmployee();

  // ── Excel and print ────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await expenseService.exportExpenses(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rasxodlar_${range.from ?? 'boshi'}_${range.to ?? today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Excel faylni yuklab bo'lmadi");
    } finally {
      setExporting(false);
    }
  };

  const [printing, setPrinting] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const rows = await fetchAllRows({ ...filters, sort });
      const notes: string[] = [];
      const cat = categories.find((c) => c.id === categoryId);
      const emp = employees.find((e) => e.id === employeeId);
      if (cat) notes.push(`Rasxod turi: ${cat.name}`);
      if (payment) notes.push(`To'lov: ${PAYMENT_LABEL[payment]}`);
      if (emp) notes.push(`Kim oldi: ${emp.full_name}`);
      if (q) notes.push(`Qidiruv: «${q}»`);
      setPrintJob({ id: Date.now(), rows, period: rangeLabel(range), filters: notes });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === 'too-many'
          ? "Yozuvlar juda ko'p. Davrni qisqartiring yoki Excel'dan foydalaning."
          : err instanceof Error && err.message === 'changed'
            ? "Ro'yxat shu payt o'zgardi. Qayta urinib ko'ring."
            : "Chop etish uchun ro'yxatni yuklab bo'lmadi",
      );
    } finally {
      setPrinting(false);
    }
  };
  const donePrinting = useCallback(() => setPrintJob(null), []);

  const [receipt, setReceipt] = useState<string | null>(null);

  const form = (
    <ExpenseForm
      key={formKey}
      editing={editing}
      categories={categories}
      employees={employees}
      onSaved={closeForm}
      onCancelEdit={closeForm}
      onClose={mode === 'phone' ? closeSheet : undefined}
      onDirtyChange={onDirtyChange}
      titleId={titleId}
      sheet={mode === 'phone'}
    />
  );

  return (
    <div className={cn(standalone && 'min-h-dvh bg-mc-bg px-4 py-4 text-mc-text md:px-6 md:py-6')}>
      <div ref={rootRef} className="mx-auto w-full max-w-[1500px]">
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Orqaga"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 transition-colors hover:bg-mc-surface-2 hover:text-mc-text active:scale-95 pointer-fine:h-9 pointer-fine:w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 break-words text-[20px] font-extrabold tracking-tight text-mc-text">Rasxodlar</h1>
          <button
            type="button"
            onClick={() => setManage('categories')}
            aria-label="Rasxod turlari"
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-mc-sm px-3 text-[14px] font-semibold text-mc-text-2 transition-colors hover:bg-mc-surface-2 hover:text-mc-text active:scale-95 pointer-fine:h-9"
          >
            <Tags className="h-4 w-4" />
            <span className={cn(mode === 'phone' && 'sr-only')}>Rasxod turlari</span>
          </button>
          <button
            type="button"
            onClick={() => setManage('employees')}
            aria-label="Xodimlar"
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-mc-sm px-3 text-[14px] font-semibold text-mc-text-2 transition-colors hover:bg-mc-surface-2 hover:text-mc-text active:scale-95 pointer-fine:h-9"
          >
            <Users className="h-4 w-4" />
            <span className={cn(mode === 'phone' && 'sr-only')}>Xodimlar</span>
          </button>
        </div>

        {mode === 'phone' && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-mc-md bg-mc-brand text-[16px] font-bold text-mc-on-brand transition-transform active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
            {editing ? 'Tahrirni davom ettirish' : "Yangi rasxod qo'shish"}
          </button>
        )}

        <div className={cn('grid gap-4', mode === 'split' && 'grid-cols-[352px_minmax(0,1fr)] items-start')}>
          {mode !== 'phone' && (
            <div
              ref={formCardRef}
              className={cn(
                'scroll-mt-4 rounded-mc-xl border bg-mc-surface shadow-[var(--mc-shadow-card)]',
                editing ? 'border-mc-brand/50' : 'border-mc-border',
              )}
            >
              {form}
            </div>
          )}
          <ExpenseList
            rows={list.data?.items ?? []}
            total={total}
            page={page}
            perPage={PER_PAGE}
            onPage={setPage}
            loading={list.isLoading}
            refreshing={list.isFetching && !list.isLoading}
            error={list.isError}
            onRetry={() => list.refetch()}
            summary={summary.data}
            summaryLoading={summary.isLoading}
            today={today}
            range={range}
            onRange={withPage(setRange)}
            categoryId={categoryId}
            onCategory={withPage(setCategoryId)}
            payment={payment}
            onPayment={withPage(setPayment)}
            employeeId={employeeId}
            onEmployee={withPage(setEmployeeId)}
            search={search}
            onSearch={setSearch}
            sort={sort}
            onSort={withPage(setSort)}
            onReset={() => {
              setCategoryId(undefined);
              setPayment(undefined);
              setEmployeeId(undefined);
              setSearch('');
              setQ('');
              setPage(1);
            }}
            categories={categories}
            employees={employees}
            canModify={canModify}
            onEdit={startEdit}
            onDelete={startDelete}
            onOpenReceipt={setReceipt}
            onExport={handleExport}
            exporting={exporting}
            onPrint={handlePrint}
            printing={printing}
          />
        </div>
      </div>

      {mode === 'phone' && (
        <PhoneSheet open={sheetOpen} onClose={closeSheet} titleId={titleId}>
          {form}
        </PhoneSheet>
      )}

      <DeleteExpenseDialog
        key={deleting?.id ?? 'none'}
        expense={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        pending={deleteMut.isPending}
      />

      <ReferenceDialog
        open={manage === 'categories'}
        onClose={() => setManage(null)}
        title="Rasxod turlari"
        addPlaceholder="Yangi rasxod turi"
        removeNote="Rasxodlari bor tur o'chirilmaydi, ro'yxat buzilmasin uchun."
        items={categories.map((c) => ({ id: c.id, name: c.name }))}
        onAdd={(name) => createCategory.mutate(name)}
        onRemove={(id) => deleteCategory.mutate(id)}
        adding={createCategory.isPending}
        removingId={deleteCategory.isPending ? (deleteCategory.variables ?? null) : null}
      />
      <ReferenceDialog
        open={manage === 'employees'}
        onClose={() => setManage(null)}
        title="Xodimlar"
        addPlaceholder="Xodimning ism-familiyasi"
        removeNote="Xodim tanlash ro'yxatidan olinadi. Eski rasxodlarda ismi saqlanib qoladi."
        items={employees.map((e) => ({ id: e.id, name: e.full_name }))}
        onAdd={(name) => createEmployee.mutate(name)}
        onRemove={(id) => deactivateEmployee.mutate(id)}
        adding={createEmployee.isPending}
        removingId={deactivateEmployee.isPending ? (deactivateEmployee.variables ?? null) : null}
      />

      <ReceiptViewer url={receipt} onClose={() => setReceipt(null)} />
      {/* Keyed per job: a second print must run even if the first never reported back. */}
      {printJob && <ExpensePrint key={printJob.id} job={printJob} onDone={donePrinting} />}
    </div>
  );
}
