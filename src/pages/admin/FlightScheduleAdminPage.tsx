import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Plane,
  Gift,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { format, parseISO, getMonth } from 'date-fns';
import {
  getFlightSchedule,
  createFlightSchedule,
  updateFlightSchedule,
  deleteFlightSchedule,
  type FlightScheduleItem,
  type CreateFlightScheduleRequest,
  type UpdateFlightScheduleRequest,
} from '@/api/services/flightSchedule';
import { getAdminJwtClaims } from '@/api/services/adminManagement';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────────

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const STATUS_CONFIG = {
  scheduled: {
    label: 'Rejalashtirilgan',
    icon: Clock,
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  },
  delayed: {
    label: 'Kechikkan',
    icon: AlertCircle,
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  },
  arrived: {
    label: 'Keldi',
    icon: CheckCircle2,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
} as const;

const TYPE_CONFIG = {
  avia: {
    label: 'Avia',
    icon: Plane,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  },
  aksiya: {
    label: 'Aksiya',
    icon: Gift,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  },
} as const;

// ── Entry Form Modal ───────────────────────────────────────────────────────────

interface EntryFormValues {
  flight_name: string;
  flight_date: string;
  type: 'avia' | 'aksiya';
  status: 'arrived' | 'scheduled' | 'delayed';
  notes: string;
}

interface EntryFormModalProps {
  initial?: FlightScheduleItem | null;
  onClose: () => void;
  onSave: (values: EntryFormValues) => void;
  isSaving: boolean;
}

function EntryFormModal({ initial, onClose, onSave, isSaving }: EntryFormModalProps) {
  const [values, setValues] = useState<EntryFormValues>({
    flight_name: initial?.flight_name ?? '',
    flight_date: initial?.flight_date ?? format(new Date(), 'yyyy-MM-dd'),
    type: initial?.type ?? 'avia',
    status: initial?.status ?? 'scheduled',
    notes: initial?.notes ?? '',
  });

  const isEdit = !!initial;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.flight_name.trim()) {
      toast.error('Reys nomini kiriting');
      return;
    }
    onSave(values);
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isEdit ? 'Reysni tahrirlash' : "Yangi reys qo'shish"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-5 py-4 space-y-4">

            {/* Flight name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Reys nomi *
              </label>
              <input
                type="text"
                required
                value={values.flight_name}
                onChange={(e) => setValues({ ...values, flight_name: e.target.value })}
                placeholder="MC-1044 yoki Navro'z bayrami"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Sana *
              </label>
              <input
                type="date"
                required
                value={values.flight_date}
                onChange={(e) => setValues({ ...values, flight_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Turi
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['avia', 'aksiya'] as const).map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setValues({ ...values, type: t })}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                        values.type === t
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600',
                      )}
                    >
                      <Icon className="size-4 flex-shrink-0" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Holati
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['scheduled', 'delayed', 'arrived'] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setValues({ ...values, status: s })}
                      className={cn(
                        'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                        values.status === s
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600',
                      )}
                    >
                      <Icon className="size-4 flex-shrink-0" />
                      <span className="text-center leading-tight">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Izoh (ixtiyoriy)
              </label>
              <textarea
                value={values.notes}
                onChange={(e) => setValues({ ...values, notes: e.target.value })}
                placeholder="Aksiya tavsifi yoki qo'shimcha ma'lumot..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-2 flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Bekor
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Saqlash' : "Qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  item: FlightScheduleItem;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirm({ item, onCancel, onConfirm, isDeleting }: DeleteConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
        </div>
        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Trash2 className="size-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                O'chirishni tasdiqlang
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.flight_name}</span>{' '}
                ({item.flight_date}) o'chiriladi. Bu amalni qaytarib bo'lmaydi.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Bekor
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              O'chirish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single entry card ──────────────────────────────────────────────────────────

interface EntryCardProps {
  item: FlightScheduleItem;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}

function EntryCard({ item, onEdit, onDelete, canManage }: EntryCardProps) {
  const typeCfg = TYPE_CONFIG[item.type];
  const statusCfg = STATUS_CONFIG[item.status];
  const TypeIcon = typeCfg.icon;
  const StatusIcon = statusCfg.icon;

  const day = format(parseISO(item.flight_date), 'd');
  const weekday = format(parseISO(item.flight_date), 'EEE');

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded-xl group">
      {/* Date column */}
      <div className="flex flex-col items-center w-10 flex-shrink-0 pt-0.5">
        <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200 leading-none">{day}</span>
        <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{weekday}</span>
      </div>

      {/* Type icon dot */}
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
        item.type === 'aksiya'
          ? 'bg-purple-100 dark:bg-purple-500/10'
          : 'bg-blue-100 dark:bg-blue-500/10',
      )}>
        <TypeIcon className={cn('size-4', item.type === 'aksiya' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400')} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
          {item.flight_name}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', typeCfg.className)}>
            <TypeIcon className="size-2.5" />
            {typeCfg.label}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', statusCfg.className)}>
            <StatusIcon className="size-2.5" />
            {statusCfg.label}
          </span>
        </div>
        {item.notes && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-1">{item.notes}</p>
        )}
      </div>

      {/* Actions — only visible to users with manage permission */}
      {canManage && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
            title="Tahrirlash"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="O'chirish"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

interface FlightScheduleAdminPageProps {
  onBack?: () => void;
}

export default function FlightScheduleAdminPage({ onBack }: FlightScheduleAdminPageProps) {
  const queryClient = useQueryClient();
  const jwtClaims = getAdminJwtClaims();
  // canManage → full CRUD; canView → read-only (includes canManage users)
  const canManage = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('flight_schedule:manage');
  const canView   = canManage || jwtClaims.permissions.has('flight_schedule:read');

  const [year, setYear] = useState(new Date().getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FlightScheduleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlightScheduleItem | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['flightSchedule', year],
    queryFn: () => getFlightSchedule(year),
    staleTime: 5 * 60_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: CreateFlightScheduleRequest) => createFlightSchedule(body),
    onSuccess: () => {
      toast.success("Reys qo'shildi");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['flightSchedule', year] });
      // Also invalidate the user-facing schedule cache
      queryClient.invalidateQueries({ queryKey: ['flightSchedule'] });
    },
    onError: () => toast.error("Reys qo'shishda xatolik"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateFlightScheduleRequest }) =>
      updateFlightSchedule(id, body),
    onSuccess: () => {
      toast.success('Reys yangilandi');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['flightSchedule'] });
    },
    onError: () => toast.error('Reysni yangilashda xatolik'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFlightSchedule(id),
    onSuccess: () => {
      toast.success("Reys o'chirildi");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['flightSchedule'] });
    },
    onError: () => toast.error("O'chirishda xatolik"),
  });

  // ── Derived data — group by month ──────────────────────────────────────────
  const groupedByMonth = useMemo(() => {
    const items = [...(data?.items ?? [])].sort(
      (a, b) => a.flight_date.localeCompare(b.flight_date),
    );
    const groups = new Map<number, FlightScheduleItem[]>();
    items.forEach((item) => {
      const month = getMonth(parseISO(item.flight_date));
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(item);
    });
    return groups;
  }, [data]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = (values: EntryFormValues) => {
    const body: UpdateFlightScheduleRequest & CreateFlightScheduleRequest = {
      flight_name: values.flight_name.trim(),
      flight_date: values.flight_date,
      type: values.type,
      status: values.status,
      notes: values.notes.trim() || null,
    };

    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-zinc-500 text-center px-8">
        <AlertCircle className="size-12 opacity-40" />
        <p className="text-sm font-medium">Bu sahifaga kirish huquqi yo'q</p>
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-orange-500 flex-shrink-0" />
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Reys jadvali
              </h1>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {data?.total ?? 0} ta yozuv · {year} yil
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Year navigator */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 px-1 tabular-nums">
              {year}
            </span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Add button — only for manage permission */}
          {canManage && (
            <button
              onClick={() => { setEditTarget(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors shadow-sm shadow-orange-500/20"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Qo'shish</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-zinc-400">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-rose-500">
          <AlertCircle className="size-8 opacity-70" />
          <p className="text-sm font-medium">Ma'lumotlarni yuklashda xatolik</p>
        </div>
      )}

      {!isLoading && !isError && groupedByMonth.size === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-400">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Calendar className="size-8 text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {year} yil uchun reyslar yo'q
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {canManage ? 'Birinchi reysni qo\'shing' : 'Hozircha ma\'lumot yo\'q'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => { setEditTarget(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
            >
              <Plus className="size-4" />
              Reys qo'shish
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && groupedByMonth.size > 0 && (
        <div className="space-y-4">
          {Array.from(groupedByMonth.entries()).map(([month, items]) => (
            <div
              key={month}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden"
            >
              {/* Month header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {UZ_MONTHS[month]} {year}
                </span>
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                  {items.length} ta
                </span>
              </div>

              {/* Entries */}
              <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                {items.map((item) => (
                  <EntryCard
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    onEdit={() => { setEditTarget(item); setFormOpen(true); }}
                    onDelete={() => setDeleteTarget(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {formOpen && (
        <EntryFormModal
          initial={editTarget}
          onClose={() => { setFormOpen(false); setEditTarget(null); }}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
