import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, Fingerprint, Lock, User, ArrowRight, Loader2, ChevronLeft } from 'lucide-react';
import {
  checkAdminUsername,
  loginAdminPin,
  webauthnLoginBegin,
  webauthnLoginComplete,
} from '../api/services/adminAuth';
import { webauthnGet } from '../utils/webauthn';

const usernameSchema = z.object({
  system_username: z.string().min(3, "Username must be at least 3 characters").max(50),
});

type UsernameFormValues = z.infer<typeof usernameSchema>;

interface AdminLoginFormProps {
  onAdminLoginSuccess: (role: string) => void;
}

const floatingOrbs = [
  { size: 320, x: '-10%', y: '-20%', color: 'from-orange-500/8 to-amber-400/4', delay: 0 },
  { size: 240, x: '70%', y: '60%', color: 'from-amber-500/6 to-orange-400/3', delay: 2 },
  { size: 180, x: '80%', y: '-10%', color: 'from-yellow-400/5 to-orange-500/3', delay: 4 },
];

export default function AdminLoginForm({ onAdminLoginSuccess }: AdminLoginFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [systemUsername, setSystemUsername] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [hasPasskey, setHasPasskey] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const { register, handleSubmit, formState: { errors } } = useForm<UsernameFormValues>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { system_username: '' },
  });

  useEffect(() => {
    if (step === 1) {
      // Delay past the card entry animation (duration:0.5s + delay:0.1s = 600ms)
      // so the browser receives focus on a fully-painted, visible input.
      setTimeout(() => usernameRef.current?.focus(), 650);
    } else {
      // Step-2 slide-in animation is 250ms; 300ms gives a small margin.
      setTimeout(() => pinRefs[0].current?.focus(), 300);
    }
    // refs are stable objects; only step changes which one to focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const checkUsernameMutation = useMutation({
    mutationFn: (username: string) => checkAdminUsername(username),
    onSuccess: async (data, variables) => {
      setAdminRole(data.role_name);
      setHasPasskey(data.has_passkey);

      if (data.has_passkey) {
        setIsPasskeyLoading(true);
        try {
          const beginRes = await webauthnLoginBegin(variables);
          const assertionResponse = await webauthnGet(beginRes.options);
          const completeRes = await webauthnLoginComplete(variables, assertionResponse);
          localStorage.setItem('access_token', completeRes.access_token);
          localStorage.setItem('admin_role', completeRes.role_name);
          onAdminLoginSuccess(completeRes.role_name);
          return;
        } catch (err) {
          console.warn('Passkey fallback', err);
        } finally {
          setIsPasskeyLoading(false);
        }
      }

      setStep(2);
    },
  });

  const loginPinMutation = useMutation({
    mutationFn: ({ username, pinStr }: { username: string; pinStr: string }) =>
      loginAdminPin(username, pinStr, navigator.userAgent),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('admin_role', data.role_name);
      onAdminLoginSuccess(data.role_name);
    },
    onError: (error: unknown) => {
      setPinError((error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Noto'g'ri PIN. Qaytadan urinib ko'ring.");
      setPin(['', '', '', '']);
      pinRefs[0].current?.focus();
    },
  });

  const onUsernameSubmit = (data: UsernameFormValues) => {
    setSystemUsername(data.system_username);
    checkUsernameMutation.mutate(data.system_username);
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setPinError('');
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  useEffect(() => {
    if (pin.every((p) => p !== '') && pin.length === 4) {
      const pinStr = pin.join('');
      if (!loginPinMutation.isPending && !loginPinMutation.isSuccess && !pinError) {
        loginPinMutation.mutate({ username: systemUsername, pinStr });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="min-h-[100vh] flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto w-full relative bg-[#fafaf9] dark:bg-[#09090b]">

      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {floatingOrbs.map((orb, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
            style={{ width: orb.size, height: orb.size, left: orb.x, top: orb.y }}
            animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 8, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="w-full max-w-[400px] shrink-0 relative z-10">

        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <motion.div
            whileHover={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-[22px] bg-gradient-to-br from-orange-500 to-amber-500 mb-5 shadow-xl shadow-orange-500/25"
          >
            <ShieldCheck className="w-10 h-10 text-white" strokeWidth={1.8} />
          </motion.div>
          <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
            Admin Portal
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1.5 tracking-wide">
            Faqat ruxsat berilgan adminlar uchun
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-[#111111] rounded-[24px] shadow-2xl shadow-black/[0.04] dark:shadow-black/40 border border-black/[0.06] dark:border-white/[0.06] overflow-hidden"
        >
          {/* Accent line */}
          <div className="h-[3px] bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

          <div className="p-7 sm:p-8">
            <AnimatePresence mode="wait">

              {/* ── STEP 1: Username ── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div className="mb-6">
                    <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">
                      Tizimga kirish
                    </h2>
                    <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
                      Davom etish uchun username kiriting
                    </p>
                  </div>

                  <form onSubmit={handleSubmit(onUsernameSubmit)} className="space-y-5">
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Username
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <User className="w-[18px] h-[18px] text-gray-400 dark:text-gray-600 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input
                          {...register('system_username')}
                          ref={(e) => {
                            usernameRef.current = e;
                            register('system_username').ref(e);
                          }}
                          type="text"
                          placeholder="admin_01"
                          autoComplete="off"
                          className="w-full pl-10 pr-4 py-3.5 bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-2xl text-[14px]
                                     focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 dark:focus:border-orange-500/40 transition-all outline-none
                                     text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                          onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                        />
                      </div>
                      <AnimatePresence>
                        {errors.system_username && (
                          <motion.p
                            key="validation-error"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-red-500 text-[12px] mt-2 font-medium"
                          >
                            {errors.system_username.message}
                          </motion.p>
                        )}
                        {checkUsernameMutation.isError && (
                          <motion.p
                            key="api-error"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-red-500 text-[12px] mt-2 font-medium"
                          >
                            {(checkUsernameMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Foydalanuvchi topilmadi"}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={checkUsernameMutation.isPending || isPasskeyLoading}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600
                                 text-white text-[14px] font-semibold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {checkUsernameMutation.isPending || isPasskeyLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Davom etish <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ── STEP 2: PIN ── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex flex-col items-center"
                >
                  {/* Back button */}
                  <button
                    onClick={() => { setStep(1); setPin(['', '', '', '']); setPinError(''); }}
                    className="self-start -ml-1 mb-5 flex items-center gap-1 text-[13px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Orqaga
                  </button>

                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="w-16 h-16 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/5 rounded-full flex items-center justify-center mb-5 ring-1 ring-orange-200/50 dark:ring-orange-500/20"
                  >
                    <Lock className="w-7 h-7 text-orange-500" strokeWidth={1.8} />
                  </motion.div>

                  <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">
                    Xush kelibsiz
                  </h3>
                  <span className="inline-flex items-center px-3 py-1 mb-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[12px] font-semibold tracking-wide">
                    {adminRole.replace('-', ' ').toUpperCase()}
                  </span>
                  <p className="text-[13px] text-gray-500 dark:text-gray-500 mb-7 text-center">
                    4 xonali xavfsizlik PIN kodini kiriting
                  </p>

                  {/* Passkey button */}
                  {hasPasskey && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onClick={async () => {
                        try {
                          setIsPasskeyLoading(true);
                          const beginRes = await webauthnLoginBegin(systemUsername);
                          const assertionResponse = await webauthnGet(beginRes.options);
                          const completeRes = await webauthnLoginComplete(systemUsername, assertionResponse);
                          localStorage.setItem('access_token', completeRes.access_token);
                          localStorage.setItem('admin_role', completeRes.role_name);
                          onAdminLoginSuccess(completeRes.role_name);
                        } catch (err) {
                          setPinError('Passkey bekor qilindi yoki xatolik.');
                          console.warn('Passkey login error', err);
                        } finally {
                          setIsPasskeyLoading(false);
                        }
                      }}
                      disabled={isPasskeyLoading}
                      whileTap={{ scale: 0.96 }}
                      className="mb-7 px-5 py-2.5 flex items-center gap-2.5 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.07] text-gray-800 dark:text-gray-200 rounded-2xl transition-all text-[13px] font-medium border border-gray-200/80 dark:border-white/[0.08]"
                    >
                      {isPasskeyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Fingerprint className="w-4 h-4 text-orange-500" /> Face ID / Touch ID</>}
                    </motion.button>
                  )}

                  {/* PIN inputs */}
                  <div className="flex gap-3 justify-center w-full mb-5">
                    {pin.map((digit, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * index + 0.15 }}
                      >
                        <input
                          ref={pinRefs[index]}
                          type="password"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handlePinChange(index, e.target.value)}
                          onKeyDown={(e) => handlePinKeyDown(index, e)}
                          onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                          className={`w-[60px] h-[64px] md:w-[66px] md:h-[70px] text-center text-2xl font-bold rounded-2xl bg-gray-50/80 dark:bg-white/[0.04]
                                    border-2 focus:outline-none transition-all
                                    ${pinError
                                      ? 'border-red-400 dark:border-red-500/60 text-red-500 animate-[shake_0.4s_ease-in-out]'
                                      : digit
                                        ? 'border-orange-400 dark:border-orange-500/50 text-gray-900 dark:text-white ring-4 ring-orange-500/10'
                                        : 'border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white focus:border-orange-400 dark:focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10'
                                    }`}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Status messages */}
                  <div className="h-8 flex items-center justify-center w-full">
                    <AnimatePresence mode="wait">
                      {pinError && (
                        <motion.p
                          key="error"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="text-red-500 text-[13px] font-medium flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" /> {pinError}
                        </motion.p>
                      )}
                      {loginPinMutation.isPending && (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-orange-500"
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-[13px] font-medium">Tekshirilmoqda...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-8 tracking-wide"
        >
          Himoyalangan ulanish &middot; End-to-end shifrlangan
        </motion.p>
      </div>
    </div>
  );
}