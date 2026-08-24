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
      <label className="flex items-center gap-2 text-sm font-semibold text-mc-text">
        <span className="flex size-7 items-center justify-center rounded-mc-md bg-mc-brand/10 text-mc-brand dark:bg-mc-brand-soft dark:text-mc-brand">
          <ImageIcon className="size-3.5" />
        </span>
        {label}
      </label>

      {isLoading ? (
        <div className={`${isCompact ? 'h-[88px]' : 'h-[184px]'} relative overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface-2 dark:border-white/10`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-mc-brand/25 to-transparent dark:via-mc-brand/25" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-9 animate-spin text-mc-brand" />
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
            'relative w-full rounded-mc-lg border text-left transition active:scale-[0.99]',
            isCompact
              ? 'flex min-h-[88px] items-center gap-3 p-3'
              : 'flex min-h-[184px] flex-col items-center justify-center gap-4 p-5 text-center',
            'bg-mc-surface shadow-sm',
            ' dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.34),inset_0_-1px_0_rgba(255,255,255,0.055)]',
            isDragging
              ? 'border-mc-brand ring-4 ring-mc-brand/20 dark:border-mc-brand/40'
              : 'border-dashed border-mc-border dark:border-white/12',
            hasError ? 'border-mc-danger ring-4 ring-mc-danger/15 dark:border-mc-danger/40' : '',
          ].join(' ')}
        >
          <span className={`${isCompact ? 'size-14 shrink-0' : 'size-14'} flex items-center justify-center rounded-mc-lg bg-mc-brand/10 text-mc-brand shadow-none dark:bg-white/[0.055] dark:text-mc-brand`}>
            {status === 'compressing' ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
          </span>

          <span className="space-y-1">
            <span className="block text-sm font-bold text-mc-text">
              {status === 'compressing' ? t('form.upload.compressing') : t('form.dragDropImage')}
            </span>
            <span className="block text-xs font-medium text-mc-text-2">
              {t('form.supportedFormats')}
            </span>
          </span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-mc-lg border border-mc-border bg-mc-surface shadow-sm dark:border-white/12 dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.34),inset_0_-1px_0_rgba(255,255,255,0.055)]">
          <div className={`${isCompact ? 'h-[112px]' : 'h-[184px]'} relative overflow-hidden bg-mc-surface-2 dark:bg-black/20`}>
            <img
              src={preview ?? undefined}
              alt={label}
              onError={handlePreviewError}
              className="size-full object-cover"
            />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-mc-success px-2.5 py-1 text-xs font-bold text-white shadow-lg">
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
                className="h-11 rounded-mc-md border-mc-border bg-mc-surface text-mc-text active:scale-[0.98] dark:border-white/12 dark:bg-white/[0.04] dark:text-mc-text"
              >
                <RefreshCcw className="size-4" />
                {t('form.upload.change')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                className="h-11 rounded-mc-md border-mc-danger/25 bg-mc-danger-soft text-mc-danger active:scale-[0.98] dark:border-mc-danger/25 dark:bg-mc-danger/10 dark:text-mc-danger"
              >
                <X className="size-4" />
                {t('form.upload.remove')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasError && error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-mc-danger">
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
