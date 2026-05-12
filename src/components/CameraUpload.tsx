import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface CameraUploadProps {
  label: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  onCameraClose?: () => void;
}

export default function CameraUpload({
  label,
  onChange,
  error,
  onCameraClose,
}: CameraUploadProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // Track object URL so we can revoke it on change/unmount (memory leak prevention)
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith('image/')) return;

      // Revoke previous blob URL before creating a new one
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

      // createObjectURL is synchronous — preview appears the instant the file is chosen,
      // no FileReader async delay and no canvas round-trip that could degrade quality.
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setPreview(objectUrl);

      // Pass the original, unmodified file — MarkTakenModal compresses before upload,
      // so the backend always receives the highest available quality.
      onChange(file);

      if (onCameraClose) onCameraClose();
    },
    [onChange, onCameraClose],
  );

  const handleRemove = useCallback(() => {
    onChange(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }, [onChange]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {!preview && (
        <div className="grid grid-cols-2 gap-3">
          {/* Opens the device's native camera (rear lens) via capture attribute.
              More reliable in Telegram WebView than getUserMedia streams. */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="relative border-2 border-dashed border-orange-300 rounded-lg p-8 cursor-pointer transition-all duration-300 hover:border-orange-500 hover:bg-orange-50 active:scale-95"
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-orange-100">
                <Camera className="w-8 h-8 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">{t('camera.openCamera')}</p>
            </div>
          </button>

          <label
            htmlFor="gallery-input-camera-upload"
            className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer transition-all duration-300 hover:border-gray-500 hover:bg-gray-50 active:scale-95"
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-gray-100">
                <Upload className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">{t('camera.selectFromGallery')}</p>
            </div>
          </label>

          {/* capture="environment" = rear camera on mobile; falls back to file picker on desktop */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />

          <input
            ref={galleryInputRef}
            id="gallery-input-camera-upload"
            type="file"
            accept="image/*"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>
      )}

      {preview && (
        <div className="relative group rounded-lg overflow-hidden border-2 border-orange-200 hover:border-orange-400 transition-all duration-300 h-[280px]">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="cursor-pointer"
            >
              <div className="rounded-full bg-white p-2 transform scale-90 group-hover:scale-100 transition-transform hover:bg-gray-100">
                <Camera className="w-5 h-5 text-gray-700" />
              </div>
            </button>
            <Button
              type="button"
              onClick={handleRemove}
              variant="destructive"
              size="icon"
              className="rounded-full transform scale-90 group-hover:scale-100 transition-transform"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
          {error}
        </p>
      )}
    </div>
  );
}
