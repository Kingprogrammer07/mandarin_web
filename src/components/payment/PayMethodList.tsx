/**
 * The «To'lov usuli» list and the switch row of the payment screens.
 *
 * One radio row per way to pay; the screen's one pay button acts on the chosen
 * row. A row that cannot take the current choice (the wallet's part, a custom
 * sum) is disabled and says why in place of its hint.
 */

import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** One row of the «To'lov usuli» list and what the pay button does with it. */
export interface PayOption {
  key: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  /** Why the method cannot take the current wallet / amount choice; null when it can. */
  blockedBy: string | null;
  /** Guided-tour anchor carried by the row. */
  tour?: string;
  /** The pay button's label while this row is chosen. */
  cta: string;
  run: () => void;
}

interface PayMethodListProps {
  options: PayOption[];
  /** The chosen row: the one the client picked, else the first usable one. */
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
  /** Guided-tour anchor of the whole list. */
  tour?: string;
}

export function PayMethodList({ options, selectedKey, onSelect, tour }: PayMethodListProps) {
  const { t } = useTranslation();
  return (
    <fieldset data-tour={tour} className="min-w-0">
      <legend className="mb-2.5 text-[13px] font-extrabold text-mc-text">
        {t('makePayment.methods.title')}
      </legend>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = option.key === selectedKey;
          const blocked = option.blockedBy !== null;
          const Icon = option.icon;
          return (
            <label
              key={option.key}
              data-tour={option.tour}
              className={`flex min-h-16 items-center gap-3 rounded-mc-md border bg-mc-surface px-3 py-2.5
                outline-offset-2 outline-mc-brand/50 has-[:focus-visible]:outline-2
                transition-[transform,border-color] duration-150 ${
                  blocked ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
                } ${selected ? 'border-mc-brand ring-1 ring-mc-brand' : 'border-mc-border'}`}
            >
              <input
                type="radio"
                name="pay-method"
                value={option.key}
                checked={selected}
                disabled={blocked}
                onChange={() => onSelect(option.key)}
                className="sr-only"
              />
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface-2 ${
                  blocked ? 'text-mc-text-3' : selected ? 'text-mc-text' : 'text-mc-text-2'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block break-words text-[15px] font-bold leading-snug tabular-nums ${
                    blocked ? 'text-mc-text-3' : 'text-mc-text'
                  }`}
                >
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-mc-text-2">
                  {option.blockedBy ?? option.hint}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 rounded-full transition-[border-width,border-color] duration-150 ${
                  blocked
                    ? 'border-2 border-transparent'
                    : selected
                      ? 'border-[6px] border-mc-brand'
                      : 'border-2 border-mc-text-3/60'
                }`}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A full-width row with an iOS-style switch. */
export function SwitchRow({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-mc-text">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-mc-text-2 tabular-nums">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
          checked ? 'bg-mc-brand' : 'bg-mc-text-3/35'
        }`}
      >
        {/* A white knob in both themes, like the bank card face. */}
        <span
          className={`absolute top-[2px] left-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            checked ? 'translate-x-[18px]' : ''
          }`}
        />
      </span>
    </button>
  );
}
