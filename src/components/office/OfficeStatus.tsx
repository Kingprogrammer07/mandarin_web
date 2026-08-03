import { useTranslation } from 'react-i18next';
import { ChevronRight, Clock, MapPin, Phone, Send } from 'lucide-react';
import {
  WEEKDAY_ORDER,
  type OfficeInfo,
  type WeekdayKey,
} from '@/api/services/officeService';
import { useOfficeInfo } from '@/hooks/useOfficeInfo';

/**
 * Shared office-card pieces. A customer was sent to the office by the cash-payment
 * screen with no address and no hours, and arrived on a Sunday to a closed door —
 * so every screen that mentions the office renders these from one source.
 */

function formatNextOpen(
  iso: string | null,
  locale: string,
  weekday: 'long' | 'short' = 'long',
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'uz-UZ', {
    weekday,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Green "open until HH:MM" / red "closed today" pill.
 *
 * `compact` drops the "opens Monday 14:00" tail. In the full card that tail is
 * the useful part, but inside a one-line row it grew to two lines and pushed
 * the title into wrapping — there the next-open time belongs on its own line,
 * where it can be truncated.
 */
export function OfficeOpenBadge({
  office,
  compact = false,
}: {
  office: OfficeInfo;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const nextOpen = formatNextOpen(office.next_open_at, i18n.language);

  const shell = compact
    ? 'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black'
    : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ring-1';
  const dot = compact ? 'h-1.5 w-1.5' : 'h-2 w-2';

  if (office.is_open_now) {
    return (
      <span
        className={`${shell} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20`}
      >
        <span className={`${dot} rounded-full bg-emerald-500`} />
        {compact
          ? t('office.open')
          : office.today_hours
            ? t('office.openUntil', { time: office.today_hours.close })
            : t('office.open')}
      </span>
    );
  }

  return (
    <span
      className={`${shell} bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20`}
    >
      <span className={`${dot} rounded-full bg-red-500`} />
      {compact
        ? t('office.closedShort')
        : `${
            office.closed_reason === 'holiday'
              ? t('office.closedHoliday')
              : t('office.closedNow')
          }${nextOpen ? ` · ${t('office.opensAt', { when: nextOpen })}` : ''}`}
    </span>
  );
}

/** Full weekday schedule; today is highlighted. */
export function OfficeHoursTable({ office }: { office: OfficeInfo }) {
  const { t } = useTranslation();
  const todayKey = WEEKDAY_ORDER[(new Date().getDay() + 6) % 7];

  return (
    <div className="space-y-1">
      {WEEKDAY_ORDER.map((day: WeekdayKey) => {
        const cfg = office.working_hours?.[day];
        const isToday = day === todayKey;
        return (
          <div
            key={day}
            className={`flex items-center justify-between rounded-lg px-2 py-1 text-[13px] ${
              isToday
                ? 'bg-orange-50 font-black text-gray-950 dark:bg-orange-400/10 dark:text-[#fff8ed]'
                : 'font-semibold text-gray-600 dark:text-white/55'
            }`}
          >
            <span>{t(`office.weekday.${day}`)}</span>
            <span className={cfg?.closed || !cfg ? 'text-red-500 dark:text-red-400' : ''}>
              {cfg && !cfg.closed ? `${cfg.open} – ${cfg.close}` : t('office.dayOff')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Tap-to-call rows + admin chat link. */
export function OfficeContacts({ office }: { office: OfficeInfo }) {
  const { t } = useTranslation();
  const hasPhones = office.phones.length > 0;
  if (!hasPhones && !office.telegram_username) return null;

  return (
    <div className="space-y-2">
      {office.phones.map((phone) => (
        <a
          key={phone}
          href={`tel:${phone.replace(/[^+\d]/g, '')}`}
          className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/85 p-3 transition active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.045]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
            <Phone className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-gray-950 dark:text-[#fff8ed]">
              {phone}
            </span>
            <span className="text-[11px] font-semibold text-gray-500 dark:text-white/45">
              {t('office.callHint')}
            </span>
          </span>
        </a>
      ))}
      {office.telegram_username && (
        <a
          href={`https://t.me/${office.telegram_username.replace(/^@/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/85 p-3 transition active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.045]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
            <Send className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-gray-950 dark:text-[#fff8ed]">
              {t('office.adminChat')}
            </span>
            <span className="text-[11px] font-semibold text-gray-500 dark:text-white/45">
              @{office.telegram_username.replace(/^@/, '')}
            </span>
          </span>
        </a>
      )}
    </div>
  );
}

/**
 * Home-screen strip: address + open/closed at a glance, tap for the full card.
 * Renders nothing until staff fill in an address, so it never shows an empty row.
 *
 * Strictly two lines, both truncated. The address is staff-entered free text and
 * the next-open string is locale-formatted, so neither has a length this row can
 * rely on; letting them wrap turned a 56px strip into a 150px block that pushed
 * the rest of the home screen off-screen.
 */
export function OfficeHomeStrip({ onOpen }: { onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: office } = useOfficeInfo();
  if (!office || !office.address_text) return null;

  const nextOpen = office.is_open_now
    ? null
    : formatNextOpen(office.next_open_at, i18n.language, 'short');
  const subtitle = [
    office.address_text,
    nextOpen ? t('office.opensAt', { when: nextOpen }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-left transition active:scale-[0.99] dark:border-white/[0.08] dark:bg-white/[0.04]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300">
        <MapPin className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-black text-gray-950 dark:text-[#fff8ed]">
            {t('office.homeTitle')}
          </span>
          <OfficeOpenBadge office={office} compact />
        </span>
        <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-white/45">
          {subtitle}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-white/30" />
    </button>
  );
}

/**
 * Compact "before you go" block for the cash-payment confirmation: address,
 * open/closed state and a route link. Renders nothing while loading or when the
 * office record is empty, so it can be dropped into any flow safely.
 */
export function OfficeVisitSummary({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { data: office } = useOfficeInfo();
  if (!office || !office.address_text) return null;

  const routeUrl =
    office.map_url ||
    (office.latitude && office.longitude
      ? `https://yandex.uz/maps/?rtext=~${office.latitude},${office.longitude}&rtt=auto`
      : null);

  return (
    <div
      className={`w-full max-w-xs mx-auto rounded-2xl border p-3 text-left ${
        office.is_open_now
          ? 'border-gray-200 bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04]'
          : 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10'
      } ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-white/45">
          <MapPin className="h-3.5 w-3.5" />
          {t('office.visitTitle')}
        </span>
        <OfficeOpenBadge office={office} />
      </div>
      <p className="text-[13px] font-bold leading-snug text-gray-900 dark:text-[#fff8ed]">
        {office.address_text}
      </p>
      {office.landmark && (
        <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-white/45">
          {office.landmark}
        </p>
      )}
      {!office.is_open_now && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] font-bold text-red-700 dark:text-red-300">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('office.closedWarning')}
        </p>
      )}
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-[13px] font-black text-white dark:bg-white dark:text-gray-900"
        >
          <MapPin className="h-4 w-4" />
          {t('office.route')}
        </a>
      )}
    </div>
  );
}
