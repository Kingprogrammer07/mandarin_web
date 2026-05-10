import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, RefreshCw, Send, Plus, Clock,
  AlertCircle, Loader2, X, Search, Filter, ChevronLeft, ChevronRight, Download, Bot, Globe,
} from 'lucide-react';
import {
  getNotificationSummary,
  startSendNotifications,
  getSendTaskState,
  cancelSendTask,
  type ClientNotificationStatus,
  type NotificationSummary,
  type SendTaskState,
} from '@/api/services/flightNotifications';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import ForgottenCargoModal from '@/components/admin/ForgottenCargoModal';
import type { ForgottenCargoResult } from '@/api/services/flightNotifications';
import { exportFlightCargoExcel } from '@/api/services/cargo';

interface FlightNotificationPageProps {
  flightName: string;
  onBack: () => void;
}

type FilterMode = 'all' | 'sent' | 'pending';

const POLL_INTERVAL_MS = 1500;
const PAGE_SIZE = 30;

const activeTaskKey = (flightName: string) => `cargo_send_task:${flightName}`;

// ─── Progress Modal ────────────────────────────────────────────────────────────

interface ProgressModalProps {
  taskState: SendTaskState;
  flightName: string;
  onClose: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} soniya`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} daq ${s} son` : `${m} daqiqa`;
}

