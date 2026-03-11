import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, MapPin, Phone, Sparkles } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { useState, useEffect } from 'react';
import { register as registerApi, getTelegramWebAppData } from '@/api/services/auth';
import StatusAnimation from './StatusAnimation';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import ImageUpload from './ImageUpload';
import TranslatedFormMessage from './TranslatedFormMessage';
import { formSchema, regions, DISTRICTS, type RegistrationFormData } from '@/lib/validation';

interface RegistrationFormProps {
  onNavigateToLogin?: () => void;
}

export default function RegistrationForm({ onNavigateToLogin }: RegistrationFormProps) {
  const { t } = useTranslation();

  // Reverse Auth Guard fallback: redirect if already authenticated
  useEffect(() => {
    if (sessionStorage.getItem('access_token') && onNavigateToLogin) {
      onNavigateToLogin();
    }
  }, [onNavigateToLogin]);

  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [dateInputValue, setDateInputValue] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

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

  const onSubmit = async (data: RegistrationFormData) => {
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
      };
      const response = await registerApi(registerData);
      setSubmitStatus('success');
      setSubmitMessage(response.message || t('form.messages.success'));
      form.reset();
      setFrontImage(null);
      setBackImage(null);
      setDateInputValue('');
      setTimeout(() => {
        if (onNavigateToLogin) {
          onNavigateToLogin();
        }
      }, 1500);
    } catch (error: unknown) {
      setSubmitStatus('error');
      const message = typeof error === 'object' && error !== null && 'message' in (error as object) ? (error as { message?: string }).message : undefined;
      setSubmitMessage(message || t('form.messages.generalError'));

    }
  };

  const handleAnimationComplete = () => {
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  const handlePassportInput = (v: string) => {
    const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.substring(0, 2) + (c.length > 2 ? c.substring(2, 9) : '');
  };

  const handlePhoneInput = (v: string) => {
    const c = v.replace(/\D/g, '');
    let f = c.substring(0, 2);
    if (c.length > 2) f += ' ' + c.substring(2, 5);
    if (c.length > 5) f += ' ' + c.substring(5, 7);
    if (c.length > 7) f += ' ' + c.substring(7, 9);
    return { formatted: f, raw: c };
  };

  const handleDateInput = (v: string, onChange: (d?: Date) => void) => {
    const c = v.replace(/[^\d/]/g, '');
    let f = c;
    if (c.length >= 2 && !c.includes('/')) f = c.substring(0, 2) + '/' + c.substring(2);
    if (c.length >= 5 && c.split('/').length === 2) {
      const p = c.split('/');
      f = p[0] + '/' + p[1].substring(0, 2) + '/' + p[1].substring(2);
    }
    setDateInputValue(f);
    if (f.length === 10) {
      const d = parse(f, 'dd/MM/yyyy', new Date());
      if (isValid(d)) onChange(d);
    }
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

      <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
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
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 bg-clip-text text-transparent">
                {t('form.title')}
              </h1>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-400 opacity-50" />
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-orange-400 opacity-50" />
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Full Name */}
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                      {t('form.fullName')}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('form.fullNamePlaceholder')} {...field} className={inp} />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )} />

                {/* Passport + PINFL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="passportSeries" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                        {t('form.passportSeries')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('form.passportSeriesPlaceholder')}
                          {...field}
                          onChange={(e) => field.onChange(handlePassportInput(e.target.value))}
                          maxLength={9}
                          className={`${inp} uppercase font-mono tracking-widest placeholder:tracking-normal placeholder:font-normal`}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="pinfl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                        {t('form.pinfl')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('form.pinflPlaceholder')}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                          maxLength={14}
                          className={`${inp} font-mono tracking-wider placeholder:tracking-normal placeholder:font-normal`}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Date of Birth */}
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                      {t('form.dateOfBirth')}
                    </FormLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <div className="relative">
                        <Input
                          placeholder="DD/MM/YYYY"
                          value={field.value ? format(field.value, 'dd/MM/yyyy') : dateInputValue}
                          onChange={(e) => handleDateInput(e.target.value, field.onChange)}
                          onFocus={() => { if (!dateInputValue && !field.value) setDateInputValue(''); }}
                          className={`${inp} pr-12 font-mono tracking-widest placeholder:tracking-normal placeholder:font-normal`}
                        />
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10"
                          >
                            <CalendarIcon className="h-4 w-4 text-orange-400" />
                          </Button>
                        </PopoverTrigger>
                      </div>
                      <PopoverContent
                        align="start"
                        className="w-auto p-0 dark:bg-[#1a1209] dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-xl"
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
                          disabled={(d) => d > new Date() || d < new Date('1900-01-01')}
                          captionLayout="dropdown"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                        />
                      </PopoverContent>
                    </Popover>
                    <TranslatedFormMessage />
                  </FormItem>
                )} />

                {/* Region & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="region" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        {t('form.region')}
                      </FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('district', '');
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={`${inp} w-full`}>
                            <SelectValue placeholder={t('form.regionPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-[#1a1209] dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-xl max-h-60">
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

                  <FormField control={form.control} name="district" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-500 opacity-50" />
                        {t('form.district')}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch('region')}>
                        <FormControl>
                          <SelectTrigger className={`${inp} w-full`}>
                            <SelectValue placeholder={t('form.districtPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-[#1a1209] dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-xl max-h-60">
                          {form.watch('region') && DISTRICTS[form.watch('region')]?.map((d) => (
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
                </div>

                {/* Address */}
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide">
                      {t('form.address')}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('form.addressPlaceholder')} {...field} className={inp} />
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )} />

                {/* Phone */}
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm text-gray-700 dark:text-gray-200 tracking-wide flex items-center gap-2">
                      <Phone className="w-4 h-4 text-orange-500" />
                      {t('form.phoneNumber')}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">+998</span>
                          <div className="w-px h-4 bg-gray-300 dark:bg-white/20" />
                        </div>
                        <Input
                          placeholder={t('form.phoneNumberPlaceholder')}
                          value={handlePhoneInput(field.value).formatted}
                          onChange={(e) => field.onChange(handlePhoneInput(e.target.value).raw)}
                          className={`${inp} pl-[4.5rem] font-mono tracking-wider placeholder:tracking-normal placeholder:font-normal`}
                        />
                      </div>
                    </FormControl>
                    <TranslatedFormMessage />
                  </FormItem>
                )} />

                {/* Passport Images */}
                <FormField control={form.control} name="passportImages" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-base text-gray-700 dark:text-gray-200">
                      {t('form.passportImages')}
                    </FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <ImageUpload
                        label={t('form.passportImagesFront')}
                        value={frontImage}
                        onChange={(file) => {
                          setFrontImage(file);
                          field.onChange([file, backImage].filter((f): f is File => f !== null));
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
                        onChange={(file) => {
                          setBackImage(file);
                          field.onChange([frontImage, file].filter((f): f is File => f !== null));
                        }}
                      />
                    </div>
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
                    {t('form.submit')}
                  </Button>
                </div>

                <div className="text-center pb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('form.haveAccount')}{' '}
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="text-orange-500 hover:text-orange-400 font-semibold transition-colors underline underline-offset-2 decoration-orange-400/50"
                    >
                      {t('form.login')}
                    </button>
                  </p>
                </div>

              </form>
            </Form>
          </div>
        </div>
      </div>
    </>
  );
}
