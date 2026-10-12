import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getNotificationSummary,
  type ClientNotificationStatus,
  type ForgottenCargoResult,
  type NotificationSummary,
} from '@/api/services/flightNotifications';
import ForgottenCargoModal from '@/components/admin/ForgottenCargoModal';
import {
  NotificationClientList,
  type ListStatus,
} from '@/components/admin/flight-notifications/NotificationClientList';
import { NotificationHeader } from '@/components/admin/flight-notifications/NotificationHeader';
import { NotificationToolbar } from '@/components/admin/flight-notifications/NotificationToolbar';
import { ResendConfirmDialog } from '@/components/admin/flight-notifications/ResendConfirmDialog';
import { SendBar } from '@/components/admin/flight-notifications/SendBar';
import { SendProgressDialog } from '@/components/admin/flight-notifications/SendProgressDialog';
import {
  alreadyNotifiedClients,
  filterClients,
  isOstatkaFlight,
  paginate,
  pendingClientIds,
  pruneSelection,
  selectionStateOf,
  setClientsSelected,
  toggleSelection,
  type NotificationFilter,
} from '@/components/admin/flight-notifications/notificationFilters';
import { errorMessage } from '@/components/admin/flight-notifications/sendTask';
import { useSendTask } from '@/components/admin/flight-notifications/useSendTask';
import { cn } from '@/lib/utils';

interface FlightNotificationPageProps {
  flightName: string;
  onBack: () => void;
  /**
   * The page owns the whole viewport (the astatka route has no app navigation
   * bar): a fixed header and send bar around its own scroller. Without it the
   * page flows inside the app's padded <main>, under the navigation bar.
   */
  fullScreen?: boolean;
}

const NO_CLIENTS: ClientNotificationStatus[] = [];