function ProgressModal({ taskState, flightName, onClose, onCancel, isCancelling }: ProgressModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (taskState.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [taskState.status]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportFlightCargoExcel(flightName);
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number };
      if (err.message === 'rate_limit') setExportError('1 daqiqa kuting (limit)');
      else setExportError(err.message ?? 'Yuklab bo\'lmadi');
    } finally {
      setIsExporting(false);
    }
  };

  const isDone = taskState.status === 'completed' || taskState.status === 'failed';
  const wasCancelled = taskState.status === 'failed' && taskState.sent + taskState.failed + taskState.skipped < taskState.total;

  const processed = taskState.sent + taskState.failed + taskState.skipped;
  const elapsedSec = (now - new Date(taskState.started_at).getTime()) / 1000;
  const rate = elapsedSec > 0 && processed > 0 ? processed / elapsedSec : 0;
  const remaining = taskState.total - processed;
  const etaSec = rate > 0 ? remaining / rate : null;
  const etaText = !isDone && etaSec !== null && etaSec > 1 ? `~${formatDuration(etaSec)} qoldi` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden">

        {/* Colour bar */}
        <div className={`h-1 ${isDone && taskState.failed > 0 ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`} />

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-black text-gray-800 dark:text-white">
              {!isDone ? 'Yuborilmoqda...' : wasCancelled ? 'Yuborish to\'xtatildi' : 'Yuborish yakunlandi'}
            </h3>
            {isDone && (
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${taskState.percent}%` }}
            />
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col items-center p-2 rounded-xl bg-green-50 dark:bg-green-500/[0.08]">
              <span className="text-lg font-black text-green-600 dark:text-green-400">{taskState.sent}</span>
              <span className="text-[10px] text-green-600/70 dark:text-green-400/60 font-medium">Yuborildi</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-xl bg-red-50 dark:bg-red-500/[0.08]">
              <span className="text-lg font-black text-red-600 dark:text-red-400">{taskState.failed}</span>
              <span className="text-[10px] text-red-600/70 dark:text-red-400/60 font-medium">Xato</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-xl bg-gray-50 dark:bg-white/[0.04]">
              <span className="text-lg font-black text-gray-600 dark:text-gray-300">{taskState.skipped}</span>
              <span className="text-[10px] text-gray-500/70 font-medium">O'tkazildi</span>
            </div>
          </div>

          {/* Percent */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            {taskState.percent}% — {taskState.sent + taskState.failed + taskState.skipped}/{taskState.total}
          </p>

          {/* Errors */}
          {taskState.errors.length > 0 && (
            <div className="max-h-28 overflow-y-auto rounded-xl bg-red-50 dark:bg-red-500/[0.06] border border-red-100 dark:border-red-500/15 p-3 space-y-1 mb-4">
              {taskState.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-red-700 dark:text-red-300">
                    <span className="font-bold">{err.client_id}:</span> {err.error}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!isDone && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isCancelling ? "To'xtatilmoqda..." : 'Yuborilmoqda...'}
                </div>
                {etaText && (
                  <span className="text-[11px] font-bold text-orange-500">{etaText}</span>
                )}
              </div>
              {onCancel && (
                <button
                  onClick={onCancel}
                  disabled={isCancelling}
                  className="w-full h-9 rounded-2xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCancelling
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <X className="w-3.5 h-3.5" />
                  }
                  To'xtatish
                </button>
              )}
            </div>
          )}

          {isDone && (
            <div className="space-y-2">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full h-11 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-black transition-colors flex items-center justify-center gap-2"
              >
                {isExporting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />
                }
                {isExporting ? 'Yuklanmoqda...' : 'Excel yuklab olish'}
              </button>
              {exportError && (
                <p className="text-center text-xs text-red-500">{exportError}</p>
              )}
              <button
                onClick={onClose}
                className="w-full h-11 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                Yopish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Client row ────────────────────────────────────────────────────────────────

interface ClientRowProps {
  client: ClientNotificationStatus;
  isSelected: boolean;
  onToggle: () => void;
}

function ClientRow({ client, isSelected, onToggle }: ClientRowProps) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all select-none ${
        isSelected
          ? 'bg-orange-50 dark:bg-orange-500/[0.08] border-orange-200 dark:border-orange-500/20'
          : 'bg-white dark:bg-[#111] border-gray-100 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
          isSelected
            ? 'bg-orange-500 border-orange-500'
            : 'border-gray-300 dark:border-white/20'
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-gray-800 dark:text-white">{client.client_id}</span>
          {!client.telegram_id && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-bold">
              TG yo'q
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400">{client.cargo_count} ta yuk</span>
          <span className="text-[11px] text-gray-300 dark:text-white/20">·</span>
          <span className="text-[11px] text-gray-400">{client.total_weight.toFixed(1)} kg</span>
          <span className="text-[11px] text-gray-300 dark:text-white/20">·</span>
          <span className="text-[11px] text-gray-400">
            {client.total_price_uzs.toLocaleString('uz-UZ')} so'm
          </span>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {!client.is_sent && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/15">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Kutmoqda</span>
          </div>
        )}
        {client.is_sent_bot && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/15">
            <Bot className="w-3 h-3 text-blue-500" />
            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Bot</span>
          </div>
        )}
        {client.is_sent_web && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/15">
            <Globe className="w-3 h-3 text-green-500" />
            <span className="text-[9px] font-bold text-green-600 dark:text-green-400">Web</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FlightNotificationPage({ flightName, onBack }: FlightNotificationPageProps) {
  const { toast, ToastRenderer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<SendTaskState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showForgottenModal, setShowForgottenModal] = useState(false);
  const [page, setPage] = useState(1);
  const [markBot, setMarkBot] = useState(false);
  const [markWeb, setMarkWeb] = useState(true);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await getNotificationSummary(flightName);
      setSummary(data);
      // Keep selected set consistent: remove IDs that no longer exist
      setSelected((prev) => {
        const existingIds = new Set(data.clients.map((c) => c.client_id));
        return new Set([...prev].filter((id) => existingIds.has(id)));
      });
    } catch (err) {
      const errMsg = (err as { message?: string })?.message ?? "Ma'lumotlarni yuklab bo'lmadi";
      toast({ title: errMsg, variant: 'error' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [flightName, toast]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  // Restore in-progress task after page reload/reopen
  useEffect(() => {
    const savedTaskId = localStorage.getItem(activeTaskKey(flightName));
    if (!savedTaskId) return;

    getSendTaskState(savedTaskId)
      .then((state) => {
        if (state.status === 'completed' || state.status === 'failed') {
          localStorage.removeItem(activeTaskKey(flightName));
          return;
        }
        setTaskId(savedTaskId);
        setTaskState(state);
        startPolling(savedTaskId);
      })
      .catch(() => localStorage.removeItem(activeTaskKey(flightName)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightName]);

  // ── Task polling ───────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const state = await getSendTaskState(id);
        setTaskState(state);
        if (state.status === 'completed' || state.status === 'failed') {
          stopPolling();
        }
      } catch {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Filtered + paginated clients ──────────────────────────────────────────

  const filteredClients: ClientNotificationStatus[] = (summary?.clients ?? []).filter((c) => {
    if (filter === 'sent' && !c.is_sent) return false;
    if (filter === 'pending' && c.is_sent) return false;
    if (search && !c.client_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Reset to page 1 whenever filter or search changes
  useEffect(() => { setPage(1); }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const paginatedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleClient = (clientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredClients.forEach((c) => next.add(c.client_id));
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredClients.forEach((c) => next.delete(c.client_id));
      return next;
    });
  };

  const allVisibleSelected =
    filteredClients.length > 0 && filteredClients.every((c) => selected.has(c.client_id));

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (selected.size === 0) {
      toast({ title: "Kamida 1 ta mijozni tanlang", variant: 'error' });
      return;
    }

    // Warn if any selected client was already notified via any channel
    const alreadySent = (summary?.clients ?? []).filter(
      (c) => selected.has(c.client_id) && (c.is_sent_bot || c.is_sent_web),
    );
    if (alreadySent.length > 0) {
      const channelList = alreadySent.map((c) => {
        const channels = [c.is_sent_bot && 'Bot', c.is_sent_web && 'Web'].filter(Boolean).join('+');
        return `${c.client_id} (${channels})`;
      }).join(', ');
      const ok = await confirm({
        message: `${alreadySent.length} ta mijoz allaqachon yuborilgan`,
        description: `${channelList}.\n\nBaribir qayta yuborishni xohlaysizmi?`,
        confirmLabel: 'Ha, qayta yuborish',
        cancelLabel: 'Bekor qilish',
        variant: 'warning',
      });
      if (!ok) return;
    }

    setIsSending(true);
    try {
      if (!markBot && !markWeb) {
        toast({ title: "Kamida bittasini tanlang: Bot yoki Web", variant: 'error' });
        setIsSending(false);
        return;
      }
      const resp = await startSendNotifications(flightName, {
        client_ids: [...selected],
        only_pending: false,
        mark_bot: markBot,
        mark_web: markWeb,
      });
      localStorage.setItem(activeTaskKey(flightName), resp.task_id);
      setTaskId(resp.task_id);
      setTaskState({
        task_id: resp.task_id,
        status: 'running',
        total: resp.total_clients,
        sent: 0,
        failed: 0,
        skipped: 0,
        percent: 0,
        errors: [],
        started_at: new Date().toISOString(),
        finished_at: null,
      });
      startPolling(resp.task_id);
    } catch (err) {
      const errMsg = (err as { message?: string })?.message ?? "Yuborishni boshlashda xatolik";
      toast({ title: errMsg, variant: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseProgressModal = () => {
    stopPolling();
    localStorage.removeItem(activeTaskKey(flightName));
    setTaskId(null);
    setTaskState(null);
    setIsCancelling(false);
    setSelected(new Set());
    void fetchSummary(true);
  };

  const handleCancelTask = async () => {
    if (!taskId) return;
    setIsCancelling(true);
    try {
      await cancelSendTask(taskId);
      // Polling will detect status="failed" and stop itself
    } catch {
      toast({ title: "Bekor qilishda xatolik yuz berdi", variant: 'error' });
      setIsCancelling(false);
    }
  };

  // ── Forgotten cargo success ────────────────────────────────────────────────

  const handleForgottenSuccess = (result: ForgottenCargoResult) => {
    setShowForgottenModal(false);
    const msg = result.sent
      ? `Yuk qo'shildi va yuborildi (${result.track_codes_added} ta trek kod)`
      : `Yuk qo'shildi (${result.track_codes_added} ta trek kod). ${result.send_error ? `Yuborish: ${result.send_error}` : ''}`;
    toast({ title: msg, variant: result.sent ? 'success' : 'default' });
    void fetchSummary(true);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const pendingCount = summary?.pending_count ?? 0;
  const totalCount = summary?.total_clients ?? 0;
  const botSentCount = summary?.bot_sent_count ?? 0;
  const webSentCount = summary?.web_sent_count ?? 0;
  const selectedCount = selected.size;

  return (
    <>
    <ToastRenderer />
    <ConfirmDialog />
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium truncate">{flightName}</p>
            <h1 className="text-base font-black text-gray-800 dark:text-white leading-tight">Bildirishnomalar</h1>
          </div>

          <button
            onClick={() => fetchSummary(true)}
            disabled={isRefreshing}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.05]">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{totalCount} ta</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/[0.08]">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{pendingCount} kutmoqda</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/[0.08]">
            <Bot className="w-3 h-3 text-blue-500" />
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{botSentCount} bot</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-500/[0.08]">
            <Globe className="w-3 h-3 text-green-500" />
            <span className="text-[11px] font-bold text-green-600 dark:text-green-400">{webSentCount} web</span>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.06]">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mijoz kodini qidirish..."
              className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          {/* Filter */}
          <div className="flex items-center rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden h-9">
            {(['all', 'pending', 'sent'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-2.5 h-full text-[11px] font-bold transition-colors ${
                  filter === mode
                    ? 'bg-orange-500 text-white'
                    : 'bg-white dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.07]'
                }`}
              >
                {mode === 'all' ? 'Hammasi' : mode === 'pending' ? 'Kutmoqda' : 'Yuborildi'}
              </button>
            ))}
          </div>
        </div>

        {/* Select-all + action row */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <button
            onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
            className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              allVisibleSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-white/20'
            }`}>
              {allVisibleSelected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            Barchasi
          </button>

          <Filter className="w-3.5 h-3.5 text-gray-300 dark:text-white/20" />

          <div className="flex-1" />

          <button
            onClick={() => setShowForgottenModal(true)}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/[0.08] border border-violet-200/60 dark:border-violet-500/15 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-500/15 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Unutilgan yuk
          </button>

          <button
            onClick={handleSend}
            disabled={isSending || selectedCount === 0}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-black text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {selectedCount > 0 ? `Yuborish (${selectedCount})` : 'Yuborish'}
          </button>
        </div>

        {/* Mark-mode row */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Belgilash:</span>
          {(
            [
              { id: 'web', label: 'Web', checked: markWeb, set: setMarkWeb },
              { id: 'bot', label: 'Bot', checked: markBot, set: setMarkBot },
            ] as const
          ).map(({ id, label, checked, set }) => (
            <label key={id} className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => set(!checked)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  checked ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-white/20'
                }`}
              >
                {checked && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{label}</span>
            </label>
          ))}
          {!markBot && !markWeb && (
            <span className="text-[10px] text-red-500 font-bold">Kamida bittasini tanlang</span>
          )}
        </div>
      </div>

      {/* ── Client list ── */}
      <div className="px-4 py-3 space-y-2">
        {filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center mb-4">
              <Send className="w-6 h-6 text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Mijozlar topilmadi</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Filtrni o'zgartiring yoki boshqa reys tanlang</p>
          </div>
        ) : (
          paginatedClients.map((client) => (
            <ClientRow
              key={client.client_id}
              client={client}
              isSelected={selected.has(client.client_id)}
              onToggle={() => toggleClient(client.client_id)}
            />
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {taskState && (
        <ProgressModal
          taskState={taskState}
          flightName={flightName}
          onClose={handleCloseProgressModal}
          onCancel={handleCancelTask}
          isCancelling={isCancelling}
        />
      )}

      {showForgottenModal && (
        <ForgottenCargoModal
          flightName={flightName}
          onClose={() => setShowForgottenModal(false)}
          onSuccess={handleForgottenSuccess}
        />
      )}

    </div>
    </>
  );
}
