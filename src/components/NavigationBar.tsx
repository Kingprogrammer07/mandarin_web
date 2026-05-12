import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sun, Moon, 
  // LayoutDashboard, 
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationBarProps {
  onStatisticsClick?: () => void;
  onVerificationClick?: () => void;
  currentPage?: string;
}
// onStatisticsClick and onVerificationClick are kept for backwards-compatible prop passing
// but the buttons are no longer rendered — statistics moved to AdminLayout sidebar


// ─── LANGUAGE TOGGLE ────────────────────────────────────────────────────────
const LanguageMenu = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const activeLanguage = i18n.language?.startsWith('ru') ? 'ru' : 'uz';
  const languages = [
    { code: 'uz', label: 'UZ' },
    { code: 'ru', label: 'RU' },
  ] as const;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "grid h-10 w-10 place-items-center rounded-[15px] border transition-all duration-200 max-[360px]:h-9 max-[360px]:w-9",
          isOpen
            ? "border-orange-300/40 bg-orange-100/85 text-orange-600 dark:border-orange-300/24 dark:bg-orange-300/[0.13] dark:text-amber-300"
            : "border-gray-200/80 bg-white/70 text-gray-600 hover:border-orange-200 hover:bg-orange-50 dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-white/64 dark:hover:border-orange-300/20 dark:hover:bg-orange-300/[0.09]"
        )}
        aria-label="Tilni tanlash"
        aria-expanded={isOpen}
      >
        <Globe className="h-5 w-5 max-[360px]:h-4 max-[360px]:w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-[132px] overflow-hidden rounded-[1.15rem] border border-gray-100 bg-white/96 p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.15)] backdrop-blur-2xl dark:border-white/[0.075] dark:bg-[#080b11]/96 dark:shadow-[0_24px_58px_rgba(0,0,0,0.54)]">
          {languages.map((language) => {
            const isActive = activeLanguage === language.code;

            return (
              <button
                key={language.code}
                type="button"
                onClick={() => {
                  i18n.changeLanguage(language.code);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-[0.85rem] px-3 py-2 text-left text-xs font-black transition-all duration-200",
                  isActive
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-300/[0.13] dark:text-amber-200"
                    : "text-gray-500 hover:bg-gray-50 dark:text-white/50 dark:hover:bg-white/[0.055]"
                )}
              >
                <span>{language.label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-amber-300" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── THEME TOGGLE ───────────────────────────────────────────────────────────
const NavbarThemeToggle = ({ isDark }: { isDark: boolean }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    localStorage.setItem('theme', theme);
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-[15px] border transition-all duration-200 max-[360px]:h-9 max-[360px]:w-9",
        isDark
          ? "border-white/[0.085] bg-white/[0.055] text-amber-200 hover:border-orange-300/22 hover:bg-orange-300/[0.09]"
          : "border-gray-200/80 bg-white/70 text-gray-600 hover:border-orange-200 hover:bg-orange-50"
      )}
      aria-label={nextTheme === 'light' ? 'Light mode' : 'Dark mode'}
      title={nextTheme === 'light' ? 'Light mode' : 'Dark mode'}
    >
      <Icon className="h-5 w-5 max-[360px]:h-4 max-[360px]:w-4" />
    </button>
  );
};

// ─── MAIN NAVBAR ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NavigationBar(_props: NavigationBarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Dark mode watcher
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const useLightText = isDark;

  // ─── Inline style for scrolled dark bg ──────────────────────────────────
  const panelStyle: React.CSSProperties = isDark
    ? {
      background: "linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025)), rgba(10,14,21,0.84)",
      borderColor: "rgba(245,158,11,0.16)",
      boxShadow: isScrolled
        ? "0 18px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)"
        : "0 16px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)",
      backdropFilter: "blur(22px)",
      WebkitBackdropFilter: "blur(22px)",
    }
    : {
      background: "rgba(255,255,255,0.88)",
      borderColor: "rgba(251,146,60,0.22)",
      boxShadow: isScrolled
        ? "0 16px 34px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.8)"
        : "0 12px 28px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
    };

  return (
    <nav
      className="fixed left-0 right-0 top-3 z-50 px-3 transition-all duration-300 max-[360px]:px-2 sm:px-4"
    >
      <div
        className="mx-auto max-w-4xl rounded-[22px] border px-2.5 py-2 transition-all duration-300 max-[360px]:rounded-[19px] max-[360px]:px-2 max-[360px]:py-1.5 sm:px-3"
        style={panelStyle}
      >
        <div className="flex min-h-[42px] items-center justify-between gap-3 max-[360px]:min-h-[38px] max-[360px]:gap-2">

          {/* ── LOGO ── */}
          <div className="flex min-w-0 shrink items-center gap-2.5 max-[360px]:gap-2">
            {/* <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-amber-300 to-orange-500 text-orange-950 shadow-[0_12px_26px_rgba(245,158,11,0.22),inset_0_1px_0_rgba(255,255,255,0.35)] max-[360px]:h-8 max-[360px]:w-8 max-[360px]:rounded-[13px] sm:h-10 sm:w-10"> */}
              {/* <LayoutDashboard className="h-5 w-5 max-[360px]:h-4 max-[360px]:w-4" /> */}
            {/* </div> */}
            <div className="flex shrink-0 items-center justify-center">
              <img src="/mandarin.png" alt="Mandarin Cargo" className="h-[32px] w-[32px] object-contain" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className={cn(
                "truncate text-sm font-black leading-tight tracking-normal transition-colors duration-300 max-[360px]:text-[12px] sm:text-base",
                useLightText
                  ? "text-white"
                  : "text-gray-900 dark:text-white"
              )}>
                Mandarin Cargo
              </span>
              <span className={cn(
                "truncate text-[8px] font-extrabold uppercase tracking-[0.08em] transition-colors duration-300 max-[360px]:hidden sm:text-[9px]",
                useLightText
                  ? "text-white/70"
                  : "text-gray-500 dark:text-orange-200/55"
              )}>
                Foydalanuvchi tizimi
              </span>
            </div>
          </div>

          {/* ── RIGHT SIDE ── */}
          <div className="flex shrink-0 items-center gap-1.5 max-[360px]:gap-1">
            <NavbarThemeToggle isDark={isDark} />
            <LanguageMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
