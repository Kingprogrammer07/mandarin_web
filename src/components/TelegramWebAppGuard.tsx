import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Package, WifiOff, RefreshCw } from 'lucide-react';
import { getTelegramWebAppData, validateInitData, telegramAutoLogin } from '@/api/services/auth';
import { TopProgressBar } from '@/components/ui/TopProgressBar';

interface TelegramWebAppGuardProps {
  children: React.ReactNode;
}

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafc] px-4 dark:bg-[#06080d]">
      <style>{STYLES}</style>
      <TopProgressBar />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.18),rgba(249,115,22,0.07)_38%,transparent_72%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,138,31,0.20),rgba(249,115,22,0.08)_38%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent dark:via-orange-200/55" />

      <div className="fade-in-up relative w-full max-w-[330px] overflow-hidden rounded-[30px] border border-orange-500/16 bg-white/82 p-5 text-center shadow-[0_24px_60px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[18px] dark:border-white/[0.09] dark:bg-[#0a0e15]/84 dark:shadow-[0_26px_70px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07)]">
        <div className="pointer-events-none absolute -right-16 -top-14 h-36 w-64 rotate-[-14deg] rounded-[42%] bg-[linear-gradient(90deg,rgba(245,158,11,0.18),rgba(59,130,246,0.08),transparent_72%)] blur-[18px]" />
        {/* Brand mark */}
        <div className="guard-mark-pulse relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-orange-500/20 bg-gradient-to-br from-orange-400 to-orange-600 text-white dark:border-amber-200/15">
          <span className="select-none text-[24px] font-black leading-none">M</span>
        </div>

        {/* Brand text */}
        <div className="relative">
          <p className="text-[15px] font-black tracking-normal text-gray-950 dark:text-[#fff8ed]">
            Mandarin Cargo
          </p>
          <p className="mt-1 min-h-[18px] text-[12px] font-bold leading-snug text-gray-500 dark:text-[#fff8ed]/58">
            {t(messageIndex === 0 ? 'telegramGuard.loading.telegram' : 'telegramGuard.loading.app')}
          </p>
        </div>

        {/* Determinate progress bar — fills over ~2.8s */}
        <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-gray-950/7 dark:bg-white/8">
          <div className="progress-animate h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── ERROR SCREEN ─────────────── */
function ErrorScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] px-4">
      <style>{STYLES}</style>

      <div className="fade-in-up w-full max-w-sm bg-white dark:bg-[#111111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-xl dark:shadow-black/40 overflow-hidden">

        <div className="h-1 bg-gradient-to-r from-red-400 via-red-500 to-orange-400" />

        <div className="p-8 text-center">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>

          <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            Kirish rad etildi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
            Bu sahifa faqat Telegram bot orqali ochilishi kerak.
            Iltimos, botimizdan foydalanib sahifani qayta oching.
          </p>

          <div className="h-px w-full bg-gray-100 dark:bg-white/[0.06] mb-6" />

          <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-500/[0.08] border border-orange-100 dark:border-orange-500/15 rounded-2xl p-4 text-left">
            <div className="shrink-0 w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center mt-0.5">
              <Package className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-0.5">
                Maslahat
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-300/70 leading-relaxed">
                Telegram botda buyruqlarni ishlating yoki menyudan kerakli bo'limni tanlang.
              </p>
            </div>
          </div>

        </div>
      </div>

      <p
        className="fade-in-up mt-5 text-xs text-gray-300 dark:text-white/20 tracking-widest uppercase font-medium"
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] px-4">
      <style>{STYLES}</style>

      <div className="fade-in-up w-full max-w-sm bg-white dark:bg-[#111111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-xl dark:shadow-black/40 overflow-hidden">

        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500" />

        <div className="p-8 text-center">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 mb-6">
            <WifiOff className="w-8 h-8 text-amber-500" />
          </div>

          <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            Ulanish xatosi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
            Serverga ulanib bo'lmadi. Internet aloqangizni tekshirib, qayta urinib ko'ring.
          </p>

          <button
            onClick={onRetry}
            disabled={retrying}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Ulanmoqda...' : 'Qayta urinish'}
          </button>

        </div>
      </div>

      <p
        className="fade-in-up mt-5 text-xs text-gray-300 dark:text-white/20 tracking-widest uppercase font-medium"
        style={{ animationDelay: '0.3s' }}
      >
        Mandarin Cargo System
      </p>
    </div>
  );
}

/* ─────────────── MAIN GUARD ─────────────── */
export default function TelegramWebAppGuard({ children }: TelegramWebAppGuardProps) {
  const isBrowserRoute =
    window.location.pathname.startsWith('/admin') ||
    window.location.pathname === '/pos' ||
    window.location.pathname.startsWith('/flights') ||
    window.location.pathname.startsWith('/statistics') ||
    window.location.pathname === '/pickup-tv';

  const [isValidating, setIsValidating] = useState(!isBrowserRoute);
  const [isValid, setIsValid] = useState(isBrowserRoute);
  const [isNetworkFailure, setIsNetworkFailure] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const checkTelegramWebApp = useCallback(async () => {
    if (isBrowserRoute) return;

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
  }, [isBrowserRoute]);

  useEffect(() => {
    void checkTelegramWebApp();
  }, [checkTelegramWebApp]);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    setIsNetworkFailure(false);
    setIsValidating(true);
    void checkTelegramWebApp();
  }, [checkTelegramWebApp]);

  if (isValidating) return <LoadingScreen />;
  if (isNetworkFailure) return <NetworkErrorScreen onRetry={handleRetry} retrying={retrying} />;
  if (!isValid) return <ErrorScreen />;
  return <>{children}</>;
}
