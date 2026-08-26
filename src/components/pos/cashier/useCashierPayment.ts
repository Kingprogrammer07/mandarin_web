/**
 * The money engine behind the cashier screen.
 *
 * Everything here — the waterfall split, the wallet netting, the idempotency
 * key, the in-flight guard — is carried over from the console that has been
 * taking real payments at the counter. It is deliberately a transplant, not a
 * rewrite: the guards below exist because of specific ledger damage, and each
 * one keeps the comment that records what it cost to learn.
 *
 * The old console is untouched. It stays the working till until this screen
 * replaces it, so this file duplicates rather than refactors — a shared
 * abstraction extracted now would change the code the counter runs today.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  getPaymentCards,
  processBulkPayment,
  type CardWithBalance,
  type PaymentProvider,
} from '@/api/pos';
import {
  getUnpaidCargo,
  type ClientSearchResult,
  type UnpaidCargoItem,
} from '@/api/verification';
import type { ConfirmPayload } from '@/pages/pos/components/ConfirmModal';
import { waterfallDistribute } from '@/pages/pos/components/utils';
import { formatCurrencySum } from '@/lib/format';

import { computePaymentTotals } from './paymentTotals';

/**
 * Sentinel the flight dropdown uses for "every unpaid flight at once".
 *
 * Declared here rather than imported from the form so the hook does not depend
 * on the component that renders it.
 */
export const ALL_FLIGHTS_VALUE = '__all__';

/** A flight and the cargo rows the client still owes on it. */
export interface FlightGroup {
  flightName: string;
  items: UnpaidCargoItem[];
  totalWeight: number;
  totalAmount: number;
}

interface PosApiError {
  status?: number;
  data?: {
    detail?:
      | { error?: string; failed_cargo_id?: number; display_number?: number }
      | string;
  };
  message?: string;
}

