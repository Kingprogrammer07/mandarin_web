import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, LogOut, Shield, ShieldCheck, ShieldOff, Loader2, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchMyPasskeys,
  webauthnRegisterBegin,
  webauthnRegisterComplete,
  refreshAdminToken,
} from '../../api/services/adminAuth';
import { webauthnCreate } from '../../utils/webauthn';
import { getAdminJwtClaims } from '../../api/services/adminManagement';

interface PasskeyPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

// Stable device name derived from the browser UA — used as the passkey identifier.
function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android[^;]+;\s*([^)]+)\)/);
    return match ? match[1].trim() : 'Android';
  }
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown device';
}

function getInitialTheme(): boolean {
  return (
    localStorage.getItem('adminTheme') === 'dark' ||
    (!('adminTheme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export default function PasskeyPage({ onLogout }: PasskeyPageProps) {
  const queryClient = useQueryClient();
  const [jwtClaims, setJwtClaims] = useState(() => getAdminJwtClaims());
  const [isDark, setIsDark] = useState(getInitialTheme);
  const deviceName = getDeviceName();

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('adminTheme', next ? 'dark' : 'light');
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  // Silent token refresh on mount
  useEffect(() => {
    let cancelled = false;
    refreshAdminToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem('access_token', data.access_token);
        setJwtClaims(getAdminJwtClaims());
      })
      .catch(() => { /* Non-fatal — continue with existing token */ });
    return () => { cancelled = true; };
  }, []);

  const canRegisterPasskey = jwtClaims.isSuperAdmin || jwtClaims.permissions.has('auth:passkey');

  const { data: passkeyStatus, isLoading } = useQuery({
    queryKey: ['my-passkeys', deviceName],
    queryFn: () => fetchMyPasskeys(deviceName),
  });

  const { mutate: registerPasskey, isPending: isRegistering } = useMutation({
    mutationFn: async () => {
      // Step 1: request registration options from server
      const { options } = await webauthnRegisterBegin(deviceName);
      // Step 2: call the native browser WebAuthn API
      const attestation = await webauthnCreate(options);
      // Step 3: send the attestation back to complete registration
      return webauthnRegisterComplete(deviceName, attestation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-passkeys'] });
      toast.success('Passkey muvaffaqiyatli ro\'yxatdan o\'tkazildi');
    },
    onError: (err: Error) => {
      // User cancellation from the browser dialog is not a real error
      if (err.name === 'NotAllowedError') {
        toast.info('Passkey ro\'yxatdan o\'tkazish bekor qilindi');
      } else {
        toast.error(err.message || 'Passkey ro\'yxatdan o\'tkazishda xatolik');
      }
    },
  });

  const hasCurrentDevicePasskey = passkeyStatus?.has_current_device_passkey ?? false;
  const totalPasskeys = passkeyStatus?.total_passkeys ?? 0;

  return (
    <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#0a0a0a]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                </div>
                <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">
                  Passkey xavfsizligi
                </h1>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              title={isDark ? "Kunduzgi rejim" : "Tungi rejim"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Chiqish"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status card */}
        <div className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5">
          <h2 className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Joriy qurilma holati
          </h2>

          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-48 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                hasCurrentDevicePasskey
                  ? 'bg-emerald-100 dark:bg-emerald-500/10'
                  : 'bg-gray-100 dark:bg-white/[0.06]'
              }`}>
                {hasCurrentDevicePasskey
                  ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  : <ShieldOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                }
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                  {deviceName}
                </p>
                <p className={`text-[12px] ${
                  hasCurrentDevicePasskey
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {hasCurrentDevicePasskey ? 'Passkey ro\'yxatdan o\'tgan' : 'Passkey yo\'q'}
                </p>
              </div>
            </div>
          )}

          {!isLoading && totalPasskeys > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span className="text-[12px] text-gray-400 dark:text-gray-500">
                  Jami {totalPasskeys} ta qurilmada passkey ro&apos;yxatdan o&apos;tgan
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Register card */}
        {canRegisterPasskey && (
          <div className="bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5">
            <h2 className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {hasCurrentDevicePasskey ? 'Passkey yangilash' : 'Passkey qo\'shish'}
            </h2>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-4">
              {hasCurrentDevicePasskey
                ? 'Bu qurilmadagi passkey ni yangilash uchun qurilma autentifikatoringizdan foydalaning.'
                : 'Bu qurilmani passkey bilan himoya qiling. Keyingi kirishda PIN kerak bo\'lmaydi.'}
            </p>
            <button
              onClick={() => registerPasskey()}
              disabled={isRegistering}
              className="w-full h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ro&apos;yxatdan o&apos;tkazilmoqda...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  {hasCurrentDevicePasskey ? 'Passkey yangilash' : 'Passkey qo\'shish'}
                </>
              )}
            </button>
          </div>
        )}

        {/* No permission notice */}
        {!canRegisterPasskey && !isLoading && (
          <div className="bg-amber-50 dark:bg-amber-500/[0.08] rounded-2xl border border-amber-200 dark:border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-amber-700 dark:text-amber-400">
                Passkey ro&apos;yxatdan o&apos;tkazish uchun ruxsat yo&apos;q.
                Agar kerak bo&apos;lsa, super-admin bilan bog&apos;laning.
              </p>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-500/[0.06] rounded-2xl border border-blue-100 dark:border-blue-500/20 p-4">
          <p className="text-[12px] text-blue-600 dark:text-blue-400 leading-relaxed">
            Passkey — bu PIN o&apos;rniga ishlatiluvchi zamonaviy xavfsizlik usuli.
            Barmoq izi, yuz tanish yoki qurilma qulfi orqali tezda kira olasiz.
          </p>
        </div>
      </div>
    </div>
  );
}
