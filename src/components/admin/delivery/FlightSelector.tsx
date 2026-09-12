import { Check, Plane, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { DeliveryFlightState } from "@/api/services/adminDeliveryService";
import { flightDebt, flightWeightKg } from "@/lib/adminDeliveryFlights";

interface FlightSelectorProps {
  flights: DeliveryFlightState[];
  selectedFlights: string[];
  onToggleFlight: (flightName: string) => void;
  onSelectAll: () => void;
}

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

export default function FlightSelector({
  flights,
  selectedFlights,
  onToggleFlight,
  onSelectAll,
}: FlightSelectorProps) {
  const { t } = useTranslation();

  const allSelected =
    flights.length > 0 &&
    flights.every((flight) => selectedFlights.includes(flight.flight));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("adminDeliveryRequest.flights.title", "Reyslarni tanlang")}
        </h3>
        <button
          type="button"
          onClick={onSelectAll}
          className="min-h-11 rounded-lg px-2 text-xs font-medium text-orange-600 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          {allSelected
            ? t("adminDeliveryRequest.flights.deselectAll", "Barchasini bekor qilish")
            : t("adminDeliveryRequest.flights.selectAll", "Barchasini tanlash")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {flights.map((flight, index) => {
          const isSelected = selectedFlights.includes(flight.flight);
          const cargoCount = flight.cargo_count;
          const debt = flightDebt(flight.rows);
          const detailsId = `flight-details-${index}`;

          // Collection state. A half-collected flight still has something to
          // deliver, so it gets its own count rather than reading as "taken".
          const allTaken = flight.is_taken_away;
          const someTaken = flight.taken_count > 0 && !allTaken;

          return (
            <motion.button
              key={flight.flight}
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
              onClick={() => onToggleFlight(flight.flight)}
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
        })}
      </div>
    </div>
  );
}
