import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CloudOff, Loader2, Pencil, RefreshCw } from "lucide-react";

import {
  scanTrackCode,
  type Astatka,
  type AstatkaScanResult,
  type AstatkaStatus,
} from "@/api/services/astatka";
import { astatkaStore, type QueuedItem } from "@/utils/astatkaStore";
import { startAstatkaSync, type SyncOutcome } from "@/utils/astatkaSync";
import { triggerSoftHaptic, triggerSuccessHaptic } from "@/utils/haptics";

/**
 * The scanning screen.
 *
 * One column, one job. A worker holds a phone in one hand and a parcel in the
 * other, several hundred times a shift, so the design is shaped by what that
 * costs: the scan field never loses focus, a clean scan needs no tap at all,
 * and the answer is legible at arm's length by colour alone.
 *
 * The mockup this replaces was a three-column desktop layout with four KPI
 * cards above the scan field, two tables showing the same rows, a photo panel
 * per scan, and three buttons after every scan. On a 390px phone the worker's
 * primary control would have been below the fold, and three taps times five
 * hundred boxes is a different job.
 */

interface Props {
  astatka: Astatka;
  onBack: () => void;
  onEditItem: (item: QueuedItem) => void;
  onManualEntry: (seed: Partial<QueuedItem> & { trackCode: string }) => void;
}

/** Colour and words per outcome. Colour carries it; the words confirm it. */
const STATUS_STYLE: Record<
  AstatkaStatus,
  { label: string; card: string; dot: string }
> = {
  matched: {
    label: "Mos keldi",
    card: "border-mc-success/40 bg-mc-success-soft",
    dot: "bg-mc-success",
  },
  needs_data: {
    label: "Og'irlik kiritilsin",
    card: "border-mc-warn/40 bg-mc-warn-soft",
    dot: "bg-mc-warn",
  },
  foreign_flight: {
    label: "Boshqa reys",
    card: "border-mc-warn/40 bg-mc-warn-soft",
    dot: "bg-mc-warn",
  },
  unknown: {
    label: "Topilmadi",
    card: "border-mc-danger/40 bg-mc-danger-soft",
    dot: "bg-mc-danger",
  },
};

