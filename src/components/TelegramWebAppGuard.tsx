import { useEffect, useState } from 'react';
import { AlertCircle, Package } from 'lucide-react';
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
  @keyframes progress-bar {
    0%   { width: 0%;  }
    40%  { width: 60%; }
    70%  { width: 80%; }
    100% { width: 95%; }
  }
  .fade-in-up       { animation: fade-in-up   0.5s ease-out both;    }
  .progress-animate { animation: progress-bar 2.8s ease-out forwards; }
`;

/* ─────────────── LOADING SCREEN ─────────────── */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
      <style>{STYLES}</style>
      <TopProgressBar />

      <div className="fade-in-up flex flex-col items-center gap-6">
        {/* Brand mark */}
        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
          <span className="text-white text-xl font-black select-none">M</span>
        </div>

        {/* Brand text */}
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-gray-800 dark:text-white tracking-wide">
            Mandarin Cargo
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 tracking-[0.2em] uppercase">
            System
          </p>
        </div>

        {/* Determinate progress bar — fills over ~2.8s */}
        <div className="w-48 h-[3px] bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <div className="progress-animate h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" />
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

  useEffect(() => {
    if (isBrowserRoute) {
      return;
    }

    const checkTelegramWebApp = async () => {
      try {
        const telegramData = getTelegramWebAppData();
        const validateResponse = await validateInitData({
          init_data: telegramData?.initData || '',
        });

        if (!telegramData || !telegramData.user || !validateResponse.valid) {
          setIsValid(false);
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
        setIsValidating(false);
      } catch (error) {
        console.error('Telegram WebApp validation error:', error);
        setIsValid(false);
        setIsValidating(false);
      }
    };

    // Artificial 500ms delay disabled: it made every Telegram launch wait even
    // when initData validation could start immediately.
    void checkTelegramWebApp();
  }, [isBrowserRoute]);

  if (isValidating) return <LoadingScreen />;
  if (!isValid)     return <ErrorScreen />;
  return <>{children}</>;
}
