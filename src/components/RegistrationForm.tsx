import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parse } from 'date-fns';
import { Calendar as CalendarIcon, Hash, IdCard, Loader2, MapPin, Phone, UserRound } from 'lucide-react';
import { register as registerApi, getTelegramWebAppData } from '@/api/services/auth';
import { applicationService, MY_APPLICATION_QUERY_KEY } from '@/api/services/application';
import StatusAnimation from './StatusAnimation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageUpload from './ImageUpload';
import RegistrationPendingScreen from './RegistrationPendingScreen';
import TranslatedFormMessage from './TranslatedFormMessage';
import PrivacyPolicyModal, { PRIVACY_POLICY_VERSION } from './legal/PrivacyPolicyModal';
import { DISTRICTS, formSchema, regions, type RegistrationFormData } from '@/lib/validation';

interface RegistrationFormProps {
  onNavigateToLogin?: () => void;
}

type RegisterStep = 1 | 2 | 3;

const STEP_FIELDS: Record<RegisterStep, Array<keyof RegistrationFormData>> = {
  1: ['fullName', 'passportSeries', 'pinfl', 'dateOfBirth'],
  2: ['region', 'district', 'address', 'phoneNumber'],
  3: ['passportImages'],
};

export default function RegistrationForm({ onNavigateToLogin }: RegistrationFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<RegisterStep>(1);
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [dateInputValue, setDateInputValue] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  // Replaces the old "toast then redirect to login" ending — see the submit handler.
  const [showPendingScreen, setShowPendingScreen] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  // Explicit, required consent to the Privacy Policy + User Agreement before the
  // account (with passport/KYC data) is created.
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('access_token') && onNavigateToLogin) {
      onNavigateToLogin();
    }
  }, [onNavigateToLogin]);

  // Someone who already applied must not be handed a blank form again — that is
  // how the same person ends up submitting twice. On failure (no Telegram
  // context, network down) we fall through to the form rather than block them.
  const { data: existingApplication, isPending: isCheckingApplication } = useQuery({
    queryKey: MY_APPLICATION_QUERY_KEY,
    queryFn: () => applicationService.get(),
    retry: false,
  });

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      passportSeries: '',
      pinfl: '',
      region: '',
      district: '',
      address: '',
      phoneNumber: '',
      passportImages: [],
    },
  });

  const selectedRegion = form.watch('region');
  const dateOfBirthValue = form.watch('dateOfBirth');

  useEffect(() => {
    if (dateOfBirthValue) {
      setDateInputValue(format(dateOfBirthValue, 'dd/MM/yyyy'));
    }
  }, [dateOfBirthValue]);

  const steps = useMemo(
    () => [
      {
        id: 1 as const,
        title: t('form.steps.identity'),
        description: t('form.stepDescriptions.identity'),
      },
      {
        id: 2 as const,
        title: t('form.steps.contact'),
        description: t('form.stepDescriptions.contact'),
      },
      {
        id: 3 as const,
        title: t('form.steps.documents'),
        description: t('form.stepDescriptions.documents'),
      },
    ],
    [t],
  );

  const onSubmit = async (data: RegistrationFormData) => {
    if (!agreedToPolicy) {
      setSubmitStatus('error');
      setSubmitMessage(t('form.consent.required', "Davom etish uchun shartlarga rozilik bering."));
      setTimeout(() => setSubmitStatus('idle'), 2500);
      return;
    }
    setSubmitStatus('loading');
    setSubmitMessage(t('form.messages.loading'));
    try {
      const telegramData = getTelegramWebAppData();
      if (!telegramData?.user) throw new Error(t('form.messages.telegramError'));

      const registerData = {
        full_name: data.fullName,
        passport_series: data.passportSeries,
        pinfl: data.pinfl,
        region: data.region,
        district: data.district,
        address: data.address,
        phone_number: `+998${data.phoneNumber}`,
        date_of_birth: format(data.dateOfBirth, 'yyyy-MM-dd'),
        telegram_id: telegramData.user.id,
        passport_images: data.passportImages,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
      };

      const response = await registerApi(registerData);
      setSubmitStatus('success');
      setSubmitMessage(response.message || t('form.messages.success'));
      form.reset();
      setFrontImage(null);
      setBackImage(null);
      setDateInputValue('');
      setCurrentStep(1);

      // No auto-redirect to login: the account is not usable until an admin
      // approves it. Sending the user to a login form they cannot pass is what
      // made people re-submit the same registration.
      setShowPendingScreen(true);
    } catch (error: unknown) {
      setSubmitStatus('error');
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      setSubmitMessage(message || t('form.messages.generalError'));
    }
  };

  const handleAnimationComplete = () => {
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  const goToNext = async () => {
    const isValidStep = await form.trigger(STEP_FIELDS[currentStep], { shouldFocus: true });
    if (!isValidStep) return;
    setCurrentStep((step) => Math.min(step + 1, 3) as RegisterStep);
  };

  const goBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 1) as RegisterStep);
  };

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    if (currentStep < 3) {
      event.preventDefault();
      void goToNext();
    }
  };

  const handlePassportInput = (value: string) => {
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleanValue.substring(0, 2) + (cleanValue.length > 2 ? cleanValue.substring(2, 9) : '');
  };

  const handlePhoneInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 9);
    let formatted = cleanValue.substring(0, 2);
    if (cleanValue.length > 2) formatted += ` ${cleanValue.substring(2, 5)}`;
    if (cleanValue.length > 5) formatted += ` ${cleanValue.substring(5, 7)}`;
    if (cleanValue.length > 7) formatted += ` ${cleanValue.substring(7, 9)}`;
    return { formatted, raw: cleanValue };
  };

  const handleDateInput = (value: string, onChange: (date?: Date) => void) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean)
      .join('/');

    setDateInputValue(formatted);
    if (digits.length < 8) {
      onChange(undefined);
      return;
    }

    const parsedDate = parse(formatted, 'dd/MM/yyyy', new Date());
    if (isValid(parsedDate)) onChange(parsedDate);
  };

  const inputClass = [
    'h-[54px] rounded-[18px]',
    'border border-gray-900/[0.07] dark:border-white/[0.095]',
    'bg-white dark:bg-[#10151f]',
    'text-gray-950 dark:text-[#fff8ed]',
    'placeholder:text-gray-400 dark:placeholder:text-[#fff8ed]/42',
    'transition-colors duration-150',
    'shadow-[0_8px_18px_rgba(15,23,42,0.045)]',
    'dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.36),inset_0_-1px_0_rgba(255,255,255,0.055),0_1px_0_rgba(255,255,255,0.045)]',
    'focus:border-orange-500/70 focus:ring-2 focus:ring-orange-500/15 focus:ring-offset-0 focus:outline-none',
  ].join(' ');

  const labelClass = 'ml-0.5 text-[12px] font-black text-gray-800 dark:text-[#fff8ed]/76';
  const iconBoxClass =
    'pointer-events-none absolute left-3 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-[12px] bg-orange-500/10 text-orange-600 dark:bg-white/[0.055] dark:text-amber-300';

  if (isCheckingApplication) {
    return (
      <div className="flex min-h-[40svh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
      </div>
    );
  }

  if (showPendingScreen || existingApplication?.status === 'pending') {
    return (
      <RegistrationPendingScreen
        onContinue={() => {
          setShowPendingScreen(false);
          onNavigateToLogin?.();
        }}
        onWithdrawn={() => {
          // Back to a blank form: the withdrawal freed the phone/passport, so a
          // fresh application can be filled in immediately.
          setShowPendingScreen(false);
          setCurrentStep(1);
          void queryClient.invalidateQueries({ queryKey: MY_APPLICATION_QUERY_KEY });
        }}
      />
    );
  }

  return (
    <>
      {submitStatus !== 'idle' && (
        <StatusAnimation
          status={submitStatus}
          message={submitMessage}
          onComplete={handleAnimationComplete}
        />
      )}

      <div className="mx-auto flex min-h-[calc(100svh-96px)] w-full max-w-md items-center px-4 py-6 sm:px-6">
        <div className="w-full space-y-4">
          <div className="px-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] border border-orange-500/20 bg-orange-500/10 text-orange-600 dark:border-white/[0.085] dark:bg-white/[0.055] dark:text-amber-300">
                <IdCard className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-[24px] font-black leading-tight tracking-normal text-gray-950 dark:text-[#fff8ed]">
                  {t('form.title')}
                </h1>
                <p className="mt-1 text-[12px] font-bold leading-snug text-gray-500 dark:text-[#fff8ed]/56">
                  {steps[currentStep - 1].description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {steps.map((step) => {
                const isActive = currentStep === step.id;
                const isDone = currentStep > step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (step.id < currentStep) setCurrentStep(step.id);
                    }}
                    className={[
                      'min-w-0 rounded-[18px] border px-2 py-2.5 text-left transition',
                      isActive
                        ? 'border-orange-500/35 bg-orange-500/10 dark:border-amber-300/22 dark:bg-white/[0.055]'
                        : 'border-gray-900/[0.06] bg-white/60 dark:border-white/[0.07] dark:bg-white/[0.03]',
                      isDone ? 'opacity-90' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black',
                        isActive || isDone
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-[#fff8ed]/48',
                      ].join(' ')}
                    >
                      {step.id}
                    </span>
                    <span className="block min-h-[24px] text-[10px] font-black leading-[1.15] text-gray-900 dark:text-[#fff8ed] sm:text-[11px]">
                      {step.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-[30px] border border-orange-500/18 bg-white/92 p-5 shadow-[0_22px_46px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-white/[0.085] dark:bg-[#0a0e15] dark:shadow-[0_22px_54px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="pointer-events-none absolute -right-20 -top-14 h-44 w-80 rotate-[-14deg] rounded-[42%] bg-[linear-gradient(110deg,rgba(255,255,255,0.08),transparent_28%),linear-gradient(90deg,rgba(245,158,11,0.16),rgba(59,130,246,0.08),transparent_72%)] opacity-75 blur-[18px]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:100%_42px] [mask-image:linear-gradient(to_bottom,transparent,black_18%,transparent_88%)]" />

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              onKeyDown={handleFormKeyDown}
              className="relative z-10 space-y-4"
            >
              {currentStep === 1 && (
                <>
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.fullName')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className={iconBoxClass}>
                            <UserRound className="h-4 w-4" />
                          </div>
                          <Input
                            placeholder={t('form.fullNamePlaceholder')}
                            {...field}
                            enterKeyHint="next"
                            className={`${inputClass} pl-14 font-bold placeholder:font-bold`}
                          />
                        </div>
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="passportSeries" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.passportSeries')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className={`${iconBoxClass} text-[13px] font-black`}>ID</div>
                          <Input
                            placeholder={t('form.passportSeriesPlaceholder')}
                            {...field}
                            enterKeyHint="next"
                            onChange={(event) => field.onChange(handlePassportInput(event.target.value))}
                            maxLength={9}
                            className={`${inputClass} pl-14 font-mono text-base font-black uppercase tracking-widest placeholder:font-bold placeholder:tracking-normal`}
                          />
                        </div>
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="pinfl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.pinfl')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className={iconBoxClass}>
                            <Hash className="h-4 w-4" />
                          </div>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            enterKeyHint="next"
                            placeholder={t('form.pinflPlaceholder')}
                            {...field}
                            onChange={(event) => field.onChange(event.target.value.replace(/\D/g, ''))}
                            maxLength={14}
                            className={`${inputClass} pl-14 font-mono text-base font-black tracking-wider placeholder:font-bold placeholder:tracking-normal`}
                          />
                        </div>
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className={labelClass}>{t('form.dateOfBirth')}</FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <div className="relative">
                          <Input
                            type="tel"
                            inputMode="numeric"
                            enterKeyHint="next"
                            placeholder="DD/MM/YYYY"
                            value={dateInputValue}
                            onChange={(event) => handleDateInput(event.target.value, field.onChange)}
                            className={`${inputClass} pr-12 font-mono text-base font-black tracking-widest placeholder:font-bold placeholder:tracking-normal`}
                          />
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1.5 top-1/2 h-10 w-10 -translate-y-1/2 rounded-[14px] text-orange-600 hover:bg-orange-500/10 dark:text-amber-300"
                            >
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                        </div>
                        <PopoverContent
                          align="start"
                          className="w-auto overflow-hidden rounded-2xl border-orange-500/20 p-0 shadow-xl dark:border-white/10 dark:bg-[#111827]"
                        >
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              if (date) {
                                setDateInputValue(format(date, 'dd/MM/yyyy'));
                                setIsCalendarOpen(false);
                              }
                            }}
                            disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                            captionLayout="dropdown"
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />
                </>
              )}

              {currentStep === 2 && (
                <>
                  <FormField control={form.control} name="region" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.region')}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('district', '');
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className={`${inputClass} w-full px-4 font-bold`}>
                            <SelectValue placeholder={t('form.regionPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60 overflow-hidden rounded-2xl border-orange-500/20 shadow-xl dark:border-white/10 dark:bg-[#111827]">
                          {regions.map((region) => (
                            <SelectItem
                              key={region.value}
                              value={region.value}
                              className="cursor-pointer rounded-lg dark:text-gray-200 dark:hover:bg-orange-500/10"
                            >
                              {t(region.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="district" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.district')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedRegion}>
                        <FormControl>
                          <SelectTrigger className={`${inputClass} w-full px-4 font-bold`}>
                            <SelectValue placeholder={t('form.districtPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60 overflow-hidden rounded-2xl border-orange-500/20 shadow-xl dark:border-white/10 dark:bg-[#111827]">
                          {selectedRegion &&
                            DISTRICTS[selectedRegion]?.map((district) => (
                              <SelectItem
                                key={district.value}
                                value={district.value}
                                className="cursor-pointer rounded-lg dark:text-gray-200 dark:hover:bg-orange-500/10"
                              >
                                {t(district.label)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.address')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="pointer-events-none absolute left-3 top-4 z-10 grid h-[34px] w-[34px] place-items-center rounded-[12px] bg-orange-500/10 text-orange-600 dark:bg-white/[0.055] dark:text-amber-300">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <textarea
                            placeholder={t('form.addressPlaceholder')}
                            {...field}
                            enterKeyHint="next"
                            rows={3}
                            className={`${inputClass} min-h-[96px] w-full resize-none px-4 py-4 pl-14 font-bold placeholder:font-bold`}
                          />
                        </div>
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.phoneNumber')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className={iconBoxClass}>
                            <Phone className="h-4 w-4" />
                          </div>
                          <div className="pointer-events-none absolute left-[58px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-2">
                            <span className="text-[13px] font-black text-gray-600 dark:text-[#fff8ed]/72">+998</span>
                            <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
                          </div>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            enterKeyHint="next"
                            autoComplete="tel-national"
                            placeholder={t('form.phoneNumberPlaceholder')}
                            value={handlePhoneInput(field.value).formatted}
                            onChange={(event) => field.onChange(handlePhoneInput(event.target.value).raw)}
                            className={`${inputClass} pl-[6.6rem] font-mono text-base font-black tracking-wider placeholder:font-bold placeholder:tracking-normal`}
                          />
                        </div>
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />
                </>
              )}

              {currentStep === 3 && (
                <>
                  <FormField control={form.control} name="passportImages" render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>{t('form.passportImages')}</FormLabel>
                      <div className="space-y-3">
                        <ImageUpload
                          label={t('form.passportImagesFront')}
                          value={frontImage}
                          variant="compact"
                          onChange={(file) => {
                            setFrontImage(file);
                            field.onChange([file, backImage].filter((item): item is File => item !== null));
                          }}
                          error={
                            form.formState.errors.passportImages?.message
                              ? t(form.formState.errors.passportImages.message)
                              : undefined
                          }
                        />
                        <ImageUpload
                          label={t('form.passportImagesBack')}
                          value={backImage}
                          variant="compact"
                          onChange={(file) => {
                            setBackImage(file);
                            field.onChange([frontImage, file].filter((item): item is File => item !== null));
                          }}
                        />
                      </div>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  {/* Required consent — Privacy Policy + User Agreement */}
                  <button
                    type="button"
                    onClick={() => setAgreedToPolicy((v) => !v)}
                    className="flex w-full items-start gap-2.5 rounded-[16px] border border-gray-900/[0.07] bg-white/60 p-3 text-left dark:border-white/[0.09] dark:bg-white/[0.03]"
                  >
                    <span
                      className={[
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border-2 transition-colors',
                        agreedToPolicy
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-gray-300 dark:border-white/25',
                      ].join(' ')}
                    >
                      {agreedToPolicy && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="text-[12px] font-bold leading-snug text-gray-700 dark:text-[#fff8ed]/78">
                      {t('form.consent.prefix', 'Men ')}
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPolicy(true);
                        }}
                        className="cursor-pointer font-black text-orange-600 underline decoration-orange-400/50 underline-offset-2 dark:text-amber-300"
                      >
                        {t('form.consent.link', 'Maxfiylik siyosati va Foydalanuvchi kelishuvi')}
                      </span>
                      {t('form.consent.suffix', 'ga roziman')}
                    </span>
                  </button>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {currentStep === 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onNavigateToLogin}
                    className="h-13 rounded-[18px] border-gray-900/[0.07] bg-white/70 text-[14px] font-black text-gray-700 active:scale-[0.99] dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-[#fff8ed]/70"
                  >
                    {t('form.login')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="h-13 rounded-[18px] border-gray-900/[0.07] bg-white/70 text-[14px] font-black text-gray-700 active:scale-[0.99] dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-[#fff8ed]/70"
                  >
                    {t('form.back')}
                  </Button>
                )}

                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => void goToNext()}
                    className="h-13 rounded-[18px] border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-[14px] font-black text-white shadow-[0_15px_30px_rgba(249,115,22,0.22)] transition-opacity duration-150 hover:opacity-95 active:scale-[0.99]"
                  >
                    {t('form.next')}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitStatus === 'loading' || !agreedToPolicy}
                    className="h-13 rounded-[18px] border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-[14px] font-black text-white shadow-[0_15px_30px_rgba(249,115,22,0.22)] transition-opacity duration-150 hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('form.submit')}
                  </Button>
                )}
              </div>

              <p className="pt-1 text-center text-[12px] font-bold text-gray-500 dark:text-[#fff8ed]/52">
                {t('form.haveAccount')}{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-black text-orange-600 transition-colors hover:text-orange-500 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  {t('form.login')}
                </button>
              </p>
            </form>
          </Form>
          </div>
        </div>
      </div>

      <PrivacyPolicyModal open={showPolicy} onClose={() => setShowPolicy(false)} />
    </>
  );
}
