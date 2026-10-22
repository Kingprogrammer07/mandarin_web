import { useId, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  ChevronDown,
  Eraser,
  FileSpreadsheet,
  Loader2,
  Search,
  Square,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  astatkaCleanupQueryKey,
  cleanAstatkaFlights,
  downloadAstatkaCleanupExcel,
  downloadAstatkaInventoryReport,
  getAstatkaCleanupPreview,
  getAstatkaCleanupRuns,
  undoAstatkaCleanup,
  type CleanupApplyResult,
  type CleanupBag,
  type CleanupFlight,
  type CleanupRun,
  type CleanupSkipReason,
} from "@/api/services/astatkaCleanup";
import type { AstatkaFlightStats } from "@/api/services/astatkaFlights";
import { WorkspaceDialog } from "@/components/astatka/workspace/WorkspaceDialog";
import { formatDateTime, formatKg, paymentLabel } from "@/lib/astatkaFormat";
import { formatUzs, TASHKENT_TZ } from "@/lib/format";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiError";
import { downloadBlob, safeFileName } from "@/utils/downloadFile";

interface Props {
  flightName: string;
  /** The card's counts, to warn while bags still wait to be confirmed. */
  stats: AstatkaFlightStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SKIP_LABELS: Record<CleanupSkipReason, string> = {
  no_payment_row: "To'lov yozuvi yo'q",
  receipt_pending: "Kassada chek kutilmoqda",
  in_delivery: "Navbatda yoki yetkazish so'rovida",
};

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TASHKENT_TZ,
});

const sameName = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/** Old flights with something to clean; a recent one is offered but not ticked. */
const defaultChoice = (flights: CleanupFlight[]) =>
  new Set(flights.filter((f) => f.to_clean > 0 && !f.recent).map((f) => f.flight_name));

/**
 * "Reyslarni tozalash": the astatka's source flights, and their bags that are
 * neither taken away nor in any astatka. The sheet says in full what the
 * button changes and what it leaves, lists every bag it would touch, and acts
 * only after the astatka's name is typed again. Earlier runs can be exported
 * and undone from the same sheet.
 */
