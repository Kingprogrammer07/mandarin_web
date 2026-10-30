import { useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Plane, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { DeliveryFlightState } from "@/api/services/adminDeliveryService";
import { flightDebt, flightWeightKg } from "@/lib/adminDeliveryFlights";

interface FlightSelectorProps {
  flights: DeliveryFlightState[];
  selectedFlights: string[];
  onToggleFlight: (flightName: string) => void;
  /** Select these flights, or clear them when every one is already selected. */
  onSelectAll: (flightNames: string[]) => void;
}

type PaymentFilter = "all" | "unpaid" | "paid";

/** Cards per page; a client with years of flights otherwise scrolls for minutes. */
export const FLIGHTS_PAGE_SIZE = 10;
/** Below this the search and filter only take room. */
const CONTROLS_FROM = 7;

const FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "unpaid", label: "Qarzdor" },
  { value: "paid", label: "To'langan" },
];

/** Literal fallbacks when a translation is missing. */
const DELIVERY_TYPE_FALLBACK: Record<string, string> = {
  self_pickup: "O'zi olib ketish",
  yandex: "Yandex",
  mandarin: "Mandarin Dostavka",
  bts: "BTS",
  uzpost: "UzPost",
};

const REQUEST_STATUS_FALLBACK: Record<string, string> = {
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
};

/**
 * Entry stagger per card, capped. The list is every flight the client has ever
 * had, so an uncapped delay kept the last cards invisible, yet clickable, for
 * seconds.
 */
const STAGGER_SECONDS = 0.04;
const STAGGER_MAX_STEPS = 6;

interface FlightCardProps {
  flight: DeliveryFlightState;
  index: number;
  isSelected: boolean;
  onToggle: (flightName: string) => void;
}

function FlightCard({ flight, index, isSelected, onToggle }: FlightCardProps) {
  const { t } = useTranslation();
  const cargoCount = flight.cargo_count;
  const debt = flightDebt(flight.rows);
  const detailsId = `flight-details-${flight.flight.replace(/[^A-Za-z0-9_-]/g, "_")}`;

  // Collection state. A half-collected flight still has something to
  // deliver, so it gets its own count rather than reading as "taken".
  const allTaken = flight.is_taken_away;
  const someTaken = flight.taken_count > 0 && !allTaken;

  return (
    <motion.button
      type="button"
      // Named by the flight alone; the badges below are its description.
      // Otherwise a screen reader reads every badge and request as the
      // button's name.
      aria-label={flight.flight}
      aria-describedby={detailsId}
      aria-pressed={isSelected}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, STAGGER_MAX_STEPS) * STAGGER_SECONDS }}
      onClick={() => onToggle(flight.flight)}
      className={`relative text-left rounded-2xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
        isSelected
          ? "border-orange-400 bg-orange-50/60 dark:bg-orange-500/10 ring-1 ring-orange-400"
          : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-orange-200 dark:hover:border-orange-500/30"
      }`}
    >
      {isSelected && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" aria-hidden="true" />
        </span>
      )}

      <span className="flex items-center gap-2 mb-2 pr-7">
        <Plane className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="min-w-0 break-words font-semibold text-sm text-gray-900 dark:text-white">
          {flight.flight}
        </span>
      </span>

      <span id={detailsId} className="block">
        <span className="flex flex-wrap gap-2 mt-2">
          <Badge
            variant="secondary"
            className="rounded-md text-xs bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
          >
            {cargoCount} {t("adminDeliveryRequest.cargoPreview.cargoLabel", "yuk")}
          </Badge>
          <Badge
            variant="secondary"
            className="rounded-md text-xs bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
          >
            {flightWeightKg(flight.rows).toFixed(2)} kg
          </Badge>
          {flight.payment_status === "paid" ? (
            <Badge variant="secondary" className="rounded-md text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              ✅ {t("adminDeliveryRequest.cargoPreview.paid", "To'langan")}
            </Badge>
          ) : flight.payment_status === "partial" ? (
            <Badge variant="secondary" className="rounded-md text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              ⚠️ {t("adminDeliveryRequest.cargoPreview.partial", "Qisman")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-md text-xs bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
              ❌ {t("adminDeliveryRequest.cargoPreview.unpaid", "To'lanmagan")}
            </Badge>
          )}
          {debt > 0 && (
            <Badge variant="secondary" className="rounded-md text-xs bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 flex items-center gap-1 whitespace-nowrap">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {t("adminDeliveryRequest.cargoPreview.debtAmount", {
                amount: debt.toLocaleString(),
                defaultValue: "{{amount}} so'm qarz",
              })}
            </Badge>
          )}
          {allTaken ? (
            <Badge variant="secondary" className="rounded-md text-xs bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300">
              📦 {t("adminDeliveryRequest.cargoPreview.taken", "Olib ketilgan")}
            </Badge>
          ) : someTaken ? (
            <Badge variant="secondary" className="rounded-md text-xs bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400">
              📦 {flight.taken_count}/{cargoCount} {t("adminDeliveryRequest.cargoPreview.taken", "Olib ketilgan").toLowerCase()}
            </Badge>
          ) : null}
        </span>

        {/* Requests already on their way for this flight. Filing for
            another recipient starts here, so a flight that has already
            been sent is visible before it is ticked again, not after the
            warehouse finds two requests for one parcel. */}
        {flight.active_requests.length > 0 && (
          <span
            role="group"
            aria-label={t(
              "adminDeliveryRequest.flights.activeRequests",
              "Shu reys bo'yicha zayavkalar",
            )}
            className="mt-3 block space-y-1"
          >
            {flight.active_requests.map((request) => (
              <span
                key={request.id}
                className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg bg-blue-50 px-2 py-1 text-[11px] text-blue-800 dark:bg-blue-500/10 dark:text-blue-300"
              >
                <span className="font-mono font-semibold">#{request.id}</span>
                <span>
                  {t(
                    `adminDeliveryRequest.deliveryType.labels.${request.delivery_type}`,
                    DELIVERY_TYPE_FALLBACK[request.delivery_type] ?? request.delivery_type,
                  )}
                </span>
                <span>
                  ·{" "}
                  {t(
                    `adminDeliveryRequest.flights.requestStatus.${request.status}`,
                    REQUEST_STATUS_FALLBACK[request.status] ?? request.status,
                  )}
                </span>
                {request.recipient_name && (
                  <span className="min-w-0 break-words">· {request.recipient_name}</span>
                )}
              </span>
            ))}
          </span>
        )}
      </span>
    </motion.button>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
  label,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (pageCount <= 1) return null;
  const arrow =
    "flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:border-orange-300 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300";
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-3 pt-1">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Oldingi sahifa"
        className={arrow}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-12 text-center text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        aria-label="Keyingi sahifa"
        className={arrow}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

