import { useEffect, useState } from 'react';
import { AlertCircle, Package } from 'lucide-react';
import { getTelegramWebAppData, validateInitData, telegramAutoLogin } from '@/api/services/auth';

interface TelegramWebAppGuardProps {
  children: React.ReactNode;
}

const STYLES = `
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
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
    40%           { transform: translateY(-8px); opacity: 1;   }
  }
  @keyframes pkg-float {
    0%, 100% { transform: translateY(0px);  }
    50%      { transform: translateY(-6px); }
  }
  @keyframes text-pulse {
    0%,100% { opacity: 1;   text-shadow: 0 0 6px rgba(249,115,22,.8), 0 0 18px rgba(249,115,22,.4); }
    50%     { opacity: .7;  text-shadow: 0 0 3px rgba(249,115,22,.5), 0 0 8px  rgba(249,115,22,.2); }
  }
  @keyframes line-scroll {
    0%   { background-position: 0 0;    }
    100% { background-position: 26px 0; }
  }
  @keyframes take-off {
    0%   { opacity: 0; transform: translate(-40px, 0)    rotate(0deg);   }
    10%  { opacity: 1;                                                    }
    25%  { transform: translate(0, 0)      rotate(0deg);   }
    30%  { transform: translate(8px, -1px)  rotate(-2deg);  }
    35%  { transform: translate(16px,-3px)  rotate(-4deg);  }
    40%  { opacity: 1; transform: translate(24px,-5px)  rotate(-7deg);  }
    45%  { transform: translate(32px,-8px)  rotate(-10deg); }
    50%  { opacity: 0; transform: translate(40px,-12px) rotate(-16deg); }
    100% { opacity: 0; transform: translate(40px,-12px) rotate(-16deg); }
  }
  @keyframes landing {
    0%   { opacity: 0; transform: translate(-40px,-12px) rotate(16deg);  }
    50%  { opacity: 0; transform: translate(-40px,-12px) rotate(16deg);  }
    55%  { transform: translate(-32px,-8px)  rotate(10deg);  }
    60%  { opacity: 1; transform: translate(-24px,-5px)  rotate(7deg);   }
    65%  { transform: translate(-16px,-3px)  rotate(4deg);   }
    70%  { transform: translate(-8px, -1px)  rotate(2deg);   }
    75%  { transform: translate(0, 0)        rotate(0deg);   }
    90%  { opacity: 1;                                                    }
    100% { opacity: 0; transform: translate(40px, 0)     rotate(0deg);   }
  }

  .fade-in-up       { animation: fade-in-up   0.6s ease-out both;              }
  .progress-animate { animation: progress-bar 2.8s ease-out forwards;          }
  .pkg-float        { animation: pkg-float    2.8s ease-in-out infinite;       }
  .dot-1 { animation: dot-bounce 1.4s ease-in-out infinite 0.0s; }
  .dot-2 { animation: dot-bounce 1.4s ease-in-out infinite 0.2s; }
  .dot-3 { animation: dot-bounce 1.4s ease-in-out infinite 0.4s; }

  .plane-takeoff {
    transform-origin: bottom center;
    animation: take-off 2s linear infinite;
  }
  .plane-landing {
    transform-origin: bottom center;
    animation: landing 2s linear infinite;
  }
  .brand-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #f97316;
    animation: text-pulse 2s ease-in-out infinite;
    white-space: nowrap;
  }
  .brand-sub {
    font-size: 8px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(249,115,22,.45);
    white-space: nowrap;
  }
  .flight-line {
    position: absolute;
    height: 1px;
    left: 0; right: 0;
    background: repeating-linear-gradient(
      90deg,
      rgba(249,115,22,.2) 0, rgba(249,115,22,.2) 8px,
      transparent 8px, transparent 18px
    );
    pointer-events: none;
    animation: line-scroll 1s linear infinite;
  }
`;

/* ── SVG defs (shared glow filter) ── */
const SVG_DEFS = (
  <defs>
    <filter id="plane-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

const PLANE_PATH = "M59.124,34L56,29h-4l2.947,11H89c1.657,0,3-1.343,3-3s-1.343-3-3-3H78.998L69,18h-4l4.287,16H59.124z";

/* ── Plane Loader ── */
function PlaneLoader() {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* flight path dashed line */}
      <div className="flight-line" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>

        {/* Take-off */}
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg"
             width="120" height="48" viewBox="0 0 144 48" style={{ flexShrink: 0 }}>
          {SVG_DEFS}
          <path className="plane-takeoff"
                d={PLANE_PATH}
                fill="none"
                stroke="#f97316"
                strokeWidth="1.8"
                strokeLinejoin="round"
                filter="url(#plane-glow)" />
          <rect x="52" y="44" fill="#f97316" opacity=".3" width="40" height="2" rx="1" />
        </svg>

        {/* Brand text */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 160, flexShrink: 0 }}>
          <span className="brand-title">Mandarin Cargo</span>
          <span className="brand-sub">System</span>
        </div>

        {/* Landing */}
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg"
             width="120" height="48" viewBox="0 0 144 48" style={{ flexShrink: 0 }}>
          {SVG_DEFS}
          <path className="plane-landing"
                d={PLANE_PATH}
                fill="none"
                stroke="#f97316"
                strokeWidth="1.8"
                strokeLinejoin="round"
                filter="url(#plane-glow)" />
          <rect x="52" y="44" fill="#f97316" opacity=".3" width="40" height="2" rx="1" />
        </svg>

      </div>
    </div>
  );
}

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
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
              Tizim yuklanmoqda
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Kargo ma'lumotlari tekshirilmoqda...
            </p>
          </div>

          {/* ✈ Plane loader */}
          <div className="mb-5">
            <PlaneLoader />
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

      <p
        className="fade-in-up mt-5 text-xs text-gray-300 dark:text-white/20 tracking-widest uppercase font-medium"
        style={{ animationDelay: '0.3s' }}
      >
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
    window.location.pathname.startsWith('/statistics');

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

    const timer = setTimeout(checkTelegramWebApp, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isValidating) return <LoadingScreen />;
  if (!isValid)     return <ErrorScreen />;
  return <>{children}</>;
}