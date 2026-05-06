import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parse, isValid } from 'date-fns';
import {
  MapPin, Phone, User, Hash, Globe, Calendar as CalendarIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import StatusAnimation from '@/components/StatusAnimation';
import {
  createClient, updateClient, deleteClient as deleteClientApi,
  type Client, type ClientCreateRequest, previewClientCode,
} from '@/api/services/client';
import { regions, DISTRICTS } from '@/lib/validation';

import { clientSchema, type ClientFormData } from './client-form/schema';
import { PassportUploadSection } from './client-form/PassportUploadSection';
import { BalanceAdjustmentSection } from './client-form/BalanceAdjustmentSection';

interface ClientFormProps {
  mode: 'add' | 'edit';
  clientData?: Client;
  clientId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ClientForm({ mode, clientData, clientId, onSuccess, onCancel }: ClientFormProps) {
  const { t } = useTranslation();
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontImagePreview, setFrontImagePreview] = useState<string | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoUpdateCode, setAutoUpdateCode] = useState(false);
  const [originalCode, setOriginalCode] = useState('');
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      telegram_id: clientData?.telegram_id?.toString() || '',
      full_name: clientData?.full_name || '',
      client_code: clientData?.extra_code || clientData?.client_code || '',
      passport_series: clientData?.passport_series || '',
      date_of_birth: undefined,
      region: clientData?.region || '',
      district: clientData?.district || '',
      address: clientData?.address || '',
      phone: clientData?.phone?.replace('+998', '') || '',
      pinfl: clientData?.pinfl || '',
      referrer_telegram_id: clientData?.referrer_telegram_id?.toString() || '',
      referrer_client_code: clientData?.referrer_client_code || '',
      passportImages: [],
      adjustment_amount: '',
      adjustment_reason: '',
      adjustment_type: '',
    },
  });

  const selectedDistrict = form.watch('district');
  const selectedRegion = form.watch('region');

  // Debounce bilan Live Preview API
  useEffect(() => {
    const initialRegion = clientData?.region || '';
    const initialDistrict = clientData?.district || '';
    const isChanged = mode === 'add' || selectedRegion !== initialRegion || selectedDistrict !== initialDistrict;

    if (!selectedRegion || !selectedDistrict || !isChanged) {
      setPreviewCode(null);
      setIsLoadingPreview(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewError(null);
    const timeoutId = setTimeout(() => {
      setIsLoadingPreview(true);
      previewClientCode(selectedRegion, selectedDistrict)
        .then((data) => {
          if (!cancelled) {
            setPreviewCode(data.preview_code);
            setPreviewError(null);
            if (autoUpdateCode) {
              form.setValue('client_code', data.preview_code, { shouldValidate: true, shouldDirty: true });
            }
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            console.error('Preview error:', error);
            setPreviewCode(null);
            const msg = error && typeof error === 'object' && 'message' in error
              ? String((error as { message: string }).message)
              : 'Preview code olishda xatolik';
            setPreviewError(msg);
          }
        })
        .finally(() => { if (!cancelled) setIsLoadingPreview(false); });
    }, 500);

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [selectedRegion, selectedDistrict, mode, clientData, form, autoUpdateCode]);

  // Load existing data in edit mode
  useEffect(() => {
    const loadClientData = async () => {
      if (mode !== 'edit' || !clientId) return;
      try {
        setSubmitStatus('loading');
        setSubmitMessage(t('client.messages.loadingEdit'));
        setIsLoadingImages(true);

        const { getClient, getPassportImagesMetadata } = await import('@/api/services/client');
        const [clientRes, imagesMetadataRes] = await Promise.allSettled([
          getClient(clientId),
          getPassportImagesMetadata(clientId, true),
        ]);

        if (clientRes.status === 'fulfilled') {
          const data = clientRes.value;
          form.setValue('telegram_id', data.telegram_id?.toString() || '');
          form.setValue('full_name', data.full_name || '');
          const fetchedCode = data.extra_code || data.client_code || '';
          setOriginalCode(fetchedCode);
          form.setValue('client_code', fetchedCode);
          form.setValue('passport_series', data.passport_series || '');
          form.setValue('region', data.region || '');
          form.setValue('district', data.district || '');
          form.setValue('address', data.address || '');
          form.setValue('phone', data.phone?.replace('+998', '') || '');
          form.setValue('pinfl', data.pinfl || '');
          form.setValue('referrer_telegram_id', data.referrer_telegram_id?.toString() || '');
          form.setValue('referrer_client_code', data.referrer_client_code || '');
          setCurrentBalance(data.current_balance ?? 0);

          if (data.date_of_birth) {
            try {
              const date = parse(data.date_of_birth, 'yyyy-MM-dd', new Date());
              if (isValid(date)) {
                setDateInputValue(format(date, 'dd/MM/yyyy'));
                form.setValue('date_of_birth', date);
              }
            } catch (e) { console.error('Error parsing date_of_birth:', e); }
          }
        }
        setSubmitStatus('idle');

        if (imagesMetadataRes.status === 'fulfilled') {
          const metadata = imagesMetadataRes.value;
          const front = metadata.images.find((img) => img.index === 0);
          if (front?.telegram_url) { setFrontImagePreview(front.telegram_url); form.clearErrors('passportImages'); }
          const back = metadata.images.find((img) => img.index === 1);
          if (back?.telegram_url) setBackImagePreview(back.telegram_url);
        }
        setIsLoadingImages(false);
        setSubmitMessage('');
      } catch (error: unknown) {
        console.error('Error loading client:', error);
        setIsLoadingImages(false);
        setSubmitStatus('error');
        setSubmitMessage(getErrorMessage(error, t('client.messages.error')));
      }
    };
    loadClientData();
  }, [mode, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error !== null) {
      const e = error as { message?: string; data?: { detail?: string; message?: string } };
      return e.data?.detail ?? e.data?.message ?? e.message ?? fallback;
    }
    return fallback;
  };

  useEffect(() => {
    if (selectedRegion) form.setValue('district', '');
  }, [selectedRegion, form]);

  const handlePassportInput = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = '';
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2);
      if (cleaned.length > 2) formatted += cleaned.substring(2, 9);
    }
    return formatted;
  };

  const handleDateInput = (value: string, onChange: (date?: Date) => void) => {
    const cleaned = value.replace(/[^\d/]/g, '');
    let formatted = cleaned;
    if (cleaned.length >= 2 && !cleaned.includes('/')) {
      formatted = cleaned.substring(0, 2) + '/' + cleaned.substring(2);
    }
    if (cleaned.length >= 5 && cleaned.split('/').length === 2) {
      const parts = cleaned.split('/');
      formatted = parts[0] + '/' + parts[1].substring(0, 2) + '/' + parts[1].substring(2);
    }
    setDateInputValue(formatted);
    if (formatted.length === 10) {
      const parsedDate = parse(formatted, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) onChange(parsedDate);
    }
  };

  const updatePassportImages = (front: File | null, back: File | null) => {
    const images: File[] = [];
    if (front) images.push(front);
    if (back) images.push(back);
    form.setValue('passportImages', images);
    if (images.length > 0) form.clearErrors('passportImages');
  };

  const handleFrontImageChange = (file: File | null) => {
    setFrontImage(file);
    updatePassportImages(file, backImage);
  };

  const handleBackImageChange = (file: File | null) => {
    setBackImage(file);
    updatePassportImages(frontImage, file);
  };

  const onSubmit = async (data: ClientFormData) => {
    if (mode === 'add' && (!data.passportImages || data.passportImages.length === 0)) {
      setSubmitStatus('error');
      setSubmitMessage(t('client.validation.passportImagesRequired'));
      setTimeout(() => setSubmitStatus('idle'), 3000);
      return;
    }
    if (mode === 'edit' && (!data.passportImages || data.passportImages.length === 0)) {
      if (!frontImagePreview && !backImagePreview) {
        setSubmitStatus('error');
        setSubmitMessage(t('client.validation.passportImagesRequired'));
        setTimeout(() => setSubmitStatus('idle'), 3000);
        return;
      }
    }

    setSubmitStatus('loading');
    setSubmitMessage(t(mode === 'add' ? 'client.messages.loadingAdd' : 'client.messages.loadingEdit'));

    try {
      const requestData: ClientCreateRequest = { full_name: data.full_name };
      if (data.telegram_id) requestData.telegram_id = parseInt(data.telegram_id, 10);
      if (data.client_code) requestData.client_code = data.client_code.trim().toUpperCase();
      if (data.passport_series) requestData.passport_series = data.passport_series;
      if (data.pinfl) requestData.pinfl = data.pinfl;
      if (data.date_of_birth) requestData.date_of_birth = format(data.date_of_birth, 'yyyy-MM-dd');
      if (data.region) requestData.region = data.region;
      if (data.district) requestData.district = data.district;
      if (data.address) requestData.address = data.address;
      if (data.phone) requestData.phone = `+998${data.phone}`;
      if (data.referrer_telegram_id) requestData.referrer_telegram_id = parseInt(data.referrer_telegram_id, 10);
      if (data.referrer_client_code) requestData.referrer_client_code = data.referrer_client_code.trim().toUpperCase();
      if (data.passportImages && data.passportImages.length > 0) requestData.passport_images = data.passportImages;

      if (mode === 'edit' && data.adjustment_amount && data.adjustment_type) {
        requestData.adjustment_amount = parseFloat(data.adjustment_amount);
        requestData.adjustment_reason = data.adjustment_reason || 'Admin tahriri';
        requestData.adjustment_type = data.adjustment_type as 'bonus' | 'penalty' | 'silent';
      }

      if (mode === 'add') await createClient(requestData);
      else if (mode === 'edit' && clientId) await updateClient(clientId, requestData);

      setSubmitStatus('success');
      setSubmitMessage(t(mode === 'add' ? 'client.messages.successAdd' : 'client.messages.successEdit'));
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
      }, 2000);
    } catch (error: unknown) {
      console.error('Client form error:', error);
      setSubmitStatus('error');
      setSubmitMessage(getErrorMessage(error, t('client.messages.error')));
    }
  };

  const handleDelete = async () => {
    if (!clientId) return;
    if (!window.confirm(t('client.messages.deleteConfirm'))) return;
    setSubmitStatus('loading');
    setSubmitMessage(t('client.messages.loadingEdit'));
    try {
      await deleteClientApi(clientId);
      setSubmitStatus('success');
      setSubmitMessage(t('client.messages.successEdit'));
      setTimeout(() => {
        if (onCancel) onCancel();
        else if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
      }, 2000);
    } catch (error: unknown) {
      console.error('Delete client error:', error);
      setSubmitStatus('error');
      setSubmitMessage(getErrorMessage(error, t('client.messages.error')));
    }
  };

  return (
    <>
      {submitStatus !== 'idle' && (
        <StatusAnimation status={submitStatus} message={submitMessage} onComplete={() => { setSubmitStatus('idle'); setSubmitMessage(''); }} />
      )}

      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-orange-200/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-orange-400/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -z-10" />

          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
              {t(mode === 'add' ? 'client.addTitle' : 'client.editTitle')}
            </h1>
            {mode === 'edit' && clientData?.full_name && (
              <p className="text-gray-600 text-lg">
                {clientData.full_name} {clientData.client_code && `(${clientData.client_code})`}
              </p>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Telegram ID */}
              <FormField control={form.control} name="telegram_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <Hash className="w-4 h-4 text-orange-500" /> {t('client.telegramId')}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400" placeholder={t('client.telegramIdPlaceholder')} />
                  </FormControl>
                  {form.formState.errors.telegram_id && <p className="text-red-500 text-sm">{t(form.formState.errors.telegram_id.message as string)}</p>}
                </FormItem>
              )} />

              {/* Client Code */}
              <FormField control={form.control} name="client_code" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <Hash className="w-4 h-4 text-orange-500" /> {t('client.clientId')}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400 uppercase" placeholder={t('client.clientIdPlaceholder')} />
                  </FormControl>
                  {form.formState.errors.client_code && <p className="text-red-500 text-sm">{t(form.formState.errors.client_code.message as string)}</p>}
                </FormItem>
              )} />

              {/* Full Name */}
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-orange-500" /> {t('client.fullName')} <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400" placeholder={t('client.fullNamePlaceholder')} maxLength={256} />
                  </FormControl>
                  {form.formState.errors.full_name && <p className="text-red-500 text-sm">{t(form.formState.errors.full_name.message as string)}</p>}
                </FormItem>
              )} />

              {/* Passport Series */}
              <FormField control={form.control} name="passport_series" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">{t('client.passportSeries')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('client.passportSeriesPlaceholder')} {...field} onChange={(e) => field.onChange(handlePassportInput(e.target.value))}
                      maxLength={9} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400 uppercase" />
                  </FormControl>
                  {form.formState.errors.passport_series && <p className="text-red-500 text-sm">{t(form.formState.errors.passport_series.message as string)}</p>}
                </FormItem>
              )} />

              {/* PINFL */}
              <FormField control={form.control} name="pinfl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">{t('client.pinfl')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('client.pinflPlaceholder')} {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      maxLength={14} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400" />
                  </FormControl>
                  {form.formState.errors.pinfl && <p className="text-red-500 text-sm">{t(form.formState.errors.pinfl.message as string)}</p>}
                </FormItem>
              )} />

              {/* Date of Birth */}
              <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-gray-700 font-medium">{t('client.dateOfBirth')}</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <div className="relative">
                      <Input placeholder="DD/MM/YYYY" value={field.value ? format(field.value, 'dd/MM/yyyy') : dateInputValue}
                        onChange={(e) => handleDateInput(e.target.value, field.onChange)}
                        onFocus={() => { if (!dateInputValue && !field.value) setDateInputValue(''); }}
                        className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400 pr-10" />
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full hover:bg-orange-50">
                          <CalendarIcon className="h-4 w-4 text-orange-500" />
                        </Button>
                      </PopoverTrigger>
                    </div>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); if (date) { setDateInputValue(format(date, 'dd/MM/yyyy')); setIsCalendarOpen(false); } }}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')} captionLayout="dropdown" startMonth={new Date(1900, 0)} endMonth={new Date(new Date().getFullYear(), 11)} />
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.date_of_birth && <p className="text-red-500 text-sm">{t(form.formState.errors.date_of_birth.message as string)}</p>}
                </FormItem>
              )} />

              {/* Region */}
              <FormField control={form.control} name="region" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-orange-500" /> {t('client.region')}
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="w-full bg-orange-50/50 border-orange-200 focus:border-orange-500 focus:ring-orange-500">
                        <SelectValue placeholder={t('client.regionPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.value} value={region.value} className="cursor-pointer hover:bg-orange-50 focus:bg-orange-100">{t(region.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.region && <p className="text-red-500 text-sm">{t(form.formState.errors.region.message as string)}</p>}
                </FormItem>
              )} />

              {/* District */}
              <FormField control={form.control} name="district" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" /> {t('client.district')}
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedRegion}>
                    <FormControl>
                      <SelectTrigger className="w-full bg-orange-50/50 border-orange-200 focus:border-orange-500 focus:ring-orange-500">
                        <SelectValue placeholder={t('client.districtPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectedRegion && DISTRICTS[selectedRegion as keyof typeof DISTRICTS]?.map((dist) => (
                        <SelectItem key={dist.value} value={dist.value} className="cursor-pointer hover:bg-orange-50 focus:bg-orange-100">{t(dist.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.district && <p className="text-red-500 text-sm">{t(form.formState.errors.district.message as string)}</p>}
                  {selectedDistrict && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                      {isLoadingPreview ? (
                        <span className="text-orange-500 text-sm flex items-center gap-2 animate-pulse">
                          <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /> Hisoblanmoqda...
                        </span>
                      ) : previewCode ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                          <Hash className="w-3.5 h-3.5" /> Kutilayotgan kod: <span className="font-bold text-green-800 tracking-wide">{previewCode}</span>
                        </div>
                      ) : previewError ? <span className="text-red-500 text-sm">{previewError}</span> : null}
                    </div>
                  )}
                </FormItem>
              )} />

              {/* Auto-update code toggle */}
              {selectedDistrict && (
                <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3">
                  <span className="text-sm font-medium text-gray-700">{t('client.autoUpdateCode', 'Kod avto-yangilansinmi?')}</span>
                  <Switch checked={autoUpdateCode} onCheckedChange={(checked) => {
                    setAutoUpdateCode(checked);
                    if (checked && previewCode) form.setValue('client_code', previewCode, { shouldValidate: true, shouldDirty: true });
                    else if (!checked) form.setValue('client_code', originalCode, { shouldValidate: true, shouldDirty: true });
                  }} />
                </div>
              )}

              {/* Address */}
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" /> {t('client.address')}
                  </FormLabel>
                  <FormControl>
                    <textarea {...field} rows={4} className="w-full px-3 py-2 bg-orange-50/50 border border-orange-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:ring-orange-500 focus:outline-none resize-none"
                      placeholder={t('client.addressPlaceholder')} maxLength={512} />
                  </FormControl>
                  {form.formState.errors.address && <p className="text-red-500 text-sm">{t(form.formState.errors.address.message as string)}</p>}
                </FormItem>
              )} />

              {/* Phone */}
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-orange-500" /> {t('client.phone')}
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 font-medium">+998</span>
                      <Input {...field} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400" placeholder={t('client.phonePlaceholder')} maxLength={9} />
                    </div>
                  </FormControl>
                  {form.formState.errors.phone && <p className="text-red-500 text-sm">{t(form.formState.errors.phone.message as string)}</p>}
                </FormItem>
              )} />

              {/* Passport Images */}
              <PassportUploadSection
                form={form}
                frontImagePreview={frontImagePreview}
                backImagePreview={backImagePreview}
                isLoadingImages={isLoadingImages}
                onFrontImageChange={handleFrontImageChange}
                onBackImageChange={handleBackImageChange}
                t={t}
              />

              {/* Referrer Telegram ID */}
              <FormField control={form.control} name="referrer_telegram_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">{t('client.referrerTelegramId')}</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400" placeholder={t('client.referrerTelegramIdPlaceholder')} />
                  </FormControl>
                  {form.formState.errors.referrer_telegram_id && <p className="text-red-500 text-sm">{t(form.formState.errors.referrer_telegram_id.message as string)}</p>}
                </FormItem>
              )} />

              {/* Referrer Client Code */}
              <FormField control={form.control} name="referrer_client_code" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">{t('client.referrerClientCode')}</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-orange-50/50 text-gray-900 placeholder:text-gray-400 uppercase" placeholder={t('client.referrerClientCodePlaceholder')} />
                  </FormControl>
                  {form.formState.errors.referrer_client_code && <p className="text-red-500 text-sm">{t(form.formState.errors.referrer_client_code.message as string)}</p>}
                </FormItem>
              )} />

              {/* Registration Date (Edit mode only) */}
              {mode === 'edit' && clientData?.created_at && (
                <div>
                  <label className="text-gray-700 font-medium mb-2 block">{t('client.registrationDate')}</label>
                  <p className="text-gray-600 bg-orange-50/50 px-3 py-2 rounded-lg border border-orange-200">{clientData.created_at}</p>
                </div>
              )}

              {/* Balance Adjustment (Edit mode only) */}
              {mode === 'edit' && <BalanceAdjustmentSection form={form} currentBalance={currentBalance} />}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-6 border-t border-orange-200">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all" disabled={submitStatus === 'loading'}>
                  {t('client.submit')}
                </Button>
                {mode === 'edit' && (
                  <Button type="button" onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all" disabled={submitStatus === 'loading'}>
                    {t('client.delete')}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </>
  );
}
