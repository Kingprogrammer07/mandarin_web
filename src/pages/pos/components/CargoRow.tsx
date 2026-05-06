
import { motion } from 'framer-motion';
import { CheckCheck, Plane } from 'lucide-react';
import { formatCurrencySum } from '@/lib/format';
import type { UnpaidCargoItem } from '@/api/verification';

// ─── CargoRow ─────────────────────────────────────────────────────────────────

export function CargoRow({
  cargo,
  isSelected,
  onToggle,
}: {
  cargo: UnpaidCargoItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.label
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        isSelected
          ? "bg-orange-50 dark:bg-orange-500/[0.08] border-orange-200/70 dark:border-orange-500/20"
          : "bg-white dark:bg-[#111] border-gray-100 dark:border-white/[0.06] hover:border-orange-200/50 dark:hover:border-orange-500/10"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={isSelected}
        onChange={onToggle}
      />
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          isSelected
            ? "bg-orange-500 border-orange-500 shadow-sm shadow-orange-500/20"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {isSelected && (
          <CheckCheck className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">
            #{cargo.row_number}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {cargo.weight} kg
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <Plane className="w-3 h-3" />
            {cargo.flight_name}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
          {formatCurrencySum(cargo.price_per_kg, undefined, "$")}/kg
        </p>
      </div>
      <p
        className={`text-[14px] font-black shrink-0 transition-colors ${
          isSelected
            ? "text-orange-600 dark:text-orange-400"
            : "text-red-500 dark:text-red-400"
        }`}
      >
        {formatCurrencySum(cargo.total_payment)}
      </p>
    </motion.label>
  );
}

