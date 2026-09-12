import { useState } from "react";
import { ChevronDown, Package, Banknote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { DeliveryFlightState } from "@/api/services/adminDeliveryService";
import { parseWeightKg } from "@/lib/adminDeliveryFlights";

interface CargoPreviewListProps {
  flights: DeliveryFlightState[];
  selectedFlightNames: string[];
}

export default function CargoPreviewList({
  flights,
  selectedFlightNames,
}: CargoPreviewListProps) {
  const { t } = useTranslation();
  const [expandedFlights, setExpandedFlights] = useState<Set<string>>(
    () => new Set(selectedFlightNames),
  );

  const toggleFlight = (name: string) => {
    setExpandedFlights((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleFlights = flights.filter((flight) =>
    selectedFlightNames.includes(flight.flight),
  );

  if (visibleFlights.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {t("adminDeliveryRequest.cargoPreview.title", "Yuklarni ko'rish")}
      </h3>

      <div className="space-y-2">
        {visibleFlights.map((flight) => {
          const isExpanded = expandedFlights.has(flight.flight);
          const panelId = `cargo-rows-${flight.flight}`;

          return (
            <div
              key={flight.flight}
              className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleFlight(flight.flight)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="w-full min-h-11 flex items-center justify-between gap-2 p-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Package className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="min-w-0 break-words font-medium text-sm text-gray-900 dark:text-white">
                    {flight.flight}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    ({flight.rows.length} {t("adminDeliveryRequest.cargoPreview.cargoLabel", "yuk")})
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    id={panelId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ul className="px-3 pb-3 space-y-2">
                      {flight.rows.map((row) => {
                        const weight = parseWeightKg(row.vazn);
                        return (
                          // Two lines rather than one: on a 320px phone a row of
                          // number, weight, status, debt and amount does not fit,
                          // and a clipped amount reads as a different amount.
                          <li
                            key={row.id}
                            className="rounded-xl bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-xs space-y-1.5"
                          >
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-mono text-gray-500">#{row.qator_raqami}</span>
                              <span className="whitespace-nowrap text-gray-700 dark:text-gray-300">
                                {weight === null ? "—" : `${weight.toFixed(2)} kg`}
                              </span>
                              {row.is_taken_away && (
                                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-500/20 dark:text-slate-300">
                                  {t("adminDeliveryRequest.cargoPreview.taken", "Olib ketilgan")}
                                </span>
                              )}
                            </span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {row.payment_status === "paid" ? (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                  {t("adminDeliveryRequest.cargoPreview.paid", "To'langan")}
                                </span>
                              ) : row.payment_status === "partial" ? (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                                  {t("adminDeliveryRequest.cargoPreview.partial", "Qisman")}
                                </span>
                              ) : (
                                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                                  {t("adminDeliveryRequest.cargoPreview.unpaid", "To'lanmagan")}
                                </span>
                              )}
                              {row.remaining_amount > 0 && (
                                <span className="whitespace-nowrap text-[10px] font-medium text-orange-600 dark:text-orange-400">
                                  {row.remaining_amount.toLocaleString()}{" "}
                                  {t("adminDeliveryRequest.cargoPreview.debt", "qarz")}
                                </span>
                              )}
                              <span className="flex items-center gap-1 whitespace-nowrap text-gray-600 dark:text-gray-400">
                                <Banknote className="w-3 h-3" aria-hidden="true" />
                                {row.total_amount.toLocaleString()}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
