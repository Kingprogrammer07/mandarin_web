import type { ReactNode } from 'react';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { triggerSoftHaptic } from '@/utils/haptics';

const LANGUAGES = [
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
] as const;

interface HomeHeaderProps {
  /**
   * The notification bell, supplied by the container.
   *
   * `NotificationCenter` takes no props — it owns its open state AND renders
   * its own trigger — so the header cannot drive it from the outside. A second
   * bell here looked right and did nothing, while the real one rendered
   * wherever the component happened to be mounted in the page flow.
   */
  notificationSlot?: ReactNode;
}

/**
 * Logo, language switch and notification bell.
 *
 * The language switch used to live in the top `NavigationBar`, which client
 * pages no longer render — without moving it here a user would have no way to
 * change language at all.
 */
export function HomeHeader({ notificationSlot }: HomeHeaderProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggle: toggleTheme } = useAppTheme();
  const current = i18n.language?.startsWith('ru') ? 'ru' : 'uz';
  const isDark = theme === 'dark';

  const switchTheme = () => {
    triggerSoftHaptic();
    toggleTheme();
  };

  const cycleLanguage = () => {
    triggerSoftHaptic();
    const next = current === 'uz' ? 'ru' : 'uz';
    void i18n.changeLanguage(next);
  };

  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-2.5">
      <div className="flex items-center gap-2.5">
        <img
          src="/mandarin.png"
          alt="Mandarin Cargo"
          className="h-7 w-7 shrink-0 object-contain"
          width={28}
          height={28}
        />
        <span className="text-[11px] font-extrabold leading-[1.15] tracking-tight text-mc-text">
          MANDARIN
          <br />
          CARGO
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={switchTheme}
          className="flex h-10 w-10 items-center justify-center rounded-mc-sm bg-mc-surface-2
                     text-mc-text-2 transition-colors duration-150"
          // Names the destination, not the current state: a screen-reader user
          // hears what the button will do, which is the only thing they can act on.
          aria-label={
            isDark
              ? t('header.themeLight', "Yorug' rejimga o'tish")
              : t('header.themeDark', "Qorong'i rejimga o'tish")
          }
        >
          {isDark ? (
            <Sun className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <Moon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={cycleLanguage}
          className="flex h-10 items-center gap-0.5 rounded-mc-sm bg-mc-surface-2
                     px-2.5 text-[12px] font-bold text-mc-text
                     transition-colors duration-150 active:bg-mc-surface-2"
          aria-label={t('header.changeLanguage', "Tilni o'zgartirish")}
        >
          {LANGUAGES.find((l) => l.code === current)?.label}
          <ChevronDown className="h-3.5 w-3.5 text-mc-text-2" aria-hidden="true" />
        </button>

        {notificationSlot}
      </div>
    </header>
  );
}
