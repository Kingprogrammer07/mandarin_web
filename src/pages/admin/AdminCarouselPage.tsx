import {
  useState, useCallback, useEffect, useRef,
  memo, useMemo,
} from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Loader2, Plus, Eye, MousePointerClick, Image, Video, Trash2,
  Pencil, ToggleLeft, ToggleRight, Film, Upload, Link2,
  TrendingUp, Layers, BarChart2, ExternalLink, X, Check,
  ChevronUp, ChevronDown as ChevronDownIcon, AlertCircle,
  CheckCircle2, Palette, ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  uploadCarouselMedia,
  uploadCarouselMediaBatch,
  getCarouselStats,
  createCarouselItem,
  updateCarouselItem,
  deleteCarouselItem,
} from '../../api/services/adminCarousel';
import type {
  CarouselItemStatsResponse,
  CarouselItemCreateRequest,
  CarouselMediaType,
  CarouselMediaUploadResponse,
  CarouselMediaItemResponse,
  CarouselMediaItemInput,
} from '../../api/services/adminCarousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../../components/ui/drawer';
import { Skeleton } from '../../components/ui/skeleton';
import LightSelect from '../../components/ui/LightSelect';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ITEM_TYPE_OPTIONS = [
  { value: 'ad',      label: 'Reklama' },
  { value: 'feature', label: 'Yangilik' },
];

const MEDIA_TYPE_OPTIONS = [
  { value: 'image', label: 'Rasm' },
  { value: 'video', label: 'Video' },
  { value: 'gif',   label: 'GIF' },
];

const MEDIA_TYPE_ICON: Record<string, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  gif:   <Film  className="w-4 h-4" />,
};

/** Named colours displayed as swatches — ordinary users don't need to know hex. */
const PRESET_COLORS: { hex: string; name: string }[] = [
  { hex: '#ffffff', name: "Oq" },
  { hex: '#f8fafc', name: "Oppoq" },
  { hex: '#9ca3af', name: "Kulrang" },
  { hex: '#1e293b', name: "Tungi" },
  { hex: '#000000', name: "Qora" },
  { hex: '#3b82f6', name: "Ko'k" },
  { hex: '#06b6d4', name: "Moviy" },
  { hex: '#22c55e', name: "Yashil" },
  { hex: '#84cc16', name: "Limon" },
  { hex: '#fbbf24', name: "Sariq" },
  { hex: '#f97316', name: "To'q sariq" },
  { hex: '#ef4444', name: "Qizil" },
  { hex: '#ec4899', name: "Pushti" },
  { hex: '#a855f7', name: "Binafsha" },
];

const ACCEPTED_MIME_TYPES =
  'image/jpeg,image/png,image/webp,image/heic,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg';

// ─── Zod schema ────────────────────────────────────────────────────────────────

const carouselFormSchema = z
  .object({
    type:         z.string().min(1, "Turini tanlang"),
    title:        z.string().optional(),
    sub_title:    z.string().optional(),
    media_type:   z.string().min(1, "Media turini tanlang"),
    // Internal hidden fields populated by upload or URL input
    media_url:    z.string().optional(),
    media_s3_key: z.string().optional(),
    action_url:   z.string().url("To'g'ri URL kiriting").optional().or(z.literal('')),
    text_color:   z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex rang (#rrggbb)"),
    gradient:     z.string().optional(),
    order:        z.number().int().min(0),
    is_active:    z.boolean(),
  })
  .refine(
    (d) => !!(d.media_url || d.media_s3_key),
    { message: "Media URL yoki fayl yuklash kerak", path: ['media_url'] },
  );

type CarouselFormValues = z.infer<typeof carouselFormSchema>;

const EMPTY_FORM: CarouselFormValues = {
  type:         'ad',
  title:        '',
  sub_title:    '',
  media_type:   'image',
  media_url:    '',
  media_s3_key: '',
  action_url:   '',
  text_color:   '#ffffff',
  gradient:     '',
  order:        0,
  is_active:    true,
};

// ─── Upload state ──────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
  status:   UploadStatus;
  progress: number; // 0–100
  file:     File | null;
  result:   CarouselMediaUploadResponse | null;
  errorMsg: string | null;
}

const UPLOAD_IDLE: UploadState = {
  status: 'idle', progress: 0, file: null, result: null, errorMsg: null,
};

// ─── Gallery item state (feature type media slides) ───────────────────────────

interface GalleryItemState {
  /** Local React key — not related to API id */
  localId: string;
  /** API id — only present when editing an existing media item */
  id?: number;
  uploadState: UploadState;
  order: number;
}