export default function FlightNotificationPage({
  flightName,
  onBack,
  fullScreen = false,
}: FlightNotificationPageProps) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Only the newest summary request may write state: an older one resolving
  // late (slow network, a double refresh) would roll the list back.
  const requestSeqRef = useRef(0);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [markBot, setMarkBot] = useState(false);
  const [markWeb, setMarkWeb] = useState(true);
  const [showForgottenModal, setShowForgottenModal] = useState(false);
  // Guards the confirm → start window, where the send button is not yet disabled.
  const sendInFlightRef = useRef(false);
  const listTopRef = useRef<HTMLElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const addForgottenRef = useRef<HTMLButtonElement>(null);
  /** Already-notified clients the re-send question is about; `null` = not asking. */
  const [resendTargets, setResendTargets] = useState<ClientNotificationStatus[] | null>(null);
  const resendAnswerRef = useRef<((resend: boolean) => void) | null>(null);

  const notifyError = useCallback((title: string) => {
    toast.error(title);
  }, []);
  const sendTask = useSendTask(flightName, notifyError);

  const askResend = (clients: ClientNotificationStatus[]) =>
    new Promise<boolean>((resolve) => {
      resendAnswerRef.current = resolve;
      setResendTargets(clients);
    });
  // Radix reports "closed" after "Ha" too; only the first answer counts.
  const answerResend = (resend: boolean) => {
    setResendTargets(null);
    resendAnswerRef.current?.(resend);
    resendAnswerRef.current = null;
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadSummary = useCallback(
    async (quiet = false) => {
      const requestSeq = ++requestSeqRef.current;
      if (quiet) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const data = await getNotificationSummary(flightName);
        if (requestSeq !== requestSeqRef.current) return;
        setSummary(data);
        setLoadError(null);
        // Keep the selection consistent: drop ids that no longer exist.
        setSelected((prev) => pruneSelection(prev, data.clients));
      } catch (err) {
        if (requestSeq !== requestSeqRef.current) return;
        const message = errorMessage(err, "Ma'lumotlarni yuklab bo'lmadi");
        setLoadError(message);
        // A failed background refresh keeps the last good list on screen, so
        // the toast is the only sign that it may be out of date.
        if (quiet) toast.error(message);
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [flightName],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // ── Filtered + paginated clients ───────────────────────────────────────────

  const clients = summary?.clients ?? NO_CLIENTS;
  const filteredClients = useMemo(
    () => filterClients(clients, filter, search),
    [clients, filter, search],
  );
  const pageSlice = paginate(filteredClients, page);
  const selectionState = selectionStateOf(filteredClients, selected);
  const isOstatka = isOstatkaFlight(flightName);

  let listStatus: ListStatus = 'loading';
  if (summary) listStatus = 'ready';
  else if (loadError && !isLoading) listStatus = 'error';

  // Filter and search changes always start again from the first page.
  const changeFilter = (next: NotificationFilter) => {
    setFilter(next);
    setPage(1);
  };
  const changeSearch = (next: string) => {
    setSearch(next);
    setPage(1);
  };
  const clearFilters = () => {
    setFilter('all');
    setSearch('');
    setPage(1);
  };

  const goToPage = (next: number) => {
    // Commit the new page before scrolling, so the scroll runs against the
    // list that is actually shown (a short last page shrinks the document).
    flushSync(() => setPage(next));
    listTopRef.current?.scrollIntoView?.({ block: 'start' });
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleClient = useCallback((clientId: string) => {
    setSelected((prev) => toggleSelection(prev, clientId));
  }, []);

  const toggleAllMatching = () => {
    setSelected((prev) => setClientsSelected(prev, filteredClients, selectionState !== 'all'));
  };

  // Select every not-yet-sent client across the whole flight (not just the
  // current filter/page), so the operator can fire one send at the remainder.
  const selectPending = () => {
    const pendingIds = pendingClientIds(clients);
    setSelected(new Set(pendingIds));
    if (pendingIds.length === 0) {
      toast.message("Yuborilmagan mijoz yo'q");
    }
  };

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (sendInFlightRef.current || sendTask.hasUnfinishedTask) return;
    if (isOstatka) {
      toast.error('Ostatka (A-) reyslar bot orqali yuboriladi');
      return;
    }
    if (selected.size === 0) {
      toast.error('Kamida 1 ta mijozni tanlang');
      return;
    }
    if (!markBot && !markWeb) {
      toast.error('Kamida bittasini tanlang: Bot yoki Web');
      return;
    }

    sendInFlightRef.current = true;
    try {
      // Warn if any selected client was already notified via any channel
      const alreadySent = alreadyNotifiedClients(clients, selected);
      if (alreadySent.length > 0 && !(await askResend(alreadySent))) return;
      await sendTask.start({
        client_ids: [...selected],
        only_pending: false,
        mark_bot: markBot,
        mark_web: markWeb,
      });
    } finally {
      sendInFlightRef.current = false;
    }
  };

  // A finished send is forgotten. One still running (the dialog could only be
  // closed because progress polls stopped answering) is only hidden: it stays
  // tracked, the send button stays blocked, and the send bar can reopen it.
  const handleCloseProgress = () => {
    if (sendTask.hasUnfinishedTask) {
      sendTask.hide();
    } else {
      sendTask.forget();
      setSelected(new Set());
    }
    void loadSummary(true);
  };

  // ── Forgotten cargo success ────────────────────────────────────────────────

  const handleForgottenSuccess = (result: ForgottenCargoResult) => {
    setShowForgottenModal(false);
    const msg = result.sent
      ? `Yuk qo'shildi va yuborildi (${result.track_codes_added} ta trek kod)`
      : `Yuk qo'shildi (${result.track_codes_added} ta trek kod). ${result.send_error ? `Yuborish: ${result.send_error}` : ''}`;
    if (result.sent) toast.success(msg);
    else toast.message(msg);
    void loadSummary(true);
  };

  // ───────────────────────────────────────────────────────────────────────────

  // The progress dialog is portalled and follows only the task, so a send
  // recovered on reload shows even while the summary is still loading.
  return (
    <div className={cn('flex flex-col', fullScreen && 'h-dvh overflow-hidden bg-mc-bg')}>
      <NotificationHeader
        flightName={flightName}
        onBack={onBack}
        onRefresh={() => void loadSummary(summary !== null)}
        isRefreshing={isLoading || isRefreshing}
        fullScreen={fullScreen}
      />

      <div
        className={cn(
          fullScreen
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
            : // Clears the send bar, which is pinned to the viewport in this mode.
              'pb-[calc(5rem+env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-3">
          <NotificationToolbar
            summary={summary}
            isLoadingSummary={listStatus === 'loading'}
            search={search}
            onSearchChange={changeSearch}
            filter={filter}
            onFilterChange={changeFilter}
            markWeb={markWeb}
            markBot={markBot}
            onMarkWebChange={setMarkWeb}
            onMarkBotChange={setMarkBot}
            onSelectPending={selectPending}
            onAddForgotten={() => setShowForgottenModal(true)}
            addForgottenRef={addForgottenRef}
            isOstatka={isOstatka}
          />

          {isOstatka && (
            <p className="flex items-start gap-2 rounded-mc-md bg-mc-warn-soft px-3 py-2.5 text-[12px] font-bold leading-snug text-mc-warn">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Ostatka (A-) reyslar bot orqali yuboriladi. Web orqali yuborish o'chirilgan.
            </p>
          )}

          <NotificationClientList
            status={listStatus}
            errorMessage={loadError}
            // Quiet while a list is on screen (the empty-flight "Yangilash"):
            // a failure then has to say so, since the list stays as it was.
            onRetry={() => void loadSummary(summary !== null)}
            totalClients={clients.length}
            matchingCount={filteredClients.length}
            pageClients={pageSlice.items}
            selected={selected}
            selectionState={selectionState}
            onToggleClient={toggleClient}
            onToggleAll={toggleAllMatching}
            page={pageSlice.page}
            totalPages={pageSlice.totalPages}
            onPageChange={goToPage}
            onClearFilters={clearFilters}
            listTopRef={listTopRef}
            scrollMarginClassName={fullScreen ? 'scroll-mt-3' : 'scroll-mt-24'}
          />
        </div>
      </div>

      <SendBar
        selectedCount={selected.size}
        markWeb={markWeb}
        markBot={markBot}
        isOstatka={isOstatka}
        isSending={sendTask.isStarting || sendTask.hasUnfinishedTask}
        onShowRunningSend={
          sendTask.hasUnfinishedTask && !sendTask.isDialogOpen ? sendTask.reopen : undefined
        }
        onSend={() => void handleSend()}
        sendButtonRef={sendButtonRef}
        floating={!fullScreen}
      />

      <ResendConfirmDialog
        clients={resendTargets}
        onConfirm={() => answerResend(true)}
        onCancel={() => answerResend(false)}
        returnFocusRef={sendButtonRef}
      />

      <SendProgressDialog
        taskState={sendTask.isDialogOpen ? sendTask.taskState : null}
        flightName={flightName}
        isCancelling={sendTask.isCancelling}
        pollFailed={sendTask.pollFailed}
        onCancel={() => void sendTask.cancel()}
        onRetryPolling={sendTask.retryPolling}
        onClose={handleCloseProgress}
        returnFocusRef={listTopRef}
      />

      {showForgottenModal && (
        <ForgottenCargoModal
          flightName={flightName}
          onClose={() => setShowForgottenModal(false)}
          onSuccess={handleForgottenSuccess}
          returnFocusRef={addForgottenRef}
        />
      )}
    </div>
  );
}
