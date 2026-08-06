import { Check, Plane, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { FlightGroup } from "@/api/services/warehouse";

interface FlightSelectorProps {
  flights: FlightGroup[];
  selectedFlights: string[];
  onToggleFlight: (flightName: string) => void;
  onSelectAll: () => void;
}

export default function FlightSelector({
  flights,
  selectedFlights,
  onToggleFlight,
  onSelectAll,
}: FlightSelectorProps) {
  const { t } = useTranslation();

  const allSelected = flights.length > 0 && flights.every((f) =>
    selectedFlights.includes(f.flight_name),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("adminDeliveryRequest.flights.title", "Reyslarni tanlang")}
        </h3>
        <button
          onClick={onSelectAll}
          className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
        >
          {allSelected
            ? t("adminDeliveryRequest.flights.deselectAll", "Barchasini bekor qilish")
            : t("adminDeliveryRequest.flights.selectAll", "Barchasini tanlash")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {flights.map((flight, index) => {
          const isSelected = selectedFlights.includes(flight.flight_name);
          const cargoCount = flight.transactions.length;

          const hasUnpaid = flight.transactions.some(tx => tx.payment_status === "unpaid" || tx.payment_status === "pending");
          const hasPartial = flight.transactions.some(tx => tx.payment_status === "partial");
          const allPaid = flight.transactions.every(tx => tx.payment_status === "paid");

          // Collection state. The data was always on the wire; the lookup used
          // to filter fully-collected flights out server-side, so the manager
          // saw an empty list rather than a collected one. Rolled up here the
          // same way the payment badges are, because FlightGroup carries no
          // flight-level aggregate.
          const takenCount = flight.transactions.filter(tx => tx.is_taken_away).length;
          const allTaken = takenCount === cargoCount && cargoCount > 0;
          const someTaken = takenCount > 0 && !allTaken;

          return (
            <motion.button
              key={flight.flight_name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onToggleFlight(flight.flight_name)}
              className={`relative text-left rounded-2xl border p-4 transition-all duration-200 ${
                isSelected
                  ? "border-orange-400 bg-orange-50/60 dark:bg-orange-500/10 ring-1 ring-orange-400"
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-orange-200 dark:hover:border-orange-500/30"
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <Plane className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                  {flight.flight_name}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
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
                  {flight.total_weight_kg.toFixed(2)} kg
                </Badge>
                {allPaid ? (
                  <Badge variant="secondary" className="rounded-md text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    ✅ To'langan
                  </Badge>
                ) : hasUnpaid ? (
                  <Badge variant="secondary" className="rounded-md text-xs bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    ❌ To'lanmagan
                  </Badge>
                ) : hasPartial ? (
                  <Badge variant="secondary" className="rounded-md text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                    ⚠️ Bo'lib to'langan
                  </Badge>
                ) : null}
                {flight.total_remaining_amount > 0 && (
                  <Badge variant="secondary" className="rounded-md text-xs bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {flight.total_remaining_amount.toLocaleString()} so'm qarz
                  </Badge>
                )}
                {/* The fact that used to be invisible: this flight has already
                    left. Shown as its own badge rather than by hiding the
                    flight, so a manager filing anyway knows what they are
                    filing over. Partial collection gets its own count — a
                    half-collected flight still has something to deliver. */}
                {allTaken ? (
                  <Badge variant="secondary" className="rounded-md text-xs bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300">
                    📦 Olib ketilgan
                  </Badge>
                ) : someTaken ? (
                  <Badge variant="secondary" className="rounded-md text-xs bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400">
                    📦 {takenCount}/{cargoCount} olib ketilgan
                  </Badge>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
