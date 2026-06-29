import { useState, useCallback, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Trash2,
  Check,
  X,
  Package,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Monitor,
} from "lucide-react";
import {
  usePosPickupQueueList,
  useUpdatePosPickupQueue,
  useCancelPosPickupQueue,
} from "@/api/hooks/usePickupQueue";
import {
  PICKUP_METHOD_LABELS,
  PICKUP_PRIORITY_LABELS,
  PICKUP_STATUS_LABELS,
} from "@/api/pickupQueue";
import type { PosPickupQueueItem, PickupMethod, PickupQueuePriority, PickupQueueStatus } from "@/api/pickupQueue";

const EXPANDED_KEY = "pos_pickup_preview_expanded";

function loadExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) !== "false";
  } catch {
    return true;
  }
}

function saveExpanded(v: boolean) {
  try {
    localStorage.setItem(EXPANDED_KEY, String(v));
  } catch { /* noop */ }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function StatusBadge({ status }: { status: PosPickupQueueItem["status"] }) {
  const isReady = status === "ready";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
        isReady
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      }`}
    >
      {PICKUP_STATUS_LABELS[status] ?? status}
    </span>
  );
}

interface EditableRowProps {
  item: PosPickupQueueItem;
  onSave: (id: number, data: { note: string | null; pickup_method: PickupMethod; priority: PickupQueuePriority; status: PickupQueueStatus }) => void;
  onCancel: () => void;
  isPending: boolean;
}

const EditableRow = memo(function EditableRow({ item, onSave, onCancel, isPending }: EditableRowProps) {
  const [note, setNote] = useState(item.note ?? "");
  const [method, setMethod] = useState<PickupMethod>(item.pickup_method);
  const [priority, setPriority] = useState<PickupQueuePriority>(item.priority);
  const [queueStatus, setQueueStatus] = useState<PickupQueueStatus>(item.status);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    noteRef.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    onSave(item.id, {
      note: note.trim() || null,
      pickup_method: method,
      priority,
      status: queueStatus,
    });
  }, [item.id, note, method, priority, queueStatus, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") onCancel();
    },
    [handleSave, onCancel]
  );

  return (
    <motion.tr
      initial={{ backgroundColor: "rgba(59,130,246,0.06)" }}
      animate={{ backgroundColor: "transparent" }}
      transition={{ duration: 0.4 }}
      className="border-b border-gray-100 dark:border-white/[0.06]"
    >
      <td className="px-3 py-2">
        <span className="text-sm font-black text-gray-900 dark:text-white">#{item.display_number}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.client_code}</span>
      </td>
      <td className="px-3 py-2" colSpan={2}>
        <div className="flex items-center gap-2">
          <input
            ref={noteRef}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            onKeyDown={handleKeyDown}
            placeholder="Izoh..."
            className="flex-1 min-w-0 px-2 py-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PickupMethod)}
            onKeyDown={handleKeyDown}
            className="px-2 py-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none text-gray-900 dark:text-white"
          >
            {Object.entries(PICKUP_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as PickupQueuePriority)}
            onKeyDown={handleKeyDown}
            className="px-2 py-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none text-gray-900 dark:text-white"
          >
            {Object.entries(PICKUP_PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={queueStatus}
            onChange={(e) => setQueueStatus(e.target.value as PickupQueueStatus)}
            onKeyDown={handleKeyDown}
            className="px-2 py-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] font-semibold outline-none text-gray-900 dark:text-white"
          >
            {Object.entries(PICKUP_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={queueStatus} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
            title="Saqlash (Enter)"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
            title="Bekor (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
});

interface ReadOnlyRowProps {
  item: PosPickupQueueItem;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const ReadOnlyRow = memo(function ReadOnlyRow({ item, onEdit, onDelete, isDeleting }: ReadOnlyRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
    >
      <td className="px-3 py-2">
        <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">#{item.display_number}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.client_code}</span>
      </td>
      <td className="px-3 py-2 max-w-[140px]">
        <p className="text-[12px] text-gray-600 dark:text-gray-300 truncate">{item.note ?? "—"}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          {PICKUP_METHOD_LABELS[item.pickup_method]}
          {item.priority !== "normal" && (
            <span className="ml-1.5 px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold">
              {PICKUP_PRIORITY_LABELS[item.priority]}
            </span>
          )}
        </p>
      </td>
      <td className="px-3 py-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{formatTime(item.created_at)}</span>
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
            title="Tahrirlash"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
            title="Bekor qilish"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </td>
    </motion.tr>
  );
});

function PosPickupQueuePreviewCardBase() {
  const { data, isLoading } = usePosPickupQueueList();
  const updateMut = useUpdatePosPickupQueue();
  const cancelMut = useCancelPosPickupQueue();

  const [isExpanded, setIsExpanded] = useState(() => loadExpanded());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  const items = data?.items ?? [];

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      saveExpanded(next);
      return next;
    });
  }, []);

  const handleSave = useCallback(
    (id: number, data: { note: string | null; pickup_method: PickupMethod; priority: PickupQueuePriority; status: PickupQueueStatus }) => {
      updateMut.mutate(
        { queueId: id, data },
        { onSuccess: () => setEditingId(null) }
      );
    },
    [updateMut]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = useCallback(
    (id: number) => {
      if (confirmCancelId === id) {
        if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        cancelMut.mutate(
          { queueId: id, reason: "Kassir tomonidan bekor qilindi" },
          { onSuccess: () => setConfirmCancelId(null) }
        );
      } else {
        if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        setConfirmCancelId(id);
        confirmTimeoutRef.current = setTimeout(() => setConfirmCancelId((prev) => (prev === id ? null : prev)), 3000);
      }
    },
    [confirmCancelId, cancelMut]
  );

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "bg-white dark:bg-[#161616] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden flex flex-col transition-all duration-300",
        isExpanded ? "min-h-0" : "shrink-0"
      )}
    >
      {/* Header */}
      <button
        onClick={toggleExpand}
        className="w-full px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Sklad navbati
          </p>
          {items.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/pickup-tv"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
            title="TV ekranni ochish"
          >
            <Monitor className="w-4 h-4" />
          </a>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="overflow-hidden flex flex-col min-h-0"
          >
            <div className="flex-1 overflow-auto min-h-0">
              {isLoading && items.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Package className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-2" />
                  <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">
                    Hali navbat yo&apos;q
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-0.5">
                    Yuk to&apos;lovi tasdiqlanganda avtomatik yoki qo&apos;lda yuboriladi
                  </p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-gray-50/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Kod</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Izoh</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Vaqt</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false} mode="sync">
                      {items.map((item) =>
                        editingId === item.id ? (
                          <EditableRow
                            key={`edit-${item.id}`}
                            item={item}
                            onSave={handleSave}
                            onCancel={handleCancelEdit}
                            isPending={updateMut.isPending}
                          />
                        ) : (
                          <ReadOnlyRow
                            key={item.id}
                            item={item}
                            onEdit={() => setEditingId(item.id)}
                            onDelete={() => handleDelete(item.id)}
                            isDeleting={cancelMut.isPending && confirmCancelId === item.id}
                          />
                        )
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>

            {/* Cancel confirmation strip */}
            <AnimatePresence>
              {confirmCancelId !== null && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-3 mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[11px] font-bold text-red-600 dark:text-red-400 flex-1">
                      Bekor qilishni tasdiqlang — yana bir marta bosing
                    </p>
                    <button
                      onClick={() => setConfirmCancelId(null)}
                      className="text-[11px] font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Yopish
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple cn helper to avoid importing from lib/cn if tree-shaking matters
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Memoized: this card takes no props, so it should only re-render on its own
// query/state changes — not on every POSDashboard render (search keystrokes etc.).
export const PosPickupQueuePreviewCard = memo(PosPickupQueuePreviewCardBase);