export function AstatkaCleanupDialog({ flightName, stats, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [typed, setTyped] = useState("");
  const [showBags, setShowBags] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<CleanupApplyResult | null>(null);

  const previewQuery = useQuery({
    queryKey: [...astatkaCleanupQueryKey(flightName), "preview"],
    queryFn: () => getAstatkaCleanupPreview(flightName),
    enabled: open,
    staleTime: 0,
  });
  const runsQuery = useQuery({
    queryKey: [...astatkaCleanupQueryKey(flightName), "runs"],
    queryFn: () => getAstatkaCleanupRuns(flightName),
    enabled: open,
  });

  const preview = previewQuery.data;
  const flights = useMemo(() => preview?.flights ?? [], [preview]);
  // Until the admin touches a box, the default choice follows the latest preview.
  const selected = useMemo(() => chosen ?? defaultChoice(flights), [chosen, flights]);
  const selectedBags = useMemo(
    () => (preview?.bags ?? []).filter((bag) => selected.has(bag.flight_name)),
    [preview, selected],
  );
  const selectedSkipped = useMemo(
    () => (preview?.skipped ?? []).filter((bag) => selected.has(bag.flight_name)),
    [preview, selected],
  );
  const unpaid = selectedBags.filter((bag) => bag.payment === "pending" || bag.payment === "partial");
  const unpaidAmount = unpaid.reduce((sum, bag) => sum + bag.debt, 0);
  const selectedRecent = flights.filter((f) => f.recent && selected.has(f.flight_name));

  const needle = search.trim().toUpperCase();
  const visibleBags = needle
    ? selectedBags.filter(
        (bag) =>
          bag.client_code.includes(needle) ||
          bag.flight_name.includes(needle) ||
          (bag.client_name ?? "").toUpperCase().includes(needle),
      )
    : selectedBags;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: astatkaCleanupQueryKey(flightName) });

  const clean = useMutation({
    mutationFn: () => cleanAstatkaFlights(flightName, [...selected], typed.trim()),
    onSuccess: (done) => {
      setResult(done);
      setTyped("");
      setChosen(null);
      void refresh();
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setChosen(null);
      setTyped("");
      setSearch("");
      setShowBags(false);
      setShowSkipped(false);
      setResult(null);
      clean.reset();
    }
    onOpenChange(next);
  }

  const toggleFlight = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setChosen(next);
  };

  const canClean = sameName(typed, flightName) && selectedBags.length > 0 && !clean.isPending;

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={(next) => {
        if (!clean.isPending) handleOpenChange(next);
      }}
      wide
      title="Reyslarni tozalash"
      description={flightName}
      footer={
        result ? (
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="h-12 w-full rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[14px] font-bold text-mc-text active:scale-[0.98]"
          >
            Yopish
          </button>
        ) : (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={clean.isPending}
              className="h-12 rounded-mc-md border border-mc-border bg-mc-surface px-4 text-[14px] font-bold text-mc-text active:scale-[0.98] disabled:opacity-50"
            >
              Bekor
            </button>
            <button
              type="button"
              onClick={() => clean.mutate()}
              disabled={!canClean}
              className="flex h-12 items-center justify-center gap-2 rounded-mc-md bg-mc-danger-fill px-3 text-[14px] font-extrabold text-mc-on-danger active:scale-[0.98] disabled:opacity-50"
            >
              {clean.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eraser className="h-4 w-4" />
              )}
              Tozalash ({selectedBags.length} ta yuk)
            </button>
          </div>
        )
      }
    >
      {result ? (
        <CleanupDone flightName={flightName} result={result} />
      ) : (
        <div className="space-y-4">
          <WhatItDoes />
          <InventoryReport flightName={flightName} />

          {stats && stats.expected > 0 && (
            <p className="flex gap-2 rounded-mc-sm bg-mc-warn-soft px-3 py-2 text-[12px] font-semibold text-mc-warn">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Astatkada hali {stats.expected} ta yuk tasdiqlanmagan. Avval skanerlash tugaganiga
              ishonch hosil qiling: tokchada turgan, lekin skanerlanmagan yuk ham «olib ketilgan»
              bo'lib qoladi.
            </p>
          )}

          {previewQuery.isLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-[72px] animate-pulse rounded-mc-md bg-mc-surface-2" />
              ))}
            </div>
          )}
          {previewQuery.isError && (
            <p role="alert" className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
              {apiErrorMessage(previewQuery.error, "Reyslarni tekshirib bo'lmadi.")}
            </p>
          )}

          {preview && (
            <>
              <section>
                <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                  1. Reyslarni tanlang
                </h3>
                <p className="mt-0.5 text-[12px] font-medium text-mc-text-3">
                  Bu astatkaga yuk tushgan reyslar. {preview.recent_days} kundan yangi reyslar
                  belgilanmagan: ular hali tarqatilayotgan bo'lishi mumkin.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {flights.map((flight) => (
                    <li key={flight.flight_name}>
                      <FlightRow
                        flight={flight}
                        active={selected.has(flight.flight_name)}
                        onToggle={() => toggleFlight(flight.flight_name)}
                      />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-mc-md border border-mc-border bg-mc-surface-2 p-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
                  2. Nima bo'ladi
                </h3>
                {selectedBags.length === 0 ? (
                  <p className="mt-1 text-[13px] font-semibold text-mc-text-2">
                    Tanlangan reyslarda tozalanadigan yuk yo'q.
                  </p>
                ) : (
                  <div className="mt-1 space-y-1 text-[13px] font-semibold text-mc-text">
                    <p>
                      <span className="font-extrabold tabular-nums">{selectedBags.length} ta yuk</span>{" "}
                      «olib ketilgan» deb belgilanadi ({selected.size} ta reys).
                    </p>
                    {unpaid.length > 0 && (
                      <p className="text-mc-text-2">
                        Ulardan {unpaid.length} tasi to'lanmagan:{" "}
                        <span className="font-extrabold tabular-nums text-mc-text">
                          {formatUzs(unpaidAmount)}
                        </span>{" "}
                        qarz kassada qarz bo'lib qoladi, o'chmaydi.
                      </p>
                    )}
                    {selectedSkipped.length > 0 && (
                      <p className="text-mc-text-2">
                        Yana {selectedSkipped.length} ta yukka tegilmaydi (sababi pastda).
                      </p>
                    )}
                    {selectedRecent.length > 0 && (
                      <p className="flex gap-1.5 text-mc-warn">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        Yangi reys tanlandi: {selectedRecent.map((f) => f.flight_name).join(", ")}.
                        Hali tarqatilayotgan bo'lsa, tozalamang.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {selectedBags.length > 0 && (
                <Disclosure
                  open={showBags}
                  onToggle={() => setShowBags((value) => !value)}
                  label={`Belgilanadigan yuklar ro'yxati (${selectedBags.length})`}
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-3" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Mijoz kodi, ismi yoki reys"
                      aria-label="Yuklar ichidan qidirish"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      className="h-11 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 pl-9 pr-3 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-brand"
                    />
                  </div>
                  <ul className="mt-2 divide-y divide-mc-border rounded-mc-md border border-mc-border">
                    {visibleBags.map((bag) => (
                      <BagRow key={`${bag.flight_name}|${bag.client_code}`} bag={bag} />
                    ))}
                    {visibleBags.length === 0 && (
                      <li className="px-3 py-4 text-center text-[13px] font-semibold text-mc-text-3">
                        Topilmadi
                      </li>
                    )}
                  </ul>
                </Disclosure>
              )}

              {selectedSkipped.length > 0 && (
                <Disclosure
                  open={showSkipped}
                  onToggle={() => setShowSkipped((value) => !value)}
                  label={`Tegilmaydigan yuklar (${selectedSkipped.length})`}
                >
                  <p className="text-[12px] font-medium text-mc-text-3">
                    Bular ham hech qayerda topilmadi, lekin ularni qo'lda tekshirish kerak.
                  </p>
                  <ul className="mt-2 divide-y divide-mc-border rounded-mc-md border border-mc-border">
                    {selectedSkipped.map((bag) => (
                      <BagRow key={`${bag.flight_name}|${bag.client_code}`} bag={bag} />
                    ))}
                  </ul>
                </Disclosure>
              )}

              {selectedBags.length > 0 && (
                <div>
                  <label htmlFor={inputId} className="block text-[12px] font-semibold text-mc-text-2">
                    3. Tasdiqlash uchun astatka nomini yozing:
                    <span className="mt-0.5 block break-words text-[13px] font-extrabold text-mc-text">
                      {flightName}
                    </span>
                  </label>
                  <input
                    id={inputId}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && canClean) clean.mutate();
                    }}
                    disabled={clean.isPending}
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="mt-1.5 h-12 w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[16px] font-semibold text-mc-text outline-none focus:border-mc-danger"
                  />
                </div>
              )}

              {clean.isError && (
                <p role="alert" className="rounded-mc-sm bg-mc-danger-soft px-3 py-2 text-[13px] font-semibold text-mc-danger">
                  {apiErrorMessage(clean.error, "Tozalab bo'lmadi.")}
                </p>
              )}
            </>
          )}

          <CleanupHistory
            flightName={flightName}
            runs={runsQuery.data ?? []}
            onUndone={() => void refresh()}
          />
        </div>
      )}
    </WorkspaceDialog>
  );
}

