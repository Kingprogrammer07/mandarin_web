import { Check, Plane } from "lucide-react";
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
                  {flight.total_weight_kg.toFixed(1)} kg
                </Badge>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
