/**
 * Who collects the parcel.
 *
 * Requests used to go out under the account holder's name with no way to change
 * it, but a parcel is often picked up by a relative, a neighbour or a colleague
 * — and that name is what the courier reads off the label and asks for at the
 * counter. Defaults to the profile name, so nothing changes for the majority
 * who collect their own.
 *
 * Two states rather than a permanently open text box: an always-editable field
 * pre-filled with your own name invites accidental edits on the one screen
 * where a typo means the courier cannot hand the parcel over.
 */

import { useTranslation } from 'react-i18next';
import { Pencil, User } from 'lucide-react';

const CARD =
  'rounded-mc-lg border border-mc-border bg-mc-surface p-3.5 backdrop-blur-md';

export function RecipientNameField({
  profileName,
  value,
  onChange,
}: {
  /** The name on the account — what is used when no override is set. */
  profileName: string;
  /** The override, or null while the profile name is being used. */
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { t } = useTranslation();
  const isOverridden = value !== null;

  return (
    <div className={CARD}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-bold text-mc-text-2">
          <User className="h-3.5 w-3.5" />
          {t('deliveryRequest.recipient.label', 'Qabul qiluvchi')}
        </span>

        <button
          type="button"
          onClick={() => onChange(isOverridden ? null : profileName)}
          className="flex min-h-[32px] items-center gap-1 text-[11px] font-bold text-mc-brand active:scale-95"
        >
          <Pencil className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
          {isOverridden
            ? t('deliveryRequest.recipient.useProfile', 'Profildagi ism')
            : t('deliveryRequest.recipient.useOther', 'Boshqa ism')}
        </button>
      </div>

      {isOverridden ? (
        <>
          {/* 16px: below that iOS zooms the page on focus and does not zoom
              back, and this form lives inside the Telegram Mini App. */}
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t(
              'deliveryRequest.recipient.placeholder',
              'Kim olib ketadi?',
            )}
            autoComplete="name"
            maxLength={120}
            className="w-full rounded-mc-md border border-mc-border bg-mc-surface-2 px-3 py-2.5 text-[16px] font-semibold text-mc-text outline-none transition focus:border-mc-brand focus:ring-1 focus:ring-mc-brand"
          />
          <p className="mt-1.5 text-[11px] text-mc-text-3">
            {t(
              'deliveryRequest.recipient.hintOther',
              'Kuryer shu ismni so‘raydi. Bo‘sh qoldirilsa profildagi ism ishlatiladi.',
            )}
          </p>
        </>
      ) : (
        <p className="truncate text-[13px] font-semibold text-mc-text" title={profileName}>
          {profileName || t('deliveryRequest.recipient.empty', '—')}
        </p>
      )}
    </div>
  );
}