function newKey(): string {
  // The idempotency key. crypto.randomUUID is present in every browser this app
  // supports; the fallback exists so a locked-down WebView cannot make the
  // scanner unusable — a slightly weaker id still keeps retries safe.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function AstatkaScanner({
  astatka,
  onBack,
  onEditItem,
  onManualEntry,
}: Props) {
  const [code, setCode] = useState("");
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [last, setLast] = useState<QueuedItem | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [storageBroken, setStorageBroken] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await astatkaStore.listForAstatka(astatka.id);
      setItems(rows);
      setPendingCount(rows.filter((row) => row.status !== "saved").length);
    } catch {
      setStorageBroken(true);
    }
  }, [astatka.id]);

  useEffect(() => {
    // Anything left `saving` means a tab died mid-request. Re-sending is free —
    // the idempotency key makes a duplicate impossible — and leaving them would
    // strand the parcels forever.
    void astatkaStore
      .recoverStuck(astatka.id)
      .catch(() => setStorageBroken(true))
      .finally(refresh);
  }, [astatka.id, refresh]);

  useEffect(() => {
    const stop = startAstatkaSync(astatka.id, (outcome: SyncOutcome) => {
      setPendingCount((current) => (outcome.drained ? 0 : current));
      void refresh();
    });
    return stop;
  }, [astatka.id, refresh]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /**
   * Put the caret back in the scan field and keep it there.
   *
   * A hardware scanner types like a keyboard, so a field that has lost focus
   * silently swallows the next parcel. Re-focusing after every scan is what
   * makes the loop hands-free.
   */
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(focusInput, [focusInput]);

  const record = useCallback(
    async (resolution: AstatkaScanResult) => {
      const item: QueuedItem = {
        id: newKey(),
        astatkaId: astatka.id,
        status: "pending",
        trackCode: resolution.track_code,
        clientCode: resolution.client_code,
        sourceFlightName: resolution.source_flight_name,
        weightKg: resolution.weight_kg,
        pricePerKg: resolution.price_per_kg,
        comment: resolution.comment,
        scanStatus: resolution.status,
        sourceFlightCargoId: resolution.source_flight_cargo_id,
        photos: resolution.photos,
        localPhotoIds: [],
        enteredManually: false,
        scannedAt: Date.now(),
        attempts: 0,
        lastError: null,
      };

      // Disk first, network second. If the phone dies now the parcel is still
      // counted; the sync worker will find it.
      await astatkaStore.enqueue(item);
      setLast(item);
      await refresh();

      if (resolution.needs_manual_entry) {
        // The common case — flight_cargos covers 18 flights against the
        // manifest's 129 — so the weight is asked for straight away rather than
        // left for a second pass over the same shelf.
        onManualEntry({ ...item, trackCode: resolution.track_code });
      }
    },
    [astatka.id, onManualEntry, refresh],
  );

  const submit = useCallback(
    async (raw: string) => {
      const trackCode = raw.trim();
      if (!trackCode || isResolving) return;

      setCode("");
      focusInput();

      const alreadyHere = items.find(
        (item) =>
          (item.trackCode ?? "").toUpperCase() === trackCode.toUpperCase(),
      );
      if (alreadyHere) {
        // Re-scanning a shelf is normal. Show it, do not count it twice.
        setLast(alreadyHere);
        triggerSoftHaptic();
        return;
      }

      setIsResolving(true);
      try {
        const resolution = await scanTrackCode(astatka.id, trackCode);
        await record(resolution);
        if (resolution.status === "matched") triggerSuccessHaptic();
        else triggerSoftHaptic();
      } catch {
        // Offline, or the server is unreachable. The local index knows who the
        // parcel belongs to; it cannot know the weight, so this lands on
        // needs_data and the worker types it. The parcel is never lost.
        const offline = await astatkaStore
          .resolveOffline(trackCode)
          .catch(() => null);
        await record({
          status: offline ? "needs_data" : "unknown",
          track_code: trackCode,
          client_code: offline?.clientCode ?? null,
          source_flight_name: offline?.flightName ?? null,
          weight_kg: null,
          price_per_kg: null,
          comment: null,
          source_flight_cargo_id: null,
          photos: [],
          duplicate: false,
          needs_manual_entry: true,
        });
        triggerSoftHaptic();
      } finally {
        setIsResolving(false);
        focusInput();
      }
    },
    [astatka.id, focusInput, isResolving, items, record],
  );

  const counts = useMemo(() => {
    const tally: Partial<Record<AstatkaStatus, number>> = {};
    for (const item of items) {
      tally[item.scanStatus] = (tally[item.scanStatus] ?? 0) + 1;
    }
    return tally;
  }, [items]);

  const lastStyle = last ? STATUS_STYLE[last.scanStatus] : null;

  return (
    <div className="flex min-h-dvh flex-col bg-mc-bg">
      {/* Sticky, because the scan field is the whole screen's purpose and must
          never scroll away from the thumb. */}
      <header className="sticky top-0 z-20 border-b border-mc-border bg-mc-surface px-3 pt-[env(safe-area-inset-top)] pb-2">
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Orqaga"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-extrabold text-mc-text">
              {astatka.name}
            </h1>
            <p className="truncate text-[11px] font-medium text-mc-text-3">
              {items.length} ta · {counts.matched ?? 0} mos ·{" "}
              {(counts.needs_data ?? 0) + (counts.unknown ?? 0)} to‘ldirilsin
            </p>
          </div>
          {/* What actually matters on a phone: is anything unsent. Not which
              USB scanner is plugged in — there isn't one. */}
          {(pendingCount > 0 || !isOnline) && (
            <span
              className={`flex shrink-0 items-center gap-1 rounded-mc-sm px-2 py-1 text-[11px] font-bold ${
                isOnline
                  ? "bg-mc-warn-soft text-mc-warn"
                  : "bg-mc-danger-soft text-mc-danger"
              }`}
            >
              <CloudOff className="h-3.5 w-3.5" strokeWidth={2.4} />
              {pendingCount}
            </span>
          )}
        </div>

        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(code);
          }}
        >
          <input
            ref={inputRef}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onBlur={focusInput}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Trek kodni skanerlang"
            aria-label="Trek kod"
            className="h-12 w-full rounded-mc-md border-2 border-mc-brand bg-mc-surface-2 px-3 text-[16px] font-bold text-mc-text placeholder:font-medium placeholder:text-mc-text-3 focus:outline-none"
          />
        </form>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {storageBroken && (
          <div className="mt-3 rounded-mc-md border border-mc-danger/30 bg-mc-danger-soft p-3">
            <p className="text-[12px] font-bold text-mc-danger">
              Oflayn saqlash ishlamayapti
            </p>
            <p className="mt-1 text-[11px] font-medium text-mc-text-2">
              Skanerlash ishlaydi, lekin sahifa yopilsa saqlanmagan yuklar
              yo‘qoladi. Internetni tekshiring va sahifani yangilang.
            </p>
          </div>
        )}

        {last && lastStyle && (
          <section
            className={`mt-3 rounded-mc-lg border p-3 ${lastStyle.card}`}
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${lastStyle.dot}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-extrabold text-mc-text">
                  {last.trackCode}
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-mc-text-2">
                  {lastStyle.label}
                </p>
                <p className="mt-1 truncate text-[12px] font-medium text-mc-text-2">
                  {last.clientCode ?? "Mijoz noma’lum"}
                  {last.sourceFlightName ? ` · ${last.sourceFlightName}` : ""}
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-mc-text">
                  {last.weightKg ? `${last.weightKg} kg` : "og‘irlik yo‘q"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditItem(last)}
                className="flex h-11 shrink-0 items-center gap-1 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[12px] font-bold text-mc-text"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                Tahrir
              </button>
            </div>
          </section>
        )}

        {isResolving && (
          <div className="mt-3 flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-mc-text-3">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
            Qidirilmoqda…
          </div>
        )}

        {items.length === 0 && !isResolving && (
          <div className="mt-10 text-center">
            <RefreshCw
              className="mx-auto h-8 w-8 text-mc-text-3"
              strokeWidth={1.8}
            />
            <p className="mt-3 text-[13px] font-bold text-mc-text-2">
              Hali hech narsa skanerlanmadi
            </p>
            <p className="mt-1 text-[12px] font-medium text-mc-text-3">
              Trek kodni skanerlang — yuk avtomatik qo‘shiladi
            </p>
          </div>
        )}

        <ul className="mt-3 space-y-1.5">
          {items.map((item) => {
            const style = STATUS_STYLE[item.scanStatus];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="flex w-full items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface p-2.5 text-left active:scale-[0.99]"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-mc-text">
                      {item.trackCode ?? "—"}
                    </span>
                    <span className="block truncate text-[11px] font-medium text-mc-text-3">
                      {item.clientCode ?? "noma’lum"}
                      {item.sourceFlightName
                        ? ` · ${item.sourceFlightName}`
                        : ""}
                    </span>
                  </span>
                  {/* Numbers are never truncated: a clipped weight reads as a
                      different, wrong weight. */}
                  <span className="shrink-0 text-[13px] font-extrabold text-mc-text">
                    {item.weightKg ? `${item.weightKg} kg` : "—"}
                  </span>
                  {item.status !== "saved" && (
                    <CloudOff
                      className="h-3.5 w-3.5 shrink-0 text-mc-warn"
                      strokeWidth={2.4}
                      aria-label="Yuborilmagan"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
