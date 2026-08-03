import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, RefreshCcw, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { compressImageFile } from '@/utils/imageCompression';

interface ImageUploadProps {
  label: string;
  value?: File | string | null;
  onChange: (file: File | null) => void;
  error?: string;
  isLoading?: boolean;
  variant?: 'default' | 'compact';
}

type UploadStatus = 'idle' | 'compressing' | 'ready' | 'error';

const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
const allowedExtensions = ['jpeg', 'jpg', 'png', 'webp', 'heic', 'heif'];

function isAllowedImage(file: File): boolean {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  return allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension || '');
}

export default function ImageUpload({
  label,
  value,
  onChange,
  error,
  isLoading = false,
  variant = 'default',
}: ImageUploadProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs are owned here, not by the effect's cleanup.
  //
  // Revoking inside the cleanup looked correct but broke previews in practice:
  // any re-run of the effect (StrictMode's double-invoke, a remount when the
  // wizard steps back and forward) revoked a URL the <img> was still showing,
  // leaving one passport side as a broken image while the other rendered. The
  // ref lets us revoke exactly one URL — the one being replaced — and release
  // the last one on unmount.
  const objectUrlRef = useRef<string | null>(null);

  const releaseObjectUrl = React.useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!value) {
      releaseObjectUrl();
      setPreview(null);
      setStatus('idle');
      return;
    }

    if (typeof value === 'string') {
      releaseObjectUrl();
      setPreview(value);
      setStatus('ready');
      return;
    }

    releaseObjectUrl();
    const objectUrl = URL.createObjectURL(value);
    objectUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setStatus('ready');
  }, [value, releaseObjectUrl]);

  // Release the last URL only when the component really goes away.
  React.useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  /**
   * Self-heal a dead preview: if the browser drops the blob (revoked early by a
   * race, or restored from bfcache) rebuild it from the File we still hold, so
   * the user never stares at a broken thumbnail they cannot fix.
   */
  const handlePreviewError = React.useCallback(() => {
    if (!(value instanceof File)) return;
    releaseObjectUrl();
    const rebuilt = URL.createObjectURL(value);
    objectUrlRef.current = rebuilt;
    setPreview(rebuilt);
  }, [value, releaseObjectUrl]);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    if (!isAllowedImage(file)) {
      toast.error(t('form.messages.invalidFileType'));
      resetFileInput();
      setStatus('error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('form.messages.fileTooLarge'));
      resetFileInput();
      setStatus('error');
      return;
    }

    setStatus('compressing');

    try {
      const result = await compressImageFile(file);
      onChange(result.file);
      setStatus('ready');
    } catch {
      toast.error(t('form.messages.imagePrepareError'));
      onChange(file);
      setStatus('ready');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileChange(e.dataTransfer.files[0] || null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemove = () => {
    onChange(null);
    setPreview(null);
    setStatus('idle');
    resetFileInput();
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const hasError = Boolean(error) || status === 'error';
  const showReadyState = Boolean(preview);
  const isCompact = variant === 'compact';

  return (
    <div className="space-y-2.5">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="flex size-7 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-400/10 dark:text-orange-300">
          <ImageIcon className="size-3.5" />
        </span>
        {label}
      </label>

      {isLoading ? (
        <div className={`${isCompact ? 'h-[88px]' : 'h-[184px]'} relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#10151f]`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-100/60 to-transparent dark:via-orange-400/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-9 animate-spin text-orange-500" />
          </div>
        </div>
      ) : !showReadyState ? (
        <button
          type="button"
          onClick={openFilePicker}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            'relative w-full rounded-2xl border text-left transition active:scale-[0.99]',
            isCompact
              ? 'flex min-h-[88px] items-center gap-3 p-3'
              : 'flex min-h-[184px] flex-col items-center justify-center gap-4 p-5 text-center',
            'bg-white shadow-sm',
            'dark:bg-[#10151f] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.34),inset_0_-1px_0_rgba(255,255,255,0.055)]',
            isDragging
              ? 'border-orange-400 ring-4 ring-orange-500/15 dark:border-orange-300/60'
              : 'border-dashed border-slate-200 dark:border-white/12',
            hasError ? 'border-red-400 ring-4 ring-red-500/10 dark:border-red-400/60' : '',
          ].join(' ')}
        >
          <span className={`${isCompact ? 'size-14 shrink-0' : 'size-14'} flex items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 shadow-none dark:bg-white/[0.055] dark:text-amber-300`}>
            {status === 'compressing' ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
          </span>

          <span className="space-y-1">
            <span className="block text-sm font-bold text-slate-800 dark:text-white">
              {status === 'compressing' ? t('form.upload.compressing') : t('form.dragDropImage')}
            </span>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('form.supportedFormats')}
            </span>
          </span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/12 dark:bg-[#10151f] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.34),inset_0_-1px_0_rgba(255,255,255,0.055)]">
          <div className={`${isCompact ? 'h-[112px]' : 'h-[184px]'} relative overflow-hidden bg-slate-100 dark:bg-black/20`}>
            <img
              src={preview ?? undefined}
              alt={label}
              onError={handlePreviewError}
              className="size-full object-cover"
            />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
              <CheckCircle2 className="size-3.5" />
              {t('form.upload.ready')}
            </div>
          </div>

          <div className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={openFilePicker}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-700 active:scale-[0.98] dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-100"
              >
                <RefreshCcw className="size-4" />
                {t('form.upload.change')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                className="h-11 rounded-xl border-red-200 bg-red-50 text-red-600 active:scale-[0.98] dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300"
              >
                <X className="size-4" />
                {t('form.upload.remove')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasError && error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-500">
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.heic,.heif"
        onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  );
}