/** The sentence the owner asked for: what the button does, and what it does not. */
function WhatItDoes() {
  return (
    <section className="rounded-mc-md border border-mc-border bg-mc-surface p-3 text-[12px] font-medium leading-relaxed text-mc-text-2">
      <h3 className="text-[13px] font-extrabold text-mc-text">Bu tugma nima qiladi</h3>
      <p className="mt-1">
        Astatka to'liq skanerlangan bo'lsa, bu reyslarning har bir yuki yo «olib ketilgan» deb
        belgilangan, yo biror astatkada turibdi. Ikkalasida ham yo'q yuk ombordan isbotsiz
        chiqib ketgan. Tugma shunday yuklarni{" "}
        <span className="font-bold text-mc-text">«olib ketilgan» deb belgilaydi</span>, xolos.
      </p>
      <p className="mt-2 font-bold text-mc-text">O'zgarmaydi:</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
        <li>
          To'lov va qarz. To'lanmagan yuk kassada qarz bo'lib qoladi, uni kassa alohida hal
          qiladi.
        </li>
        <li>Foto hisobot, trek kodlar va astatkadagi yuklar.</li>
        <li>
          Mijozga xabar bormaydi, isbot rasmi qo'shilmaydi, olib ketilgan sanasi bo'sh qoladi:
          bugungi kunlik hisobotga tushmaydi.
        </li>
      </ul>
      <p className="mt-2">
        To'lov yozuvi yo'q, kassada chek kutayotgan yoki navbatda, yetkazish so'rovida turgan
        yuklarga tegilmaydi. Har bir tozalash saqlanadi: Excel'ini olish va «Bekor qilish»
        mumkin.
      </p>
    </section>
  );
}

