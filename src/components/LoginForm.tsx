import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Phone, User, LogIn, MapPin } from 'lucide-react';
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
        telegram_id: telegramData.user.id,
      });

      if (response.access_token) {
        sessionStorage.setItem('access_token', response.access_token);
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
    const c = v.replace(/\D/g, '');
    let f = c.substring(0, 2);
    if (c.length > 2) f += ' ' + c.substring(2, 5);
    if (c.length > 5) f += ' ' + c.substring(5, 7);
    if (c.length > 7) f += ' ' + c.substring(7, 9);
    return { formatted: f, raw: c };
  };

  const inp = [
    'h-12 rounded-xl',
    'border border-gray-200 dark:border-white/10',
    'bg-gray-50 dark:bg-white/5',
    'text-gray-900 dark:text-white',
    'placeholder:text-gray-400 dark:placeholder:text-gray-500',
    'transition-colors duration-150',
    'focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:ring-offset-0 focus:outline-none',
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

      <div className="w-full max-w-lg mx-auto p-4 sm:p-6 lg:p-8">
        <div className="relative bg-white dark:bg-[#0d0a04] rounded-3xl border border-orange-100/80 dark:border-orange-500/15 overflow-hidden shadow-xl">

          {/* top accent bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

          {/* dot-grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.022] dark:opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(249,115,22) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative p-6 sm:p-8 lg:p-10">

            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex mb-5">
                <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
                  <LogIn className="w-10 h-10 text-white" />
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent">
                {t('login.title')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                {t('login.subtitle')}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-orange-400 opacity-50" />
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-orange-400 opacity-50" />
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Client Code */}
                <FormField control={form.control} name="clientCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                      <User className="w-4 h-4 text-orange-500" />
                      {t('login.clientCode')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('login.clientCodePlaceholder')}
                        {...field}
                        onChange={(e) => field.onChange(handleClientCodeInput(e.target.value))}
                        className={`${inp} uppercase font-mono text-base tracking-widest placeholder:tracking-normal placeholder:font-normal`}
                      />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )} />

                {/* Phone */}
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                      <Phone className="w-4 h-4 text-orange-500" />
                      {t('login.phoneNumber')}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">+998</span>
                          <div className="w-px h-4 bg-gray-300 dark:bg-white/20" />
                        </div>
                        <Input
                          placeholder={t('login.phoneNumberPlaceholder')}
                          value={handlePhoneInput(field.value).formatted}
                          onChange={(e) => field.onChange(handlePhoneInput(e.target.value).raw)}
                          className={`${inp} pl-[4.5rem] font-mono tracking-wider placeholder:tracking-normal placeholder:font-normal`}
                        />
                      </div>
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )} />

                {/* Submit */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={submitStatus === 'loading'}
                    className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:brightness-95 text-white font-bold text-base tracking-wide rounded-xl shadow-md shadow-orange-500/30 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed border-0"
                  >
                    {t('login.submit')}
                  </Button>
                </div>

                <div className="text-center pb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('login.noAccount')}{' '}
                    <button
                      type="button"
                      onClick={onNavigateToRegister}
                      className="text-orange-500 hover:text-orange-400 font-semibold transition-colors underline underline-offset-2 decoration-orange-400/50"
                    >
                      {t('login.register')}
                    </button>
                  </p>
                </div>

              </form>
            </Form>
          </div>
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
                className="fixed inset-0 bg-black/80 z-[9999] backdrop-blur-sm"
                onClick={() => setShowAddressDrawer(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white dark:bg-zinc-950 z-[10000] rounded-t-3xl p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] h-[80vh] overflow-y-auto flex flex-col"
              >
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-800 rounded-full mx-auto mb-6" />
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('login.addressDrawer.title', 'Yashash manzilingizni kiriting')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('login.addressDrawer.subtitle', 'Davom etish uchun viloyat va tumaningizni belgilang')}
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
                            <SelectTrigger className={`${inp} w-full`}>
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
                            <SelectTrigger className={`${inp} w-full`}>
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
                        className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:brightness-95 text-white font-bold text-base tracking-wide rounded-xl shadow-md shadow-orange-500/30 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed border-0"
                      >
                        {t('login.addressDrawer.submit', 'Saqlash va Kirish')}
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