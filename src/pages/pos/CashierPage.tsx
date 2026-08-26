/**
 * Kassir oynasi — the rebuilt cashier console.
 *
 * Lives at `/kassa` while it is being built. The existing `/pos` console keeps
 * running untouched: it is the screen the counter uses all day, and replacing
 * it in place would mean every half-finished section is a broken till.
 *
 * No sidebar, by the owner's decision. Everything a cashier needs to leave the
 * screen — role switch and logout — sits at the right of the header instead.
 *
 * Three columns, as in the mockup: who is paying, what they are paying, and
 * the receipts waiting for a decision. The receipt column runs the full height
 * beside both rows because it is worked through independently of whoever is
 * standing at the counter.
 *
 * The period control drives BOTH the totals and the sparklines from one
 * request, and the same window feeds the history table, so a card can never
 * show a figure for one window beside a chart or a table for another.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, LayoutGrid, LogOut, RotateCcw, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

import {
  editPayment,
  getCashierLogSeries,
  type CashierLogItem,
  type CashierLogProvider,
} from '@/api/pos';
import { getAdminJwtClaims } from '@/api/services/adminManagement';
import {
  posNotificationService,
  type NotificationFilters,
  type PosNotificationItem,
} from '@/api/services/posNotificationService';
import {
  normalizeSearchResult,
  searchClients,
  type ClientSearchResult,
} from '@/api/verification';
import RoleSwitcher from '@/components/admin/RoleSwitcher';
import {
  describeApiFailure,
  describeSearchFailure,
} from '@/components/pos/cashier/apiErrors';
import { ClientLookup } from '@/components/pos/cashier/ClientLookup';
import {
  EditPaymentModal,
  type EditPaymentSubmission,
} from '@/components/pos/cashier/EditPaymentModal';
import { PaymentForm } from '@/components/pos/cashier/PaymentForm';
import { PaymentHistory } from '@/components/pos/cashier/PaymentHistory';
import { PeriodPicker } from '@/components/pos/cashier/PeriodPicker';
import { ProviderCards } from '@/components/pos/cashier/ProviderCards';
import { ReceiptQueue } from '@/components/pos/cashier/ReceiptQueue';
import { SplitHandle } from '@/components/pos/cashier/SplitHandle';
import { ThemeChoice } from '@/components/pos/cashier/ThemeChoice';
import {
  clampLayoutToSpace,
  clampLayoutValue,
  DEFAULT_LAYOUT,
  HISTORY_BAR_HEIGHT,
  HISTORY_MIN_HEIGHT,
  isDefaultLayout,
  loadHistoryOpen,
  loadLayout,
  saveHistoryOpen,
  saveLayout,
  type LayoutSpace,
  type PanelLayout,
} from '@/components/pos/cashier/panelLayout';
import { useCashierPayment } from '@/components/pos/cashier/useCashierPayment';
import {
  DEFAULT_PER_PAGE,
  PER_PAGE_OPTIONS,
  type ReceiptTab,
} from '@/components/pos/cashier/receiptTabs';
import { ReceiptImageModal } from '@/components/pos/cashier/ReceiptImageModal';
import {
  describeRange,
  resolvePeriod,
  type PeriodKey,
  type PeriodRange,
} from '@/components/pos/cashier/periods';
import { usePaymentNotifications } from '@/hooks/usePaymentNotifications';
import { ClientProfileDrawer } from '@/pages/pos/components/ClientProfileDrawer';
import { ConfirmModal } from '@/pages/pos/components/ConfirmModal';
import ReceiptScannerModal from '@/pages/pos/components/ReceiptScannerModal';
import { RejectConfirmModal } from '@/pages/pos/components/RejectConfirmModal';
import { formatTashkentDate } from '@/lib/format';

/**
 * The `?receipt=<order_id>` a printed QR code carries, if the page was opened
 * from one. Empty or absent both mean "not a deep link".
 */
function receiptDeepLink(): string | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('receipt');
  return value && value.trim() ? value.trim() : null;
}

const PER_PAGE_KEY = 'kassa_receipts_per_page_v1';

/** The cashier's own choice, or three. Per browser, like the panel sizes. */
function loadPerPage(): number {
  if (typeof window === 'undefined') return DEFAULT_PER_PAGE;
  try {
    const stored = Number(window.localStorage.getItem(PER_PAGE_KEY));
    return (PER_PAGE_OPTIONS as readonly number[]).includes(stored)
      ? stored
      : DEFAULT_PER_PAGE;
  } catch {
    return DEFAULT_PER_PAGE;
  }
}

interface CashierPageProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[16px] font-bold text-mc-text">Ruxsat yo‘q</p>
      <p className="max-w-xs text-[13px] text-mc-text-3">
        Bu sahifa uchun kassa huquqi kerak.
      </p>
    </div>
  );
}

