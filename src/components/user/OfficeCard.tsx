import { MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OfficeInfo } from '@/api/services/officeService';
import { triggerSoftHaptic } from '@/utils/haptics';

interface OfficeCardProps {
  office?: OfficeInfo;
  isLoading: boolean;
  /** Opens the full office sheet — hours for the week, map, all phones. */
  onOpen: () => void;
}

/**
 * Shown until staff upload a photo through the admin panel.
 *
 * A branch card with an empty grey square reads as "image failed to load", and
 * this office does not change often enough for a bundled shot to go stale.
 * `office.photo_url` still wins whenever it is set.
 */
const FALLBACK_OFFICE_PHOTO = '/office.jpg';

function formatTodayHours(office: OfficeInfo): string | null {
  const today = office.today_hours;
  if (!today?.open || !today?.close) return null;
  return `${today.open} – ${today.close}`;
}

/**
 * Office summary: photo, open/closed, today's hours, address, call button.
 *
 * Renders nothing at all when staff have not filled in an address — an office
 * card with a blank address is worse than no card, because a client will tap
 * it, find nothing, and stop trusting the section.
 */
export function OfficeCard({ office, isLoading, onOpen }: OfficeCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="px-4">
        <div className="h-[72px] animate-pulse rounded-mc-lg border border-mc-border bg-mc-surface-2" />
      </div>
    );
  }

  if (!office?.address_text) return null;

  const hours = formatTodayHours(office);
  const phone = office.phones[0];
  const isOpen = office.is_open_now;

  return (
    <div className="px-4">
      <div
        className="flex items-center gap-2.5 rounded-mc-lg border border-mc-border
                   bg-mc-surface p-2 shadow-[var(--mc-shadow-card)]"
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-mc-md"
          aria-label={t('home.office.open', 'Filial haqida batafsil')}
        >
          {/* Fixed box with an explicit aspect so the row never reflows while
              the photo loads. */}
          <span
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center
                       overflow-hidden rounded-mc-sm bg-mc-surface-2"
            aria-hidden="true"
          >
            <img
              src={office.photo_url ?? FALLBACK_OFFICE_PHOTO}
              alt=""
              loading="lazy"
              width={52}
              height={52}
              className="h-full w-full object-cover"
              // If a staff-uploaded URL 404s, drop back to the bundled shot
              // rather than leaving a broken-image glyph in the card.
              onError={(event) => {
                const img = event.currentTarget;
                if (img.src.endsWith(FALLBACK_OFFICE_PHOTO)) return;
                img.src = FALLBACK_OFFICE_PHOTO;
              }}
            />
          </span>

          <span className="min-w-0 flex-1">
            {/* Reuses the existing "Bizning manzil" copy rather than a second
                hardcoded branch name — the two would drift the first time an
                office moved, and only one of them would get updated. */}
            <span className="block truncate text-[13px] font-extrabold text-mc-text">
              {t('ourAddress.locationName', 'Mandarin Cargo ofisi')}
            </span>

            <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isOpen ? 'bg-mc-success' : 'bg-mc-text-3'
                }`}
                aria-hidden="true"
              />
              {/* Text as well as colour: "open" must survive a colour-blind
                  reader and a greyscale screenshot. */}
              <span className={`font-bold ${isOpen ? 'text-mc-success' : 'text-mc-text-2'}`}>
                {isOpen ? t('home.office.openNow', 'Ochiq') : t('home.office.closed', 'Yopiq')}
              </span>
              {hours && (
                <>
                  <span className="text-mc-text-3" aria-hidden="true">
                    •
                  </span>
                  <span className="text-mc-text-2 tabular-nums">{hours}</span>
                </>
              )}
            </span>

            <span className="mt-0.5 flex items-start gap-1.5">
              <MapPin
                className="mt-[2px] h-3.5 w-3.5 shrink-0 text-mc-text-3"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="line-clamp-2 text-[11px] leading-snug text-mc-text-2">
                {office.address_text}
              </span>
            </span>
          </span>
        </button>

        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
            onClick={() => triggerSoftHaptic()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                       border border-mc-border bg-mc-surface text-mc-brand
                       transition-transform duration-150 active:scale-[0.94]"
            aria-label={t('home.office.call', { phone, defaultValue: `Qo'ng'iroq: ${phone}` })}
          >
            <Phone className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
