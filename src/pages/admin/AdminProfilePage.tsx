import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { webauthnCreate } from '../../utils/webauthn';
import { Fingerprint, Smartphone, Loader2, CheckCircle, Info, Sparkles, KeyRound, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

import { webauthnRegisterBegin, webauthnRegisterComplete, fetchMyPasskeys } from '../../api/services/adminAuth';

interface AdminProfilePageProps {
  /** Provided when rendered standalone (non-admin roles). Shows a back button. */
  onBack?: () => void;
}

export default function AdminProfilePage({ onBack }: AdminProfilePageProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [hasCurrentDevicePasskey, setHasCurrentDevicePasskey] = useState(false);
  const [totalPasskeys, setTotalPasskeys] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  const deviceName = navigator.userAgent.substring(0, 100);

  // Check existing passkey status on mount
  useEffect(() => {
    const checkPasskeys = async () => {
      try {
        const res = await fetchMyPasskeys(deviceName);
        setHasCurrentDevicePasskey(res.has_current_device_passkey);
        setTotalPasskeys(res.total_passkeys);
      } catch (error) {
        console.error("Passkey holatini tekshirishda xatolik:", error);
      } finally {
        setIsChecking(false);
      }
    };
    checkPasskeys();
  }, [deviceName]);

  const handleRegisterPasskey = async () => {
    setIsRegistering(true);
    toast.info("Face ID / Touch ID kutilmoqda...");

    try {
      const beginRes = await webauthnRegisterBegin(deviceName);
      const options = beginRes.options;
      const credential = await webauthnCreate(options);
      await webauthnRegisterComplete(deviceName, credential);

      setHasCurrentDevicePasskey(true);
      setTotalPasskeys((prev) => prev + 1);
      toast.success("Muvaffaqiyatli ulangan! Profilingiz ishonchli himoyalandi.");
    } catch (error: unknown) {
      console.error(error);
      const err = error as { message?: string };
      const msg = err.message || "Passkey ulashda xatolik yuz berdi. Balki rad etilgandir.";
      toast.error(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const features = [
    { icon: '🔐', title: 'Parolsiz kirish', desc: 'PIN eslab qolish shart emas' },
    { icon: '⚡', title: 'Tezkor', desc: '1 soniyada tizimga kirish' },
    { icon: '🛡️', title: 'Xavfsiz', desc: 'End-to-end shifrlangan' },
  ];

  const alreadyRegistered = hasCurrentDevicePasskey;

  const pageContent = (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2"
      >
        <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
          Profil va Xavfsizlik
        </h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
          Shaxsiy sozlamalar va hisobingiz xavfsizligini boshqarish
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white dark:bg-[#111] rounded-[22px] shadow-sm border border-black/[0.06] dark:border-white/[0.06] overflow-hidden relative"
      >
        {/* Top gradient accent */}
        <div className="h-32 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-400 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]" />

          {/* Floating icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Fingerprint className="w-14 h-14 text-white/30" strokeWidth={1.2} />
            </motion.div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-8 -mt-8 relative z-10">

          {/* Icon badge */}
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-xl shadow-black/[0.08] flex items-center justify-center mb-6 border border-black/[0.05] dark:border-white/[0.08]">
            <Fingerprint className="w-8 h-8 text-orange-500" strokeWidth={1.8} />
          </div>

          <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            Biometrik autentifikatsiya
          </h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-md mb-6">
            Qurilmangizdagi biometrik ma'lumotlarni ulab, keyingi safar PIN-kodsiz tez va xavfsiz tizimga kiring.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]"
              >
                <span className="text-base">{f.icon}</span>
                <div>
                  <div className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 leading-tight">{f.title}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-500">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Passkey stats */}
          {!isChecking && totalPasskeys > 0 && (
            <div className="flex items-center gap-2 mb-6 px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/[0.08] border border-blue-200/50 dark:border-blue-500/20">
              <KeyRound className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-[12px] text-blue-700 dark:text-blue-400">
                Jami <strong>{totalPasskeys}</strong> ta qurilmada passkey ulangan
                {hasCurrentDevicePasskey && ' (shu qurilma ham)'}
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-white/[0.06] mb-6" />

          {/* Action */}
          {isChecking ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-[13px]">Tekshirilmoqda...</span>
            </div>
          ) : (
            <motion.button
              onClick={handleRegisterPasskey}
              disabled={isRegistering || alreadyRegistered}
              whileTap={{ scale: 0.97 }}
              className={`
                w-full sm:w-auto flex items-center justify-center gap-3 px-7 py-3.5 rounded-2xl font-semibold text-[14px] transition-all shadow-lg
                ${alreadyRegistered
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20 cursor-default'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25 hover:shadow-orange-500/35 disabled:opacity-60'
                }
              `}
            >
              {isRegistering ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : alreadyRegistered ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Smartphone className="w-5 h-5" />
              )}
              {isRegistering ? 'Ulanmoqda...' : alreadyRegistered ? 'Bu qurilmada ulangan' : 'Face ID / Touch ID Ulash'}
            </motion.button>
          )}

          {/* Success state */}
          {alreadyRegistered && !isChecking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/50 dark:border-emerald-500/20"
            >
              <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                  Bu qurilmada biometrik ma'lumotlar ulangan
                </p>
                <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/50 mt-0.5">
                  Face ID yoki Touch ID bilan tezkor kirish mumkin.
                </p>
              </div>
            </motion.div>
          )}

          {/* Info note */}
          {!alreadyRegistered && !isChecking && (
            <div className="mt-5 flex items-start gap-2.5 text-gray-400 dark:text-gray-500">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Faqat HTTPS yoki localhost muhitida ishlaydi. Qurilma Face ID, Touch ID yoki Windows Hello'ni qo'llab-quvvatlashi kerak.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  if (onBack) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#09090b]">
        <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              title="Orqaga"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-orange-500" />
              </div>
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                Profil va Xavfsizlik
              </h1>
            </div>
          </div>
        </div>
        <div className="px-4 py-5">
          {pageContent}
        </div>
      </div>
    );
  }

  return pageContent;
}