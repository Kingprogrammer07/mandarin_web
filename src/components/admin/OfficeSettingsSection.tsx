import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import {
  officeService,
  WEEKDAY_ORDER,
  type OfficeDayHours,
  type OfficeInfo,
  type WeekdayKey,
} from '@/api/services/officeService';

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: 'Dushanba',
  tue: 'Seshanba',
  wed: 'Chorshanba',
  thu: 'Payshanba',
  fri: 'Juma',
  sat: 'Shanba',
  sun: 'Yakshanba',
};

const DEFAULT_DAY: OfficeDayHours = { open: '09:00', close: '18:00', closed: false };

/** Local edit buffer — the API shape minus the server-computed status fields. */
interface OfficeForm {
  address_text: string;
  landmark: string;
  latitude: string;
  longitude: string;
  phones: string[];
  telegram_username: string;
  working_hours: Record<WeekdayKey, OfficeDayHours>;
  holidays: string[];
  notice: string;
  map_url: string;
}

function toForm(office: OfficeInfo): OfficeForm {
  const hours = {} as Record<WeekdayKey, OfficeDayHours>;
  WEEKDAY_ORDER.forEach((day) => {
    hours[day] = office.working_hours?.[day] ?? { ...DEFAULT_DAY };
  });
  return {
    address_text: office.address_text ?? '',
    landmark: office.landmark ?? '',
    latitude: office.latitude != null ? String(office.latitude) : '',
    longitude: office.longitude != null ? String(office.longitude) : '',
    phones: office.phones?.length ? [...office.phones] : [''],
    telegram_username: office.telegram_username ?? '',
    working_hours: hours,
    holidays: office.holidays?.length ? [...office.holidays] : [],
    notice: office.notice ?? '',
    map_url: office.map_url ?? '',
  };
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-white/5 dark:text-white';

function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function validateWorkingHours(hours: Record<WeekdayKey, OfficeDayHours>): string | null {
  for (const day of WEEKDAY_ORDER) {
    const cfg = hours[day];
    if (cfg.closed) continue;

    const opens = parseTimeToMinutes(cfg.open);
    const closes = parseTimeToMinutes(cfg.close);
    if (opens == null || closes == null) {
      return `${WEEKDAY_LABELS[day]}: ish vaqti HH:MM formatida bo'lishi kerak`;
    }
    if (closes <= opens) {
      return `${WEEKDAY_LABELS[day]}: yopilish vaqti ochilishdan keyin bo'lishi kerak. Masalan, 18:30.`;
    }
  }
  return null;
}

/**
 * Admin editor for the office card shown in the Mini App, the cash-payment
 * screen and the bot. Kept in its own component so SystemSettingsPage stays
 * navigable.
 */
export default function OfficeSettingsSection() {
  const { data: office, isLoading } = useQuery({
    queryKey: ['office-info'],
    queryFn: officeService.get,
    staleTime: 60_000,
  });

  // The editor mounts only once data exists, so its state can be seeded from a
  // useState initializer — no effect, and a background refetch can never
  // overwrite half-typed edits.
  if (isLoading || !office) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 p-8 dark:border-white/10">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      </div>
    );
  }
  return <OfficeEditor office={office} />;
}

