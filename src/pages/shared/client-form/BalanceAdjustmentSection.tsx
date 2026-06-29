import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { normalizeNumber } from '@/utils/numberFormat';
import type { UseFormReturn } from 'react-hook-form';
import type { ClientFormData } from './schema';

interface BalanceAdjustmentSectionProps {
  form: UseFormReturn<ClientFormData>;
  currentBalance: number | null;
}

export function BalanceAdjustmentSection({ form, currentBalance }: BalanceAdjustmentSectionProps) {
  return (
    <div className="p-4 border border-orange-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-white/[0.03] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Balans boshqaruvi</h3>
        {currentBalance !== null && (
          <span
            className={`text-lg font-bold ${
              currentBalance > 0
                ? 'text-green-600 dark:text-green-400'
                : currentBalance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Joriy balans: {currentBalance.toFixed(2)} so'm
          </span>
        )}
      </div>

      <FormField
        control={form.control}
        name="adjustment_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-700 dark:text-gray-300 font-medium">Amal turi</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl>
                <SelectTrigger className="bg-orange-50/50 dark:bg-white/[0.04] dark:border-white/[0.08] text-gray-900 dark:text-white">
                  <SelectValue placeholder="Tanlang..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="bonus">🎁 Bonus berish</SelectItem>
                <SelectItem value="penalty">🛑 Jarima / Pul yechish</SelectItem>
                <SelectItem value="silent">🤫 Yashirin tahrirlash (Kassa)</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      {form.watch('adjustment_type') && form.watch('adjustment_type') !== '' && (
        <>
          <FormField
            control={form.control}
            name="adjustment_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 dark:text-gray-300 font-medium">Miqdor (so'm)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="bg-orange-50/50 dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    {...field}
                    onChange={(event) => {
                      const normalized = normalizeNumber(event.target.value);
                      if (normalized !== null) field.onChange(normalized);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adjustment_reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 dark:text-gray-300 font-medium">Sabab</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Sababni yozing..."
                    className="bg-orange-50/50 dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );
}
