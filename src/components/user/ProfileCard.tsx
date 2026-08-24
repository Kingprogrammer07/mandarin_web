import { ChevronRight, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { triggerSoftHaptic } from '@/utils/haptics';

interface ProfileCardProps {
  fullName: string;
  clientCode: string;
  /** `dd.mm.yyyy hh:mm` from the API — only the date half is shown. */
  createdAt?: string;
  avatarUrl?: string;
  onOpen: () => void;
}

/** The API sends `dd.mm.yyyy hh:mm`; the card wants the day, not the minute. */
function dateOnly(value?: string): string | null {
  if (!value) return null;
  const [datePart] = value.trim().split(' ');
  return datePart || null;
}

/**
 * Identity header: who this account is and when it was opened.
 *
 * The client code is the one thing a client is asked for by staff, on the bot
 * and on every parcel, so it sits directly under the name rather than inside
 * the details screen.
 */
export function ProfileCard({
  fullName,
  clientCode,
  createdAt,
  avatarUrl,
  onOpen,
}: ProfileCardProps) {
  const { t } = useTranslation();
  const registered = dateOnly(createdAt);

  return (
    <div className="px-4">
      <button
        type="button"
        onClick={() => {
          triggerSoftHaptic();
          onOpen();
        }}
        className="flex w-full items-center gap-3 rounded-mc-lg border border-mc-border
                   bg-mc-surface p-3 text-left shadow-[var(--mc-shadow-card)]
                   transition-transform duration-150 active:scale-[0.99]"
      >
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden
                     rounded-full bg-mc-brand-soft text-mc-brand"
          aria-hidden="true"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              loading="lazy"
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-7 w-7" strokeWidth={1.8} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-extrabold leading-tight text-mc-text">
            {fullName}
          </span>
          {clientCode && (
            <span
              className="mt-1 inline-flex items-center rounded-full bg-mc-brand-soft px-2 py-0.5
                         text-[11px] font-extrabold text-mc-brand"
            >
              {clientCode}
            </span>
          )}
          {registered && (
            <span className="mt-1 block truncate text-[11px] font-medium text-mc-text-2">
              {t('profile.registeredOn', { date: registered })}
            </span>
          )}
        </span>

        <ChevronRight className="h-5 w-5 shrink-0 text-mc-text-3" aria-hidden="true" />
      </button>
    </div>
  );
}