function pageOf<T>(items: T[], page: number): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / FLIGHTS_PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * FLIGHTS_PAGE_SIZE;
  return { items: items.slice(start, start + FLIGHTS_PAGE_SIZE), page: current, pageCount };
}

/**
 * The client's flights: those with cargo still in the warehouse first, paged;
 * fully collected ones folded away below, since a request is rarely filed for
 * them. Search and the payment filter apply to both.
 */
export default function FlightSelector({
  flights,
  selectedFlights,
  onToggleFlight,
  onSelectAll,
}: FlightSelectorProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [activePage, setActivePage] = useState(1);
  const [takenPage, setTakenPage] = useState(1);
  const [takenOpen, setTakenOpen] = useState(false);

  const needle = query.trim().toUpperCase();
  const shown = flights.filter(
    (flight) =>
      (!needle || flight.flight.toUpperCase().includes(needle)) &&
      (paymentFilter === "all" ||
        (paymentFilter === "paid"
          ? flight.payment_status === "paid"
          : flight.payment_status !== "paid")),
  );
  const active = shown.filter((flight) => !flight.is_taken_away);
  const taken = shown.filter((flight) => flight.is_taken_away);
  const activeView = pageOf(active, activePage);
  const takenView = pageOf(taken, takenPage);

  // "All" means the flights still to deliver; collected ones only when the
  // filter leaves nothing else.
  const selectAllNames = (active.length > 0 ? active : taken).map((flight) => flight.flight);
  const allSelected =
    selectAllNames.length > 0 &&
    selectAllNames.every((name) => selectedFlights.includes(name));
  const selectedTaken = taken.filter((flight) => selectedFlights.includes(flight.flight)).length;

  const resetPages = () => {
    setActivePage(1);
    setTakenPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("adminDeliveryRequest.flights.title", "Reyslarni tanlang")}
          {selectedFlights.length > 0 && (
            <span className="ml-1.5 font-normal text-orange-600 dark:text-orange-400">
              · {selectedFlights.length} ta tanlandi
            </span>
          )}
        </h3>
        {selectAllNames.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectAll(selectAllNames)}
            className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-orange-600 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {allSelected
              ? t("adminDeliveryRequest.flights.deselectAll", "Barchasini bekor qilish")
              : t("adminDeliveryRequest.flights.selectAll", "Barchasini tanlash")}
          </button>
        )}
      </div>

      {flights.length >= CONTROLS_FROM && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Reys qidirish</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetPages();
              }}
              placeholder="Reys nomi, masalan M318"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 md:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            />
          </label>
          <div
            role="group"
            aria-label="To'lov holati"
            className="flex shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/[0.03]"
          >
            {FILTERS.map((option) => {
              const on = paymentFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPaymentFilter(option.value);
                    resetPages();
                  }}
                  className={`h-9 flex-1 rounded-lg px-3 text-xs font-medium transition-colors sm:flex-none ${
                    on
                      ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 dark:border-white/10">
          Bu filtr bo'yicha reys yo'q
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeView.items.map((flight, index) => (
                  <FlightCard
                    key={flight.flight}
                    flight={flight}
                    index={index}
                    isSelected={selectedFlights.includes(flight.flight)}
                    onToggle={onToggleFlight}
                  />
                ))}
              </div>
              <Pager
                page={activeView.page}
                pageCount={activeView.pageCount}
                onPage={setActivePage}
                label="Reyslar sahifalari"
              />
            </>
          )}

          {taken.length > 0 && (
            <section className="rounded-2xl border border-gray-200 dark:border-white/10">
              <button
                type="button"
                aria-expanded={takenOpen}
                onClick={() => setTakenOpen((open) => !open)}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 py-2 text-left"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Olib ketilganlar ({taken.length})
                  {selectedTaken > 0 && (
                    <span className="ml-1.5 font-normal text-orange-600 dark:text-orange-400">
                      · {selectedTaken} ta tanlangan
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${takenOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {takenOpen && (
                <div className="space-y-3 px-3 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {takenView.items.map((flight, index) => (
                      <FlightCard
                        key={flight.flight}
                        flight={flight}
                        index={index}
                        isSelected={selectedFlights.includes(flight.flight)}
                        onToggle={onToggleFlight}
                      />
                    ))}
                  </div>
                  <Pager
                    page={takenView.page}
                    pageCount={takenView.pageCount}
                    onPage={setTakenPage}
                    label="Olib ketilgan reyslar sahifalari"
                  />
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
