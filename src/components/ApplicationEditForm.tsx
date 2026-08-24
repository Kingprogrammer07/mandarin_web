import { useState } from 'react';
import type { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { format, isValid, parse } from 'date-fns';
import { Calendar as CalendarIcon, Hash, Loader2, MapPin, Phone, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageUpload from './ImageUpload';
import TranslatedFormMessage from './TranslatedFormMessage';
import { applicationService, type MyApplication } from '@/api/services/application';
import { DISTRICTS, formSchema, regions } from '@/lib/validation';

/**
 * Correct a registration application that is still waiting for approval.
 *
 * Uses the registration schema minus the photo requirement: the applicant
 * already has photos on file, so each side is optional here and replaces only
 * itself. Only fields the user actually changed are sent, which keeps the
 * server-side uniqueness check from flagging an untouched phone number as a
 * duplicate of itself.
 */

const editSchema = formSchema.omit({ passportImages: true });
type ApplicationEditData = z.infer<typeof editSchema>;

interface ApplicationEditFormProps {
  application: MyApplication;
  onSaved: (updated: MyApplication) => void;
  onCancel: () => void;
}

/** "+998901234567" → "901234567"; anything unexpected is left for the user to fix. */
function toLocalPhoneDigits(phone: string | null): string {
  return (phone ?? '').replace(/^\+998/, '').replace(/\D/g, '').slice(0, 9);
}

function toDate(isoDate: string | null): Date | undefined {
  if (!isoDate) return undefined;
  const parsed = parse(isoDate, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : undefined;
}

export default function ApplicationEditForm({
  application,
  onSaved,
  onCancel,
}: ApplicationEditFormProps) {
  const { t } = useTranslation();
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dateInputValue, setDateInputValue] = useState(() => {
    const parsed = toDate(application.date_of_birth);
    return parsed ? format(parsed, 'dd/MM/yyyy') : '';
  });

  const form = useForm<ApplicationEditData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fullName: application.full_name ?? '',
      passportSeries: application.passport_series ?? '',
      pinfl: application.pinfl ?? '',
      dateOfBirth: toDate(application.date_of_birth),
      region: application.region ?? '',
      district: application.district ?? '',
      address: application.address ?? '',
      phoneNumber: toLocalPhoneDigits(application.phone),
    },
  });

  const selectedRegion = form.watch('region');

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

  const onSubmit = async (data: ApplicationEditData) => {
    const phone = `+998${data.phoneNumber}`;
    const birthDate = format(data.dateOfBirth, 'yyyy-MM-dd');

    // Send only what moved. An unchanged phone resubmitted as "new" would be
    // compared against the whole table and could read as its own duplicate.
    const patch = {
      ...(data.fullName !== application.full_name ? { full_name: data.fullName } : {}),
      ...(data.passportSeries !== application.passport_series
        ? { passport_series: data.passportSeries }
        : {}),
      ...(data.pinfl !== application.pinfl ? { pinfl: data.pinfl } : {}),
      ...(data.region !== application.region ? { region: data.region } : {}),
      ...(data.district !== application.district ? { district: data.district } : {}),
      ...(data.address !== application.address ? { address: data.address } : {}),
      ...(phone !== application.phone ? { phone_number: phone } : {}),
      ...(birthDate !== application.date_of_birth ? { date_of_birth: birthDate } : {}),
      ...(frontImage ? { passport_front: frontImage } : {}),
      ...(backImage ? { passport_back: backImage } : {}),
    };

    if (Object.keys(patch).length === 0) {
      toast.info(t('application.edit.nothingChanged'));
      onCancel();
      return;
    }

    setIsSaving(true);
    try {
      const updated = await applicationService.update(patch);
      toast.success(t('application.edit.saved'));
      onSaved(updated);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || t('application.edit.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = [
    'h-[54px] rounded-[18px]',
    'border border-mc-border',
    'bg-mc-surface',
    'text-mc-text',
    'placeholder:text-mc-text-3',
    'focus:border-mc-brand/70 focus:ring-2 focus:ring-mc-brand/20 focus:outline-none',
  ].join(' ');
  const labelClass = 'ml-0.5 text-[12px] font-black text-mc-text';
  const iconBoxClass =
    'pointer-events-none absolute left-3 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-[12px] bg-mc-brand/10 text-mc-brand dark:bg-white/[0.055] dark:text-mc-brand';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-left">
        <FormField control={form.control} name="fullName" render={({ field }) => (
          <FormItem>
            <FormLabel className={labelClass}>{t('form.fullName')}</FormLabel>
            <FormControl>
              <div className="relative">
                <div className={iconBoxClass}><UserRound className="h-4 w-4" /></div>
                <Input {...field} className={`${inputClass} pl-14 font-bold`} />
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
                  {...field}
                  maxLength={9}
                  onChange={(event) => {
                    const clean = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    field.onChange(clean.substring(0, 2) + clean.substring(2, 9));
                  }}
                  className={`${inputClass} pl-14 font-mono text-base font-black uppercase tracking-widest`}
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
                <div className={iconBoxClass}><Hash className="h-4 w-4" /></div>
                <Input
                  {...field}
                  type="tel"
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(event) => field.onChange(event.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} pl-14 font-mono text-base font-black tracking-wider`}
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
                  placeholder="DD/MM/YYYY"
                  value={dateInputValue}
                  onChange={(event) => handleDateInput(event.target.value, field.onChange)}
                  className={`${inputClass} pr-12 font-mono text-base font-black tracking-widest`}
                />
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 h-10 w-10 -translate-y-1/2 rounded-[14px] text-mc-brand"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </div>
              <PopoverContent
                align="start"
                className="w-auto overflow-hidden rounded-mc-lg border-mc-brand/20 p-0 shadow-xl dark:border-white/10"
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

        <FormField control={form.control} name="region" render={({ field }) => (
          <FormItem>
            <FormLabel className={labelClass}>{t('form.region')}</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue('district', '');
              }}
            >
              <FormControl>
                <SelectTrigger className={`${inputClass} w-full px-4 font-bold`}>
                  <SelectValue placeholder={t('form.regionPlaceholder')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-60 overflow-hidden rounded-mc-lg border-mc-brand/20 shadow-xl dark:border-white/10">
                {regions.map((region) => (
                  <SelectItem key={region.value} value={region.value} className="cursor-pointer rounded-mc-sm">
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
              <SelectContent className="max-h-60 overflow-hidden rounded-mc-lg border-mc-brand/20 shadow-xl dark:border-white/10">
                {selectedRegion &&
                  DISTRICTS[selectedRegion]?.map((district) => (
                    <SelectItem key={district.value} value={district.value} className="cursor-pointer rounded-mc-sm">
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
                <div className="pointer-events-none absolute left-3 top-4 z-10 grid h-[34px] w-[34px] place-items-center rounded-[12px] bg-mc-brand/10 text-mc-brand dark:bg-white/[0.055] dark:text-mc-brand">
                  <MapPin className="h-4 w-4" />
                </div>
                <textarea
                  {...field}
                  rows={3}
                  className={`${inputClass} min-h-[96px] w-full resize-none px-4 py-4 pl-14 font-bold`}
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
                <div className={iconBoxClass}><Phone className="h-4 w-4" /></div>
                <span className="pointer-events-none absolute left-[58px] top-1/2 z-10 -translate-y-1/2 text-[13px] font-black text-mc-text-2">
                  +998
                </span>
                <Input
                  {...field}
                  type="tel"
                  inputMode="numeric"
                  onChange={(event) => field.onChange(event.target.value.replace(/\D/g, '').slice(0, 9))}
                  className={`${inputClass} pl-[6.6rem] font-mono text-base font-black tracking-wider`}
                />
              </div>
            </FormControl>
            <TranslatedFormMessage />
          </FormItem>
        )} />

        <div className="space-y-3">
          <p className="text-[12px] font-bold text-mc-text-2 dark:text-white/45">
            {t('application.edit.photosHint')}
          </p>
          <ImageUpload
            label={t('form.passportImagesFront')}
            variant="compact"
            value={frontImage ?? application.passport_image_urls[0] ?? null}
            onChange={setFrontImage}
          />
          <ImageUpload
            label={t('form.passportImagesBack')}
            variant="compact"
            value={backImage ?? application.passport_image_urls[1] ?? null}
            onChange={setBackImage}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="h-12 rounded-mc-lg font-black"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-12 rounded-mc-lg bg-gradient-to-r from-mc-brand to-mc-brand-strong font-black text-white"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('application.edit.save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
