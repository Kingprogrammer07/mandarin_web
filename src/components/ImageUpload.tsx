import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface ImageUploadProps {
  label: string;
  value?: File | string | null;
  onChange: (file: File | null) => void;
  error?: string;
  isLoading?: boolean;
}

const STYLES = `
  @keyframes drag-bounce { 0%{transform:scale(1)} 50%{transform:scale(0.97)} 100%{transform:scale(1)} }
  @keyframes upload-float {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-5px); }
  }
  .drag-active  { animation: drag-bounce .3s ease; }
  .upload-icon  { animation: upload-float 2.5s ease-in-out infinite; }
`;

export default function ImageUpload({ label, value, onChange, error, isLoading = false }: ImageUploadProps) {
  const { t } = useTranslation();
  const [preview,    setPreview]    = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (typeof value === 'string') setPreview(value);
  }, [value]);

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/heic", "image/heif"];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpeg', 'jpg', 'png', 'webp', 'heic', 'heif'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      toast.error(t('form.messages.invalidFileType'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('form.messages.fileTooLarge'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    onChange(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop      = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files[0]); };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleRemove    = () => { onChange(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  return (
    <>
      <style>{STYLES}</style>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
          {label}
        </label>

        {isLoading ? (
          <div className="relative border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl h-[180px] overflow-hidden bg-gray-50 dark:bg-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-100/50 dark:via-orange-500/8 to-transparent"
              style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          </div>
        ) : !preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            className={[
              'relative border-2 border-dashed rounded-2xl p-6 cursor-pointer min-h-[180px]',
              'flex flex-col items-center justify-center gap-4',
              'transition-all duration-300 ease-in-out group',
              isDragging
                ? 'drag-active border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-lg shadow-orange-500/20'
                : 'border-gray-200 dark:border-white/10 hover:border-orange-400 dark:hover:border-orange-500/40 hover:bg-orange-50/40 dark:hover:bg-orange-500/5',
              error ? 'border-red-400 dark:border-red-500/40' : '',
            ].join(' ')}
          >
            {/* drag glow overlay */}
            {isDragging && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 pointer-events-none" />
            )}

            <div className={[
              'p-4 rounded-2xl transition-all duration-300',
              isDragging
                ? 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-xl shadow-orange-500/40 scale-110'
                : 'bg-orange-100 dark:bg-orange-500/15 group-hover:bg-orange-200 dark:group-hover:bg-orange-500/25',
            ].join(' ')}>
              <Upload className={[
                'w-7 h-7 transition-colors duration-300',
                isDragging ? 'text-white upload-icon' : 'text-orange-500',
              ].join(' ')} />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200">
                {t('form.dragDropImage')}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono tracking-wider">{t('form.supportedFormats')}</p>
            </div>

            <input ref={fileInputRef} type="file" accept="image/jpeg, image/png, image/webp, .heic, .heif"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden" />
          </div>
        ) : (
          <div className="relative group rounded-2xl overflow-hidden h-[180px] border-2 border-orange-200 dark:border-orange-500/30 hover:border-orange-400 dark:hover:border-orange-500/60 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-orange-500/15">
            <img src={preview} alt={label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

            {/* gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* remove button */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
              <Button type="button" onClick={handleRemove} variant="destructive" size="icon"
                className="rounded-xl shadow-xl scale-75 group-hover:scale-100 transition-transform duration-300">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* success badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
              <span>✓</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}