function FlightRow({
  flight,
  active,
  onToggle,
}: {
  flight: CleanupFlight;
  active: boolean;
  onToggle: () => void;
}) {
  const empty = flight.to_clean === 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={empty}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-3 rounded-mc-md border p-3 text-left active:scale-[0.99] disabled:active:scale-100",
        // A soft outline, not a fill: most rows start ticked, and forty
        // orange cards would bury the red counts that matter.
        active ? "border-mc-brand/70 bg-mc-surface" : "border-mc-border bg-mc-surface-2",
        empty && "opacity-60",
      )}
    >
      {active ? (
        <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-mc-brand" />
      ) : (
        <Square className="mt-0.5 h-5 w-5 shrink-0 text-mc-text-3" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words text-[15px] font-extrabold text-mc-text">
            {flight.flight_name}
          </span>
          {flight.arrived_at && (
            <span className="text-[11px] font-semibold text-mc-text-3">
              {dayFormat.format(new Date(flight.arrived_at))} kelgan
            </span>
          )}
          {flight.recent && (
            <span className="rounded-full bg-mc-warn-soft px-2 py-0.5 text-[11px] font-bold text-mc-warn">
              Yangi reys
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-mc-text-2">
          {flight.bags} yuk · {flight.taken} olib ketilgan · {flight.on_shelf} astatkada
        </span>
        <span className="mt-0.5 block text-[12px] font-semibold tabular-nums">
          {empty ? (
            <span className="text-mc-text-3">Tozalanadigan yuk yo'q</span>
          ) : (
            <>
              <span className="font-extrabold text-mc-danger">
                {flight.to_clean} tasi hech qayerda yo'q
              </span>
              {flight.unpaid_bags > 0 && (
                <span className="text-mc-text-2">
                  {" "}
                  · {flight.unpaid_bags} tasi to'lanmagan, {formatUzs(flight.unpaid_amount)}
                </span>
              )}
            </>
          )}
          {flight.skipped > 0 && (
            <span className="text-mc-text-3"> · {flight.skipped} tasiga tegilmaydi</span>
          )}
        </span>
      </span>
    </button>
  );
}

function BagRow({ bag }: { bag: CleanupBag }) {
  const payment = paymentLabel(bag.payment);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2">
      <span className="min-w-0 break-all text-[13px] font-extrabold text-mc-text">
        {bag.client_code}
        <span className="ml-2 font-semibold text-mc-text-2">{bag.flight_name}</span>
      </span>
      <span className="text-right text-[13px] font-bold tabular-nums text-mc-text">
        {formatKg(bag.weight_kg)}
      </span>
      <span className="min-w-0 break-words text-[12px] font-medium text-mc-text-3">
        {bag.client_name ?? "—"}
      </span>
      <span
        className={cn(
          "text-right text-[12px] font-semibold tabular-nums",
          bag.reason ? "text-mc-warn" : bag.debt > 0 ? "text-mc-danger" : "text-mc-text-3",
        )}
      >
        {bag.reason
          ? SKIP_LABELS[bag.reason]
          : bag.debt > 0
            ? `${payment ?? ""} · ${formatUzs(bag.debt)}`
            : payment}
      </span>
    </li>
  );
}

function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left text-[13px] font-bold text-mc-text"
      >
        <span className="min-w-0">{label}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-mc-text-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </section>
  );
}

function CleanupDone({ flightName, result }: { flightName: string; result: CleanupApplyResult }) {
  const { run } = result;
  return (
    <div className="space-y-3">
      <div className="rounded-mc-md bg-mc-success/12 p-3">
        <p className="text-[15px] font-extrabold text-mc-success">
          {run.bags} ta yuk «olib ketilgan» deb belgilandi
        </p>
        <p className="mt-0.5 text-[12px] font-semibold text-mc-text-2">
          {run.transactions} ta to'lov yozuvi · {run.source_flights.length} ta reys
        </p>
      </div>
      {run.unpaid_bags > 0 && (
        <p className="text-[13px] font-semibold text-mc-text-2">
          {run.unpaid_bags} ta to'lanmagan yukning qarzi ({formatUzs(run.unpaid_amount)}) kassada
          qoldi. Excel faylini kassaga bering.
        </p>
      )}
      {result.changed_meanwhile > 0 && (
        <p className="text-[13px] font-semibold text-mc-warn">
          {result.changed_meanwhile} ta yuk shu orada o'zgargani uchun tegilmadi.
        </p>
      )}
      <ExcelButton flightName={flightName} run={run} />
      <p className="text-[12px] font-medium text-mc-text-3">
        Xato bo'lsa, «Reyslarni tozalash» oynasining pastidagi «Oldingi tozalashlar»dan bekor
        qilish mumkin.
      </p>
    </div>
  );
}

