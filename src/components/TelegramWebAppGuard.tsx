import { useEffect, useState } from 'react';
import { AlertCircle, Package, MapPin, Truck } from 'lucide-react';
import { getTelegramWebAppData, validateInitData } from '@/api/services/auth';

interface TelegramWebAppGuardProps {
  children: React.ReactNode;
}

const STYLES = `
  @keyframes truck-move {
    0%   { transform: translateX(-110%); }
    100% { transform: translateX(110%); }
  }
  @keyframes road-scroll {
    0%   { background-position: 0 0; }
    100% { background-position: 60px 0; }
  }
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
    40%           { transform: translateY(-8px); opacity: 1;   }
  }
  @keyframes fade-in-up {
    0%   { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0);    }
  }
  @keyframes progress-bar {
    0%   { width: 0%;  }
    40%  { width: 60%; }
    70%  { width: 80%; }
    100% { width: 95%; }
  }
  @keyframes pkg-float {
    0%, 100% { transform: translateY(0px);  }
    50%      { transform: translateY(-6px); }
  }

  .truck-animate    { animation: truck-move   2.4s cubic-bezier(.45,0,.55,1) infinite; }
  .road-animate     { animation: road-scroll  0.5s linear infinite; }
  .progress-animate { animation: progress-bar 2.8s ease-out forwards; }
  .fade-in-up       { animation: fade-in-up   0.6s ease-out both; }
  .pkg-float        { animation: pkg-float    2.8s ease-in-out infinite; }
  .dot-1 { animation: dot-bounce 1.4s ease-in-out infinite 0.0s; }
  .dot-2 { animation: dot-bounce 1.4s ease-in-out infinite 0.2s; }
  .dot-3 { animation: dot-bounce 1.4s ease-in-out infinite 0.4s; }
`;

/* ─────────────── LOADING SCREEN ─────────────── */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] px-4">
      <style>{STYLES}</style>

      <div className="fade-in-up w-full max-w-sm bg-white dark:bg-[#111111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-xl dark:shadow-black/40 overflow-hidden">

        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />

        <div className="p-8">

          {/* Floating package icon */}
          <div className="flex justify-center mb-6">
            <div className="pkg-float relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Package className="w-8 h-8 text-white" />
              </div>
              <span className="absolute inset-0 rounded-2xl bg-orange-500/20 animate-ping" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-7">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
              Tizim yuklanmoqda
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Kargo ma'lumotlari tekshirilmoqda...
            </p>
          </div>

          {/* Truck track */}
          <div className="relative mb-5">
            {/* Scrolling road */}
            <div
              className="road-animate h-[3px] w-full rounded-full"
              style={{
                background: 'repeating-linear-gradient(90deg, rgb(249 115 22 / 0.15) 0px, rgb(249 115 22 / 0.15) 20px, transparent 20px, transparent 40px)',
                backgroundSize: '60px 3px',
              }}
            />

            {/* Moving truck */}
            <div className="truck-animate absolute -top-[13px] left-0">
              <div className="bg-white dark:bg-[#111111] px-0.5 rounded">
                <Truck className="w-5 h-5 text-orange-500" strokeWidth={2} />
              </div>
            </div>

            {/* Route stops */}
            <div className="flex justify-between mt-2.5 px-0.5">
              {['A', 'B', 'C', 'D'].map((stop) => (
                <div key={stop} className="flex flex-col items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-gray-300 dark:text-white/20" />
                  <span className="text-[10px] text-gray-300 dark:text-white/20 font-mono">{stop}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden mb-5">
            <div className="progress-animate h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" />
          </div>

          {/* Bouncing dots */}
          <div className="flex items-center justify-center gap-2">
            <span className="dot-1 w-2 h-2 rounded-full bg-orange-400 inline-block" />
            <span className="dot-2 w-2 h-2 rounded-full bg-orange-500 inline-block" />
            <span className="dot-3 w-2 h-2 rounded-full bg-amber-400 inline-block" />
          </div>

        </div>
      </div>

      <p className="fade-in-up mt-5 text-xs text-gray-300 dark:text-white/20 tracking-widest uppercase font-medium"
        style={{ animationDelay: '0.3s' }}>
        Mandarin Cargo System
      </p>
    </div>
  );
}

/* ─────────────── ERROR SCREEN ─────────────── */
function ErrorScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] px-4">
      <style>{STYLES}</style>

      <div className="fade-in-up w-full max-w-sm bg-white dark:bg-[#111111] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-xl dark:shadow-black/40 overflow-hidden">

        {/* Top accent — red for error */}
        <div className="h-1 bg-gradient-to-r from-red-400 via-red-500 to-orange-400" />

        <div className="p-8 text-center">

          {/* Icon */}
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

          {/* Tip */}
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

      <p className="fade-in-up mt-5 text-xs text-gray-300 dark:text-white/20 tracking-widest uppercase font-medium"
        style={{ animationDelay: '0.3s' }}>
        Mandarin Cargo System
      </p>
    </div>
  );
}

/* ─────────────── MAIN GUARD (logika o'zgarmaган) ─────────────── */
export default function TelegramWebAppGuard({ children }: TelegramWebAppGuardProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // Telegram WebApp SDK yuklanishini kutish
    const checkTelegramWebApp = async () => {
      try {
        // Telegram WebApp ma'lumotlarini tekshirish
        const telegramData = getTelegramWebAppData();
        const validateResponse = await validateInitData({
          init_data: telegramData?.initData || '',
        });

        if (!telegramData || !telegramData.user || !validateResponse.valid) {
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        // Telegram WebApp ready signal
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        }

        setIsValid(true);
        setIsValidating(false);
      } catch (error) {
        console.error('Telegram WebApp validation error:', error);
        setIsValid(false);
        setIsValidating(false);
      }
    };

    // SDK yuklanishi uchun biroz kutish
    const timer = setTimeout(checkTelegramWebApp, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isValidating) return <LoadingScreen />;
  if (!isValid)     return <ErrorScreen />;
  return <>{children}</>;
}