export function useCashierPayment(
  client: ClientSearchResult | null,
  /**
   * Whether this admin may take payments (`pos:process`).
   *
   * Gates the two queries, not just the button: an adjust-only role that can
   * open a client but not charge them would otherwise fire an unpaid-cargo
   * request the API answers with 403 on every search.
   */
  canProcess: boolean,
  /**
   * Called after a payment posts, so the caller can re-read the client.
   *
   * `client.client_balance` is a snapshot taken by the search call; it is plain
   * props, not a react-query result, so no invalidation can refresh it. Without
   * this the wallet figure on screen is the balance from BEFORE the payment.
   */
  onClientStale?: () => void,
) {
  const queryClient = useQueryClient();
  const clientCode = client?.client_code ?? null;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [paymentType, setPaymentType] = useState<PaymentProvider>('cash');
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(
    null,
  );

  /**
   * What the cashier typed, or null while the field is still following the
   * amount due.
   *
   * The old console kept this in an effect that wrote state on every change to
   * the selection. Holding an override instead makes the default a plain
   * derived value: the field follows the debt until the cashier takes it over,
   * and every action that changes what is owed hands it back. Same behaviour,
   * no effect, and no pair of refs tracking which of the two is in charge.
   */
  const [receivedOverride, setReceivedOverride] = useState<string | null>(null);

  /** Free text the cashier attaches to this payment (`cashier_note`). */
  const [note, setNote] = useState('');

  /** Balance after an adjustment, so the wallet figure is right without a refetch. */
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const displayBalance = liveBalance ?? client?.client_balance ?? 0;

  const cargoQuery = useQuery({
    queryKey: ['pos-unpaid', clientCode],
    queryFn: () =>
      getUnpaidCargo({
        clientCode: clientCode!,
        filterType: 'all',
        sortOrder: 'asc',
        limit: 100,
        offset: 0,
      }),
    enabled: canProcess && !!clientCode,
    staleTime: 30_000,
  });

  const cardsQuery = useQuery({
    queryKey: ['payment-cards'],
    queryFn: getPaymentCards,
    enabled: canProcess,
    staleTime: 2 * 60_000,
  });

  /**
   * Every card, active or not.
   *
   * `is_active` hides a card from clients in the Mini App. The cashier is
   * recording which card money actually landed on, which can be one that was
   * retired yesterday — filtering here would make that payment unrecordable.
   */
  const selectableCards = useMemo(
    () =>
      [...(cardsQuery.data ?? [])].sort(
        (a, b) => Number(b.is_active) - Number(a.is_active),
      ),
    [cardsQuery.data],
  );

  const selectedCard = useMemo(
    () => selectableCards.find((card) => card.id === selectedCardId) ?? null,
    [selectableCards, selectedCardId],
  );

  const cargos: UnpaidCargoItem[] = useMemo(
    () => cargoQuery.data?.items ?? [],
    [cargoQuery.data?.items],
  );

  const flightGroups: FlightGroup[] = useMemo(() => {
    const map = new Map<string, UnpaidCargoItem[]>();
    for (const cargo of cargos) {
      const bucket = map.get(cargo.flight_name);
      if (bucket) bucket.push(cargo);
      else map.set(cargo.flight_name, [cargo]);
    }
    return Array.from(map.entries()).map(([flightName, items]) => ({
      flightName,
      items,
      totalWeight: items.reduce((sum, c) => sum + (c.weight ?? 0), 0),
      totalAmount: items.reduce((sum, c) => sum + (c.total_payment ?? 0), 0),
    }));
  }, [cargos]);

  const { selectedCargos, totalOwed, totalSelectedWeight } = useMemo(() => {
    const selected = cargos.filter((c) => selectedIds.has(c.cargo_id));
    return {
      selectedCargos: selected,
      totalOwed: selected.reduce((sum, c) => sum + (c.total_payment ?? 0), 0),
      totalSelectedWeight: selected.reduce((sum, c) => sum + (c.weight ?? 0), 0),
    };
  }, [cargos, selectedIds]);

  const {
    walletDeduction,
    netAfterWallet,
    receivedInput,
    receivedAmount,
    change,
    shortfall,
  } = computePaymentTotals({
    totalOwed,
    walletBalance: displayBalance,
    useWallet,
    receivedOverride,
  });

  /**
   * Holds the idempotency key of the payment currently in flight.
   *
   * A ref, not state: it must be readable and writable within one tick. State
   * would not update until the next render, which is the very window rapid
   * clicks slip through.
   */
  const inFlightPaymentRef = useRef<string | null>(null);

  const resetSelection = useCallback(() => {
    setSelectedIds(new Set());
    setReceivedOverride(null);
    setUseWallet(false);
    setLiveBalance(null);
    setNote('');
    // A card chosen for the previous client would otherwise be sent with this
    // one's payment, booking it against a card that took no money.
    setSelectedCardId(null);
  }, []);

  const payMutation = useMutation({
    mutationFn: processBulkPayment,
    onSettled: () => {
      inFlightPaymentRef.current = null;
    },
    onSuccess: (result) => {
      toast.success(
        `${result.processed_count} ta yuk to‘lovi qabul qilindi · ${formatCurrencySum(result.total_paid)}`,
      );
      setSelectedIds(new Set());
      setReceivedOverride(null);
      setNote('');
      setConfirmPayload(null);
      // The wallet was just spent. Leaving the toggle on with the pre-payment
      // balance still on screen quotes the client's NEXT cargo as already
      // covered — 200,000 of wallet money deducted twice, the second time from
      // a wallet holding nothing.
      setUseWallet(false);
      setLiveBalance(null);
      onClientStale?.();

      // Only queries mounted on this screen. A blanket invalidation fans out
      // refetches for off-screen queries too, multiplying requests per payment.
      for (const key of [
        'pos-unpaid',
        'cashier-log',
        'cashier',
        'pos-txn',
        'client-info',
        'pos-notifications',
      ]) {
        queryClient.invalidateQueries({
          queryKey: [key],
          refetchType: 'active',
        });
      }
    },
    onError: (err: unknown) => {
      const apiErr = err as PosApiError;
      const detail = apiErr?.data?.detail;

      if (apiErr.status === 409) {
        const displayNumber =
          detail && typeof detail === 'object' ? detail.display_number : undefined;
        toast.error(
          displayNumber
            ? `Bu yuklar allaqachon navbatda (#${displayNumber})`
            : 'Bu yuklar allaqachon navbatda',
          { duration: 6000 },
        );
      } else if (detail && typeof detail === 'object' && detail.error) {
        toast.error(
          `Xatolik (yuk #${detail.failed_cargo_id ?? '?'}): ${detail.error}`,
          { duration: 6000 },
        );
      } else {
        toast.error(apiErr.message ?? 'To‘lovda xatolik yuz berdi');
      }
      setConfirmPayload(null);
    },
  });

  /**
   * Resolve the flight dropdown to a cargo selection.
   *
   * The dropdown is an action, not a filter: choosing a flight REPLACES the
   * selection with that flight's rows. Adding to it would mean a cashier who
   * picked the wrong flight and corrected it would silently charge for both.
   */
  const selectFlight = useCallback(
    (value: string) => {
      if (value === ALL_FLIGHTS_VALUE) {
        setSelectedIds(new Set(cargos.map((cargo) => cargo.cargo_id)));
      } else {
        const group = flightGroups.find((g) => g.flightName === value);
        setSelectedIds(
          group ? new Set(group.items.map((item) => item.cargo_id)) : new Set(),
        );
      }
      setReceivedOverride(null);
    },
    [cargos, flightGroups],
  );

  const toggleWallet = useCallback(() => {
    setUseWallet((prev) => !prev);
    setReceivedOverride(null);
  }, []);

  const openConfirm = useCallback(() => {
    if (!client || selectedCargos.length === 0 || payMutation.isPending) return;
    if (paymentType === 'card' && !selectedCardId) {
      toast.error('Karta tanlanmadi. Bitta kartani tanlang.');
      return;
    }
    setConfirmPayload({
      cargos: selectedCargos,
      amounts: waterfallDistribute(selectedCargos, receivedAmount),
      paymentType,
      useWallet,
      received: receivedAmount,
      walletDeduction,
      selectedCard: paymentType === 'card' ? selectedCard : null,
      clientCode: client.client_code,
      // Minted here, once per confirmation — not at submit time. Every retry of
      // this one payment (double-click, a react-query retry, a POST the browser
      // resent after a dropped connection) therefore carries the same key, and
      // the server answers the second one from its store instead of writing a
      // second ledger row. Closing and reopening the modal mints a new key,
      // which is correct: that is a new payment.
      idempotencyKey: crypto.randomUUID(),
    });
  }, [
    client,
    selectedCargos,
    payMutation.isPending,
    paymentType,
    selectedCardId,
    receivedAmount,
    useWallet,
    walletDeduction,
    selectedCard,
  ]);

  const submitConfirmed = useCallback(() => {
    if (!confirmPayload || !client) return;
    // Synchronous re-entry guard. `isPending` disables the button, but only
    // after React re-renders — four clicks in the same tick all pass the
    // disabled check and fire four requests. Measured, not theorised: four
    // clicks produced four POSTs of 786,401 so'm, the exact shape of the
    // 2026-07-15 ledger corruption. The server key already makes the extra
    // requests harmless; this stops them being sent at all.
    if (inFlightPaymentRef.current === confirmPayload.idempotencyKey) return;
    inFlightPaymentRef.current = confirmPayload.idempotencyKey;

    payMutation.mutate({
      items: confirmPayload.cargos.map((cargo, index) => ({
        cargo_id: cargo.cargo_id,
        flight: cargo.flight_name,
        client_code: client.client_code,
        paid_amount: Number((confirmPayload.amounts[index] ?? 0.01).toFixed(2)),
        payment_type: confirmPayload.paymentType,
        use_balance: confirmPayload.useWallet,
        card_id: confirmPayload.selectedCard?.id ?? null,
      })),
      cashier_note: note.trim() || null,
      // The warehouse pickup queue is not part of this screen, by the owner's
      // decision; the request shape still carries the fields.
      create_pickup_queue: undefined,
      pickup_method: null,
      pickup_priority: undefined,
      pickup_note: null,
      pickup_idempotency_key: null,
      idempotency_key: confirmPayload.idempotencyKey,
    });
  }, [confirmPayload, client, note, payMutation]);

  return {
    cargos,
    flightGroups,
    cargoQuery,
    selectedIds,
    selectedCargos,
    totalOwed,
    totalSelectedWeight,

    paymentType,
    setPaymentType,
    selectableCards,
    cardsQuery,
    selectedCardId,
    setSelectedCardId,
    selectedCard,

    useWallet,
    toggleWallet,
    displayBalance,
    setLiveBalance,
    walletDeduction,
    netAfterWallet,

    receivedInput,
    setReceivedInput: setReceivedOverride,
    receivedAmount,
    change,
    shortfall,

    selectFlight,
    resetSelection,

    note,
    setNote,

    confirmPayload,
    cancelConfirm: () => setConfirmPayload(null),
    openConfirm,
    submitConfirmed,
    isPaying: payMutation.isPending,
  };
}

export type CashierPayment = ReturnType<typeof useCashierPayment>;
export type { CardWithBalance, PaymentProvider };