function OfficeEditor({ office }: { office: OfficeInfo }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OfficeForm>(() => toForm(office));

  const saveMutation = useMutation({
    mutationFn: officeService.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(['office-info'], updated);
      setForm(toForm(updated));
      toast.success('Ofis ma\'lumotlari saqlandi');
    },
    onError: () => toast.error('Saqlab bo\'lmadi — huquqni va serverni tekshiring'),
  });

  const patch = (changes: Partial<OfficeForm>) =>
    setForm((prev) => (prev ? { ...prev, ...changes } : prev));

  const patchDay = (day: WeekdayKey, changes: Partial<OfficeDayHours>) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            working_hours: {
              ...prev.working_hours,
              [day]: { ...prev.working_hours[day], ...changes },
            },
          }
        : prev,
    );

  const handleSave = () => {
    const lat = form.latitude.trim() ? Number(form.latitude) : null;
    const lng = form.longitude.trim() ? Number(form.longitude) : null;
    if ((form.latitude.trim() && Number.isNaN(lat)) || (form.longitude.trim() && Number.isNaN(lng))) {
      toast.error('Koordinata noto\'g\'ri — masalan: 41.284025');
      return;
    }
    const workingHoursError = validateWorkingHours(form.working_hours);
    if (workingHoursError) {
      toast.error(workingHoursError);
      return;
    }
    saveMutation.mutate({
      address_text: form.address_text.trim(),
      landmark: form.landmark.trim(),
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      phones: form.phones.map((p) => p.trim()).filter(Boolean),
      telegram_username: form.telegram_username.trim().replace(/^@/, ''),
      working_hours: form.working_hours,
      holidays: form.holidays.map((d) => d.trim()).filter(Boolean),
      notice: form.notice.trim(),
      map_url: form.map_url.trim(),
    });
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
            <MapPin className="h-4 w-4 text-orange-500" />
            Ofis ma'lumotlari
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
            Mini ilova, "Naqd to'lash" ekrani va bot shu ma'lumotni ko'rsatadi
          </p>
        </div>
        {office && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${
              office.is_open_now
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
            }`}
          >
            {office.is_open_now ? 'Hozir ochiq' : 'Hozir yopiq'}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            To'liq manzil *
          </label>
          <input
            className={inputClass}
            value={form.address_text}
            onChange={(e) => patch({ address_text: e.target.value })}
            placeholder="Toshkent sh., Chilonzor t., Bunyodkor 12, 3-qavat, 305-ofis"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            Mo'ljal (qanday topish)
          </label>
          <input
            className={inputClass}
            value={form.landmark}
            onChange={(e) => patch({ landmark: e.target.value })}
            placeholder="Metro yonida, ko'k binoning orqa kirishi"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
              Latitude
            </label>
            <input
              className={inputClass}
              value={form.latitude}
              onChange={(e) => patch({ latitude: e.target.value })}
              placeholder="41.284025"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
              Longitude
            </label>
            <input
              className={inputClass}
              value={form.longitude}
              onChange={(e) => patch({ longitude: e.target.value })}
              placeholder="69.232782"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            Telefon raqamlar
          </label>
          <div className="space-y-2">
            {form.phones.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(e) => {
                    const next = [...form.phones];
                    next[index] = e.target.value;
                    patch({ phones: next });
                  }}
                  placeholder="+998 90 123 45 67"
                  inputMode="tel"
                />
                <button
                  type="button"
                  onClick={() => patch({ phones: form.phones.filter((_, i) => i !== index) })}
                  className="shrink-0 rounded-xl border border-gray-200 px-3 text-gray-400 hover:text-red-500 dark:border-white/10"
                  aria-label="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ phones: [...form.phones, ''] })}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400"
            >
              <Plus className="h-3.5 w-3.5" /> Raqam qo'shish
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            Admin Telegram username (@ siz)
          </label>
          <input
            className={inputClass}
            value={form.telegram_username}
            onChange={(e) => patch({ telegram_username: e.target.value })}
            placeholder="mandarin_admin"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            Yandex xarita havolasi
          </label>
          <input
            className={inputClass}
            value={form.map_url}
            onChange={(e) => patch({ map_url: e.target.value })}
            placeholder="https://yandex.uz/maps/-/..."
          />
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-white/70">
            <Clock className="h-3.5 w-3.5" /> Ish vaqti
          </label>
          <div className="space-y-2">
            {WEEKDAY_ORDER.map((day) => {
              const cfg = form.working_hours[day];
              return (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs font-semibold text-gray-600 dark:text-white/55">
                    {WEEKDAY_LABELS[day]}
                  </span>
                  <input
                    type="time"
                    className={`${inputClass} w-28`}
                    value={cfg.open}
                    disabled={cfg.closed}
                    onChange={(e) => patchDay(day, { open: e.target.value })}
                  />
                  <input
                    type="time"
                    className={`${inputClass} w-28`}
                    value={cfg.close}
                    disabled={cfg.closed}
                    onChange={(e) => patchDay(day, { close: e.target.value })}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-white/45">
                    <input
                      type="checkbox"
                      checked={cfg.closed}
                      onChange={(e) => patchDay(day, { closed: e.target.checked })}
                    />
                    Dam olish
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            Bayram / yopiq kunlar (YYYY-MM-DD)
          </label>
          <div className="space-y-2">
            {form.holidays.map((day, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="date"
                  className={inputClass}
                  value={day}
                  onChange={(e) => {
                    const next = [...form.holidays];
                    next[index] = e.target.value;
                    patch({ holidays: next });
                  }}
                />
                <button
                  type="button"
                  onClick={() => patch({ holidays: form.holidays.filter((_, i) => i !== index) })}
                  className="shrink-0 rounded-xl border border-gray-200 px-3 text-gray-400 hover:text-red-500 dark:border-white/10"
                  aria-label="O'chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ holidays: [...form.holidays, ''] })}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400"
            >
              <Plus className="h-3.5 w-3.5" /> Kun qo'shish
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-white/70">
            Vaqtinchalik e'lon (ixtiyoriy)
          </label>
          <input
            className={inputClass}
            value={form.notice}
            onChange={(e) => patch({ notice: e.target.value })}
            placeholder="Bugun 15:00 gacha ishlaymiz"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-black text-white disabled:opacity-60"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Saqlash
        </button>
      </div>
    </section>
  );
}
