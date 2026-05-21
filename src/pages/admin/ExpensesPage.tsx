import { useState, useRef, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Wallet,
  CreditCard,
  TrendingDown,
  Hash,
  Settings,
  UserPlus,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  ArrowLeft,
  Download,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useExpenses,
  useExpenseCategories,
  useExpenseEmployees,
  useExpenseSummary,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useCreateExpenseEmployee,
  useDeleteExpenseEmployee,
  useUploadExpenseImages,
  useExpenseHistory,
} from "@/api/hooks/useExpenses";
import { expenseService } from "@/api/services/expenseService";
import type { Expense, ExpenseFilters, PaymentMethod } from "@/api/services/expenseService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return n.toLocaleString("uz-UZ") + " so'm";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithin24h(iso: string): boolean {
  const created = new Date(iso).getTime();
  return Date.now() - created < 24 * 60 * 60 * 1000;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Naqd",
  card: "Karta",
};

const SORT_OPTIONS = [
  { value: "created_desc", label: "Eng yangi" },
  { value: "created_asc", label: "Eng eski" },
  { value: "amount_desc", label: "Summa (kamayish)" },
  { value: "amount_asc", label: "Summa (o'sish)" },
] as const;

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  filters,
  onChange,
  categories,
  employees,
}: {
  filters: ExpenseFilters;
  onChange: (f: ExpenseFilters) => void;
  categories: { id: number; name: string }[];
  employees: { id: number; full_name: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dan (sana+vaqt)</label>
        <input
          type="datetime-local"
          value={filters.datetime_from ?? ""}
          onChange={(e) => onChange({ ...filters, datetime_from: e.target.value || undefined, date_from: undefined })}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Gacha (sana+vaqt)</label>
        <input
          type="datetime-local"
          value={filters.datetime_to ?? ""}
          onChange={(e) => onChange({ ...filters, datetime_to: e.target.value || undefined, date_to: undefined })}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Toifa</label>
        <select
          value={filters.category_id ?? ""}
          onChange={(e) => onChange({ ...filters, category_id: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
        >
          <option value="">Barcha</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">To'lov usuli</label>
        <select
          value={filters.payment_method ?? ""}
          onChange={(e) => onChange({ ...filters, payment_method: (e.target.value as PaymentMethod) || undefined })}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
        >
          <option value="">Barcha</option>
          <option value="cash">Naqd</option>
          <option value="card">Karta</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kimga</label>
        <select
          value={filters.employee_id ?? ""}
          onChange={(e) => onChange({ ...filters, employee_id: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
        >
          <option value="">Barcha</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

function ExpenseHistoryRow({ expenseId }: { expenseId: number }) {
  const { data: history, isLoading } = useExpenseHistory(expenseId);

  const FIELD_LABELS: Record<string, string> = {
    category: "Toifa",
    employee: "Kimga",
    amount: "Summa",
    payment_method: "To'lov usuli",
    description: "Izoh",
    expense_date: "Sana",
    images: "Rasmlar",
  };

  // Format ISO dates to DD.MM.YYYY HH:mm for display
  const fmtHistoryValue = (val: string | null): string => {
    if (!val) return "";
    // Detect ISO format: 2026-05-21T06:39:00+00:00
    const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (isoMatch) {
      const [, y, mo, d, h, mi] = isoMatch;
      return `${d}.${mo}.${y} ${h}:${mi}`;
    }
    return val;
  };

  if (isLoading) {
    return <div className="text-[11px] text-gray-400">Yuklanmoqda...</div>;
  }

  if (!history || history.length === 0) {
    return <div className="text-[11px] text-gray-400">Tarix mavjud emas</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">O'zgarishlar tarixi</span>
      </div>
      {history.map((h) => (
        <div key={h.id} className="flex items-start gap-3 text-[11px]">
          <span className="font-semibold text-gray-500 dark:text-gray-400 shrink-0 w-20">{FIELD_LABELS[h.field_name] || h.field_name}</span>
          <span className="text-red-500 line-through">{fmtHistoryValue(h.old_value) || "—"}</span>
          <span className="text-gray-400">→</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtHistoryValue(h.new_value) || "—"}</span>
          <span className="text-gray-400 ml-auto shrink-0">{h.changed_by_username} • {new Date(h.created_at).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

function ExpenseFormModal({
  isOpen,
  onClose,
  initial,
  categories,
  employees,
  isSuperAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial: Expense | null;
  categories: { id: number; name: string }[];
  employees: { id: number; full_name: string }[];
  isSuperAdmin: boolean;
}) {
  const isEdit = !!initial;
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? categories[0]?.id ?? 0);
  const [employeeId, setEmployeeId] = useState<number | "">(initial?.employee_id ?? "");
  const [amount, setAmount] = useState(initial ? String(Math.round(initial.amount)) : "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initial?.payment_method ?? "cash");
  const [description, setDescription] = useState(initial?.description ?? "");
  const defaultDate = new Date().toISOString().slice(0, 10);
  const defaultTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const [expenseDate, setExpenseDate] = useState(initial?.expense_date ? initial.expense_date.slice(0, 10) : defaultDate);
  const [expenseTime, setExpenseTime] = useState(initial?.expense_date ? initial.expense_date.slice(11, 16) : defaultTime);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [reason, setReason] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Reset form when opening for new expense (not edit)
  useEffect(() => {
    if (isOpen && !isEdit) {
      setCategoryId(categories[0]?.id ?? 0);
      setEmployeeId("");
      setAmount("");
      setPaymentMethod("cash");
      setDescription("");
      setExpenseDate(defaultDate);
      setExpenseTime(defaultTime);
      setImages([]);
      setPendingFiles([]);
      setReason("");
    }
  }, [isOpen, isEdit, categories]);

  const handleReset = () => {
    if (isEdit && initial) {
      setCategoryId(initial.category_id);
      setEmployeeId(initial.employee_id ?? "");
      setAmount(String(Math.round(initial.amount)));
      setPaymentMethod(initial.payment_method);
      setDescription(initial.description ?? "");
      setExpenseDate(initial.expense_date ? initial.expense_date.slice(0, 10) : defaultDate);
      setExpenseTime(initial.expense_date ? initial.expense_date.slice(11, 16) : defaultTime);
      setImages(initial.images ?? []);
      setPendingFiles([]);
      setReason("");
    } else {
      setCategoryId(categories[0]?.id ?? 0);
      setEmployeeId("");
      setAmount("");
      setPaymentMethod("cash");
      setDescription("");
      setExpenseDate(defaultDate);
      setExpenseTime(defaultTime);
      setImages([]);
      setPendingFiles([]);
      setReason("");
    }
  };

  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const uploadMut = useUploadExpenseImages();

  const canSubmit = categoryId > 0 && amount.trim() !== "" && parseFloat(amount) > 0 && (!isEdit || reason.trim() !== "");

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!categoryId || isNaN(parsedAmount) || parsedAmount <= 0) return;

    let uploadedUrls = images;
    if (pendingFiles.length > 0) {
      try {
        uploadedUrls = await uploadMut.mutateAsync(pendingFiles);
        setImages(uploadedUrls);
        setPendingFiles([]);
      } catch {
        toast.error("Rasmlarni yuklashda xatolik");
        return;
      }
    }

    const combinedDateTime = expenseDate && expenseTime ? `${expenseDate}T${expenseTime}:00.000Z` : null;

    if (isEdit && initial) {
      if (!isSuperAdmin && !isWithin24h(initial.created_at)) {
        toast.error("24 soatdan oshgan rasxodni tahrirlash mumkin emas");
        return;
      }
      updateMut.mutate(
        {
          id: initial.id,
          data: {
            category_id: categoryId,
            employee_id: employeeId === "" ? null : Number(employeeId),
            amount: parsedAmount,
            payment_method: paymentMethod,
            description: description.trim() || null,
            expense_date: combinedDateTime ? new Date(combinedDateTime).toISOString() : null,
            images: uploadedUrls,
            edit_reason: reason.trim(),
          },
        },
        { onSuccess: onClose }
      );
    } else {
      createMut.mutate(
        {
          category_id: categoryId,
          employee_id: employeeId === "" ? null : Number(employeeId),
          amount: parsedAmount,
          payment_method: paymentMethod,
          description: description.trim() || null,
          note: null,
          expense_date: combinedDateTime ? new Date(combinedDateTime).toISOString() : null,
          images: uploadedUrls,
        },
        { onSuccess: onClose }
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isEdit ? "Rasxodni tahrirlash" : "Yangi rasxod"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Toifa *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {isEdit && initial && (
                <p className="text-[10px] text-gray-400 mt-0.5">Avval: {initial.category_name}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kimga</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value === "" ? "" : parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              >
                <option value="">Tanlang</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
              {isEdit && initial && initial.employee_name && (
                <p className="text-[10px] text-gray-400 mt-0.5">Avval: {initial.employee_name}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Summa *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              />
              {isEdit && initial && (
                <p className="text-[10px] text-gray-400 mt-0.5">Avval: {formatCurrency(initial.amount)}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">To'lov usuli *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              >
                <option value="cash">Naqd</option>
                <option value="card">Karta</option>
              </select>
              {isEdit && initial && (
                <p className="text-[10px] text-gray-400 mt-0.5">Avval: {PAYMENT_METHOD_LABELS[initial.payment_method]}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sana *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              />
              {isEdit && initial && initial.expense_date && (
                <p className="text-[10px] text-gray-400 mt-0.5">Avval: {new Date(initial.expense_date).toLocaleDateString('uz-UZ')}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Vaqt *</label>
              <input
                type="time"
                value={expenseTime}
                onChange={(e) => setExpenseTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              />
              {isEdit && initial && initial.expense_date && (
                <p className="text-[10px] text-gray-400 mt-0.5">Avval: {new Date(initial.expense_date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Izoh *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nima uchun xarajat qilindi..."
              rows={3}
              maxLength={250}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 resize-none"
            />
            <p className="text-[10px] text-gray-400 text-right mt-0.5">{description.length}/250</p>
            {isEdit && initial && initial.description && (
              <p className="text-[10px] text-gray-400 mt-0.5">Avval: {initial.description}</p>
            )}
          </div>

          {/* File upload with camera + preview + drag & drop */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Chek yoki rasm (ixtiyoriy)</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => document.getElementById('expense-camera-input')?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                Kamera
              </button>
              <button
                onClick={() => document.getElementById('expense-file-input')?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Galereya
              </button>
              <input
                id="expense-camera-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                }}
              />
              <input
                id="expense-file-input"
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                }}
              />
            </div>
            {/* Drag & drop zone + Preview grid */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const files = Array.from(e.dataTransfer.files);
                if (files.length) setPendingFiles((prev) => [...prev, ...files]);
              }}
              className={cn(
                "mt-2 rounded-xl border-2 border-dashed transition-all p-2",
                dragActive
                  ? "border-orange-400 bg-orange-50/50 dark:bg-orange-500/[0.08]"
                  : "border-gray-200 dark:border-white/[0.06]"
              )}
            >
              {pendingFiles.length === 0 && images.length === 0 && (
                <p className="text-[11px] text-gray-400 text-center py-3">Fayllarni shu yerga sudrab keling</p>
              )}
              {(pendingFiles.length > 0 || images.length > 0) && (
                <div className="grid grid-cols-4 gap-2">
                {pendingFiles.map((file, idx) => (
                  <div key={`pending-${idx}`} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08]">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/[0.04]">
                        <span className="text-[10px] text-gray-500 font-bold">PDF</span>
                      </div>
                    )}
                    <button
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {images.map((url, idx) => (
                  <div key={`img-${idx}`} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08]">
                    {url.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/[0.04]">
                        <span className="text-[10px] text-gray-500 font-bold">PDF</span>
                      </div>
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">
                O'zgarish sababi *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nima uchun o'zgartirilmoqda?"
                className="w-full px-3 py-2 bg-red-50/50 dark:bg-red-500/[0.04] border border-red-200 dark:border-red-500/25 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              />
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createMut.isPending || updateMut.isPending || uploadMut.isPending}
            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-[13px] rounded-xl shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all"
          >
            {createMut.isPending || updateMut.isPending || uploadMut.isPending ? "Saqlanmoqda..." : isEdit ? "Yangilash" : "Qo'shish"}
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 font-bold text-[13px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
          >
            Tozalash
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 font-bold text-[13px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
          >
            Bekor
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Rasxodni o'chirish</h3>
        </div>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">
          Bu rasxodni o'chirmoqchimisiz? Sababini yozing:
        </p>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="O'chirish sababi..."
          className="w-full px-3 py-2 bg-red-50/50 dark:bg-red-500/[0.04] border border-red-200 dark:border-red-500/25 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-black text-[13px] rounded-xl shadow-lg shadow-red-500/25 disabled:opacity-50 transition-all"
          >
            {isPending ? "O'chirilmoqda..." : "O'chirish"}
          </button>
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 font-bold text-[13px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
          >
            Bekor
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Reference Data Manager Modal ─────────────────────────────────────────────

function ReferenceManagerModal({
  isOpen,
  onClose,
  title,
  items,
  onAdd,
  onDelete,
  isAdding,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: { id: number; name: string }[];
  onAdd: (name: string) => void;
  onDelete: (id: number) => void;
  isAdding: boolean;
  isDeleting: number | null;
}) {
  const [newName, setNewName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onAdd(newName.trim());
                  setNewName("");
                }
              }}
              placeholder="Yangi qo'shish..."
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
            />
            <button
              onClick={() => {
                if (newName.trim()) {
                  onAdd(newName.trim());
                  setNewName("");
                }
              }}
              disabled={!newName.trim() || isAdding}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-[12px] rounded-xl disabled:opacity-50 transition-all"
            >
              {isAdding ? "..." : "Qo'shish"}
            </button>
          </div>
          <div className="max-h-72 overflow-auto space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-white/[0.03] rounded-xl"
              >
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">{item.name}</span>
                <button
                  onClick={() => setConfirmDeleteId(item.id)}
                  disabled={isDeleting === item.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-center text-[12px] text-gray-400 py-4">Hali ma'lumot yo'q</p>
            )}
          </div>
        </div>

        {/* Inline confirm for delete */}
        {confirmDeleteId !== null && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] bg-red-50/50 dark:bg-red-500/[0.04]">
            <p className="text-[12px] text-red-600 dark:text-red-400 mb-2 font-semibold">
              Haqiqatdan ham o'chirmoqchimisiz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                disabled={isDeleting === confirmDeleteId}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-[12px] rounded-xl disabled:opacity-50 transition-all"
              >
                {isDeleting === confirmDeleteId ? "O'chirilmoqda..." : "Ha, o'chirish"}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 font-bold text-[12px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
              >
                Bekor
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: { total_count: number; total_amount: number; payment_method_breakdown: Record<string, { amount: number; count: number }> } | undefined }) {
  const cash = summary?.payment_method_breakdown?.cash;
  const card = summary?.payment_method_breakdown?.card;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jami rasxod</span>
        </div>
        <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(summary?.total_amount ?? 0)}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{summary?.total_count ?? 0} ta tranzaksiya</p>
      </div>
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Naqd</span>
        </div>
        <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(cash?.amount ?? 0)}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{cash?.count ?? 0} ta</p>
      </div>
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4 text-blue-500" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Karta</span>
        </div>
        <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(card?.amount ?? 0)}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{card?.count ?? 0} ta</p>
      </div>
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-purple-500" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tranzaksiyalar</span>
        </div>
        <p className="text-xl font-black text-gray-900 dark:text-white">{summary?.total_count ?? 0}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Jami soni</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ExpenseFilters>({ sort: "created_desc" });
  const [showFilters, setShowFilters] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showEmployeeManager, setShowEmployeeManager] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const isSuperAdmin = localStorage.getItem("admin_role") === "super-admin";

  const { data: listData, isLoading } = useExpenses(page, 20, filters);
  const { data: summaryData } = useExpenseSummary({
    date_from: filters.date_from,
    date_to: filters.date_to,
    category_id: filters.category_id,
    employee_id: filters.employee_id,
    payment_method: filters.payment_method,
  });
  const { data: categories } = useExpenseCategories();
  const { data: employees } = useExpenseEmployees();

  const deleteMut = useDeleteExpense();
  const createCategoryMut = useCreateExpenseCategory();
  const deleteCategoryMut = useDeleteExpenseCategory();
  const createEmployeeMut = useCreateExpenseEmployee();
  const deleteEmployeeMut = useDeleteExpenseEmployee();

  const handleExport = async () => {
    try {
      const blob = await expenseService.exportExpenses({
        date_from: filters.date_from,
        date_to: filters.date_to,
        datetime_from: filters.datetime_from,
        datetime_to: filters.datetime_to,
        category_id: filters.category_id,
        employee_id: filters.employee_id,
        payment_method: filters.payment_method,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rasxodlar_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel fayl yuklandi");
    } catch {
      toast.error("Yuklashda xatolik");
    }
  };

  const expenses = listData?.items ?? [];
  const totalPages = listData ? Math.ceil(listData.total / listData.per_page) : 0;

  const handleEdit = (expense: Expense) => {
    if (!isSuperAdmin && !isWithin24h(expense.created_at)) {
      toast.error("24 soatdan oshgan rasxodni tahrirlash mumkin emas");
      return;
    }
    setEditingExpense(expense);
    setFormModalOpen(true);
    setActionMenuId(null);
  };

  const handleDeleteClick = (id: number, createdAt: string) => {
    if (!isSuperAdmin && !isWithin24h(createdAt)) {
      toast.error("24 soatdan oshgan rasxodni o'chirish mumkin emas");
      return;
    }
    setDeletingId(id);
    setActionMenuId(null);
  };

  const handleConfirmDelete = (reason: string) => {
    if (!deletingId || !reason.trim()) return;
    deleteMut.mutate({ id: deletingId, reason: reason.trim() }, { onSuccess: () => setDeletingId(null) });
  };

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  // Close action menu on outside click
  useState(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0f0f0f] p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/[0.06] transition-colors"
            title="Orqaga"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Rasxodlar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-bold border transition-all",
              showFilters
                ? "bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-400"
                : "bg-white dark:bg-[#161616] border-gray-200 dark:border-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
          <button
            onClick={() => { setEditingExpense(null); setFormModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-[12px] rounded-xl shadow-lg shadow-orange-500/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Yangi rasxod
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] text-gray-600 dark:text-gray-400 font-bold text-[12px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="p-2.5 bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
            title="Toifalar"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowEmployeeManager(true)}
            className="p-2.5 bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
            title="Xodimlar"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <FilterPanel
              filters={filters}
              onChange={(f) => { setFilters(f); setPage(1); }}
              categories={categories ?? []}
              employees={employees ?? []}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saralash:</span>
        <select
          value={filters.sort ?? "created_desc"}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value as ExpenseFilters["sort"] })}
          className="px-2 py-1 bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] rounded-lg text-[11px] font-semibold outline-none"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/80 dark:bg-[#1a1a1a]/80 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">T/R</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-14">Rasm</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sana</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Toifa</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Izoh</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">To'lov usuli</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Kimga</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Kassa</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Summa</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && expenses.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-white/[0.06]">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <p className="text-[13px] text-gray-400 dark:text-gray-500">Rasxodlar topilmadi</p>
                  </td>
                </tr>
              ) : (
                expenses.map((expense, idx) => (
                  <Fragment key={expense.id}>
                    <tr
                      className={cn(
                        "border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors",
                        expense.edited_at && "bg-amber-50/30 dark:bg-amber-500/[0.04]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                            {(page - 1) * 20 + idx + 1}
                          </span>
                          {expense.edited_at && (
                            <button
                              onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                              className="p-0.5 rounded text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                              title="O'zgarish tarixini ko'rish"
                            >
                              {expandedId === expense.id ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {expense.images.length > 0 && !expense.images[0].toLowerCase().endsWith('.pdf') ? (
                          <button
                            onClick={() => setLightboxUrl(expense.images[0])}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-white/[0.08] hover:ring-2 hover:ring-orange-500/50 transition-all"
                          >
                            <img src={expense.images[0]} alt="" className="w-full h-full object-cover" />
                          </button>
                        ) : expense.images.length > 0 ? (
                          <a
                            href={expense.images[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-[10px] font-bold text-gray-500 hover:ring-2 hover:ring-orange-500/50 transition-all"
                          >
                            PDF
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(expense.expense_date || expense.created_at)}
                        {expense.images.length > 0 && (
                          <span className="inline-block ml-1.5 px-1 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded text-[9px] font-bold">
                            📎 {expense.images.length}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                          {expense.category_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
                          {expense.description || "—"}
                        </p>
                        {expense.edit_reason && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Tahrir: {expense.edit_reason} ({expense.edited_by_username})
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border",
                          expense.payment_method === "cash"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        )}>
                          {PAYMENT_METHOD_LABELS[expense.payment_method]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400">
                        {expense.employee_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400">
                        {expense.created_by_username || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-black text-gray-900 dark:text-white">
                          {formatCurrency(expense.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          ref={(el) => { if (el) menuButtonRefs.current.set(expense.id, el); }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                            setActionMenuId(actionMenuId === expense.id ? null : expense.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {expandedId === expense.id && (
                      <tr>
                        <td colSpan={10} className="px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02]">
                          <ExpenseHistoryRow expenseId={expense.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {listData?.total ?? 0} ta dan {(page - 1) * 20 + 1}–{Math.min(page * 20, listData?.total ?? 0)}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-[12px] font-bold transition-all",
                      p === page
                        ? "bg-orange-500 text-white"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating action menu (outside table) */}
      <AnimatePresence>
        {actionMenuId !== null && menuPos && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', left: Math.max(8, menuPos.x - 72), top: menuPos.y, zIndex: 50 }}
            className="w-36 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl py-1"
          >
            {(() => {
              const expense = expenses.find((e) => e.id === actionMenuId);
              if (!expense) return null;
              const canEdit = isSuperAdmin || isWithin24h(expense.created_at);
              return (
                <>
                  <button
                    onClick={() => { handleEdit(expense); setActionMenuId(null); }}
                    disabled={!canEdit}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Tahrirlash
                  </button>
                  <button
                    onClick={() => { handleDeleteClick(expense.id, expense.created_at); setActionMenuId(null); }}
                    disabled={!canEdit}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    O'chirish
                  </button>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <SummaryCards summary={summaryData} />

      {/* Modals */}
      <ExpenseFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        initial={editingExpense}
        categories={categories ?? []}
        employees={employees ?? []}
        isSuperAdmin={isSuperAdmin}
      />

      <DeleteConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        isPending={deleteMut.isPending}
      />

      <ReferenceManagerModal
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        title="Toifalar boshqaruvi"
        items={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
        onAdd={(name) => createCategoryMut.mutate(name)}
        onDelete={(id) => deleteCategoryMut.mutate(id)}
        isAdding={createCategoryMut.isPending}
        isDeleting={deleteCategoryMut.isPending ? deleteCategoryMut.variables ?? null : null}
      />

      <ReferenceManagerModal
        isOpen={showEmployeeManager}
        onClose={() => setShowEmployeeManager(false)}
        title="Xodimlar boshqaruvi"
        items={(employees ?? []).map((e) => ({ id: e.id, name: e.full_name }))}
        onAdd={(name) => createEmployeeMut.mutate(name)}
        onDelete={(id) => deleteEmployeeMut.mutate(id)}
        isAdding={createEmployeeMut.isPending}
        isDeleting={deleteEmployeeMut.isPending ? deleteEmployeeMut.variables ?? null : null}
      />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxUrl}
              alt="Chek / Rasm"
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
