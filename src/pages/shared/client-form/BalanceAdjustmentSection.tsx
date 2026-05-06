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
    <div className="p-4 border border-orange-200 rounded-xl bg-white space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Balans boshqaruvi</h3>
        {currentBalance !== null && (
          <span
            className={`text-lg font-bold ${
              currentBalance > 0
                ? 'text-green-600'
                : currentBalance < 0
                  ? 'text-red-600'
                  : 'text-gray-500'
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
            <FormLabel className="text-gray-700 font-medium">Amal turi</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl>
                <SelectTrigger className="bg-orange-50/50">
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
                <FormLabel className="text-gray-700 font-medium">Miqdor (so'm)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400"
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
                <FormLabel className="text-gray-700 font-medium">Sabab</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Sababni yozing..."
                    className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400"
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
