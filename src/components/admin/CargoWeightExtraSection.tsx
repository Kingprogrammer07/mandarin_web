import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Scale } from 'lucide-react';
import { toast } from 'sonner';

import { systemService } from '@/api/services/systemService';

/**
 * «Yuklar»: kilograms added to each China-manifest (cargo_items) weight when
 * it is shown — track search, «Mening yuklarim», reports, admin screens.
 *
 * Display only: the stored weight and the photo-report weight (which the debt
 * is charged from) never change, and no client screen mentions the extra.
 */

const QUERY_KEY = ['system-cargo-weight-extra'] as const;
/** Backend `cargo_weight_extra.MAX_EXTRA_KG`. */
const EXTRA_MAX = 5;
const SAMPLE_KG = 1.25;

function parseExtra(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const value = Number(text);
  return value <= EXTRA_MAX ? value : null;
}

function formatKg(value: number): string {
  return String(Number(value.toFixed(3)));
}

function CargoWeightExtraForm({ initial }: { initial: number }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState(() => initial.toFixed(2));
  const value = parseExtra(input);

  const save = useMutation({
    mutationFn: (extraKg: number) => systemService.updateCargoWeightExtra(extraKg),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
      toast.success('Saqlandi');
    },
    onError: (error: { message?: string }) => toast.error(error?.message || 'Saqlab bo‘lmadi'),
  });

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
          Har bir yukka qo‘shiladigan vazn, kg
        </span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          placeholder="0.10"
          className="w-full max-w-[200px] rounded-xl border border-gray-200 px-3 py-2 text-base tabular-nums dark:border-white/10 dark:bg-[#111827] dark:text-white"
        />
      </label>

      {value === null ? (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          0 dan {EXTRA_MAX} kg gacha son kiriting, ko‘pi bilan 3 xona kasr (masalan 0.10).
        </p>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {value === 0
            ? 'Qo‘shilmaydi: vazn bazadagidek ko‘rinadi.'
            : `Masalan: Xitoy ro‘yxatidagi ${formatKg(SAMPLE_KG)} kg mijoz va adminlarga ${formatKg(SAMPLE_KG + value)} kg bo‘lib ko‘rinadi.`}
        </p>
      )}

      <button
        type="button"
        disabled={save.isPending || value === null}
        onClick={() => value !== null && save.mutate(value)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Saqlash
      </button>
    </div>
  );
}

export default function CargoWeightExtraSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => systemService.getCargoWeightExtra(),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-500/15">
          <Scale className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 dark:text-white">Yuk vazniga qo‘shimcha</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Xitoy ro‘yxatidagi (cargo_items) har bir yuk vazniga faqat ko‘rsatishda qo‘shiladi:
            trek qidiruv, «Mening yuklarim», hisobotlar, admin oynalari. Bazadagi vazn va
            fotohisobot vazni o‘zgarmaydi, qarz fotohisobot vaznidan hisoblanadi.
          </p>
        </div>
      </div>

      {isLoading && <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />}

      {isError && !isLoading && (
        <div className="flex items-center gap-3 text-sm text-rose-600 dark:text-rose-300">
          Sozlamani o‘qib bo‘lmadi.
          <button type="button" onClick={() => refetch()} className="font-bold underline">
            Qayta urinish
          </button>
        </div>
      )}

      {data && <CargoWeightExtraForm key={data.extra_kg} initial={data.extra_kg} />}
    </div>
  );
}
