import { useState, useCallback, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Upload, Link2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

import { uploadCarouselMedia } from '../../../api/services/adminCarousel';
import type {
  CarouselItemCreateRequest,
  CarouselItemUpdateRequest,
  CarouselMediaItemResponse,
  CarouselMediaType,
  CarouselMediaItemInput,
} from '../../../api/services/adminCarousel';
import LightSelect from '../../../components/ui/LightSelect';
import { GalleryMediaSection } from './GalleryMediaSection';
import { UploadZone } from './UploadZone';
import { ColorPickerField } from './ColorPickerField';
import { HomeCarouselCard } from '../../../components/user/HomeCarouselCard';
import {
  carouselFormSchema,
  EMPTY_FORM,
  UPLOAD_IDLE,
  ITEM_TYPE_OPTIONS,
  MEDIA_TYPE_OPTIONS,
  galleryItemFromApiMedia,
  type CarouselFormValues,
  type GalleryItemState,
  type MediaInputMode,
  type UploadState,
} from './types';
import { inputClass, detectMediaTypeFromMime } from './utils';

interface CarouselFormProps {
  defaultValues?: CarouselFormValues;
  /** Pre-populated gallery slides when editing a feature item */
  defaultMediaItems?: CarouselMediaItemResponse[];
  /** Editing an existing item: cleared fields are sent as null and the
   *  gallery is always sent, so both can actually be emptied. */
  isEdit?: boolean;
  onSubmit: (data: CarouselItemCreateRequest | CarouselItemUpdateRequest) => void;
  onUploadStateChange?: (state: UploadState) => void;
}

/** The API error text (already Uzbek, e.g. the size limit), or a fallback. */
function errorText(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

const UPLOAD_FAILED = "Fayl yuklanmadi. Hajmini yoki turini tekshiring.";

export function CarouselForm({ defaultValues, defaultMediaItems, isEdit = false, onSubmit, onUploadStateChange }: CarouselFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CarouselFormValues>({
    resolver: zodResolver(carouselFormSchema),
    defaultValues: defaultValues ?? EMPTY_FORM,
  });

  // Portal target for LightSelect dropdowns inside this form's parent modal.
  const [lsPortalEl, setLsPortalEl] = useState<HTMLDivElement | null>(null);

  // Determine initial mode: if editing and existing item has s3_key → upload mode (show success)
  const initialMode: MediaInputMode = defaultValues?.media_s3_key
    ? 'upload'
    : defaultValues?.media_url
      ? 'url'
      : 'upload';

  const [mediaMode,    setMediaMode]    = useState<MediaInputMode>(initialMode);
  const [uploadState,  setUploadState]  = useState<UploadState>(() => {
    // Pre-populate success state when editing an item that already has S3 media
    if (defaultValues?.media_s3_key) {
      return {
        status: 'success',
        progress: 100,
        file: null,
        result: {
          s3_key:     defaultValues.media_s3_key,
          media_url:  defaultValues.media_url ?? '',
          media_type: (defaultValues.media_type as CarouselMediaType) ?? 'image',
          size_bytes: 0,
        },
        errorMsg: null,
        existing: true,
      };
    }
    return UPLOAD_IDLE;
  });

  const watchedColor    = useWatch({ control, name: 'text_color' });
  const watchedIsActive = useWatch({ control, name: 'is_active' });
  const watchedGradient = useWatch({ control, name: 'gradient' });
  const watchedTitle    = useWatch({ control, name: 'title' });
  const watchedType     = useWatch({ control, name: 'type' });
  const watchedSub      = useWatch({ control, name: 'sub_title' });
  const watchedMediaUrl = useWatch({ control, name: 'media_url' });
  const watchedMedia    = useWatch({ control, name: 'media_type' });

  // ── Gallery items state (feature type only) ──────────────────────────────────
  const [galleryItems, setGalleryItems] = useState<GalleryItemState[]>(() =>
    defaultMediaItems ? defaultMediaItems.map(galleryItemFromApiMedia) : [],
  );

  const handleAddGalleryItem = useCallback(() => {
    setGalleryItems((prev) => [
      ...prev,
      { localId: `new-${Date.now()}`, uploadState: UPLOAD_IDLE, order: prev.length },
    ]);
  }, []);

  const handleRemoveGalleryItem = useCallback((localId: string) => {
    setGalleryItems((prev) => prev.filter((i) => i.localId !== localId));
  }, []);

  const handleGalleryFileSelected = useCallback(async (localId: string, file: File) => {
    setGalleryItems((prev) => prev.map((i) =>
      i.localId === localId
        ? { ...i, uploadState: { status: 'uploading', progress: 0, file, result: null, errorMsg: null } }
        : i,
    ));

    try {
      const result = await uploadCarouselMedia(file, (percent: number) => {
        setGalleryItems((prev) => prev.map((i) =>
          i.localId === localId ? { ...i, uploadState: { ...i.uploadState, progress: percent } } : i,
        ));
      });
      setGalleryItems((prev) => prev.map((i) =>
        i.localId === localId
          ? { ...i, uploadState: { status: 'success', progress: 100, file, result, errorMsg: null } }
          : i,
      ));
    } catch (err) {
      const msg = errorText(err, UPLOAD_FAILED);
      setGalleryItems((prev) => prev.map((i) =>
        i.localId === localId
          ? { ...i, uploadState: { ...i.uploadState, status: 'error', errorMsg: msg } }
          : i,
      ));
      toast.error(msg);
    }
  }, []);

  const handleClearGalleryItem = useCallback((localId: string) => {
    setGalleryItems((prev) => prev.map((i) =>
      i.localId === localId ? { ...i, uploadState: UPLOAD_IDLE } : i,
    ));
  }, []);

  // Each file settles on its own. With Promise.all one failed file marked
  // every slot as failed and threw away the uploads that had succeeded.
  const handleBatchGalleryAdd = useCallback((files: File[]) => {
    const stamp = Date.now();
    setGalleryItems((prev) => [
      ...prev,
      ...files.map((file, idx) => ({
        localId: `batch-${stamp}-${idx}`,
        uploadState: { status: 'uploading' as const, progress: 0, file, result: null, errorMsg: null },
        order: prev.length + idx,
      })),
    ]);
    files.forEach((file, idx) => {
      const localId = `batch-${stamp}-${idx}`;
      uploadCarouselMedia(file, (percent) => {
        setGalleryItems((prev) => prev.map((i) =>
          i.localId === localId ? { ...i, uploadState: { ...i.uploadState, progress: percent } } : i,
        ));
      })
        .then((result) => {
          setGalleryItems((prev) => prev.map((i) =>
            i.localId === localId
              ? { ...i, uploadState: { status: 'success', progress: 100, file, result, errorMsg: null } }
              : i,
          ));
        })
        .catch((err) => {
          const msg = errorText(err, UPLOAD_FAILED);
          setGalleryItems((prev) => prev.map((i) =>
            i.localId === localId
              ? { ...i, uploadState: { ...i.uploadState, status: 'error', errorMsg: msg } }
              : i,
          ));
          toast.error(`${file.name}: ${msg}`);
        });
    });
  }, []);

  // Propagate upload state to parent for the global badge
  useEffect(() => {
    onUploadStateChange?.(uploadState);
  }, [uploadState, onUploadStateChange]);

  const handleFileSelected = useCallback(async (file: File) => {
    const detectedType = detectMediaTypeFromMime(file.type);
    if (detectedType) setValue('media_type', detectedType);

    setUploadState({ status: 'uploading', progress: 0, file, result: null, errorMsg: null });

    try {
      const result = await uploadCarouselMedia(file, (percent: number) => {
        setUploadState((prev) => ({ ...prev, progress: percent }));
      });
      setUploadState({ status: 'success', progress: 100, file, result, errorMsg: null });
      setValue('media_s3_key', result.s3_key);
      setValue('media_url', result.media_url);
      // The server's verdict wins over the browser's MIME guess.
      setValue('media_type', result.media_type);
    } catch (err) {
      const msg = errorText(err, UPLOAD_FAILED);
      setUploadState((prev) => ({ ...prev, status: 'error', errorMsg: msg }));
      toast.error(msg);
    }
  }, [setValue]);

  const handleClearUpload = useCallback(() => {
    setUploadState(UPLOAD_IDLE);
    setValue('media_s3_key', '');
    setValue('media_url', '');
  }, [setValue]);

  const handleModeSwitch = useCallback((mode: MediaInputMode) => {
    setMediaMode(mode);
    // Clear the opposite source when switching
    if (mode === 'url') {
      handleClearUpload();
    } else {
      setValue('media_url', '');
    }
  }, [handleClearUpload, setValue]);

  const submit = (data: CarouselFormValues) => {
    // Build gallery slides (feature type only)
    const mediaItems: CarouselMediaItemInput[] = galleryItems
      .filter((g) => g.uploadState.result !== null)
      .sort((a, b) => a.order - b.order)
      .map((g, idx) => {
        const res = g.uploadState.result!;
        const base = { media_type: res.media_type, order: idx } as const;
        return res.s3_key
          ? { ...base, media_s3_key: res.s3_key }
          : { ...base, media_url: res.media_url };
      });

    const isFeature = data.type === 'feature';
    const media = data.media_s3_key
      ? { media_s3_key: data.media_s3_key }
      : { media_url: data.media_url! };

    if (isEdit) {
      // null, not undefined: undefined is dropped from the JSON, so a field
      // the admin emptied kept its old text. The gallery goes every time so
      // removing its last slide is saved too.
      onSubmit({
        type:       data.type,
        title:      data.title?.trim() || null,
        sub_title:  data.sub_title?.trim() || null,
        media_type: data.media_type as CarouselMediaType,
        action_url: data.action_url?.trim() || null,
        text_color: data.text_color,
        gradient:   data.gradient?.trim() || null,
        order:      data.order,
        is_active:  data.is_active,
        ...(isFeature ? { media_items: mediaItems } : {}),
        ...media,
      });
      return;
    }

    onSubmit({
      type:       data.type,
      title:      data.title?.trim() || undefined,
      sub_title:  data.sub_title?.trim() || undefined,
      media_type: data.media_type as CarouselMediaType,
      action_url: data.action_url?.trim() || undefined,
      text_color: data.text_color,
      gradient:   data.gradient?.trim() || undefined,
      order:      data.order,
      is_active:  data.is_active,
      ...(isFeature && mediaItems.length > 0 ? { media_items: mediaItems } : {}),
      ...media,
    });
  };

  const isUploading =
    uploadState.status === 'uploading' ||
    galleryItems.some((g) => g.uploadState.status === 'uploading');

  return (
    <form id="carousel-form" onSubmit={handleSubmit(submit)} className="space-y-5">
      <div ref={setLsPortalEl} />

      {/* ── Type selector (must be chosen first) ──────────────── */}
      <div className="space-y-3">
        <p className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Tur</p>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <LightSelect
              options={ITEM_TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              placeholder="Tanlang"
              error={!!errors.type}
              portalContainer={lsPortalEl}
            />
          )}
        />
        {errors.type && (
          <p className="text-red-500 text-[11px] flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.type.message}
          </p>
        )}
      </div>

      {/* ── Media section ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/[0.05] rounded-xl">
          {([
            { mode: 'upload' as const, label: 'Fayl yuklash', icon: <Upload className="w-3.5 h-3.5" /> },
            { mode: 'url'    as const, label: 'URL orqali',   icon: <Link2  className="w-3.5 h-3.5" /> },
          ] as const).map(({ mode, label, icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeSwitch(mode)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                mediaMode === mode
                  ? 'bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {mediaMode === 'upload' ? (
          <UploadZone
            uploadState={uploadState}
            onFileSelected={handleFileSelected}
            onClear={handleClearUpload}
          />
        ) : (
          <div>
            <input
              {...register('media_url')}
              placeholder="https://example.com/banner.jpg"
              className={inputClass}
            />
          </div>
        )}

        {errors.media_url && (
          <p className="text-red-500 text-[11px] flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.media_url.message}
          </p>
        )}
      </div>

      {/* ── Media gallery (feature type only) ────────────────── */}
      {watchedType === 'feature' && (
        <GalleryMediaSection
          items={galleryItems}
          onAddItem={handleAddGalleryItem}
          onBatchAdd={handleBatchGalleryAdd}
          onRemoveItem={handleRemoveGalleryItem}
          onFileSelected={handleGalleryFileSelected}
          onClearItem={handleClearGalleryItem}
        />
      )}

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Kontent</p>
        <div>
          <input
            {...register('title')}
            placeholder="Sarlavha (ixtiyoriy)"
            className={inputClass}
          />
        </div>
        <div>
          <input
            {...register('sub_title')}
            placeholder="Qo'shimcha matn (ixtiyoriy)"
            className={inputClass}
          />
        </div>
        <div>
          <input
            {...register('action_url')}
            placeholder="Havola — https://... (ixtiyoriy)"
            className={inputClass}
          />
          {errors.action_url && (
            <p className="text-red-500 text-[11px] mt-1">{errors.action_url.message}</p>
          )}
        </div>
      </div>

      {/* ── Appearance ────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Ko'rinish</p>

        {/* Media type + Order. For an uploaded file the type comes from the
            file itself; a hand-picked "Rasm" on a video made clients load
            the video into an <img> and see nothing. */}
        <div className="grid grid-cols-2 gap-2">
          {mediaMode === 'url' ? (
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Media turi</label>
            <Controller
              name="media_type"
              control={control}
              render={({ field }) => (
                <LightSelect
                  options={MEDIA_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Tanlang"
                  error={!!errors.media_type}
                  portalContainer={lsPortalEl}
                />
              )}
            />
          </div>
          ) : (
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Media turi</label>
            <div className={`${inputClass} text-gray-500 dark:text-gray-400`}>
              {MEDIA_TYPE_OPTIONS.find((o) => o.value === watchedMedia)?.label ?? '—'}
              <span className="text-[11px] text-gray-400 dark:text-gray-500"> · fayldan</span>
            </div>
          </div>
          )}
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Tartib</label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              {...register('order', { valueAsNumber: true })}
              className={inputClass}
              placeholder="0"
            />
            {errors.order && (
              <p className="text-red-500 text-[11px] mt-1">{errors.order.message}</p>
            )}
          </div>
        </div>

        {/* Text colour */}
        <div>
          <label className="block text-[11px] text-gray-400 mb-2">Matn rangi</label>
          <Controller
            name="text_color"
            control={control}
            render={({ field }) => (
              <ColorPickerField
                value={field.value}
                onChange={field.onChange}
                error={!!errors.text_color}
              />
            )}
          />
          {errors.text_color && (
            <p className="text-red-500 text-[11px] mt-1">{errors.text_color.message}</p>
          )}
        </div>

        {/* Gradient: the client card paints it only when there is no media,
            so with a file attached the field changed nothing visible. */}
        {!watchedMediaUrl && (
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">
            Gradient <span className="text-gray-300 dark:text-gray-600">(ixtiyoriy, CSS)</span>
          </label>
          <input
            {...register('gradient')}
            placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            className={`${inputClass} font-mono text-[16px]`}
          />
        </div>
        )}

        {/* Live preview: the client's own card component, so what the admin
            sees here is what lands on the home screen. */}
        <div>
          <label className="block text-[11px] text-gray-400 mb-2">Mijozga shunday ko'rinadi</label>
          <div className="rounded-2xl bg-mc-bg p-3">
            <HomeCarouselCard
              key={`${watchedMedia}-${watchedMediaUrl ?? ''}`}
              item={{
                id: 0,
                type: watchedType === 'feature' ? 'feature' : 'ad',
                title: watchedTitle || "Sarlavha shu yerda",
                sub: watchedSub || undefined,
                gradientStyle: watchedGradient || 'linear-gradient(135deg, #1a1a2e, #16213e)',
                mediaType: watchedMedia as CarouselMediaType,
                mediaUrl: watchedMediaUrl || undefined,
                textColor: /^#[0-9a-fA-F]{6}$/.test(watchedColor) ? watchedColor : '#ffffff',
                fromApi: true,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Active toggle ─────────────────────────────────────── */}
      <Controller
        name="is_active"
        control={control}
        render={({ field }) => (
          <button
            type="button"
            onClick={() => field.onChange(!field.value)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
              watchedIsActive
                ? 'bg-emerald-50 dark:bg-emerald-500/[0.08] border-emerald-200 dark:border-emerald-500/20'
                : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.08]'
            }`}
          >
            <div className="flex items-center gap-2">
              {watchedIsActive
                ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                : <ToggleLeft  className="w-4 h-4 text-gray-400" />
              }
              <span className={`text-[13px] font-medium ${
                watchedIsActive
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {watchedIsActive ? "Faol (ko'rinadigan)" : "Nofaol (yashirilgan)"}
              </span>
            </div>
            <div className={`w-10 h-[22px] rounded-full transition-all relative ${
              watchedIsActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                watchedIsActive ? 'translate-x-[22px]' : 'translate-x-[3px]'
              }`} />
            </div>
          </button>
        )}
      />

      {isUploading && (
        <p className="text-[11px] text-center text-gray-400 dark:text-gray-500">
          Fayl yuklanayapti — boshqa maydonlarni to'ldiring…
        </p>
      )}
    </form>
  );
}