function InventoryReport({ flightName }: { flightName: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await downloadAstatkaInventoryReport(flightName);
      downloadBlob(`inventarizatsiya_${safeFileName(flightName)}.xlsx`, blob);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Hisobotni olib bo'lmadi."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-mc-md border border-mc-border bg-mc-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="min-w-0 text-[12px] font-medium leading-relaxed text-mc-text-2">
        <span className="font-extrabold text-mc-text">Inventarizatsiya hisoboti.</span> Har bir
        reysning yuklari: javonda, isbot bilan yoki isbotsiz olib ketilgan, hech qayerda yo'q,
        qarzlari va kassa tasdiqlamagan cheklar. Hech narsani o'zgartirmaydi.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 sm:self-auto text-[13px] font-bold text-mc-text active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Hisobot
      </button>
    </div>
  );
}

function ExcelButton({ flightName, run }: { flightName: string; run: CleanupRun }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await downloadAstatkaCleanupExcel(flightName, run.id);
      downloadBlob(`tozalash_${safeFileName(flightName)}_${run.id}.xlsx`, blob);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Excel faylini olib bo'lmadi."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="inline-flex h-11 items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98] disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      Excel
    </button>
  );
}

function CleanupHistory({
  flightName,
  runs,
  onUndone,
}: {
  flightName: string;
  runs: CleanupRun[];
  onUndone: () => void;
}) {
  const [armed, setArmed] = useState<number | null>(null);
  const undo = useMutation({
    mutationFn: (runId: number) => undoAstatkaCleanup(flightName, runId),
    onSuccess: (run) => {
      setArmed(null);
      toast.success(
        run.kept
          ? `Bekor qilindi: ${run.reverted} ta yozuv qaytdi, ${run.kept} tasi shu orada o'zgargani uchun qoldi.`
          : `Bekor qilindi: ${run.reverted} ta yozuv qaytdi.`,
      );
      onUndone();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Bekor qilib bo'lmadi.")),
  });

  if (runs.length === 0) return null;
  return (
    <section className="border-t border-mc-border pt-3">
      <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
        Oldingi tozalashlar
      </h3>
      <ul className="mt-2 space-y-2">
        {runs.map((run) => (
          <li key={run.id} className="rounded-mc-md border border-mc-border bg-mc-surface p-3">
            <p className="text-[13px] font-extrabold text-mc-text">
              №{run.id} · {formatDateTime(run.created_at)}
              {run.admin_username && (
                <span className="font-semibold text-mc-text-3"> · {run.admin_username}</span>
              )}
            </p>
            <p className="mt-0.5 break-words text-[12px] font-semibold tabular-nums text-mc-text-2">
              {run.bags} yuk · {run.source_flights.join(", ")}
              {run.unpaid_bags > 0 && ` · qarz ${formatUzs(run.unpaid_amount)}`}
            </p>
            {run.undone_at && (
              <p className="mt-0.5 text-[12px] font-semibold text-mc-warn">
                Bekor qilingan {formatDateTime(run.undone_at)}
                {run.undone_by_username && ` (${run.undone_by_username})`}
                {run.kept ? `: ${run.kept} ta yozuv o'zgargani uchun qoldi` : ""}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <ExcelButton flightName={flightName} run={run} />
              {!run.undone_at &&
                (armed === run.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => undo.mutate(run.id)}
                      disabled={undo.isPending}
                      className="inline-flex h-11 items-center gap-2 rounded-mc-md bg-mc-danger-fill px-3 text-[13px] font-extrabold text-mc-on-danger active:scale-[0.98] disabled:opacity-50"
                    >
                      {undo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Ha, {run.bags} ta yukni qaytarish
                    </button>
                    <button
                      type="button"
                      onClick={() => setArmed(null)}
                      disabled={undo.isPending}
                      className="h-11 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98]"
                    >
                      Yo'q
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setArmed(run.id)}
                    className="inline-flex h-11 items-center gap-2 rounded-mc-md border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.98]"
                  >
                    <Undo2 className="h-4 w-4" />
                    Bekor qilish
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
