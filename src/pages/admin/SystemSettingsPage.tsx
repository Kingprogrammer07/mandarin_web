import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import OfficeSettingsSection from '@/components/admin/OfficeSettingsSection';
import TemplateEditorSection from '@/components/admin/TemplateEditorSection';
import BroadcastComposer from '@/components/admin/BroadcastComposer';
import SmsSettingsSection from '@/components/admin/SmsSettingsSection';
import VideoGuidesSection from '@/components/admin/VideoGuidesSection';
import ButtonIconsSection from '@/components/admin/ButtonIconsSection';
import MessageEmojiSection from '@/components/admin/MessageEmojiSection';
import {
  Wrench,
  CreditCard,
  Users,
  Loader2,
  ChevronDown,
  Activity,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckSquare,
  Square,
  BarChart3,
  MapPin,
  Send,
  Truck,
} from 'lucide-react';
import {
  systemService,
  type NbuPendingPaymentRow,
  type UzPostPendingRow,
} from '@/api/services/systemService';

function formatAge(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * The page is one long scroll of ten unrelated panels, so grouping them costs
 * nothing and saves the operator from hunting. Order matters: the tabs people
 * open daily come first, infrastructure last.
 */
const SYSTEM_TABS = [
  { key: 'messages', label: 'Xabarlar', icon: Send },
  { key: 'office', label: 'Ofis', icon: MapPin },
  { key: 'payments', label: "To'lovlar", icon: CreditCard },
  { key: 'delivery', label: 'Yetkazish', icon: Truck },
  { key: 'system', label: 'Tizim', icon: Wrench },
] as const;

type SystemTab = (typeof SYSTEM_TABS)[number]['key'];

const TAB_STORAGE_KEY = 'system-settings-tab';

function readStoredTab(): SystemTab {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (SYSTEM_TABS.some((entry) => entry.key === stored)) {
      return stored as SystemTab;
    }
  } catch {
    // Private mode or a blocked storage API — fall back to the default tab.
  }
  return 'messages';
}

function getMutationErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;

  const maybeError = error as {
    message?: unknown;
    data?: { detail?: unknown };
  };
  if (typeof maybeError.data?.detail === 'string' && maybeError.data.detail) {
    return maybeError.data.detail;
  }
  if (typeof maybeError.message === 'string' && maybeError.message) {
    return maybeError.message;
  }
  return fallback;
}

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Seeded from storage, not synced by an effect: an operator working through
  // stuck payments should land back on that tab after a reload.
  const [tab, setTabState] = useState<SystemTab>(readStoredTab);
  const setTab = useCallback((next: SystemTab) => {
    setTabState(next);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      // Remembering the tab is a convenience, never a requirement.
    }
  }, []);

  const [showRedisInfo, setShowRedisInfo] = useState(false);
  const [showRedisClients, setShowRedisClients] = useState(false);
  const [showNbuPending, setShowNbuPending] = useState(false);
  const [showUzpostPending, setShowUzpostPending] = useState(false);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [expiring, setExpiring] = useState<string | null>(null);
  const [uzpostReconciling, setUzpostReconciling] = useState<number | null>(null);
  const [uzpostRejecting, setUzpostRejecting] = useState<number | null>(null);
  const [selectedTxns, setSelectedTxns] = useState<Set<string>>(new Set());
  const [selectedUzpostIds, setSelectedUzpostIds] = useState<Set<number>>(new Set());
  const [maxFlightsInput, setMaxFlightsInput] = useState<number | null>(null);

  // Maintenance + NBU toggles are pushed via SSE (`maintenance.toggled`,
  // `nbu.status.changed`), so these are slow visibility-gated fallbacks.
  const visibleInterval = (ms: number) =>
    typeof document !== 'undefined' && document.visibilityState === 'visible' ? ms : false;

  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['system-maintenance'],
    queryFn: systemService.getMaintenanceStatus,
    refetchInterval: () => visibleInterval(5 * 60_000),
    refetchIntervalInBackground: false,
  });

  const { data: nbuData, isLoading: nbuLoading } = useQuery({
    queryKey: ['system-nbu'],
    queryFn: systemService.getNbuStatus,
    refetchInterval: () => visibleInterval(5 * 60_000),
    refetchIntervalInBackground: false,
  });

  const { data: redisInfo, isLoading: redisInfoLoading } = useQuery({
    queryKey: ['system-redis-info'],
    queryFn: systemService.getRedisInfo,
    enabled: showRedisInfo,
  });

  const { data: redisClients, isLoading: redisClientsLoading } = useQuery({
    queryKey: ['system-redis-clients'],
    queryFn: systemService.getRedisClients,
    enabled: showRedisClients,
  });

  const {
    data: nbuPending,
    isLoading: nbuPendingLoading,
    refetch: refetchNbuPending,
  } = useQuery({
    queryKey: ['system-nbu-pending'],
    queryFn: () => systemService.getNbuPending(100),
    enabled: showNbuPending,
    refetchInterval: () => (showNbuPending ? visibleInterval(30_000) : false),
    refetchIntervalInBackground: false,
  });

  const {
    data: uzpostPending,
    isLoading: uzpostPendingLoading,
    refetch: refetchUzpostPending,
  } = useQuery({
    queryKey: ['system-uzpost-pending'],
    queryFn: () => systemService.listUzpostPending(100),
    enabled: showUzpostPending,
    refetchInterval: () => (showUzpostPending ? visibleInterval(30_000) : false),
    refetchIntervalInBackground: false,
  });

  const reconcileMutation = useMutation({
    mutationFn: systemService.forceReconcileNbu,
    onMutate: (transactionId) => setReconciling(transactionId),
    onSettled: () => setReconciling(null),
    onSuccess: (res) => {
      if (res.flipped_to_terminal) {
        toast.success(`${res.previous_status} → ${res.new_status}`);
      } else if (res.previous_status === res.new_status) {
        toast.message(`NBU javob: hali ${res.new_status}. Callback kutiladi.`);
      } else {
        toast.success(`Status: ${res.new_status}`);
      }
      queryClient.invalidateQueries({ queryKey: ['system-nbu-pending'] });
    },
    onError: () => {
      toast.error('Reconcile xatosi — server loglarini ko\'ring');
    },
  });

  const expireMutation = useMutation({
    mutationFn: systemService.expireNbu,
    onMutate: (transactionId) => setExpiring(transactionId),
    onSettled: () => setExpiring(null),
    onSuccess: (res) => {
      toast.success(`${res.previous_status} → ${res.new_status}`);
      queryClient.invalidateQueries({ queryKey: ['system-nbu-pending'] });
    },
    onError: () => {
      toast.error('Expire xatosi — server loglarini ko\'ring');
    },
  });

  const handleExpire = useCallback(
    (transactionId: string) => {
      // No native confirm dialog inside Telegram WebApp — use a simple
      // window.confirm fallback. Admin panel runs in regular browser so
      // this is fine.
      const ok = window.confirm(
        'Bu tranzaksiyani EXPIRED qilib belgilamoqchimisiz?\n\n' +
          'Hamyon kreditlanmaydi, karta saqlanmaydi. Faqat statusi o\'zgaradi.',
      );
      if (!ok) return;
      expireMutation.mutate(transactionId);
    },
    [expireMutation],
  );

  // Bulk expire — selected rows or all stale (>1h). Each row is reconciled
  // against NBU first, so a payment that actually landed is credited (SUCCESS),
  // never expired.
  const bulkExpireMutation = useMutation({
    mutationFn: systemService.expireNbuBulk,
    onSuccess: (res) => {
      const parts = [`${res.expired} ta expired`];
      if (res.flipped_to_success) {
        parts.push(`${res.flipped_to_success} ta SUCCESS (kreditlandi)`);
      }
      if (res.skipped) parts.push(`${res.skipped} ta o'tkazib yuborildi`);
      toast.success(parts.join(' · '));
      setSelectedTxns(new Set());
      queryClient.invalidateQueries({ queryKey: ['system-nbu-pending'] });
    },
    onError: () => {
      toast.error('Bulk expire xatosi — server loglarini ko\'ring');
    },
  });

  const toggleSelect = useCallback((transactionId: string) => {
    setSelectedTxns((prev) => {
      const next = new Set(prev);
      if (next.has(transactionId)) next.delete(transactionId);
      else next.add(transactionId);
      return next;
    });
  }, []);

  const visibleTxns = nbuPending?.rows.map((r) => r.transaction_id) ?? [];
  const allSelected =
    visibleTxns.length > 0 && visibleTxns.every((t) => selectedTxns.has(t));

  const toggleSelectAll = () => {
    setSelectedTxns(allSelected ? new Set() : new Set(visibleTxns));
  };

  const handleBulkExpireSelected = () => {
    if (selectedTxns.size === 0) return;
    const ok = window.confirm(
      `${selectedTxns.size} ta tranzaksiyani EXPIRED qilasizmi?\n\n` +
        'Har biri avval NBU bilan tekshiriladi (reconcile). Haqiqatda ' +
        'to\'langani SUCCESS bo\'lib kreditlanadi, qolgani expired bo\'ladi.',
    );
    if (!ok) return;
    bulkExpireMutation.mutate({ transaction_ids: Array.from(selectedTxns) });
  };

  const handleBulkExpireStale = () => {
    const ok = window.confirm(
      '1 soatdan ortiq pendingda turgan BARCHA tranzaksiyalarni ' +
        'EXPIRED qilasizmi?\n\nHar biri avval NBU bilan tekshiriladi.',
    );
    if (!ok) return;
    bulkExpireMutation.mutate({ older_than_seconds: 3600 });
  };

  // ── Hourly NBU report config ───────────────────────────────────────────
  const uzpostReconcileMutation = useMutation({
    mutationFn: systemService.reconcileUzpost,
    onMutate: (deliveryRequestId) => setUzpostReconciling(deliveryRequestId),
    onSettled: () => setUzpostReconciling(null),
    onSuccess: (res) => {
      if (res.approved) {
        toast.success(t('system.uzpost.reconcileOk', { status: res.new_status }));
      } else {
        toast.message(t('system.uzpost.reconcileOk', { status: res.new_status }));
      }
      queryClient.invalidateQueries({ queryKey: ['system-uzpost-pending'] });
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, t('makePayment.errorOccurred')));
    },
  });

  const uzpostRejectMutation = useMutation({
    mutationFn: systemService.rejectUzpost,
    onMutate: (deliveryRequestId) => setUzpostRejecting(deliveryRequestId),
    onSettled: () => setUzpostRejecting(null),
    onSuccess: (res) => {
      toast.success(t('system.uzpost.rejectOk', { status: res.new_status }));
      queryClient.invalidateQueries({ queryKey: ['system-uzpost-pending'] });
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, t('makePayment.errorOccurred')));
    },
  });

  const uzpostBulkExpireMutation = useMutation({
    mutationFn: systemService.expireUzpostBulk,
    onSuccess: (res) => {
      toast.success(
        t('system.uzpost.bulkResult', {
          rejected: res.rejected,
          skipped_paid: res.skipped_paid,
        }),
      );
      setSelectedUzpostIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['system-uzpost-pending'] });
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, t('makePayment.errorOccurred')));
    },
  });

  const toggleUzpostSelect = useCallback((deliveryRequestId: number) => {
    setSelectedUzpostIds((prev) => {
      const next = new Set(prev);
      if (next.has(deliveryRequestId)) next.delete(deliveryRequestId);
      else next.add(deliveryRequestId);
      return next;
    });
  }, []);

  const visibleUzpostIds =
    uzpostPending?.rows.map((row) => row.delivery_request_id) ?? [];
  const allUzpostSelected =
    visibleUzpostIds.length > 0 &&
    visibleUzpostIds.every((deliveryRequestId) =>
      selectedUzpostIds.has(deliveryRequestId),
    );

  const toggleSelectAllUzpost = () => {
    setSelectedUzpostIds(
      allUzpostSelected ? new Set() : new Set(visibleUzpostIds),
    );
  };

  const handleUzpostReject = useCallback(
    (row: UzPostPendingRow) => {
      const ok = window.confirm(t('system.uzpost.rejectConfirm'));
      if (!ok) return;
      uzpostRejectMutation.mutate(row.delivery_request_id);
    },
    [t, uzpostRejectMutation],
  );

  const handleUzpostBulkExpireSelected = () => {
    if (selectedUzpostIds.size === 0) return;
    uzpostBulkExpireMutation.mutate({
      delivery_request_ids: Array.from(selectedUzpostIds),
    });
  };

  const handleUzpostBulkExpireOld = () => {
    const ok = window.confirm(t('system.uzpost.expireOldConfirm'));
    if (!ok) return;
    uzpostBulkExpireMutation.mutate({ older_than_seconds: 3600 });
  };

  const { data: reportConfig } = useQuery({
    queryKey: ['system-nbu-report-config'],
    queryFn: systemService.getNbuReportConfig,
    refetchInterval: () => visibleInterval(5 * 60_000),
    refetchIntervalInBackground: false,
  });

  const reportConfigMutation = useMutation({
    mutationFn: systemService.updateNbuReportConfig,
    onSuccess: (cfg) => {
      queryClient.setQueryData(['system-nbu-report-config'], cfg);
      toast.success('Hisobot sozlamasi saqlandi');
    },
    onError: () => toast.error('Sozlamani saqlab bo\'lmadi'),
  });

  const resendReportMutation = useMutation({
    mutationFn: (hoursBack: number) => systemService.resendNbuReports(hoursBack),
    onSuccess: (res) => {
      toast.success(`${res.sent} ta soatlik hisobot yuborildi`);
    },
    onError: () => toast.error('Hisobotni qayta yuborib bo\'lmadi'),
  });

  const effectiveMaxFlights = maxFlightsInput ?? reportConfig?.max_flights ?? 3;

  const maintenanceMutation = useMutation({
    mutationFn: systemService.toggleMaintenance,
    onSuccess: (data) => {
      toast.success(data.maintenance ? 'Maintenance yoqildi' : 'Maintenance o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['system-maintenance'] });
    },
    onError: () => {
      toast.error(t('makePayment.errorOccurred'));
    },
  });

  const nbuMutation = useMutation({
    mutationFn: systemService.toggleNbu,
    onSuccess: (data) => {
      toast.success(data.enabled ? 'NBU to\'lovi yoqildi' : 'NBU to\'lovi o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['system-nbu'] });
      queryClient.invalidateQueries({ queryKey: ['nbu-status'] });
    },
    onError: () => {
      toast.error(t('makePayment.errorOccurred'));
    },
  });

  const handleToggleMaintenance = useCallback(() => {
    const next = !(maintenanceData?.maintenance === true);
    maintenanceMutation.mutate({ active: next });
  }, [maintenanceData, maintenanceMutation]);

  const handleToggleNbu = useCallback(() => {
    const next = !(nbuData?.enabled === true);
    nbuMutation.mutate({ active: next });
  }, [nbuData, nbuMutation]);

  const isMaintenanceOn = maintenanceData?.maintenance === true;
  const isNbuOn = nbuData?.enabled === true;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-black text-gray-900 dark:text-white">
        Tizim sozlamalari
      </h1>

      {/* Sticky so the tabs stay reachable inside the long panels below. */}
      <div className="sticky top-0 z-20 -mx-4 bg-white/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6 dark:bg-[#0a0e15]/90">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {SYSTEM_TABS.map(({ key, label, icon: Icon }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'office' && (
      <>
      {/* Office card — address/hours/phones shown to customers everywhere. */}
      <OfficeSettingsSection />
      </>
      )}

      {tab === 'messages' && (
      <>
      {/* Answers "where do I send from?" once, at the top, instead of leaving
          the operator to infer it from five section headings. */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/20 dark:bg-sky-400/10">
        <p className="mb-2 text-sm font-black text-sky-900 dark:text-sky-200">
          Xabarni qayerdan yuboriladi
        </p>
        <ul className="space-y-1.5 text-[13px] font-medium text-sky-900/85 dark:text-sky-100/80">
          <li>
            <b>Reys keldi degan xabar</b> — Import sahifasida, Excel yuklangandan
            keyin o'zi ochiladi. Avtomatik, chastota cheki qo'llanmaydi.
          </li>
          <li>
            <b>Sog'inch xati, eslatma, yangilik, reklama</b> — quyidagi
            <b> Qo'lda xabar yuborish</b> bo'limi. Auditoriya bo'yicha yoki aniq
            mijoz kodi / telefon ro'yxati bo'yicha.
          </li>
          <li>
            <b>SMS</b> — o'sha bo'limda kanal sifatida tanlanadi. Avval quyidagi
            <b> SMS shlyuzi</b> sozlanishi kerak.
          </li>
        </ul>
      </div>

      {/* Write once, choose who gets it. Sits above the template editor because
          this is the screen an operator comes here to use; templates are the
          rarer "change the wording of an automatic message" task. */}
      <BroadcastComposer />

      {/* Automatic messages — only their wording is editable here. */}
      <TemplateEditorSection />

      {/* Gateway config sits with the messaging tools, not under infrastructure:
          whoever sends the SMS is the one who needs to turn it on. */}
      <SmsSettingsSection />

      {/* Video guide links — the bot offers each one at its own moment. */}
      <VideoGuidesSection />

      {/* Opt-in decoration; the bot disables it itself if Telegram refuses. */}
      <ButtonIconsSection />
      <MessageEmojiSection />
      </>
      )}

      {tab === 'system' && (
      <>
      {/* Maintenance Toggle */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMaintenanceOn ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-gray-100 dark:bg-white/5'}`}>
              <Wrench className={`w-5 h-5 ${isMaintenanceOn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="font-bold text-base text-gray-900 dark:text-white">Maintenance mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isMaintenanceOn ? 'Yoqilgan — faqat adminlar kiradi' : 'O\'chiq — barcha foydalanuvchilar'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleMaintenance}
            disabled={maintenanceLoading || maintenanceMutation.isPending}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${isMaintenanceOn ? 'bg-amber-500' : 'bg-gray-300 dark:bg-white/20'} disabled:opacity-60`}
          >
            <motion.div
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ left: isMaintenanceOn ? 26 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>
      </>
      )}

      {tab === 'payments' && (
      <>
      {/* NBU Toggle */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNbuOn ? 'bg-sky-100 dark:bg-sky-500/15' : 'bg-gray-100 dark:bg-white/5'}`}>
              <CreditCard className={`w-5 h-5 ${isNbuOn ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'}`} />
            </div>
            <div>
              <p className="font-bold text-base text-gray-900 dark:text-white">NBU onlayn to'lov</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isNbuOn ? 'Yoqilgan — kartali to\'lov ishlayapti' : 'O\'chiq — faqat manual to\'lov'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleNbu}
            disabled={nbuLoading || nbuMutation.isPending}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${isNbuOn ? 'bg-sky-500' : 'bg-gray-300 dark:bg-white/20'} disabled:opacity-60`}
          >
            <motion.div
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ left: isNbuOn ? 26 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>
      </>
      )}

      {tab === 'system' && (
      <>
      {/* Redis Info */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowRedisInfo(!showRedisInfo)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-gray-900 dark:text-white">Redis INFO</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Server statistikasi va xotira</p>
            </div>
          </div>
          <motion.div animate={{ rotate: showRedisInfo ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showRedisInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                {redisInfoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  </div>
                ) : redisInfo ? (
                  <pre className="text-xs font-mono bg-gray-50 dark:bg-black/30 rounded-xl p-4 overflow-auto max-h-96 text-gray-700 dark:text-gray-300">
                    {redisInfo.info}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Ma'lumot yo'q</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
      )}

      {tab === 'payments' && (
      <>
      {/* Hourly NBU Report */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-gray-900 dark:text-white">
                Soatlik NBU hisobot
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Har soat guruhga NBU to'lovlari xulosasi yuboriladi
              </p>
            </div>
            <button
              onClick={() =>
                reportConfigMutation.mutate({ enabled: !reportConfig?.enabled })
              }
              disabled={reportConfigMutation.isPending}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                reportConfig?.enabled
                  ? 'bg-emerald-500'
                  : 'bg-gray-300 dark:bg-white/20'
              } disabled:opacity-50`}
              aria-label="Hisobotni yoqish/o'chirish"
            >
              <span
                className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
                  reportConfig?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Ko'rinadigan reyslar (top-N)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={effectiveMaxFlights}
                  onChange={(e) => setMaxFlightsInput(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 text-gray-700 dark:text-gray-200"
                />
                <button
                  onClick={() => {
                    reportConfigMutation.mutate({
                      max_flights: effectiveMaxFlights,
                    });
                    setMaxFlightsInput(null);
                  }}
                  disabled={
                    reportConfigMutation.isPending ||
                    effectiveMaxFlights === reportConfig?.max_flights
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Saqlash
                </button>
              </div>
            </div>

            <button
              onClick={() => resendReportMutation.mutate(1)}
              disabled={resendReportMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-xs font-bold disabled:opacity-50"
            >
              {resendReportMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Oxirgi soatni qayta yuborish
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Guruh ID: {reportConfig?.group_id ?? '—'} · oyna: o'tgan to'liq soat
            (masalan 15:00–15:59). Bo'sh soatlar ham yuboriladi.
          </p>
        </div>
      </div>
      </>
      )}

      {tab === 'payments' && (
      <>
      {/* NBU Stuck Payments */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowNbuPending(!showNbuPending)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-gray-900 dark:text-white">
                NBU pending to'lovlar
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Callback kelmagan tranzaksiyalar — qo'lda reconcile qilish
                {nbuPending && (
                  <span
                    className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold"
                    title={
                      (nbuPending.total ?? nbuPending.count) > nbuPending.count
                        ? `${nbuPending.count} ta ko'rsatilmoqda`
                        : undefined
                    }
                  >
                    {nbuPending.total ?? nbuPending.count}
                  </span>
                )}
              </p>
            </div>
          </div>
          <motion.div animate={{ rotate: showNbuPending ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showNbuPending && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Reconcile = NBU `/payment/status` ga so'rov yuborib, javobni bazaga yozish.
                    CARD_BINDING uchun token saqlanadi, ONE_TIME uchun hamyon kreditlanadi.
                  </p>
                  <button
                    onClick={() => refetchNbuPending()}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Yangilash
                  </button>
                </div>

                {nbuPendingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                  </div>
                ) : !nbuPending || nbuPending.count === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    Pending tranzaksiyalar yo'q ✓
                  </p>
                ) : (
                  <>
                    {/* Bulk actions toolbar */}
                    <div className="flex items-center gap-2 flex-wrap pb-1">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200"
                      >
                        {allSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        {allSelected ? 'Belgini olib tashlash' : 'Hammasini tanlash'}
                      </button>
                      <button
                        onClick={handleBulkExpireSelected}
                        disabled={selectedTxns.size === 0 || bulkExpireMutation.isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 dark:bg-white/15 hover:bg-gray-900 dark:hover:bg-white/20 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {bulkExpireMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        Tanlanganlarni expire ({selectedTxns.size})
                      </button>
                      <button
                        onClick={handleBulkExpireStale}
                        disabled={bulkExpireMutation.isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Barcha eskirgan (&gt;1h) expire
                      </button>
                    </div>

                  <div className="space-y-2 max-h-[480px] overflow-auto">
                    {nbuPending.rows.map((row: NbuPendingPaymentRow) => {
                      const isReconciling = reconciling === row.transaction_id;
                      const isExpiring = expiring === row.transaction_id;
                      const isCardBinding = row.purpose === 'CARD_BINDING';
                      const isBusy = isReconciling || isExpiring;
                      const isSelected = selectedTxns.has(row.transaction_id);
                      return (
                        <div
                          key={row.id}
                          className={`border rounded-xl p-3 ${
                            isSelected
                              ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/[0.06]'
                              : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex gap-2">
                          <button
                            onClick={() => toggleSelect(row.transaction_id)}
                            className="flex-shrink-0 pt-0.5 text-gray-400 hover:text-rose-500"
                            aria-label="Tanlash"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-500" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <div className="flex flex-col gap-2 flex-1 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isCardBinding
                                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  }`}
                                >
                                  {row.purpose}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-bold">
                                  {formatAge(row.age_seconds)}
                                </span>
                                {!isCardBinding && (
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    {formatMoney(row.amount_uzs)} so'm
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate">
                                txn: {row.transaction_id}
                              </p>
                              <p className="text-[11px] font-mono text-gray-500 dark:text-gray-500 truncate">
                                order: {row.order_id}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-500">
                                tg: {row.telegram_id}
                                {row.card_masked && ` · ${row.card_masked}`}
                                {row.callback_received_at && ' · callback ✓'}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => reconcileMutation.mutate(row.transaction_id)}
                                disabled={isBusy || reconcileMutation.isPending}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                              >
                                {isReconciling ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                Reconcile
                              </button>
                              <button
                                onClick={() => handleExpire(row.transaction_id)}
                                disabled={isBusy || expireMutation.isPending}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                              >
                                {isExpiring ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                Expire
                              </button>
                            </div>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
      )}

      {tab === 'delivery' && (
      <>
      {/* UzPost Pending Requests */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowUzpostPending(!showUzpostPending)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-gray-900 dark:text-white">
                {t('system.uzpost.title')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                UzPost pending zayafkalarini reconcile yoki reject qilish
                {uzpostPending && (
                  <span
                    className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold"
                    title={
                      (uzpostPending.total ?? uzpostPending.count) > uzpostPending.count
                        ? `${uzpostPending.count} ta ko'rsatilmoqda`
                        : undefined
                    }
                  >
                    {uzpostPending.total ?? uzpostPending.count}
                  </span>
                )}
              </p>
            </div>
          </div>
          <motion.div animate={{ rotate: showUzpostPending ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showUzpostPending && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Reconcile = to'langan UzPost zayafkani tasdiqlashga qayta urinish.
                    Reject = faqat pending va to'lanmagan zayafkalar uchun.
                  </p>
                  <button
                    onClick={() => refetchUzpostPending()}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Yangilash
                  </button>
                </div>

                {uzpostPendingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : !uzpostPending || uzpostPending.count === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    {t('system.uzpost.empty')}
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap pb-1">
                      <button
                        onClick={toggleSelectAllUzpost}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200"
                      >
                        {allUzpostSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        {allUzpostSelected ? 'Belgini olib tashlash' : 'Hammasini tanlash'}
                      </button>
                      <button
                        onClick={handleUzpostBulkExpireSelected}
                        disabled={
                          selectedUzpostIds.size === 0 ||
                          uzpostBulkExpireMutation.isPending
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 dark:bg-white/15 hover:bg-gray-900 dark:hover:bg-white/20 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uzpostBulkExpireMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {t('system.uzpost.expireSelected', {
                          count: selectedUzpostIds.size,
                        })}
                      </button>
                      <button
                        onClick={handleUzpostBulkExpireOld}
                        disabled={uzpostBulkExpireMutation.isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t('system.uzpost.expireOld')}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[480px] overflow-auto">
                      {uzpostPending.rows.map((row: UzPostPendingRow) => {
                        const isReconciling =
                          uzpostReconciling === row.delivery_request_id;
                        const isRejecting =
                          uzpostRejecting === row.delivery_request_id;
                        const isBusy = isReconciling || isRejecting;
                        const isSelected = selectedUzpostIds.has(
                          row.delivery_request_id,
                        );
                        const flights = row.flight_names.length
                          ? row.flight_names.join(', ')
                          : '—';
                        return (
                          <div
                            key={row.delivery_request_id}
                            className={`border rounded-xl p-3 ${
                              isSelected
                                ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50/50 dark:bg-blue-500/[0.06]'
                                : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]'
                            }`}
                          >
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  toggleUzpostSelect(row.delivery_request_id)
                                }
                                className="flex-shrink-0 pt-0.5 text-gray-400 hover:text-blue-500"
                                aria-label="Tanlash"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <div className="flex flex-col gap-2 flex-1 min-w-0">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-bold">
                                      {formatAge(row.age_seconds)}
                                    </span>
                                    {row.is_paid && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] font-bold">
                                        {t('system.uzpost.paid')}
                                      </span>
                                    )}
                                    {row.has_approved_sibling && (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-[10px] font-bold">
                                        {t('system.uzpost.sibling')}
                                      </span>
                                    )}
                                    {row.uzpost_order_number && (
                                      <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300 text-[10px] font-bold">
                                        {row.uzpost_order_number}
                                      </span>
                                    )}
                                    {row.amount_uzs !== null && (
                                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {formatMoney(row.amount_uzs)} so'm
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                    {row.client_code}
                                  </p>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
                                    reyslar: {flights}
                                  </p>
                                  <p className="text-[11px] font-mono text-gray-500 dark:text-gray-500 truncate">
                                    DR: {row.delivery_request_id}
                                    {row.nbu_order_id && ` - ${row.nbu_order_id}`}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      uzpostReconcileMutation.mutate(
                                        row.delivery_request_id,
                                      )
                                    }
                                    disabled={
                                      isBusy ||
                                      uzpostReconcileMutation.isPending
                                    }
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                  >
                                    {isReconciling ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                    {t('system.uzpost.reconcile')}
                                  </button>
                                  <button
                                    onClick={() => handleUzpostReject(row)}
                                    disabled={
                                      row.is_paid ||
                                      isBusy ||
                                      uzpostRejectMutation.isPending
                                    }
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                  >
                                    {isRejecting ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <XCircle className="w-3 h-3" />
                                    )}
                                    {t('system.uzpost.reject')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
      )}

      {tab === 'system' && (
      <>
      {/* Redis Clients */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowRedisClients(!showRedisClients)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-base text-gray-900 dark:text-white">Redis CLIENT LIST</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ulangan clientlar va ular holati</p>
            </div>
          </div>
          <motion.div animate={{ rotate: showRedisClients ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showRedisClients && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                {redisClientsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                  </div>
                ) : redisClients ? (
                  <pre className="text-xs font-mono bg-gray-50 dark:bg-black/30 rounded-xl p-4 overflow-auto max-h-96 text-gray-700 dark:text-gray-300">
                    {redisClients.clients}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Ma'lumot yo'q</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
      )}
    </div>
  );
}
