/**
 * Auto / light / dark, as three explicit buttons.
 *
 * Not a cycling icon: a till is used by whoever is on shift, and a control that
 * has to be tapped an unknown number of times to reach a known state is worse
 * than three that each say what they do. Three 36px buttons cost less header
 * room than the tooltip explaining a cycle would.
 *
 * "Avto" follows the OS, and is the default — a counter runs from morning to
 * night and the screen should not still be at midday brightness at closing
 * time unless someone decided it should be.
 *
 * The preference is global (`mc:theme-pref`), so choosing here changes the
 * whole app rather than only this screen. That is deliberate: a cashier who
 * dims the till does not want the client profile drawer coming back bright.
 */

import { Monitor, Moon, Sun } from 'lucide-react';

import { useAppTheme } from '@/hooks/useAppTheme';
import { setThemePreference, type ThemePreference } from '@/lib/theme';
import { triggerSoftHaptic } from '@/utils/haptics';

const OPTIONS: {
  value: ThemePreference;
  label: string;
  Icon: typeof Monitor;
}[] = [
  { value: 'system', label: 'Avto', Icon: Monitor },
  { value: 'light', label: 'Yorug‘', Icon: Sun },
  { value: 'dark', label: 'Qorong‘i', Icon: Moon },
];

export function ThemeChoice() {
  const { preference } = useAppTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Ko‘rinish rejimi"
      className="flex h-9 items-center gap-0.5 rounded-mc-sm border border-mc-border bg-mc-surface-2 p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => {
              triggerSoftHaptic();
              setThemePreference(value);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-[7px] transition-colors ${
              isActive
                ? 'bg-mc-brand text-mc-on-brand'
                : 'text-mc-text-2 hover:bg-mc-surface'
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
