import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Package, WifiOff, RefreshCw } from 'lucide-react';
import { getTelegramWebAppData, validateInitData, telegramAutoLogin } from '@/api/services/auth';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { isStaffPath } from '@/lib/session';

interface TelegramWebAppGuardProps {
  children: React.ReactNode;
}

// Public marketing site. Only the root path opened OUTSIDE Telegram is bounced
// here — every real surface (/auth/login, /admin/*, /payment/nbu/*, the Mini
// App itself) is untouched.
const MARKETING_SITE_URL = 'https://mandarincargo.uz';

const STYLES = `
  @keyframes fade-in-up {
    0%   { opacity: 0; transform: translateY(12px); }
    100% { opacity: 1; transform: translateY(0);    }
  }
  @keyframes guard-mark-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 18px 36px rgba(249,115,22,.18); }
    50% { transform: scale(1.035); box-shadow: 0 22px 44px rgba(249,115,22,.25); }
  }
  @keyframes progress-bar {
    0%   { width: 0%;  }
    40%  { width: 60%; }
    70%  { width: 80%; }
    100% { width: 95%; }
  }
  .fade-in-up       { animation: fade-in-up   0.5s ease-out both;    }
  .guard-mark-pulse { animation: guard-mark-pulse 1.9s ease-in-out infinite; }
  .progress-animate { animation: progress-bar 2.8s ease-out forwards; }

  /* A loading screen is the worst place to ignore this setting: it is the one
     screen a reader cannot navigate away from while it animates. */
  @media (prefers-reduced-motion: reduce) {
    .fade-in-up, .guard-mark-pulse, .progress-animate { animation: none; }
    .progress-animate { width: 95%; }
  }
`;

/* ─────────────── LOADING SCREEN ─────────────── */
function LoadingScreen() {
  const { t } = useTranslation();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % 2);
    }, 1500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-mc-bg px-4">
      <style>{STYLES}</style>
      <TopProgressBar />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mc-brand/40 to-transparent" />

      <div className="fade-in-up relative w-full max-w-[330px] overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface p-5 text-center shadow-[var(--mc-shadow-card)]">
        {/* Brand mark. `fetchPriority="high"` and the matching preload in
            index.html start this request during HTML parse instead of after
            the React bundle has evaluated — on a slow connection that was the
            difference between the splash showing the brand and showing a hole.
            The file itself went from 238 kB to 40 kB in the same change.
            Dimensions are declared so the card never reflows around it. */}
        <div className="relative mx-auto mb-4 grid h-20 w-20 place-items-center">
          <img
            src="/mandarin.png"
            alt=""
            aria-hidden="true"
            width={72}
            height={72}
            fetchPriority="high"
            decoding="async"
            className="h-18 w-18 object-contain"
          />
        </div>
        {/* Brand text */}
        <div className="relative">
          <p className="text-[15px] font-extrabold tracking-normal text-mc-text">
            Mandarin Cargo
          </p>
          <p className="mt-1 min-h-[18px] text-[12px] font-bold leading-snug text-mc-text-2">
            {t(messageIndex === 0 ? 'telegramGuard.loading.telegram' : 'telegramGuard.loading.app')}
          </p>
        </div>

        {/* Determinate progress bar — fills over ~2.8s */}
        <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-mc-text/5 dark:bg-white/8">
          <div className="progress-animate h-full rounded-full bg-gradient-to-r from-mc-brand to-mc-brand-strong" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── ERROR SCREEN ─────────────── */
function ErrorScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-mc-surface-2 px-4">
      <style>{STYLES}</style>

      <div className="fade-in-up w-full max-w-sm bg-mc-surface rounded-mc-lg border border-mc-border shadow-xl overflow-hidden">

        <div className="h-1 bg-gradient-to-r from-mc-danger via-mc-danger to-mc-brand" />

        <div className="p-8 text-center">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-mc-lg bg-mc-danger-soft border border-mc-danger/25 dark:border-mc-danger/20 mb-6">
            <AlertCircle className="w-8 h-8 text-mc-danger" />
          </div>

          <h1 className="text-xl font-bold text-mc-text mb-2">
            Kirish rad etildi
          </h1>
          <p className="text-sm text-mc-text-2 leading-relaxed mb-7">
            Bu sahifa faqat Telegram bot orqali ochilishi kerak.
            Iltimos, botimizdan foydalanib sahifani qayta oching.
          </p>

          <div className="h-px w-full bg-mc-surface-2 mb-6" />

          <div className="flex items-start gap-3 bg-mc-brand-soft dark:bg-mc-brand/[0.08] border border-mc-brand/20 dark:border-mc-brand/15 rounded-mc-lg p-4 text-left">
            <div className="shrink-0 w-7 h-7 rounded-mc-sm bg-mc-brand-soft flex items-center justify-center mt-0.5">
              <Package className="w-3.5 h-3.5 text-mc-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold text-mc-brand mb-0.5">
                Maslahat
              </p>
              <p className="text-xs text-mc-brand dark:text-mc-brand leading-relaxed">
                Telegram botda buyruqlarni ishlating yoki menyudan kerakli bo'limni tanlang.
              </p>
            </div>
          </div>

        </div>
      </div>

      <p
        className="fade-in-up mt-5 text-xs text-mc-text-3 dark:text-white/20 tracking-widest uppercase font-medium"
        style={{ animationDelay: '0.3s' }}
      >
        Mandarin Cargo System
      </p>
    </div>
  );
}

