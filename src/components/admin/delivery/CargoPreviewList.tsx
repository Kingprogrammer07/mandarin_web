import { useState } from "react";
import { ChevronDown, Package, Banknote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { FlightGroup } from "@/api/services/warehouse";

interface CargoPreviewListProps {
  flights: FlightGroup[];
  selectedFlightNames: string[];
}

export default function CargoPreviewList({
  flights,
  selectedFlightNames,
}: CargoPreviewListProps) {
  const { t } = useTranslation();
  const [expandedFlights, setExpandedFlights] = useState<Set<string>>(
    new Set(selectedFlightNames),
  );

  const toggleFlight = (name: string) => {
    setExpandedFlights((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleFlights = flights.filter((f) =>
    selectedFlightNames.includes(f.flight_name),
  );

  if (visibleFlights.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {t("adminDeliveryRequest.cargoPreview.title", "Yuklarni ko'rish")}
      </h3>

      <div className="space-y-2">
        {visibleFlights.map((flight) => {
          const isExpanded = expandedFlights.has(flight.flight_name);

          return (
            <div
              key={flight.flight_name}
              className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] overflow-hidden"
            >
              <button
                onClick={() => toggleFlight(flight.flight_name)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {flight.flight_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({flight.transactions.length} {t("adminDeliveryRequest.cargoPreview.cargoLabel", "yuk")})
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      {flight.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-gray-500">
                              #{tx.qator_raqami}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {Number(tx.vazn).toFixed(2)} kg
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tx.payment_status === 'paid' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px] bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">To'langan</span>
                            ) : tx.payment_status === 'partial' ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium text-[10px] bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">Qisman</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 font-medium text-[10px] bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">To'lanmagan</span>
                            )}
                            {tx.remaining_amount > 0 && (
                              <span className="text-orange-600 dark:text-orange-400 font-medium text-[10px]">
                                {tx.remaining_amount.toLocaleString()} qarz
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Banknote className="w-3 h-3" />
                              {tx.summa.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