export default function CashierPage({ onNavigate, onLogout }: CashierPageProps) {
  const claims = useMemo(() => getAdminJwtClaims(), []);
  /**
   * Super-admins carry no explicit permissions in their JWT — they bypass every
   * check. The slugs below are the ones the permission table actually defines;
   * a name that is not in it silently denies, which is invisible until a real
   * cashier cannot take a payment.
   */
  const access = useMemo(() => {
    const has = (slug: string) =>
      claims.isSuperAdmin || claims.permissions.has(slug);
    const read = has('pos:read');
    const process = has('pos:process');
    const adjust = has('pos:adjust');
    const updateStatus = has('pos:update_status');
    return {
      read,
      process,
      adjust,
      updateStatus,
      any: claims.isSuperAdmin || read || process || adjust || updateStatus,
    };
  }, [claims]);
  const canView = access.any;

  const queryClient = useQueryClient();
  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  /**
   * Re-read the client after a payment posts.
   *
   * The balance on screen is a snapshot from the search call — plain state, not
   * a query — so nothing else can refresh it. Silent on failure: the payment
   * already succeeded, and a red toast about a background re-read would read as
   * though it had not.
   */
  const clientCode = client?.client_code ?? null;

  /**
   * Re-read the client after something changed their balance.
   *
   * The staleness check lives in the `setClient` updater rather than in a ref:
   * `previous` is the authoritative current value at commit time, so a slow
   * response for a client the cashier has since moved on from is dropped
   * instead of putting that person's balance back on screen under a new name.
   */
  const refreshClient = useCallback(async () => {
    if (!clientCode) return;
    try {
      const response = await searchClients(clientCode);
      const fresh = normalizeSearchResult(response.client);
      setClient((previous) =>
        previous?.client_code === clientCode ? fresh : previous,
      );
    } catch {
      // The action that triggered this already succeeded; a red toast about a
      // background re-read would read as though it had not.
    }
  }, [clientCode]);

  const payment = useCashierPayment(client, access.process, () => {
    void refreshClient();
  });
  const { resetSelection } = payment;

  /**
   * Load a client the cashier did not type — currently the receipt scanner.
   *
   * Resets the basket first, unlike `refreshClient`: this is a DIFFERENT client
   * arriving, and carrying a selection across would let one person's cargo be
   * paid under another's code.
   */
  const loadClientByCode = useCallback(
    async (code: string) => {
      try {
        const response = await searchClients(code);
        resetSelection();
        setClient(normalizeSearchResult(response.client));
      } catch (err) {
        // The scanner has just resolved this receipt against the server, so the
        // client demonstrably exists. Reporting every failure as "not found"
        // would state something provably false when the real cause is a dropped
        // connection or an expired session.
        toast.error(describeSearchFailure(err, code));
      }
    },
    [resetSelection],
  );

  /** Which provider the history table is narrowed to — set by the stat cards. */
  const [historyProvider, setHistoryProvider] = useState<
    CashierLogProvider | 'all'
  >('all');

  const [layout, setLayout] = useState<PanelLayout>(loadLayout);
  const [historyOpen, setHistoryOpen] = useState<boolean>(loadHistoryOpen);

  const toggleHistory = useCallback(() => {
    setHistoryOpen((previous) => {
      saveHistoryOpen(!previous);
      return !previous;
    });
  }, []);

  /**
   * What the two rows actually measure, so the clamps can reserve room for the
   * payment column rather than trusting fixed maxima that do not know the
   * window width.
   */
  const outerRowRef = useRef<HTMLDivElement | null>(null);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const topRowRef = useRef<HTMLDivElement | null>(null);
  const spaceRef = useRef<LayoutSpace>({
    outerWidth: 0,
    topRowWidth: 0,
    leftHeight: 0,
  });

  useEffect(() => {
    const outer = outerRowRef.current;
    const left = leftColumnRef.current;
    const top = topRowRef.current;
    if (!outer || !left || !top) return;

    const measure = () => {
      spaceRef.current = {
        outerWidth: outer.clientWidth,
        topRowWidth: top.clientWidth,
        leftHeight: left.clientHeight,
      };
      // Re-clamp what is already stored. A layout tuned on a wide monitor and
      // reopened on the narrow till would otherwise leave the payment column
      // at zero, with no divider of its own to drag it back.
      setLayout((previous) => {
        const next = clampLayoutToSpace(previous, spaceRef.current);
        if (
          next.receiptsWidth === previous.receiptsWidth &&
          next.lookupWidth === previous.lookupWidth &&
          next.topHeight === previous.topHeight
        ) {
          return previous;
        }
        saveLayout(next);
        return next;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(left);
    observer.observe(top);
    return () => observer.disconnect();
  }, []);

  /**
   * Applied as a delta so the handle stays dumb, and persisted on every commit
   * rather than on an interval — a drag is a deliberate act and losing it to a
   * closed tab would be worse than the write.
   */
  const resizePanel = useCallback((key: keyof PanelLayout, delta: number) => {
    setLayout((previous) => {
      const next = clampLayoutToSpace(
        { ...previous, [key]: clampLayoutValue(key, previous[key] + delta) },
        spaceRef.current,
      );
      saveLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, []);

  /**
   * Reset ONE dimension — what a divider's Home key and double-click mean.
   *
   * Wiring every handle to the wholesale reset made "put this column back"
   * silently discard the other two panels the cashier had already tuned. The
   * header button remains the all-at-once escape hatch.
   */
  const resetPanel = useCallback((key: keyof PanelLayout) => {
    setLayout((previous) => {
      const next = clampLayoutToSpace(
        { ...previous, [key]: DEFAULT_LAYOUT[key] },
        spaceRef.current,
      );
      saveLayout(next);
      return next;
    });
  }, []);

  const [periodKey, setPeriodKey] = useState<PeriodKey>('today');
  const [range, setRange] = useState<PeriodRange>(() => resolvePeriod('today'));
  const [receiptTab, setReceiptTab] = useState<ReceiptTab>('flight');
  const [rejecting, setRejecting] = useState<PosNotificationItem | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<PosNotificationItem | null>(null);
  /** Ledger row whose receipt is being looked up, so only its pencil spins. */
  const [resolvingRowId, setResolvingRowId] = useState<number | null>(null);
  /** Receipt whose image is open in a dialog. */
  const [viewingReceipt, setViewingReceipt] = useState<PosNotificationItem | null>(
    null,
  );
  const [perPage, setPerPage] = useState<number>(loadPerPage);
  /** Bumped to put the caret back in the client search. */
  const [searchFocusToken, setSearchFocusToken] = useState(0);
  const [editError, setEditError] = useState<{
    code: string | null;
    message: string | null;
  }>({ code: null, message: null });
  const receiptColumnRef = useRef<HTMLDivElement | null>(null);

  /**
   * Receipt QR scanner.
   *
   * `?receipt=<order_id>` is read once, at mount, from the initial URL. Printed
   * receipts carry a QR pointing at `{BASE}/pos?receipt=<id>`; a cashier who
   * opens the same link on this console should land in the same place, so the
   * parameter is honoured here too.
   */
  const [scannerOrderId, setScannerOrderId] = useState<string | null>(receiptDeepLink);
  const [isScannerOpen, setIsScannerOpen] = useState(
    () => receiptDeepLink() !== null,
  );

  const {
    notifications,
    total: receiptTotal,
    page: receiptPage,
    perPage: receiptPerPage,
    filters: receiptFilters,
    defaultFilters: receiptDefaultFilters,
    setFilters: setReceiptFilters,
    resetFilters: resetReceiptFilters,
    setPage: setReceiptPage,
    isLoading: receiptsLoading,
    isError: receiptsError,
    isRefetching: receiptsRefetching,
    refetch: refetchReceipts,
  } = usePaymentNotifications({ perPage, sinceYesterday: true });

  /**
   * Pending count for BOTH queues, not just the one on screen.
   *
   * The list request is scoped to one `source`, so without this the inactive
   * tab looks identical holding zero receipts or twenty — and those are
   * payments a client has already made and is waiting on. One row per source is
   * enough: only `total` is read.
   */
  /**
   * How much work is waiting — deliberately NOT what the cashier has filtered.
   *
   * These two numbers feed the tab badges and the header bell, whose label
   * promises "receipts awaiting confirmation". Spreading the panel's filters in
   * here made that a lie in the dangerous direction: a client code left in the
   * search box, or a date narrowed to this morning, and the bell reports 2 when
   * 40 receipts are waiting — clients whose money is already sent, sitting
   * unconfirmed because the screen said there was nothing to do.
   *
   * Only `source` and `status` are sent. No date bound either: a receipt from
   * yesterday is still waiting today.
   */
  const receiptCounts = useQuery({
    queryKey: ['pos-notifications', 'counts'],
    queryFn: async () => {
      const [flight, zayafka] = await Promise.all([
        posNotificationService.getNotifications(1, 1, {
          source: 'flight',
          status: 'pending,partial',
        }),
        posNotificationService.getNotifications(1, 1, {
          source: 'zayafka',
          status: 'pending,partial',
        }),
      ]);
      return { flight: flight.total, zayafka: zayafka.total };
    },
    staleTime: 20_000,
  });

  /** The three views that read the payment-event ledger. */
  const invalidateLedger = useCallback(() => {
    for (const key of [['cashier-log'], ['cashier', 'series'], ['pos-unpaid']]) {
      queryClient.invalidateQueries({ queryKey: key, refetchType: 'active' });
    }
  }, [queryClient]);

  const handlePerPage = useCallback(
    (next: number) => {
      setPerPage(next);
      try {
        window.localStorage.setItem(PER_PAGE_KEY, String(next));
      } catch {
        // Losing the preference is not worth breaking the change that set it.
      }
      // Page 4 of three-per-page is past the end of twenty-per-page.
      setReceiptPage(1);
    },
    [setReceiptPage],
  );

  const invalidateReceipts = useCallback(() => {
    // Prefix match: covers both the list query and the per-tab count query.
    queryClient.invalidateQueries({
      queryKey: ['pos-notifications'],
      refetchType: 'active',
    });
  }, [queryClient]);

  /**
   * What the bell counts: receipts still awaiting a decision, across BOTH
   * queues. `receiptTotal` is the visible list's total and includes rows
   * already settled or rejected, which is not what the bell's label promises.
   */
  const pendingTotal =
    (receiptCounts.data?.flight ?? 0) + (receiptCounts.data?.zayafka ?? 0);

  /**
   * `source` is the tab, not a filter, so it is re-pinned on every change.
   * Letting the filter object carry its own source would let the panel and the
   * tab disagree about which queue is on screen.
   */
  const handleReceiptFilters = useCallback(
    (next: NotificationFilters) => {
      setReceiptFilters({ ...next, source: receiptTab });
      setReceiptPage(1);
    },
    [setReceiptFilters, setReceiptPage, receiptTab],
  );

  const handleReceiptFiltersReset = useCallback(() => {
    // The hook's own defaults (which include today's window), then the current
    // tab put back — a reset must not silently move the cashier to the other
    // queue.
    resetReceiptFilters();
    setReceiptFilters((previous) => ({ ...previous, source: receiptTab }));
    setReceiptPage(1);
  }, [resetReceiptFilters, setReceiptFilters, setReceiptPage, receiptTab]);

  const handleReceiptTab = useCallback(
    (tab: ReceiptTab) => {
      setReceiptTab(tab);
      setReceiptFilters((prev) => ({ ...prev, source: tab }));
      setReceiptPage(1);
    },
    [setReceiptFilters, setReceiptPage],
  );

  /**
   * Confirming a receipt is two different calls.
   *
   * A flight receipt is settled against a client and a flight; a zayavka
   * receipt against a delivery request id. They are separate endpoints because
   * they post to different ledgers, not because of a naming accident.
   */
  const confirm = useMutation({
    mutationFn: async (item: PosNotificationItem) => {
      if (item.source === 'zayafka') {
        if (!item.delivery_request_id) {
          throw new Error('Zayavka raqami yo‘q');
        }
        return posNotificationService.confirmZayafka({
          delivery_request_id: item.delivery_request_id,
          amount: item.amount_paid,
        });
      }
      return posNotificationService.confirmFlightNotification({
        client_code: item.client_code,
        flight_name: item.flight_name,
        amount: item.amount_paid,
        payment_type: item.payment_type ?? 'online',
      });
    },
    onMutate: (item) => setBusyId(item.id),
    onSuccess: (_data, item) => {
      toast.success(`${item.client_code} tasdiqlandi`);
      // The SSE push normally refreshes this, but the shared stream gives up
      // permanently after ten failed reconnects (useEventSource.ts:48) and the
      // poll is a 90s safety net — until one of those fires, the card the
      // cashier just settled stays on screen and stays clickable.
      invalidateReceipts();
      // Confirming appends a ClientPaymentEvent, which is exactly what the
      // takings cards, the sparklines and the history table read. Without this
      // the money the cashier just booked is missing from all three until the
      // 30s staleTime lapses — and the sparkline for a quiet hour looks flat.
      invalidateLedger();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Tasdiqlab bo‘lmadi'),
    onSettled: () => setBusyId(null),
  });

  const reject = useMutation({
    mutationFn: async ({
      item,
      comment,
    }: {
      item: PosNotificationItem;
      comment: string | null;
    }) => {
      if (item.source === 'zayafka') {
        if (!item.delivery_request_id) {
          throw new Error('Zayavka raqami yo‘q');
        }
        return posNotificationService.rejectZayafka({
          delivery_request_id: item.delivery_request_id,
          comment,
        });
      }
      return posNotificationService.rejectFlightNotification({
        client_code: item.client_code,
        flight_name: item.flight_name,
        comment,
      });
    },
    onMutate: ({ item }) => setBusyId(item.id),
    onSuccess: () => {
      toast.success('Rad etildi');
      setRejecting(null);
      invalidateReceipts();
      // A rejection can reverse an already-posted event, so the same three
      // views can be holding a figure that no longer exists.
      invalidateLedger();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Rad etib bo‘lmadi'),
    onSettled: () => setBusyId(null),
  });

  /**
   * Correct a payment that has already been posted.
   *
   * The refusal code is kept in state rather than only toasted: CARGO_ALREADY_TAKEN
   * is not a failure but a question — the server will accept the edit with
   * `force` once a reason is given — and the modal needs to know to ask it.
   */
  const edit = useMutation({
    mutationFn: async ({
      item,
      submission,
    }: {
      item: PosNotificationItem;
      submission: EditPaymentSubmission;
    }) =>
      editPayment({
        client_code: item.client_code,
        flight_name: item.flight_name,
        notification_id: item.id,
        ...submission,
      }),
    onMutate: () => setEditError({ code: null, message: null }),
    onSuccess: () => {
      toast.success('To‘lov o‘zgartirildi');
      setEditing(null);
      setEditError({ code: null, message: null });
      invalidateReceipts();
      queryClient.invalidateQueries({
        queryKey: ['cashier-log'],
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['cashier', 'series'],
        refetchType: 'active',
      });
      // The correction moves the client's debt, and the left column reads it
      // from a separate query the payment path already invalidates.
      queryClient.invalidateQueries({
        queryKey: ['pos-unpaid'],
        refetchType: 'active',
      });
      void refreshClient();
    },
    onError: (err: unknown) => {
      const { code, message } = describeApiFailure(err);
      setEditError({ code, message });
      // Never let a refusal be silent. Without this a shape the narrowing does
      // not recognise leaves both fields null, the modal's banner renders
      // nothing, and the Save button reads as a dead control.
      toast.error(message);
      // A stale amount means someone else already corrected this — pull the
      // fresh figure in so the reopened modal is not offering the old one.
      if (code === 'STALE_AMOUNT') invalidateReceipts();
    },
  });

  /**
   * Resolve a ledger row back to the receipt it came from, then edit it.
   *
   * The edit endpoint keys on `notification_id`; a cashier-log row carries only
   * a transaction id, so the receipt has to be found by client and flight. Done
   * `strict`, because a `LIKE` match would happily return a different flight
   * whose name merely contains this one.
   *
   * More than one match is refused rather than guessed. Picking the newest
   * would silently correct the wrong payment, and the cashier can always open
   * the exact receipt from the queue on the right.
   */
  const resolveAndEdit = useCallback(
    async (row: CashierLogItem) => {
      if (!row.client_code || !row.flight) return;
      setResolvingRowId(row.id);
      try {
        const response = await posNotificationService.getNotifications(1, 5, {
          client_code: row.client_code,
          flight: row.flight,
          strict: true,
        });
        const settled = response.items.filter(
          (item) => item.payment_status === 'paid',
        );

        if (settled.length === 1) {
          setEditError({ code: null, message: null });
          setEditing(settled[0]);
        } else if (settled.length === 0) {
          toast.info('Bu yozuvga mos chek topilmadi — cheklar ustunidan qidiring');
        } else {
          toast.info(
            `${settled.length} ta chek mos keldi — qaysi birini tahrirlashni cheklar ustunidan tanlang`,
          );
        }
      } catch (err) {
        toast.error(describeApiFailure(err, 'Chekni topib bo‘lmadi').message);
      } finally {
        setResolvingRowId(null);
      }
    },
    [],
  );

  /**
   * Open the receipt image the client sent.
   *
   * The key is asked for on demand rather than embedded in the list: these are
   * short-lived signed URLs, and one minted when the queue was fetched would
   * already be dead by the time a busy cashier reached the row.
   */
  const openReceipt = useCallback((item: PosNotificationItem) => {
    if (!item.receipt_s3_key) {
      toast.info('Bu to‘lovga chek biriktirilmagan');
      return;
    }
    // A dialog, not a new tab: the queue stays on screen behind it, which is
    // what the cashier is deciding against.
    setViewingReceipt(item);
  }, []);

  const series = useQuery({
    queryKey: ['cashier', 'series', range.from, range.to],
    queryFn: () =>
      getCashierLogSeries({
        date_from: range.from,
        date_to: range.to,
        granularity: 'auto',
      }),
    enabled: access.read,
    staleTime: 30_000,
  });

  /**
   * `setPage(1)` was a no-op: page is already 1 and nothing on this screen
   * changes it, so React bailed out — no re-render, no refetch, and the button
   * did nothing while a receipt sat unconfirmed.
   */
  const handleReceiptRefresh = useCallback(() => {
    void refetchReceipts();
    invalidateReceipts();
  }, [refetchReceipts, invalidateReceipts]);

  const handlePeriod = useCallback((key: PeriodKey, next: PeriodRange) => {
    setPeriodKey(key);
    setRange(next);
  }, []);

  const handleClientFound = useCallback(
    (found: ClientSearchResult) => {
      // A new client must start from an empty basket: carrying a selection
      // across would let the previous client's cargo be paid under this one's
      // code, which is a ledger error the cashier cannot see from the totals.
      resetSelection();
      setClient(found);
    },
    [resetSelection],
  );

  const handleClientCleared = useCallback(() => {
    resetSelection();
    setClient(null);
  }, [resetSelection]);

  /**
   * Escape clears the client and puts the caret back in the search.
   *
   * The counter's rhythm is one client after another, and the alternative was
   * reaching for the mouse to hit the small clear button between every single
   * one.
   *
   * Gated on no dialog being open. Every dialog handles Escape itself and stops
   * React's propagation, but a native `window` listener still sees the event —
   * React attaches at the root container and the DOM event carries on up. So
   * the guard is explicit rather than inherited.
   */
  const anyDialogOpen =
    Boolean(viewingReceipt) ||
    Boolean(editing) ||
    Boolean(rejecting) ||
    Boolean(payment.confirmPayload) ||
    showProfile ||
    isScannerOpen;

  useEffect(() => {
    if (anyDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      handleClientCleared();
      setSearchFocusToken((token) => token + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyDialogOpen, handleClientCleared]);

  if (!canView) return <AccessDenied />;

  const today = formatTashkentDate(new Date(), undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  /**
   * The header's status light.
   *
   * Reads the query the screen actually depends on rather than being a
   * decorative green dot: if the takings cannot be reached, the cashier is
   * looking at stale numbers and should know it.
   */
  const isOffline = series.isError;

  /**
   * Sizes travel as CSS custom properties rather than as `width` / `height`.
   *
   * An inline `style` applies at every breakpoint; these must apply only from
   * `xl` up, where the dividers exist. Below that a fixed 372px receipt column
   * would sit stranded next to a stacked layout. The variable is read by an
   * `xl:`-prefixed utility, so the breakpoint still decides.
   */
  /*
    Collapsing the ledger is only worth doing if the space goes somewhere. The
    top row grows by exactly what the table vacated, so the client lookup and
    the payment form get it — otherwise collapsing would just make the page
    shorter, which is not what was asked for.
  */
  const effectiveTopHeight = historyOpen
    ? layout.topHeight
    : layout.topHeight + (HISTORY_MIN_HEIGHT - HISTORY_BAR_HEIGHT);

  const topRowStyle = {
    '--kassa-top-h': `${effectiveTopHeight}px`,
  } as React.CSSProperties;
  const lookupStyle = {
    '--kassa-lookup-w': `${layout.lookupWidth}px`,
  } as React.CSSProperties;
  const receiptsStyle = {
    '--kassa-receipts-w': `${layout.receiptsWidth}px`,
  } as React.CSSProperties;

  return (
    /*
      One screen on desktop: `h-dvh` plus `overflow-hidden`, and every panel
      below scrolls inside itself. Under `xl` this all falls back to ordinary
      page scrolling — a phone cannot usefully hold four scroll regions at once.

      Only spacing and type sizes were tightened to get here. The 44px targets
      on the money path (confirm, reject, save, the payment fields) are left
      alone: they are what a mis-tap costs, not what the layout costs.
    */
    <div className="flex min-h-dvh flex-col bg-mc-bg">
      {/*
        The page scrolls. It is NOT pinned to the viewport.
        
        Two earlier attempts fitted everything into `h-dvh`, and both ended the
        same way: something had to give, and what gave was whichever panel the
        cashier was actually reading. Panels now take the height they are given
        — the dividers set that — and the page grows past the fold when the sum
        does. Each panel still scrolls inside itself, so a long list never
        stretches the page on its own.
      */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-4 py-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-[19px] font-extrabold leading-tight tracking-tight text-mc-text">
              Kassir oynasi
            </h1>

            {/* The way back to the old console. Rendered only when the host
                passed a navigator — the page is also opened standalone. */}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('pos-dashboard')}
                title="Eski POS oynasiga qaytish"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-mc-sm border border-mc-border px-2.5 text-[11px] font-bold text-mc-text-2 transition-transform active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                <span className="hidden sm:inline">Eski versiya</span>
                <span className="sm:hidden">Eski</span>
              </button>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className="hidden h-9 items-center gap-1.5 rounded-mc-sm bg-mc-surface-2 px-3 text-[12px] font-semibold text-mc-text-2 lg:inline-flex"
              title={today}
            >
              <CalendarDays
                className="h-3.5 w-3.5"
                strokeWidth={2}
                aria-hidden="true"
              />
              {today}
            </span>

            <span
              role="status"
              className={`hidden h-9 items-center gap-1.5 rounded-mc-sm px-3 text-[12px] font-bold md:inline-flex ${
                isOffline
                  ? 'bg-mc-danger-soft text-mc-danger'
                  : 'bg-mc-success/12 text-mc-success'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOffline ? 'bg-mc-danger' : 'bg-mc-success'
                }`}
                aria-hidden="true"
              />
              {isOffline ? 'Aloqa yo‘q' : 'Tizim faol'}
            </span>

            <ThemeChoice />

            {/* Always mounted, disabled when there is nothing to reset. Hiding
                it until the layout was already dragged meant the way back only
                appeared after you were lost. */}
            <button
              type="button"
              onClick={resetLayout}
              disabled={isDefaultLayout(layout)}
              aria-label="Panel o‘lchamlarini tiklash"
              title={
                isDefaultLayout(layout)
                  ? 'Panellar standart o‘lchamda'
                  : 'Panel o‘lchamlarini tiklash'
              }
              className="hidden h-9 items-center gap-1.5 rounded-mc-sm border border-mc-border px-2.5 text-[12px] font-bold text-mc-text-2 transition-transform active:scale-95 disabled:opacity-40 enabled:border-mc-brand/40 enabled:text-mc-brand xl:inline-flex"
            >
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              Standart o‘lcham
            </button>

            <button
              type="button"
              onClick={() => {
                setScannerOrderId(null);
                setIsScannerOpen(true);
              }}
              aria-label="Chekni skanerlash"
              title="Chekni skanerlash"
              className="flex h-9 w-9 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
            >
              <ScanLine className="h-4 w-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() =>
                receiptColumnRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
              aria-label={`Tasdiq kutayotgan cheklar: ${pendingTotal} ta`}
              className="relative flex h-9 w-9 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
            >
              <Bell className="h-4 w-4" strokeWidth={2} />
              {pendingTotal > 0 && (
                /* Tucked inside the button's own box on a phone: hung outside
                   it, the badge put 4px of layout overflow on the last control
                   of an already-tight header row. Unchanged from `sm` up. */
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-mc-brand px-1 text-[9px] font-extrabold tabular-nums text-mc-on-brand sm:-right-1 sm:-top-1">
                  {pendingTotal > 99 ? '99+' : pendingTotal}
                </span>
              )}
            </button>

            <RoleSwitcher />

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                aria-label="Chiqish"
                title="Chiqish"
                className="flex h-9 w-9 items-center justify-center rounded-mc-sm border border-mc-border text-mc-text-2 transition-transform active:scale-95"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </header>

        {/*
          Gated on pos:read, not merely rendered with a disabled query. A
          disabled TanStack query reports neither loading nor error, so
          ProviderCards would fall through to `totals[key] ?? 0` and print six
          cards reading "0 so'm" under "Tasdiqlangan summalar" — a figure an
          adjust-only admin would have no reason to disbelieve.
        */}
        {access.read && (
        <section className="shrink-0 space-y-2.5 rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
          {/* Title, window and control on one line — three stacked rows of
              chrome above six cards was most of what pushed the grid off the
              first screen. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <h2 className="text-[15px] font-extrabold tracking-tight text-mc-text">
                {periodKey === 'today'
                  ? 'Bugun tasdiqlangan summalar'
                  : 'Tasdiqlangan summalar'}
              </h2>
              <span className="text-[11px] font-medium text-mc-text-2">
                {describeRange(range.from, range.to)}
                {series.data
                  ? ` · ${series.data.granularity === 'hour' ? 'soatlik' : 'kunlik'}`
                  : ''}
              </span>
            </span>

            <PeriodPicker activeKey={periodKey} range={range} onChange={handlePeriod} />
          </div>

          <ProviderCards
            series={series.data}
            isLoading={series.isLoading}
            isError={series.isError}
            onRetry={() => void series.refetch()}
            activeProvider={historyProvider === 'all' ? null : historyProvider}
            onSelectProvider={(next) =>
              setHistoryProvider((next as CashierLogProvider) ?? 'all')
            }
          />
        </section>
        )}

        {/*
          The mockup's three areas, nested so each divider changes exactly one
          thing: the outer split sizes the receipt column, the left split sizes
          the lookup+payment row against the history, and the inner split sizes
          the lookup against the payment form.

          Explicit pixel sizes only from `xl` up, where the dividers exist. Below
          that the widths would fight the stacked layout, so they are dropped and
          the page scrolls normally.
        */}
        <div
          ref={outerRowRef}
          className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0"
        >
          <div
            ref={leftColumnRef}
            className="flex min-w-0 flex-col gap-3 xl:flex-1 xl:gap-0"
          >
            <div
              ref={topRowRef}
              className="flex flex-col gap-3 xl:h-[var(--kassa-top-h)] xl:min-h-0 xl:shrink-0 xl:flex-row xl:gap-0"
              style={topRowStyle}
            >
              <div
                className="min-h-0 xl:w-[var(--kassa-lookup-w)] xl:min-w-0 xl:shrink-0"
                style={lookupStyle}
              >
            <ClientLookup
              client={client}
              onFound={handleClientFound}
              onCleared={handleClientCleared}
              onOpenProfile={() => setShowProfile(true)}
              focusToken={searchFocusToken}
            />
              </div>

              <SplitHandle
                orientation="vertical"
                label="Mijoz qidiruvi kengligi"
                onDelta={(delta) => resizePanel('lookupWidth', delta)}
                onReset={() => resetPanel('lookupWidth')}
              />

              <section className="flex min-h-0 flex-col rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)] xl:min-w-0 xl:flex-1">
            <h2 className="shrink-0 text-[15px] font-extrabold tracking-tight text-mc-text">
              To‘lov ma’lumotlari
            </h2>

            {!client ? (
              <p className="mt-3 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-10 text-center text-[12px] font-medium text-mc-text-3">
                Avval mijozni toping
              </p>
            ) : !access.process ? (
              <p className="mt-3 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-10 text-center text-[12px] font-medium text-mc-text-3">
                Sizda to‘lov qabul qilish huquqi yo‘q
              </p>
            ) : (
              // `px-px`: the inputs are `w-full`, so their borders sat exactly
              // on the scroll box's edge and were shaved off — by the clip on
              // one side and by the scrollbar on the other.
              <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-px">
                <PaymentForm
                  groups={payment.flightGroups}
                  selectedIds={payment.selectedIds}
                  totalCargoCount={payment.cargos.length}
                  cargoLoading={payment.cargoQuery.isLoading}
                  cargoError={payment.cargoQuery.isError}
                  onRetryCargo={() => void payment.cargoQuery.refetch()}
                  onSelectFlight={payment.selectFlight}
                  paymentType={payment.paymentType}
                  onPaymentType={payment.setPaymentType}
                  cards={payment.selectableCards}
                  cardsLoading={payment.cardsQuery.isLoading}
                  cardsError={payment.cardsQuery.isError}
                  onRetryCards={() => void payment.cardsQuery.refetch()}
                  selectedCardId={payment.selectedCardId}
                  onSelectCard={payment.setSelectedCardId}
                  useWallet={payment.useWallet}
                  onToggleWallet={payment.toggleWallet}
                  walletBalance={payment.displayBalance}
                  walletDeduction={payment.walletDeduction}
                  totalOwed={payment.totalOwed}
                  netAfterWallet={payment.netAfterWallet}
                  receivedInput={payment.receivedInput}
                  onReceivedInput={payment.setReceivedInput}
                  receivedAmount={payment.receivedAmount}
                  change={payment.change}
                  shortfall={payment.shortfall}
                  note={payment.note}
                  onNote={payment.setNote}
                  selectedCount={payment.selectedCargos.length}
                  selectedWeight={payment.totalSelectedWeight}
                  isPaying={payment.isPaying}
                  onSubmit={payment.openConfirm}
                  onOpenProfile={() => setShowProfile(true)}
                />
              </div>
            )}
              </section>
            </div>

            {historyOpen && (
              <SplitHandle
                orientation="horizontal"
                label="Yuqori panellar balandligi"
                onDelta={(delta) => resizePanel('topHeight', delta)}
                onReset={() => resetPanel('topHeight')}
              />
            )}

            {access.read && (
              <div className={historyOpen ? 'min-h-[380px] xl:flex-1' : 'mt-3 xl:mt-2'}>
                <PaymentHistory
                  range={range}
                  provider={historyProvider}
                  onProviderChange={setHistoryProvider}
                  canEdit={access.process}
                  resolvingRowId={resolvingRowId}
                  onEditRow={(row) => void resolveAndEdit(row)}
                  isOpen={historyOpen}
                  onToggleOpen={toggleHistory}
                />
              </div>
            )}
          </div>

          <SplitHandle
            orientation="vertical"
            label="Cheklar ustuni kengligi"
            onDelta={(delta) => resizePanel('receiptsWidth', -delta)}
            onReset={() => resetPanel('receiptsWidth')}
          />

          <div
            ref={receiptColumnRef}
            className="min-h-[420px] xl:w-[var(--kassa-receipts-w)] xl:shrink-0"
            style={receiptsStyle}
          >
            <ReceiptQueue
              items={notifications}
              total={receiptTotal}
              page={receiptPage}
              perPage={receiptPerPage}
              onPage={setReceiptPage}
              onPerPage={handlePerPage}
              activeTab={receiptTab}
              onTabChange={handleReceiptTab}
              filters={receiptFilters}
              defaultFilters={receiptDefaultFilters}
              onFilters={handleReceiptFilters}
              onResetFilters={handleReceiptFiltersReset}
              counts={receiptCounts.data ?? { flight: 0, zayafka: 0 }}
              isLoading={receiptsLoading}
              isError={receiptsError}
              isRefetching={receiptsRefetching}
              onRefresh={handleReceiptRefresh}
              onConfirm={(item) => confirm.mutate(item)}
              onReject={(item) => setRejecting(item)}
              onEdit={(item) => {
                setEditError({ code: null, message: null });
                setEditing(item);
              }}
              onOpen={(item) => openReceipt(item)}
              canEdit={access.process}
              busyId={busyId}
            />
          </div>

        </div>
      </div>

      {payment.confirmPayload && (
        <ConfirmModal
          payload={payment.confirmPayload}
          onConfirm={payment.submitConfirmed}
          onCancel={payment.cancelConfirm}
          isPending={payment.isPaying}
        />
      )}

      {showProfile && client && (
        <ClientProfileDrawer
          clientCode={client.client_code}
          clientName={client.full_name}
          currentBalance={payment.displayBalance}
          onClose={() => setShowProfile(false)}
          onBalanceUpdate={payment.setLiveBalance}
          onRefreshClient={() => {
            // Re-read the client, not only the cargo: an adjustment moves the
            // balance the row and the wallet toggle both display.
            void refreshClient();
            void payment.cargoQuery.refetch();
          }}
          canAdjust={access.adjust}
          canUpdateStatus={access.updateStatus}
        />
      )}

      {viewingReceipt && (
        <ReceiptImageModal
          item={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {editing && (
        <EditPaymentModal
          item={editing}
          isPending={edit.isPending}
          errorCode={editError.code}
          errorMessage={editError.message}
          onSubmit={(submission) => edit.mutate({ item: editing, submission })}
          onClose={() => {
            setEditing(null);
            setEditError({ code: null, message: null });
          }}
        />
      )}

      <ReceiptScannerModal
        open={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerOrderId(null);
        }}
        initialOrderId={scannerOrderId}
        onOpenInPos={(code) => void loadClientByCode(code)}
      />

      {rejecting && (
        <RejectConfirmModal
          isOpen
          clientCode={rejecting.client_code}
          flightName={rejecting.flight_name}
          isPending={reject.isPending}
          showComment
          onCancel={() => setRejecting(null)}
          onConfirm={(comment) => reject.mutate({ item: rejecting, comment })}
        />
      )}
    </div>
  );
}
