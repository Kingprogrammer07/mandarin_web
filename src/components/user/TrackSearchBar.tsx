import { useState } from 'react';
import { ArrowRight, ScanLine, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { triggerSoftHaptic } from '@/utils/haptics';

interface TrackSearchBarProps {
  onSearch: (trackCode: string) => void;
  /** Opens the tracking screen with nothing pre-filled. */
  onOpenTracking: () => void;
  isSearching?: boolean;
}

/**
 * Track-code search.
 *
 * The trailing button changes meaning with the field: idle it shows a scan
 * frame that opens the tracking screen, and the moment there is something to
 * look up it becomes an arrow that submits. It was previously disabled while
 * idle, so the scan frame was a control that could not be pressed at all.
 */
export function TrackSearchBar({
  onSearch,
  onOpenTracking,
  isSearching = false,
}: TrackSearchBarProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const hasQuery = value.trim().length > 0;

  // Typed by inference from the form's onSubmit — React 19 deprecates the
  // standalone FormEvent import.
  const submit: React.ComponentProps<'form'>['onSubmit'] = (event) => {
    event.preventDefault();
    if (!hasQuery || isSearching) return;
    triggerSoftHaptic();
    onSearch(value.trim());
  };

  return (
    <form onSubmit={submit} className="px-4" role="search">
      <div
        className="flex items-center gap-2 rounded-mc-md border border-mc-border
                   bg-mc-surface p-1 pl-2.5 shadow-[var(--mc-shadow-card)]"
      >
        <Search
          className="h-4 w-4 shrink-0 text-mc-text-3"
          strokeWidth={2}
          aria-hidden="true"
        />

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // Uppercase because every track code in this system is; doing it on
          // input saves the user a shift key and the backend a normalisation.
          onBlur={() => setValue((v) => v.trim().toUpperCase())}
          type="search"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label={t('home.search.label', 'Yuk kodi yoki tracking raqami')}
          placeholder={t('home.search.placeholder', 'Yuk kodi yoki tracking raqami')}
          // The field stays 16px: iOS zooms on the input's own font-size, and
          // anything smaller makes it zoom the whole page on focus. Styling the
          // placeholder down separately does not trigger that.
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-mc-text
                     placeholder:text-[13px] placeholder:font-normal
                     placeholder:text-mc-text-3 focus:outline-none"
        />

        <button
          // A `type="button"` press never submits, so the idle branch can open
          // the tracking screen without the form firing an empty search.
          type={hasQuery ? 'submit' : 'button'}
          onClick={() => {
            if (hasQuery || isSearching) return;
            triggerSoftHaptic();
            onOpenTracking();
          }}
          disabled={isSearching}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm
                     bg-mc-brand text-mc-on-brand transition-transform duration-200
                     active:scale-[0.96] disabled:opacity-60"
          aria-label={
            hasQuery
              ? t('home.search.submit', 'Qidirish')
              : t('home.search.openTracking', 'Yuk kuzatish oynasini ochish')
          }
        >
          {isSearching ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current
                         border-t-transparent"
              aria-hidden="true"
            />
          ) : hasQuery ? (
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <ScanLine className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
}
