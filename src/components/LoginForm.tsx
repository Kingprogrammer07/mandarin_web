import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Phone, LogIn, MapPin } from 'lucide-react';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { login as loginApi, getTelegramWebAppData, fetchAuthMe } from '@/api/services/auth';
import { applicationService } from '@/api/services/application';
import StatusAnimation from './StatusAnimation';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { regions, DISTRICTS } from '@/lib/validation';
import TranslatedFormMessage from './TranslatedFormMessage';
import LegalDocumentModal from './legal/LegalDocumentModal';
import type { LegalDocId } from './legal/legalDocuments';
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

/**
 * A 403 from login means either "still awaiting approval" or "not logged in",
 * and the two need different screens. Rather than pattern-match a translated
 * message, ask the application endpoint directly; if it cannot answer we fall
 * back to showing the server's message.
 */
async function hasPendingApplication(): Promise<boolean> {
  try {
    const application = await applicationService.get();
    return application.status === 'pending';
  } catch {
    return false;
  }
}

interface LoginFormProps {
  onNavigateToRegister?: () => void;
  onLoginSuccess?: (role: string) => void;
}

export default function LoginForm({ onNavigateToRegister, onLoginSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const [showAddressDrawer, setShowAddressDrawer] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyDoc, setPolicyDoc] = useState<LegalDocId>('offer');
  const openDoc = (id: LegalDocId) => {
    setPolicyDoc(id);
    setShowPolicy(true);
  };
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
        // requires_address bo'lsa, sessiyani tozalab, login formni ko'rsatamiz —
        // user qayta client_code/phone kiritgach, 428 javobi address drawerni
        // ochadi. Bu hard reload halqasidan saqlaydi.
        if (userData.requires_address) {
          sessionStorage.removeItem('access_token');
          return;
        }
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
      } else if (status === 403 && (await hasPendingApplication())) {
        // Their application is still waiting, so no code will ever work here.
        // Send them to the screen that explains it and lets them fix or cancel
        // it, instead of leaving them to retry a login that cannot succeed.
        setSubmitStatus('idle');
        setSubmitMessage('');
        onNavigateToRegister?.();
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
    'h-[54px] rounded-mc-md',
    'border border-mc-border',
    'bg-mc-surface-2',
    'text-mc-text',
    'placeholder:text-mc-text-3 dark:placeholder:text-mc-text-2',
    'transition-colors duration-150',
    'shadow-[0_8px_18px_rgba(15,23,42,0.045)] dark:shadow-none',
    'focus:border-mc-brand/70 focus:ring-2 focus:ring-mc-brand/20 focus:ring-offset-0 focus:outline-none',
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
        <div className="relative overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface p-5 shadow-[var(--mc-shadow-card)]">

          <div className="relative z-10 mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-mc-md border border-mc-brand/20 bg-mc-brand/10 text-mc-brand">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[24px] font-extrabold leading-tight tracking-normal text-mc-text">
                {t('login.title')}
              </h1>
              <p className="mt-1 text-[12px] font-bold leading-snug text-mc-text-2 ">
                {t('login.subtitle')}
              </p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="relative z-10 space-y-4">
              <FormField control={form.control} name="clientCode" render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-0.5 text-[12px] font-extrabold text-mc-text ">
                    {t('login.clientCode')}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-mc-sm bg-mc-brand/10 text-[13px] font-extrabold text-mc-brand ">
                        ID
                      </div>
                      <Input
                        placeholder={t('login.clientCodePlaceholder')}
                        {...field}
                        enterKeyHint="next"
                        onChange={(e) => field.onChange(handleClientCodeInput(e.target.value))}
                        className={`${inp} pl-14 font-mono text-base font-extrabold uppercase tracking-widest placeholder:font-bold placeholder:tracking-normal`}
                      />
                    </div>
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-0.5 text-[12px] font-extrabold text-mc-text ">
                    {t('login.phoneNumber')}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-mc-sm bg-mc-brand/10 text-mc-brand ">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="pointer-events-none absolute left-[58px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-2">
                        <span className="text-[13px] font-extrabold text-mc-text-2 ">+998</span>
                        <div className="h-4 w-px bg-mc-surface-2" />
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        enterKeyHint="done"
                        autoComplete="tel-national"
                        placeholder={t('login.phoneNumberPlaceholder')}
                        value={handlePhoneInput(field.value).formatted}
                        onChange={(e) => field.onChange(handlePhoneInput(e.target.value).raw)}
                        className={`${inp} pl-[6.6rem] font-mono text-base font-extrabold tracking-wider placeholder:font-bold placeholder:tracking-normal`}
                      />
                    </div>
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )} />

              <Button
                type="submit"
                disabled={submitStatus === 'loading'}
                className="mt-2 h-14 w-full rounded-mc-md border-0 bg-gradient-to-r from-mc-brand to-mc-brand-strong text-[15px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-opacity duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('login.submit')}
              </Button>

              <div className="pt-1 text-center">
                <p className="text-[12px] font-bold text-mc-text-2 ">
                  {t('login.noAccount')}{' '}
                  <button
                    type="button"
                    onClick={onNavigateToRegister}
                    className="font-extrabold text-mc-brand transition-colors dark:text-mc-brand"
                  >
                    {t('login.register')}
                  </button>
                </p>
                {/* Login implies acceptance — existing users already consented at
                    registration; the link keeps the policy accessible. */}
                <p className="mt-2 text-[11px] font-semibold leading-snug text-mc-text-3 ">
                  {t('login.consent.prefix', 'Kirish orqali siz ')}
                  <button
                    type="button"
                    onClick={() => openDoc('offer')}
                    className="font-extrabold text-mc-brand underline decoration-mc-brand/40 underline-offset-2"
                  >
                    {t('login.consent.link', 'huquqiy hujjatlar')}
                  </button>
                  {t('login.consent.suffix', 'ga rozilik bildirasiz')}
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
                role="dialog"
                aria-modal="true"
                className="fixed bottom-0 left-0 right-0 z-[10000] mx-auto flex max-h-[82dvh] max-w-md flex-col overflow-y-auto rounded-t-mc-xl border border-b-0 border-mc-border bg-mc-surface p-5 pb-7 shadow-2xl"
              >
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-mc-border" />
                <div className="mb-5">
                  <h2 className="text-[21px] font-extrabold leading-tight text-mc-text">
                    {t('login.addressDrawer.title')}
                  </h2>
                  <p className="mt-1.5 text-[12px] font-bold leading-snug text-mc-text-2 ">
                    {t('login.addressDrawer.subtitle')}
                  </p>
                </div>

                <Form {...addressForm}>
                  <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-5">
                    <FormField control={addressForm.control} name="region" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-sm text-mc-text tracking-wide flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-mc-brand" />
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
                          <SelectContent className="z-[10010] dark:border-mc-brand/20 rounded-mc-lg overflow-hidden shadow-xl max-h-60">
                            {regions.map((r) => (
                              <SelectItem
                                key={r.value}
                                value={r.value}
                                className="rounded-mc-sm cursor-pointer dark:text-mc-text"
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
                        <FormLabel className="font-semibold text-sm text-mc-text tracking-wide flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-mc-brand opacity-50" />
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
                          <SelectContent className="z-[10010] dark:border-mc-brand/20 rounded-mc-lg overflow-hidden shadow-xl max-h-60">
                            {addressForm.watch('region') && DISTRICTS[addressForm.watch('region')]?.map((d) => (
                              <SelectItem
                                key={d.value}
                                value={d.value}
                                className="rounded-mc-sm cursor-pointer dark:text-mc-text"
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
                        className="h-14 w-full rounded-mc-md border-0 bg-gradient-to-r from-mc-brand to-mc-brand-strong text-[15px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition-opacity duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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

      <LegalDocumentModal
        open={showPolicy}
        onClose={() => setShowPolicy(false)}
        initialDoc={policyDoc}
      />
    </>
  );
}
