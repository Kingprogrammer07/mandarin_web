import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Phone, LogIn, MapPin } from 'lucide-react';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { login as loginApi, getTelegramWebAppData, fetchAuthMe } from '@/api/services/auth';
import StatusAnimation from './StatusAnimation';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { regions, DISTRICTS } from '@/lib/validation';
import TranslatedFormMessage from './TranslatedFormMessage';
import { triggerSuccessHaptic } from '@/utils/haptics';

const loginSchema = z.object({
  clientCode: z.string().min(1, 'login.validation.clientCodeRequired').regex(/^[A-Z][A-Z0-9-]*$/, 'login.validation.clientCodeInvalid'),
  phoneNumber: z.string().min(1, 'login.validation.phoneNumberRequired').regex(/^\d{9}$/, 'login.validation.phoneNumberInvalid'),
});
type LoginFormData = z.infer<typeof loginSchema>;

const addressSchema = z.object({
  region: z.string().min(1, 'form.validation.regionRequired'),
  district: z.string().min(1, 'form.validation.districtRequired'),
});
type AddressFormData = z.infer<typeof addressSchema>;

interface LoginFormProps {
  onNavigateToRegister?: () => void;
  onLoginSuccess?: (role: string) => void;
}

export default function LoginForm({ onNavigateToRegister, onLoginSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const [showAddressDrawer, setShowAddressDrawer] = useState(false);
  const [credentials, setCredentials] = useState<{ clientCode: string; phoneNumber: string } | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Reverse Auth Guard: agar token mavjud bo'lsa, /auth/me dan haqiqiy roleni olib yo'naltirish
  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token || !onLoginSuccess) return;

    // Token bor — haqiqiy roleni backenddan olamiz
    fetchAuthMe()
      .then((userData) => {
        onLoginSuccess(userData.role ?? 'user');
      })
      .catch(() => {
        // Token eskirgan yoki noto'g'ri — o'chirib tashlaymiz, login ko'rsatamiz
        sessionStorage.removeItem('access_token');
      });
  }, [onLoginSuccess]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { clientCode: '', phoneNumber: '' },
  });

  const addressForm = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: { region: '', district: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setSubmitStatus('loading');
    setSubmitMessage(t('login.messages.loading'));
    try {
      const telegramData = getTelegramWebAppData();
      if (!telegramData?.user) throw new Error(t('login.messages.telegramError'));
      const response = await loginApi({
        client_code: data.clientCode,
        phone_number: `+998${data.phoneNumber}`,
        telegram_id: telegramData?.user?.id,
      });

      if (response.access_token) {
        sessionStorage.setItem('access_token', response.access_token);
        triggerSuccessHaptic();
        setSubmitStatus('success');
        setSubmitMessage(t('login.messages.success', { name: response.full_name }));
        form.reset();
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(response.role);
          }
        }, 1500);
      }

    } catch (error: unknown) {
      const status = typeof error === 'object' && error && 'status' in (error as object) ? (error as { status?: number }).status : undefined;
      const detail = typeof error === 'object' && error && 'data' in (error as object) ? (error as { data?: { detail?: string } }).data?.detail : undefined;
      const message = typeof error === 'object' && error && 'message' in (error as object) ? (error as { message?: string }).message : undefined;

      if (status === 428 || detail === 'address_required') {
        setSubmitStatus('idle');
        setSubmitMessage('');
        setCredentials({ clientCode: data.clientCode, phoneNumber: data.phoneNumber });
        setShowAddressDrawer(true);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(detail || message || t('login.messages.generalError'));
      }
    }
  };

  const onAddressSubmit = async (data: AddressFormData) => {
    if (!credentials) return;
    setSubmitStatus('loading');
    setSubmitMessage(t('login.messages.loading'));
    try {
      const telegramData = getTelegramWebAppData();
      const response = await loginApi({
        client_code: credentials.clientCode,
        phone_number: `+998${credentials.phoneNumber}`,
        telegram_id: telegramData?.user?.id,
        region: data.region,
        district: data.district,
      });

      if (response.access_token) {
        sessionStorage.setItem('access_token', response.access_token);
        setShowAddressDrawer(false);
        triggerSuccessHaptic();
        setSubmitStatus('success');
        setSubmitMessage(t('login.messages.success', { name: response.full_name }));
        form.reset();
        addressForm.reset();
        setCredentials(null);
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(response.role);
          }
        }, 1500);
      }
    } catch (error: unknown) {
      setSubmitStatus('error');
      const detail = typeof error === 'object' && error && 'data' in (error as object) ? (error as { data?: { detail?: string } }).data?.detail : undefined;
      const message = typeof error === 'object' && error && 'message' in (error as object) ? (error as { message?: string }).message : undefined;
      setSubmitMessage(detail || message || t('login.messages.generalError'));
    }
  };

  const handleAnimationComplete = () => {
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  const handleClientCodeInput = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]/g, '');

  const handlePhoneInput = (v: string) => {
    const c = v.replace(/\D/g, '').slice(0, 9);
    let f = c.substring(0, 2);
    if (c.length > 2) f += ' ' + c.substring(2, 5);
    if (c.length > 5) f += ' ' + c.substring(5, 7);
    if (c.length > 7) f += ' ' + c.substring(7, 9);
    return { formatted: f, raw: c };
  };

  const inp = [
    'h-[54px] rounded-[18px]',
    'border border-gray-900/[0.07] dark:border-white/[0.085]',
    'bg-white dark:bg-[#10151f]',
    'text-gray-950 dark:text-[#fff8ed]',
    'placeholder:text-gray-400 dark:placeholder:text-gray-500',
    'transition-colors duration-150',
    'shadow-[0_8px_18px_rgba(15,23,42,0.045)] dark:shadow-none',
    'focus:border-orange-500/70 focus:ring-2 focus:ring-orange-500/15 focus:ring-offset-0 focus:outline-none',
  ].join(' ');

  return (
    <>
      {submitStatus !== 'idle' && (
        <StatusAnimation
          status={submitStatus}
          message={submitMessage}
          onComplete={handleAnimationComplete}
        />
      )}

      <div className="mx-auto flex min-h-[calc(100svh-72px)] w-full max-w-md items-center px-4 py-6 sm:px-6">
        <div className="relative overflow-hidden rounded-[30px] border border-orange-500/18 bg-white/92 p-5 shadow-[0_22px_46px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-white/[0.085] dark:bg-[#0a0e15] dark:shadow-[0_22px_54px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.07)]">
          <div className="pointer-events-none absolute -right-20 -top-14 h-44 w-80 rotate-[-14deg] rounded-[42%] bg-[linear-gradient(110deg,rgba(255,255,255,0.08),transparent_28%),linear-gradient(90deg,rgba(245,158,11,0.16),rgba(59,130,246,0.08),transparent_72%)] opacity-75 blur-[18px]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:100%_42px] [mask-image:linear-gradient(to_bottom,transparent,black_18%,transparent_88%)]" />

          <div className="relative z-10 mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] border border-orange-500/20 bg-orange-500/10 text-orange-600 dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-amber-300">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[24px] font-black leading-tight tracking-normal text-gray-950 dark:text-[#fff8ed]">
                {t('login.title')}
              </h1>
              <p className="mt-1 text-[12px] font-bold leading-snug text-gray-500 dark:text-[#fff8ed]/56">
                {t('login.subtitle')}
              </p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="relative z-10 space-y-4">
              <FormField control={form.control} name="clientCode" render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-0.5 text-[12px] font-black text-gray-800 dark:text-[#fff8ed]/76">
                    {t('login.clientCode')}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-[12px] bg-orange-500/10 text-[13px] font-black text-orange-600 dark:bg-white/[0.055] dark:text-amber-300">
                        ID
                      </div>
                      <Input
                        placeholder={t('login.clientCodePlaceholder')}
                        {...field}
                        enterKeyHint="next"
                        onChange={(e) => field.onChange(handleClientCodeInput(e.target.value))}
                        className={`${inp} pl-14 font-mono text-base font-black uppercase tracking-widest placeholder:font-bold placeholder:tracking-normal`}
                      />
                    </div>
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-0.5 text-[12px] font-black text-gray-800 dark:text-[#fff8ed]/76">
                    {t('login.phoneNumber')}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-[12px] bg-orange-500/10 text-orange-600 dark:bg-white/[0.055] dark:text-amber-300">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="pointer-events-none absolute left-[58px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-2">
                        <span className="text-[13px] font-black text-gray-600 dark:text-[#fff8ed]/72">+998</span>
                        <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        enterKeyHint="done"
                        autoComplete="tel-national"
                        placeholder={t('login.phoneNumberPlaceholder')}
                        value={handlePhoneInput(field.value).formatted}
                        onChange={(e) => field.onChange(handlePhoneInput(e.target.value).raw)}
                        className={`${inp} pl-[6.6rem] font-mono text-base font-black tracking-wider placeholder:font-bold placeholder:tracking-normal`}
                      />
                    </div>
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )} />

              <Button
                type="submit"
                disabled={submitStatus === 'loading'}
                className="mt-2 h-14 w-full rounded-[18px] border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-[15px] font-black text-white shadow-[0_15px_30px_rgba(249,115,22,0.24)] transition-opacity duration-150 hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('login.submit')}
              </Button>

              <div className="pt-1 text-center">
                <p className="text-[12px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
                  {t('login.noAccount')}{' '}
                  <button
                    type="button"
                    onClick={onNavigateToRegister}
                    className="font-black text-orange-600 transition-colors hover:text-orange-500 dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    {t('login.register')}
                  </button>
                </p>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {showAddressDrawer && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm"
                onClick={() => setShowAddressDrawer(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-[10000] mx-auto flex max-h-[82vh] max-w-md flex-col overflow-y-auto rounded-t-[28px] border border-b-0 border-gray-900/[0.07] bg-white p-5 pb-7 shadow-[0_-20px_54px_rgba(15,23,42,0.18)] dark:border-white/[0.10] dark:bg-[#0a0e15] dark:shadow-[0_-24px_60px_rgba(0,0,0,0.48)]"
              >
                <div className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-gray-200 dark:bg-white/20" />
                <div className="mb-5">
                  <h2 className="text-[21px] font-black leading-tight text-gray-950 dark:text-[#fff8ed]">
                    {t('login.addressDrawer.title')}
                  </h2>
                  <p className="mt-1.5 text-[12px] font-bold leading-snug text-gray-500 dark:text-[#fff8ed]/54">
                    {t('login.addressDrawer.subtitle')}
                  </p>
                </div>

                <Form {...addressForm}>
                  <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-5">
                    <FormField control={addressForm.control} name="region" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          {t('form.region')}
                        </FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          addressForm.setValue('district', '');
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={`${inp} w-full px-4 font-bold`}>
                              <SelectValue placeholder={t('form.regionPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[10010] dark:bg-[#1a1209] dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-xl max-h-60">
                            {regions.map((r) => (
                              <SelectItem
                                key={r.value}
                                value={r.value}
                                className="rounded-lg cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-500/10 dark:text-gray-200"
                              >
                                {t(r.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <TranslatedFormMessage />
                      </FormItem>
                    )} />

                    <FormField control={addressForm.control} name="district" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-orange-500 opacity-50" />
                          {t('form.district')}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!addressForm.watch('region')}
                        >
                          <FormControl>
                            <SelectTrigger className={`${inp} w-full px-4 font-bold`}>
                              <SelectValue placeholder={t('form.districtPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[10010] dark:bg-[#1a1209] dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-xl max-h-60">
                            {addressForm.watch('region') && DISTRICTS[addressForm.watch('region')]?.map((d) => (
                              <SelectItem
                                key={d.value}
                                value={d.value}
                                className="rounded-lg cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-500/10 dark:text-gray-200"
                              >
                                {t(d.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <TranslatedFormMessage />
                      </FormItem>
                    )} />

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={submitStatus === 'loading'}
                        className="h-14 w-full rounded-[18px] border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-[15px] font-black text-white shadow-[0_15px_30px_rgba(249,115,22,0.24)] transition-opacity duration-150 hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('login.addressDrawer.submit')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