function galleryItemFromApiMedia(media: CarouselMediaItemResponse): GalleryItemState {
  return {
    localId: `existing-${media.id}`,
    id: media.id,
    uploadState: {
      status: 'success',
      progress: 100,
      file: null,
      result: {
        s3_key:     media.media_s3_key ?? '',
        media_url:  media.media_url,
        media_type: media.media_type,
        size_bytes: 0,
      },
      errorMsg: null,
    },
    order: media.order,
  };
}

// ─── Gallery media section UI ─────────────────────────────────────────────────

interface GalleryMediaSectionProps {
  items:          GalleryItemState[];
  onAddItem:      () => void;
  onBatchAdd:     (files: File[]) => void;
  onRemoveItem:   (localId: string) => void;
  onFileSelected: (localId: string, file: File) => void;
  onClearItem:    (localId: string) => void;
}

const labelClass =
  'block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5';

function GalleryMediaSection({
  items, onAddItem, onBatchAdd, onRemoveItem, onFileSelected, onClearItem,
}: GalleryMediaSectionProps) {
  const batchInputRef = useRef<HTMLInputElement>(null);

  const handleBatchClick = () => {
    batchInputRef.current?.click();
  };

  const handleBatchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onBatchAdd(files);
    }
    e.target.value = '';
  };

  const LIMITS = { image: 20, gif: 20, video: 5 };
  const imageCount = items.filter(i => {
    const t = i.uploadState.result?.media_type;
    return t === 'image' || t === 'gif';
  }).length;
  const videoCount = items.filter(i => i.uploadState.result?.media_type === 'video').length;
  const canAddMore = imageCount < LIMITS.image && videoCount < LIMITS.video;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={labelClass}>Media galleryasi</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBatchClick}
            disabled={!canAddMore}
            className="flex items-center gap-1 text-[12px] font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Ko'p fayl yuklash
          </button>
          <button
            type="button"
            onClick={onAddItem}
            disabled={!canAddMore}
            className="flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Qo'shish
          </button>
        </div>
      </div>
      <input
        ref={batchInputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_MIME_TYPES}
        onChange={handleBatchChange}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={onAddItem}
          className="w-full py-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/[0.08] text-[12px] text-gray-400 dark:text-gray-600 hover:border-orange-300 dark:hover:border-orange-500/40 hover:text-orange-500 transition-all"
        >
          + Birinchi slideni qo'shing
        </button>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.localId} className="flex items-start gap-2">
              <span className="w-5 h-5 mt-[18px] rounded-full bg-gray-100 dark:bg-white/[0.06] text-[10px] font-bold flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <UploadZone
                  uploadState={item.uploadState}
                  onFileSelected={(file) => onFileSelected(item.localId, file)}
                  onClear={() => onClearItem(item.localId)}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(item.localId)}
                className="p-1.5 mt-[14px] rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                title="O'chirish"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-gray-600">
        Rasm/GIF: {imageCount}/{LIMITS.image} · Video: {videoCount}/{LIMITS.video}
      </p>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_024).toFixed(0)} KB`;
}

function detectMediaTypeFromMime(mime: string): CarouselMediaType | null {
  if (mime === 'image/gif')       return 'gif';
  if (mime.startsWith('image/'))  return 'image';
  if (mime.startsWith('video/'))  return 'video';
  return null;
}

// ─── Shared input style ────────────────────────────────────────────────────────

const inputClass =
  'w-full p-3 bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[14px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600';

// ─── SVG Progress Ring ─────────────────────────────────────────────────────────

interface ProgressRingProps {
  progress: number; // 0–100
  size?: number;
}

function ProgressRing({ progress, size = 48 }: ProgressRingProps) {
  // r=15.9 → circumference ≈ 99.9 ≈ 100, convenient for % math
  const r   = 15.9;
  const circ = 2 * Math.PI * r;
  const filled = (progress / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className="-rotate-90"
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="18" cy="18" r={r}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        className="text-blue-100 dark:text-blue-500/20"
      />
      <circle
        cx="18" cy="18" r={r}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        className="text-blue-500 transition-all duration-300"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Upload Zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  uploadState:     UploadState;
  onFileSelected:  (file: File) => void;
  onClear:         () => void;
}

function UploadZone({ uploadState, onFileSelected, onClear }: UploadZoneProps) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    // Reset input so the same file can be re-selected after clear
    e.target.value = '';
  };

  // ── Uploading state ──
  if (uploadState.status === 'uploading') {
    return (
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
        <div className="relative" style={{ width: 48, height: 48 }}>
          <ProgressRing progress={uploadState.progress} size={48} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 rotate-90">
            {uploadState.progress}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
            Yuklanmoqda…
          </p>
          <p className="text-[11px] text-blue-500 dark:text-blue-400/70 truncate mt-0.5">
            {uploadState.file?.name}
          </p>
        </div>
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
      </div>
    );
  }

  // ── Success state ──
  if (uploadState.status === 'success' && uploadState.result) {
    const { result, file } = uploadState;
    return (
      <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
          {result.media_type === 'image' || result.media_type === 'gif' ? (
            <img
              src={result.media_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Video className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
              Muvaffaqiyatli yuklandi
            </p>
          </div>
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 truncate mt-0.5">
            {file?.name} • {formatBytes(result.size_bytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shrink-0"
          title="Boshqasini tanlash"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── Error state ──
  if (uploadState.status === 'error') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/20">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-red-600 dark:text-red-400">
            {uploadState.errorMsg ?? "Yuklashda xatolik"}
          </p>
          <p className="text-[11px] text-red-500/70 truncate mt-0.5">
            {uploadState.file?.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors shrink-0"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  // ── Idle / drop zone ──
  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none ${
        dragging
          ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10 scale-[1.01]'
          : 'border-gray-200 dark:border-white/[0.1] hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-gray-50 dark:hover:bg-white/[0.02]'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        dragging
          ? 'bg-orange-100 dark:bg-orange-500/20'
          : 'bg-gray-100 dark:bg-white/[0.06]'
      }`}>
        <Upload className={`w-5 h-5 transition-colors ${dragging ? 'text-orange-500' : 'text-gray-400'}`} />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
          Faylni bu yerga tashlang
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          yoki bosib tanlang
        </p>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-600">
        JPEG · PNG · WebP · GIF · MP4 · MOV · WebM &nbsp;•&nbsp; Rasm ≤50 MB · Video ≤200 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPTED_MIME_TYPES}
        onChange={handleChange}
      />
    </div>
  );
}