/* ─────────────── NETWORK ERROR SCREEN ─────────────── */
function NetworkErrorScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-mc-surface-2 px-4">
      <style>{STYLES}</style>

      <div className="fade-in-up w-full max-w-sm bg-mc-surface rounded-mc-lg border border-mc-border shadow-xl overflow-hidden">

        <div className="h-1 bg-gradient-to-r from-mc-brand via-mc-brand to-mc-brand-strong" />

        <div className="p-8 text-center">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-mc-lg bg-mc-warn-soft border border-mc-border dark:border-mc-brand/20 mb-6">
            <WifiOff className="w-8 h-8 text-mc-brand" />
          </div>

          <h1 className="text-xl font-bold text-mc-text mb-2">
            Ulanish xatosi
          </h1>
          <p className="text-sm text-mc-text-2 leading-relaxed mb-7">
            Serverga ulanib bo'lmadi. Internet aloqangizni tekshirib, qayta urinib ko'ring.
          </p>

          <button
            onClick={onRetry}
            disabled={retrying}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-mc-lg bg-mc-brand disabled:opacity-60 text-white font-semibold text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Ulanmoqda...' : 'Qayta urinish'}
          </button>

        </div>
      </div>

      <p
        className="fade-in-up mt-5 text-xs text-mc-text-3 dark:text-white/20 tracking-widest uppercase font-medium"
        style={{ animationDelay: '0.3s' }}
      >
        Mandarin Cargo System
      </p>
    </div>
  );
}

/* ─────────────── MAIN GUARD ─────────────── */
export default function TelegramWebAppGuard({ children }: TelegramWebAppGuardProps) {
  // Root path in a plain browser (no Telegram Mini App context) → marketing
  // site. The Mini App opens at root *inside* Telegram (initData present), so
  // that case is excluded and proceeds to the normal validation flow below.
  const shouldRedirectRoot =
    window.location.pathname === '/' && !window.Telegram?.WebApp?.initData;

  // Staff routes never go through Telegram validation. Note that most of them
  // do NOT live under `/admin` — a prefix test silently locks a cashier out of
  // `/kassa` and an operator out of `/import`, which is how `/import`,
  // `/client/add`, `/client/edit/:id` and the bare `/warehouse` alias came to
  // sit behind the Mini App guard while their `/admin/...` twins did not.
  const isBrowserRoute =
    isStaffPath(window.location.pathname) ||
    // Public routes: the pickup-queue display and the pages the bank returns to.
    window.location.pathname === '/pickup-tv' ||
    window.location.pathname.startsWith('/payment/nbu');

  const [isValidating, setIsValidating] = useState(!isBrowserRoute);
  const [isValid, setIsValid] = useState(isBrowserRoute);
  const [isNetworkFailure, setIsNetworkFailure] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const checkTelegramWebApp = useCallback(async () => {
    if (isBrowserRoute || shouldRedirectRoot) return;

    try {
      const telegramData = getTelegramWebAppData();
      const validateResponse = await validateInitData({
        init_data: telegramData?.initData || '',
      });

      if (!telegramData || !telegramData.user || !validateResponse.valid) {
        setIsValid(false);
        setIsNetworkFailure(false);
        setIsValidating(false);
        return;
      }

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }

      // Attempt auto-login if no token exists in either storage
      if (!sessionStorage.getItem('access_token') && !localStorage.getItem('access_token')) {
        try {
          const loginResponse = await telegramAutoLogin(telegramData.initData);
          if (loginResponse && loginResponse.access_token) {
            sessionStorage.setItem('access_token', loginResponse.access_token);
          }
        } catch {
          // Auto-login failed (e.g., user not registered -> 404, or pending -> 403).
          // We DO NOT fail the Telegram validation. We just let them proceed as an unauthenticated guest.
          console.log('Auto-login info: User not registered or pending approval.');
        }
      }

      setIsValid(true);
      setIsNetworkFailure(false);
      setIsValidating(false);
    } catch (error) {
      const e = error as Record<string, unknown>;
      const isTransient = e?.isNetworkError === true || e?.isTimeout === true;
      if (isTransient) {
        // Telegram cold-start / proxy issue — show retry screen, not "access denied"
        setIsNetworkFailure(true);
      } else {
        setIsValid(false);
      }
      setIsValidating(false);
      setRetrying(false);
    }
  }, [isBrowserRoute, shouldRedirectRoot]);

  useEffect(() => {
    if (shouldRedirectRoot) {
      // replace() so the marketing site isn't trapped behind a back-button loop
      window.location.replace(MARKETING_SITE_URL);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkTelegramWebApp();
  }, [checkTelegramWebApp, shouldRedirectRoot]);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    setIsNetworkFailure(false);
    setIsValidating(true);
    void checkTelegramWebApp();
  }, [checkTelegramWebApp]);

  // Redirecting root → marketing: show the loader during the brief navigation.
  if (shouldRedirectRoot) return <LoadingScreen />;
  if (isValidating) return <LoadingScreen />;
  if (isNetworkFailure) return <NetworkErrorScreen onRetry={handleRetry} retrying={retrying} />;
  if (!isValid) return <ErrorScreen />;
  return <>{children}</>;
}
