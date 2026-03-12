import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, UserCheck,
  Sun, Moon, Monitor, LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationBarProps {
  onStatisticsClick?: () => void;
  onVerificationClick?: () => void;
  currentPage?: string;
}


// ─── LANGUAGE TOGGLE ────────────────────────────────────────────────────────
const LanguageToggle = ({ isDark }: { isDark: boolean }) => {
  const { i18n } = useTranslation();

  const wrapStyle: React.CSSProperties = isDark
    ? {
      backgroundColor: "rgba(22,15,5,0.72)",
      borderColor: "rgba(180,83,9,0.35)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    }
    : {
      backgroundColor: "rgba(255,255,255,0.75)",
      borderColor: "rgba(0,0,0,0.09)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    };

  return (
    <div
      className="flex items-center p-1 rounded-full border transition-all duration-300 shadow-sm"
      style={wrapStyle}
    >
      {['uz', 'ru'].map((lang) => {
        const isActive = i18n.language === lang;

        const btnStyle: React.CSSProperties = isActive
          ? isDark
            ? {
              backgroundColor: "rgba(245,158,11,0.18)",
              color: "#fcd34d",
              boxShadow: "0 0 0 1px rgba(245,158,11,0.25)",
            }
            : {
              backgroundColor: "#ffffff",
              color: "#ea580c",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }
          : {
            backgroundColor: "transparent",
            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(100,100,100,0.8)",
          };

        return (
          <button
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            className="px-2.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 border-none cursor-pointer"
            style={btnStyle}
          >
            {lang.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};

// ─── THEME TOGGLE ───────────────────────────────────────────────────────────
const NavbarThemeToggle = ({ isDark }: { isDark: boolean }) => {
  /* 
   * Initialize state from localStorage if available, otherwise default to 'system'.
   * This ensures the user's preference is remembered across reloads.
   */
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return (saved as 'light' | 'dark' | 'system') || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // 1. Save preference to localStorage whenever it changes
    localStorage.setItem('theme', theme);

    // 2. Function to apply the theme
    const applyTheme = () => {
      // Remove any existing manual overrides
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        // If system, check OS preference
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        // Otherwise use the explicit preference
        root.classList.add(theme);
      }
    };

    applyTheme();

    // 3. Listener for System Theme Changes
    // If the user selects 'system', we want to react if their OS mode changes live.
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = () => applyTheme();

      // Modern event listener
      mediaQuery.addEventListener('change', handleChange);

      // Cleanup
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

  }, [theme]);

  const items = [
    { id: 'light', icon: Sun },
    { id: 'system', icon: Monitor },
    { id: 'dark', icon: Moon },
  ] as const;

  const wrapStyle: React.CSSProperties = isDark
    ? {
      backgroundColor: "rgba(22,15,5,0.72)",
      borderColor: "rgba(180,83,9,0.35)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    }
    : {
      backgroundColor: "rgba(255,255,255,0.75)",
      borderColor: "rgba(0,0,0,0.09)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    };

  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-full border transition-all duration-300 shadow-sm"
      style={wrapStyle}
    >
      {items.map((item) => {
        const isActive = theme === item.id;

        const btnStyle: React.CSSProperties = isActive
          ? isDark
            ? {
              backgroundColor: "rgba(245,158,11,0.18)",
              color: "#fcd34d",       // amber-300 — yaxshi ko'rinadi
              boxShadow: "0 0 0 1px rgba(245,158,11,0.25)",
            }
            : {
              backgroundColor: "#ffffff",
              color: "#f59e0b",       // amber-500
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }
          : {
            backgroundColor: "transparent",
            color: isDark ? "rgba(255,255,255,0.30)" : "rgba(120,120,120,0.9)",
          };

        return (
          <button
            key={item.id}
            onClick={() => setTheme(item.id)}
            className="p-1.5 rounded-full transition-all duration-200 border-none cursor-pointer hover:opacity-80"
            style={btnStyle}
          >
            <item.icon size={14} />
          </button>
        );
      })}
    </div>
  );
};

// ─── MAIN NAVBAR ────────────────────────────────────────────────────────────
export default function NavigationBar({ onStatisticsClick, onVerificationClick, currentPage }: NavigationBarProps) {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const isProfilePage = window.location.pathname === '/user/profile';

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

  const forceLight = !isScrolled && (isProfilePage || isDark);
  const HIDDEN_PAGES = ['login', 'register', 'user-profile', 'user-home', 'user-home', 'user-reports', 'user-history'];
  const is_show_statistics = !HIDDEN_PAGES.includes(currentPage ?? '');

  // ─── Inline style for scrolled dark bg ──────────────────────────────────
  // rgba(13,10,4,0.78) — Dashboard #0d0a04 bilan bir xil tona, biroz transparent
  const navInlineStyle: React.CSSProperties = isScrolled && isDark
    ? {
      backgroundColor: "rgba(13,10,4,0.78)",
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
    }
    : {};

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isScrolled
          ? [
            "py-3 shadow-sm border-gray-200/50",
            "bg-white/80 backdrop-blur-xl",
            "dark:border-amber-900/20 dark:shadow-[0_1px_0_rgba(245,158,11,0.07)]",
          ].join(" ")
          : "bg-transparent border-transparent py-4"
      )}
      style={navInlineStyle}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">

          {/* ── LOGO ── */}
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center
              bg-gradient-to-br from-orange-500 to-amber-500 text-white
              shadow-lg shadow-orange-500/25 shrink-0">
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className={cn(
                "font-bold leading-tight tracking-tight transition-colors duration-300 truncate text-base sm:text-lg",
                forceLight
                  ? `text-white ${isProfilePage ? "md:text-black dark:text-white" : "md:text-white dark:text-white"}`
                  : "text-gray-900 dark:text-white"
              )}>
                Mandarin Cargo
              </span>
              <span className={cn(
                "font-bold uppercase tracking-widest transition-colors duration-300 truncate text-[8px] sm:text-[10px]",
                forceLight
                  ? "text-white/70 md:text-black/70 dark:text-white/70"
                  : "text-gray-500 dark:text-amber-400/60"
              )}>
                Foydalanuvchi tizimi
              </span>
            </div>
          </div>

          {/* ── RIGHT SIDE ── */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Stats/Verification — faqat desktop */}
            {is_show_statistics && (
              <div className="hidden md:flex items-center gap-2">
                {onVerificationClick && (
                  <button
                    onClick={onVerificationClick}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer",
                      "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-orange-600",
                      "dark:border-amber-900/30 dark:text-white/70 dark:hover:text-amber-300 dark:hover:border-amber-500/40",
                    )}
                    style={isDark ? { backgroundColor: "rgba(22,15,5,0.70)" } : {}}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{t('navigation.verification', 'Tekshirish')}</span>
                  </button>
                )}
                {onStatisticsClick && (
                  <button
                    onClick={onStatisticsClick}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer",
                      "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-orange-600",
                      "dark:border-amber-900/30 dark:text-white/70 dark:hover:text-amber-300 dark:hover:border-amber-500/40",
                    )}
                    style={isDark ? { backgroundColor: "rgba(22,15,5,0.70)" } : {}}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{t('navigation.statistics', 'Statistika')}</span>
                  </button>
                )}
                <div className="h-8 w-px bg-gray-200 dark:bg-amber-900/40 mx-1" />
              </div>
            )}


            {/* Togglelar — isDark prop to'g'ridan-to'g'ri uzatiladi */}
            <NavbarThemeToggle isDark={isDark} />
            <LanguageToggle isDark={isDark} />

          </div>
        </div>
      </div>
    </nav>
  );
}