import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sun, Moon, Monitor, LayoutDashboard
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
const LanguageToggle = ({ isDark }: { isDark: boolean }) => {
  const { i18n } = useTranslation();

  const wrapStyle: React.CSSProperties = isDark
    ? {
      backgroundColor: "rgba(10,14,21,0.78)",
      borderColor: "rgba(251,146,60,0.18)",
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
              backgroundColor: "rgba(255,138,31,0.18)",
              color: "#fed7aa",
              boxShadow: "0 0 0 1px rgba(251,146,60,0.24)",
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
      backgroundColor: "rgba(10,14,21,0.78)",
      borderColor: "rgba(251,146,60,0.18)",
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
              backgroundColor: "rgba(255,138,31,0.18)",
              color: "#fed7aa",
              boxShadow: "0 0 0 1px rgba(251,146,60,0.24)",
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NavigationBar(_props: NavigationBarProps) {
  useTranslation();
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

  // ─── Inline style for scrolled dark bg ──────────────────────────────────
  const navInlineStyle: React.CSSProperties = isScrolled && isDark
    ? {
      backgroundColor: "rgba(6,8,13,0.80)",
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
            "dark:border-orange-200/10 dark:shadow-[0_1px_0_rgba(251,146,60,0.08)]",
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
                  : "text-gray-500 dark:text-orange-200/55"
              )}>
                Foydalanuvchi tizimi
              </span>
            </div>
          </div>

          {/* ── RIGHT SIDE ── */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Togglelar — isDark prop to'g'ridan-to'g'ri uzatiladi */}
            <NavbarThemeToggle isDark={isDark} />
            <LanguageToggle isDark={isDark} />

          </div>
        </div>
      </div>
    </nav>
  );
}