// ─── Color Picker Field ────────────────────────────────────────────────────────

interface ColorPickerFieldProps {
  value:    string;
  onChange: (hex: string) => void;
  error?:   boolean;
}

function ColorPickerField({ value, onChange, error }: ColorPickerFieldProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [hexInput, setHexInput]     = useState(value);
  const nativePickerRef             = useRef<HTMLInputElement>(null);

  // Keep hex input in sync when value changes externally (e.g. preset click)
  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const isPreset = PRESET_COLORS.some((c) => c.hex === value.toLowerCase());

  const handlePresetClick = (hex: string) => {
    onChange(hex);
    setShowCustom(false);
  };

  const handleHexInputChange = (raw: string) => {
    setHexInput(raw);
    // Apply only when a full valid hex is typed
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      onChange(raw);
    }
  };

  // Native color picker — update form value on every change (no "OK" step)
  const handleNativePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    onChange(hex);
    setHexInput(hex);
  };

  return (
    <div className="space-y-2">
      {/* Preset palette */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => {
          const isSelected = value.toLowerCase() === c.hex;
          return (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => handlePresetClick(c.hex)}
              className={`group flex flex-col items-center gap-1 transition-transform hover:scale-110 ${
                isSelected ? 'scale-110' : ''
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-orange-500 shadow-md shadow-orange-500/30'
                    : 'border-gray-200 dark:border-white/[0.1] hover:border-gray-300'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <span className="flex items-center justify-center w-full h-full">
                    <Check
                      className="w-3 h-3"
                      style={{ color: c.hex === '#ffffff' || c.hex === '#f8fafc' ? '#000' : '#fff' }}
                    />
                  </span>
                )}
              </span>
              <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none max-w-[28px] truncate">
                {c.name}
              </span>
            </button>
          );
        })}

        {/* Custom colour toggle */}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`flex flex-col items-center gap-1 group transition-transform hover:scale-110 ${
            showCustom || (!isPreset && value) ? 'scale-110' : ''
          }`}
        >
          <span
            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
              showCustom || (!isPreset && value)
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/20'
                : 'border-dashed border-gray-300 dark:border-white/[0.15] hover:border-gray-400 bg-gray-50 dark:bg-white/[0.03]'
            }`}
            style={!isPreset && value ? { backgroundColor: value } : undefined}
          >
            {(!isPreset && value) ? (
              <Check
                className="w-3 h-3"
                style={{ color: value === '#ffffff' || value === '#f8fafc' ? '#000' : '#fff' }}
              />
            ) : (
              <Palette className="w-3 h-3 text-gray-400 dark:text-gray-500" />
            )}
          </span>
          <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none">
            Maxsus
          </span>
        </button>
      </div>

      {/* Custom colour editor */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.08]">
              {/* Native colour picker — clicking swatch opens browser picker immediately */}
              <input
                ref={nativePickerRef}
                type="color"
                value={value.match(/^#[0-9a-fA-F]{6}$/) ? value : '#ffffff'}
                onChange={handleNativePickerChange}
                className="w-10 h-10 rounded-lg border border-gray-200 dark:border-white/[0.08] cursor-pointer bg-transparent p-0.5 shrink-0"
                title="Rang tanlang"
              />
              {/* Hex text input — live sync with no separate "OK" step */}
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexInputChange(e.target.value)}
                placeholder="#ffffff"
                maxLength={7}
                className={`${inputClass} flex-1 font-mono ${error ? 'border-red-400' : ''}`}
              />
              {/* Live swatch preview */}
              <span
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/[0.08] shrink-0 transition-colors"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ccc' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:   React.ReactNode;
  label:  string;
  value:  string | number;
  accent: string;
}

const StatCard = memo(({ icon, label, value, accent }: StatCardProps) => (
  <div className="bg-white dark:bg-[#111] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.06]">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${accent}`}>
      {icon}
    </div>
    <p className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
  </div>
));
StatCard.displayName = 'StatCard';

// ─── Carousel item card ────────────────────────────────────────────────────────

interface CarouselCardProps {
  item:            CarouselItemStatsResponse;
  onEdit:          (item: CarouselItemStatsResponse) => void;
  onDelete:        (id: number) => void;
  onToggleActive:  (item: CarouselItemStatsResponse) => void;
  isTogglingId:    number | null;
  isDeletingId:    number | null;
  confirmDeleteId: number | null;
  onConfirmDelete: (id: number) => void;
  onCancelDelete:  () => void;
}

const CarouselCard = memo(({
  item, onEdit, onDelete, onToggleActive,
  isTogglingId, isDeletingId, confirmDeleteId,
  onConfirmDelete, onCancelDelete,
}: CarouselCardProps) => {
  const isToggling   = isTogglingId === item.id;
  const isDeleting   = isDeletingId === item.id;
  const isConfirming = confirmDeleteId === item.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-[#111] rounded-[20px] border overflow-hidden transition-all ${
        item.is_active
          ? 'border-black/[0.05] dark:border-white/[0.06]'
          : 'border-gray-200/60 dark:border-white/[0.04] opacity-60'
      }`}
    >
      {/* Media preview */}
      <div
        className="relative h-36 overflow-hidden flex items-center justify-center"
        style={{ background: item.gradient ?? 'linear-gradient(135deg, #1a1a2e, #16213e)' }}
      >
        {(item.media_type === 'image' || item.media_type === 'gif') ? (
          <img
            src={item.media_url}
            alt={item.title ?? ''}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : item.media_type === 'video' ? (
          <video
            src={item.media_url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {(item.title || item.sub_title) && (
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {item.title && (
              <p
                className="text-[13px] font-bold truncate leading-tight"
                style={{ color: item.text_color }}
              >
                {item.title}
              </p>
            )}
            {item.sub_title && (
              <p className="text-[11px] text-white/70 truncate mt-0.5">{item.sub_title}</p>
            )}
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm ${
            item.type === 'ad' ? 'bg-blue-500/80 text-white' : 'bg-purple-500/80 text-white'
          }`}>
            {item.type === 'ad' ? 'AD' : 'FEATURE'}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/40 text-white/90 backdrop-blur-sm">
            {MEDIA_TYPE_ICON[item.media_type]}
          </span>
        </div>

        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/40 text-white/90 text-[11px] font-bold backdrop-blur-sm">
            {item.order}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {formatNumber(item.total_views)}
            </span>
            <span className="text-[11px]">ko'rish</span>
          </div>
          <div className="w-px h-3.5 bg-gray-200 dark:bg-white/[0.08]" />
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {formatNumber(item.total_clicks)}
            </span>
            <span className="text-[11px]">bosish</span>
          </div>
          {item.total_views > 0 && (
            <>
              <div className="w-px h-3.5 bg-gray-200 dark:bg-white/[0.08]" />
              <div className="flex items-center gap-1 text-[11px] text-orange-500 font-medium">
                <TrendingUp className="w-3 h-3" />
                {((item.total_clicks / item.total_views) * 100).toFixed(1)}%
              </div>
            </>
          )}
        </div>

        {item.action_url && (
          <a
            href={item.action_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-600 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{item.action_url}</span>
          </a>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onToggleActive(item)}
            disabled={isToggling}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              item.is_active
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
            } disabled:opacity-50`}
          >
            {isToggling
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : item.is_active
                ? <ToggleRight className="w-3.5 h-3.5" />
                : <ToggleLeft  className="w-3.5 h-3.5" />
            }
            {item.is_active ? 'Faol' : 'Nofaol'}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
            title="Tahrirlash"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {!isConfirming ? (
            <button
              onClick={() => onConfirmDelete(item.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="O'chirish"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1"
              >
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                  title="Ha, o'chir"
                >
                  {isDeleting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Check   className="w-3.5 h-3.5" />
                  }
                </button>
                <button
                  onClick={onCancelDelete}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors"
                  title="Bekor qilish"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
});
CarouselCard.displayName = 'CarouselCard';

// ─── Global upload badge (visible even when modal is open) ─────────────────────

interface GlobalUploadBadgeProps {
  uploadState: UploadState;
}

const GlobalUploadBadge = memo(({ uploadState }: GlobalUploadBadgeProps) => {
  if (uploadState.status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 right-4 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border max-w-xs bg-white dark:bg-[#1c1c1e] border-black/[0.08] dark:border-white/[0.1]"
      >
        {uploadState.status === 'uploading' && (
          <>
            <div className="relative" style={{ width: 36, height: 36 }}>
              <ProgressRing progress={uploadState.progress} size={36} />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-blue-600 dark:text-blue-400 rotate-90">
                {uploadState.progress}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                Media yuklanmoqda…
              </p>
              <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                {uploadState.file?.name}
              </p>
            </div>
          </>
        )}
        {uploadState.status === 'success' && (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
              Yuklash tugadi
            </p>
          </>
        )}
        {uploadState.status === 'error' && (
          <>
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
              Yuklashda xatolik
            </p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
});
GlobalUploadBadge.displayName = 'GlobalUploadBadge';

// ─── Carousel form ─────────────────────────────────────────────────────────────

type MediaInputMode = 'upload' | 'url';

interface CarouselFormProps {
  defaultValues?:       CarouselFormValues;
  /** Pre-populated gallery slides when editing a feature item */
  defaultMediaItems?:   CarouselMediaItemResponse[];
  onSubmit:             (data: CarouselItemCreateRequest) => void;
  onUploadStateChange?: (state: UploadState) => void;
}

function CarouselForm({ defaultValues, defaultMediaItems, onSubmit, onUploadStateChange }: CarouselFormProps) {
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
      };
    }
    return UPLOAD_IDLE;
  });

  const watchedColor    = useWatch({ control, name: 'text_color' });
  const watchedIsActive = useWatch({ control, name: 'is_active' });
  const watchedGradient = useWatch({ control, name: 'gradient' });
  const watchedTitle    = useWatch({ control, name: 'title' });
  const watchedType     = useWatch({ control, name: 'type' });

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
      const result = await uploadCarouselMedia(file, (percent) => {
        setGalleryItems((prev) => prev.map((i) =>
          i.localId === localId ? { ...i, uploadState: { ...i.uploadState, progress: percent } } : i,
        ));
      });
      setGalleryItems((prev) => prev.map((i) =>
        i.localId === localId
          ? { ...i, uploadState: { status: 'success', progress: 100, file, result, errorMsg: null } }
          : i,
      ));
    } catch {
      const msg = "Fayl yuklanmadi. Hajmini yoki turini tekshiring.";
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

  const handleBatchGalleryAdd = useCallback(async (files: File[]) => {
    const startIndex = galleryItems.length;
    const newLocalIds: string[] = [];
    const newItems: GalleryItemState[] = files.map((file, idx) => {
      const localId = `batch-${Date.now()}-${idx}`;
      newLocalIds.push(localId);
      return {
        localId,
        uploadState: { status: 'uploading', progress: 0, file, result: null, errorMsg: null },
        order: startIndex + idx,
      };
    });
    setGalleryItems((prev) => [...prev, ...newItems]);

    try {
      const results = await uploadCarouselMediaBatch(files, (fileIndex, percent) => {
        setGalleryItems((prev) => prev.map((item) => {
          if (item.localId === newLocalIds[fileIndex]) {
            return { ...item, uploadState: { ...item.uploadState, progress: percent } };
          }
          return item;
        }));
      });
      setGalleryItems((prev) => prev.map((item) => {
        const slotIdx = newLocalIds.indexOf(item.localId);
        if (slotIdx !== -1) {
          return {
            ...item,
            uploadState: {
              status: 'success' as const,
              progress: 100,
              file: newItems[slotIdx].uploadState.file,
              result: results[slotIdx],
              errorMsg: null,
            },
          };
        }
        return item;
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fayllar yuklanmadi. Internet aloqasini tekshiring.";
      setGalleryItems((prev) => prev.map((item) => {
        const slotIdx = newLocalIds.indexOf(item.localId);
        if (slotIdx !== -1 && item.uploadState.status === 'uploading') {
          return {
            ...item,
            uploadState: { ...item.uploadState, status: 'error' as const, errorMsg: msg },
          };
        }
        return item;
      }));
      toast.error(msg);
    }
  }, [galleryItems.length]);

  // Propagate upload state to parent for the global badge
  useEffect(() => {
    onUploadStateChange?.(uploadState);
  }, [uploadState, onUploadStateChange]);

  const handleFileSelected = useCallback(async (file: File) => {
    const detectedType = detectMediaTypeFromMime(file.type);
    if (detectedType) setValue('media_type', detectedType);

    setUploadState({ status: 'uploading', progress: 0, file, result: null, errorMsg: null });

    try {
      const result = await uploadCarouselMedia(file, (percent) => {
        setUploadState((prev) => ({ ...prev, progress: percent }));
      });
      setUploadState({ status: 'success', progress: 100, file, result, errorMsg: null });
      setValue('media_s3_key', result.s3_key);
      setValue('media_url', result.media_url);
    } catch {
      const msg = "Fayl yuklanmadi. Hajmini yoki turini tekshiring.";
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

    const commonFields = {
      type:       data.type,
      title:      data.title || undefined,
      sub_title:  data.sub_title || undefined,
      media_type: data.media_type as CarouselMediaType,
      action_url: data.action_url || undefined,
      text_color: data.text_color,
      gradient:   data.gradient || undefined,
      order:      data.order,
      is_active:  data.is_active,
      ...(data.type === 'feature' && mediaItems.length > 0
        ? { media_items: mediaItems }
        : {}),
    };

    if (data.media_s3_key) {
      onSubmit({ ...commonFields, media_s3_key: data.media_s3_key });
    } else {
      onSubmit({ ...commonFields, media_url: data.media_url! });
    }
  };

  const isUploading =
    uploadState.status === 'uploading' ||
    galleryItems.some((g) => g.uploadState.status === 'uploading');

  return (
    <form id="carousel-form" onSubmit={handleSubmit(submit)} className="space-y-5">
      <div ref={setLsPortalEl} />

      {/* ── Type selector (must be chosen first) ──────────────── */}
      <div className="space-y-3">
        <p className={labelClass}>Tur</p>
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
        <p className={labelClass}>Kontent</p>
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
        <p className={labelClass}>Ko'rinish</p>

        {/* Media type + Order */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Media</label>
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
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Tartib</label>
            <input
              type="number"
              min={0}
              {...register('order', { valueAsNumber: true })}
              className={inputClass}
              placeholder="0"
            />
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

        {/* Gradient */}
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">
            Gradient <span className="text-gray-300 dark:text-gray-600">(ixtiyoriy, CSS)</span>
          </label>
          <input
            {...register('gradient')}
            placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            className={`${inputClass} font-mono text-[12px]`}
          />
        </div>

        {/* Live preview */}
        <div
          className="h-12 rounded-xl flex items-center justify-center text-[13px] font-semibold transition-all px-4"
          style={{
            background: watchedGradient || 'linear-gradient(135deg, #1a1a2e, #16213e)',
            color: /^#[0-9a-fA-F]{6}$/.test(watchedColor) ? watchedColor : '#ffffff',
          }}
        >
          {watchedTitle || 'Sarlavha ko\'rinishi'}
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

// ─── Main page ─────────────────────────────────────────────────────────────────

interface AdminCarouselPageProps {
  /** When provided the page renders standalone (no AdminLayout) with a back button. */
  onBack?: () => void;
}

export default function AdminCarouselPage({ onBack }: AdminCarouselPageProps) {
  const queryClient = useQueryClient();
  const isDesktop   = useIsDesktop();

  const [isFormOpen,       setIsFormOpen]       = useState(false);
  const [editingItem,      setEditingItem]       = useState<CarouselItemStatsResponse | null>(null);
  const [confirmDeleteId,  setConfirmDeleteId]   = useState<number | null>(null);
  const [togglingId,       setTogglingId]        = useState<number | null>(null);
  const [deletingId,       setDeletingId]        = useState<number | null>(null);
  const [sortBy,           setSortBy]            = useState<'order' | 'views' | 'clicks'>('order');
  const [sortDir,          setSortDir]           = useState<'asc' | 'desc'>('asc');
  /** Tracks active upload state from the form for the global floating badge. */
  const [globalUpload,     setGlobalUpload]      = useState<UploadState>(UPLOAD_IDLE);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: statsItems, isLoading } = useQuery<CarouselItemStatsResponse[]>({
    queryKey: ['admin-carousel-stats'],
    queryFn: getCarouselStats,
  });

  // ── Derived stats ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (!statsItems) return { total: 0, active: 0, views: 0, clicks: 0 };
    return {
      total:  statsItems.length,
      active: statsItems.filter((i) => i.is_active).length,
      views:  statsItems.reduce((s, i) => s + i.total_views, 0),
      clicks: statsItems.reduce((s, i) => s + i.total_clicks, 0),
    };
  }, [statsItems]);

  const sortedItems = useMemo(() => {
    if (!statsItems) return [];
    return [...statsItems].sort((a, b) => {
      const va = sortBy === 'order' ? a.order : sortBy === 'views' ? a.total_views : a.total_clicks;
      const vb = sortBy === 'order' ? b.order : sortBy === 'views' ? b.total_views : b.total_clicks;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [statsItems, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: createCarouselItem,
    onSuccess: () => {
      toast.success("Karusel elementi yaratildi");
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
      setIsFormOpen(false);
      setEditingItem(null);
      setGlobalUpload(UPLOAD_IDLE);
    },
    onError: () => toast.error("Yaratishda xatolik yuz berdi"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CarouselItemCreateRequest }) =>
      updateCarouselItem(id, data),
    onSuccess: () => {
      toast.success("Element yangilandi");
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
      setIsFormOpen(false);
      setEditingItem(null);
      setGlobalUpload(UPLOAD_IDLE);
    },
    onError: () => toast.error("Yangilashda xatolik yuz berdi"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCarouselItem,
    onSuccess: () => {
      toast.success("Element o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
      setConfirmDeleteId(null);
      setDeletingId(null);
    },
    onError: () => {
      toast.error("O'chirishda xatolik yuz berdi");
      setDeletingId(null);
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateCarouselItem(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-stats'] });
    },
    onError: () => toast.error("Holat o'zgartirishda xatolik"),
    onSettled: () => setTogglingId(null),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFormSubmit = useCallback(
    (data: CarouselItemCreateRequest) => {
      if (editingItem) {
        updateMut.mutate({ id: editingItem.id, data });
      } else {
        createMut.mutate(data);
      }
    },
    [editingItem, createMut, updateMut],
  );

  const handleEdit = useCallback((item: CarouselItemStatsResponse) => {
    setEditingItem(item);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: number) => {
    setDeletingId(id);
    deleteMut.mutate(id);
  }, [deleteMut]);

  const handleToggleActive = useCallback(
    (item: CarouselItemStatsResponse) => {
      setTogglingId(item.id);
      toggleActiveMut.mutate({ id: item.id, is_active: !item.is_active });
    },
    [toggleActiveMut],
  );

  const handleModalClose = useCallback((open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingItem(null);
      setGlobalUpload(UPLOAD_IDLE);
    }
  }, []);

  const formDefaultValues: CarouselFormValues | undefined = editingItem
    ? {
        type:         editingItem.type,
        title:        editingItem.title ?? '',
        sub_title:    editingItem.sub_title ?? '',
        media_type:   editingItem.media_type,
        media_url:    editingItem.media_url,
        media_s3_key: editingItem.media_s3_key ?? '',
        action_url:   editingItem.action_url ?? '',
        text_color:   editingItem.text_color,
        gradient:     editingItem.gradient ?? '',
        order:        editingItem.order,
        is_active:    editingItem.is_active,
      }
    : undefined;

  const isPending  = createMut.isPending || updateMut.isPending;
  const isUploading = globalUpload.status === 'uploading';
  const modalTitle = editingItem ? 'Elementni tahrirlash' : "Yangi element qo'shish";

  const renderSortButton = (col: typeof sortBy, label: string) => (
    <button
      key={col}
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
        sortBy === col
          ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
      }`}
    >
      {label}
      {sortBy === col && (
        sortDir === 'asc'
          ? <ChevronUp       className="w-3 h-3" />
          : <ChevronDownIcon className="w-3 h-3" />
      )}
    </button>
  );

  const SubmitButton = (
    <motion.button
      type="submit"
      form="carousel-form"
      disabled={isPending || isUploading}
      whileTap={{ scale: 0.97 }}
      className="w-full flex justify-center items-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-semibold text-[14px] shadow-lg shadow-orange-500/20 disabled:opacity-60 transition-all"
    >
      {isPending ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isUploading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Yuklanmoqda… {globalUpload.progress}%
        </>
      ) : (
        'Saqlash'
      )}
    </motion.button>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const content = (
    <div className="space-y-6">

      {/* Floating upload progress badge */}
      <GlobalUploadBadge uploadState={globalUpload} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
            Karusel boshqaruvi
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
            Reklama va yangilik bannerlarini boshqaring
          </p>
        </div>
        <motion.button
          onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold shadow-lg shadow-orange-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Yangi element</span>
        </motion.button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl dark:bg-white/[0.04]" />
          ))
        ) : (
          <>
            <StatCard
              icon={<Layers          className="w-4 h-4 text-blue-500" />}
              label="Jami elementlar"
              value={summary.total}
              accent="bg-blue-100 dark:bg-blue-500/20"
            />
            <StatCard
              icon={<ToggleRight     className="w-4 h-4 text-emerald-500" />}
              label="Faol elementlar"
              value={summary.active}
              accent="bg-emerald-100 dark:bg-emerald-500/20"
            />
            <StatCard
              icon={<Eye             className="w-4 h-4 text-purple-500" />}
              label="Jami ko'rishlar"
              value={formatNumber(summary.views)}
              accent="bg-purple-100 dark:bg-purple-500/20"
            />
            <StatCard
              icon={<MousePointerClick className="w-4 h-4 text-orange-500" />}
              label="Jami bosishlar"
              value={formatNumber(summary.clicks)}
              accent="bg-orange-100 dark:bg-orange-500/20"
            />
          </>
        )}
      </div>

      {/* Sort controls */}
      {!isLoading && statsItems && statsItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
            Saralash:
          </span>
          {renderSortButton('order',  'Tartib')}
          {renderSortButton('views',  "Ko'rishlar")}
          {renderSortButton('clicks', 'Bosishlar')}
          {summary.views > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-[12px] text-orange-500 font-medium">
              <BarChart2 className="w-3.5 h-3.5" />
              Umumiy CTR: {((summary.clicks / summary.views) * 100).toFixed(2)}%
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[20px] overflow-hidden border border-gray-100 dark:border-white/[0.06]">
              <Skeleton className="h-36 w-full rounded-none dark:bg-white/[0.04]" />
              <div className="p-4 space-y-2 bg-white dark:bg-[#111]">
                <Skeleton className="h-3 w-3/4 rounded dark:bg-white/[0.04]" />
                <Skeleton className="h-3 w-1/2 rounded dark:bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 bg-white dark:bg-white/[0.02] rounded-[20px] border-2 border-dashed border-gray-200 dark:border-white/[0.08]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
            <Image className="w-7 h-7 text-gray-300 dark:text-gray-700" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] font-semibold">Karusel elementlari yo'q</p>
          <p className="text-[13px] mt-1">Birinchi elementni qo'shing</p>
          <motion.button
            onClick={() => setIsFormOpen(true)}
            whileTap={{ scale: 0.95 }}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Qo'shish
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
          {sortedItems.map((item) => (
            <CarouselCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              isTogglingId={togglingId}
              isDeletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              onConfirmDelete={setConfirmDeleteId}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {isDesktop ? (
        <Dialog open={isFormOpen} onOpenChange={handleModalClose}>
          <DialogContent className="sm:max-w-[540px] flex flex-col gap-0 max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                Karusel elementi ma'lumotlarini kiriting.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <CarouselForm
                key={editingItem?.id ?? 'new'}
                defaultValues={formDefaultValues}
                defaultMediaItems={editingItem?.media_items}
                onSubmit={handleFormSubmit}
                onUploadStateChange={setGlobalUpload}
              />
            </div>
            <div className="shrink-0 px-6 pb-6 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              {SubmitButton}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isFormOpen} onOpenChange={handleModalClose}>
          <DrawerContent className="flex flex-col max-h-[92vh]">
            <DrawerHeader className="shrink-0 text-left px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
              <DrawerTitle>{modalTitle}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Karusel elementi ma'lumotlarini kiriting.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <CarouselForm
                key={editingItem?.id ?? 'new'}
                defaultValues={formDefaultValues}
                defaultMediaItems={editingItem?.media_items}
                onSubmit={handleFormSubmit}
                onUploadStateChange={setGlobalUpload}
              />
            </div>
            <div className="shrink-0 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-white/[0.06]">
              {SubmitButton}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );

  // ── Standalone wrap (manager view) ────────────────────────────────────────
  if (onBack) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] dark:bg-[#09090b]">
        {/* Sticky back-button header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.08]">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              title="Orqaga"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-orange-500" />
              </div>
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                Karusel boshqaruvi
              </h1>
            </div>
          </div>
        </div>
        {/* Page content with padding */}
        <div className="max-w-5xl mx-auto px-4 py-5">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
