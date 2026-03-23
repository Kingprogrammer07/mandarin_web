import { useState, useRef, useEffect } from 'react';
import { offlineStorage } from '@/utils/offlineStorage';
import { uploadPhoto } from '@/api/services/cargo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';
import type { MultiPhotoUploadHandle } from '@/components/MultiPhotoUpload';
import { ArrowLeft, Save, Camera } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

interface AddCargoFormProps {
  flightName: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface QueuedUpload {
  id: string;
  flightName: string;
  clientId: string;
  photos: File[];
  weightKg?: number;
  pricePerKg?: number;
  comment?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const normalizeNumber = (value: string): string | null => {
  const normalized = value.replace(/,/g, '.');
  const cleaned = normalized.replace(/[^\d.]/g, '');

  const parts = cleaned.split('.');
  if (parts.length > 2) return null;

  // Smart decimal: if starts with '.', prefix with '0'
  if (cleaned.startsWith('.')) return '0' + cleaned;

  return cleaned;
};

export default function AddCargoForm({ flightName, onBack, onSuccess }: AddCargoFormProps) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fast mode & Auto Camera settings
  const [fastMode, setFastMode] = useState(false);
  const [autoCamera, setAutoCamera] = useState(true); // Restored Toggle State

  // Upload queue for background processing
  const [uploadQueue, setUploadQueue] = useState<QueuedUpload[]>([]);

  // Refs
  const clientIdInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<MultiPhotoUploadHandle>(null);

  // Track previous fastMode value to detect toggle-on
  const prevFastModeRef = useRef(false);

  // Toast notifications
  const { toast, ToastRenderer } = useToast();

  /**
   * Client ID validation and formatting
   */
  const handleClientIdChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setClientId(cleaned);
    if (errors.client_id) {
      setErrors({ ...errors, client_id: '' });
    }
  };

  /**
   * Weight validation
   */
  const handleWeightChange = (value: string) => {
    const cleaned = normalizeNumber(value);
    if (cleaned === null) return;

    // Allow empty input while editing
    if (cleaned === '') {
      setWeightKg('');
      if (errors.weight_kg) {
        setErrors({ ...errors, weight_kg: '' });
      }
      return;
    }

    const numericValue = Number(cleaned);

    // Prevent invalid numbers
    if (isNaN(numericValue) || numericValue < 0) {
      return;
    }

    // If 100 or more => force to 99
    if (numericValue >= 100) {
      setWeightKg('99');
    } else {
      setWeightKg(cleaned);
    }

    if (errors.weight_kg) {
      setErrors({ ...errors, weight_kg: '' });
    }
  };

  /**
   * Price per kg validation
   */
  const handlePricePerKgChange = (value: string) => {
    const cleaned = normalizeNumber(value);
    if (cleaned === null) return;

    setPricePerKg(cleaned);
    if (errors.price_per_kg) {
      setErrors({ ...errors, price_per_kg: '' });
    }
  };

  /**
   * Form validation
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!clientId.trim()) {
      newErrors.client_id = t('cargo.validation.clientCodeRequired');
    } else if (!/^[A-Z][A-Z0-9-]*$/.test(clientId)) {
      newErrors.client_id = t('cargo.validation.clientCodeInvalid');
    }

    if (photos.length === 0) {
      newErrors.photos = t('cargo.validation.photoRequired');
    }

    if (!weightKg.trim()) {
      newErrors.weight_kg = t('cargo.validation.weightRequired');
    } else if (isNaN(Number(weightKg))) {
      newErrors.weight_kg = t('cargo.validation.weightInvalid');
    }

    if (pricePerKg && isNaN(Number(pricePerKg))) {
      newErrors.price_per_kg = t('cargo.validation.weightInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * PERMISSION-FIRST: When user toggles Fast Mode ON, acquire camera
   * permission and start the stream in the background (no modal).
   */
  useEffect(() => {
    if (fastMode && !prevFastModeRef.current) {
      // FastMode turned ON -> Silent Warm Up
      cameraRef.current?.prepareStream();
    }
    prevFastModeRef.current = fastMode;
  }, [fastMode]);

  /**
   * BACKGROUND QUEUE SUBMIT FLOW
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || photos.length === 0) return;

    // Create queue item
    const queueItem: QueuedUpload = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      flightName,
      clientId,
      photos,
      weightKg: weightKg ? Number(weightKg) : undefined,
      pricePerKg: pricePerKg ? Number(pricePerKg) : undefined,
      comment: comment.trim() || undefined,
      status: 'pending'
    };

    // Add to queue
    setUploadQueue(prev => [...prev, queueItem]);

    if (fastMode) {
      // FAST MODE: Immediate reset
      setClientId('');
      setWeightKg('');
      setPricePerKg('');
      setComment('');
      setPhotos([]);
      setErrors({});

      // LOGIC: Check Auto Camera Toggle
      if (autoCamera) {
        // If Auto-Camera ON: Open camera immediately (0ms delay due to warm start)
        setTimeout(() => {
          cameraRef.current?.openCamera();
        }, 100);
      } else {
        // If Auto-Camera OFF: Just focus the input
        setTimeout(() => {
          clientIdInputRef.current?.focus();
        }, 100);
      }
    }
  };

  /**
   * Background queue processor
   */
  useEffect(() => {
    const getErrorMessage = (error: unknown, fallback: string) => {
      if (typeof error === 'object' && error !== null) {
        const e = error as { message?: string; data?: { detail?: string } };
        return e.data?.detail ?? e.message ?? fallback;
      }
      return fallback;
    };
    const hasResponse = (error: unknown): error is { response: unknown } =>
      typeof error === 'object' && error !== null && 'response' in (error as object);


    const processQueue = async () => {
      const pending = uploadQueue.find(item => item.status === 'pending');
      if (!pending) {
        if (!fastMode && uploadQueue.length > 0) {
          const allCompleted = uploadQueue.every(item => item.status === 'success' || item.status === 'error');
          if (allCompleted) {
            setTimeout(() => {
              onSuccess();
            }, 1000);
          }
        }
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      setUploadQueue(prev => prev.map(item =>
        item.id === pending.id ? { ...item, status: 'uploading' } : item
      ));

      try {
        await uploadPhoto(
          pending.flightName,
          pending.clientId,
          pending.photos,
          pending.weightKg,
          pending.pricePerKg,
          pending.comment
        );

        setUploadQueue(prev => prev.map(item =>
          item.id === pending.id ? { ...item, status: 'success' } : item
        ));

        toast({
          title: `✅ ${t('cargo.messages.uploadSuccess')}`,
          description: `${t('cargo.photoCard.client')} ${pending.clientId} - ${pending.photos.length} ${t('cargo.photos')}`,
          variant: 'success',
          duration: 2000
        });

        setTimeout(() => {
          setUploadQueue(prev => prev.filter(item => item.id !== pending.id));
        }, 3000);

      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error, t('cargo.messages.uploadError'));

        // CHECK: If network error (status 0 or 'Network Error'), save to offline storage
        const isNetworkError =
          (typeof error === 'object' && error !== null && 'message' in (error as object) && (error as { message?: string }).message === 'Network Error') ||
          !window.navigator.onLine;
        if (!hasResponse(error) || isNetworkError) {

          try {
            const failedItem = {
              id: pending.id,
              flightName: pending.flightName,
              clientId: pending.clientId,
              photos: pending.photos,
              weightKg: pending.weightKg,
              pricePerKg: pending.pricePerKg,
              comment: pending.comment,
              error: errorMessage,
              timestamp: Date.now()
            };

            await offlineStorage.saveItem(failedItem);

            toast({
              title: "⚠️ Internet yo'q",
              description: "Ma'lumot oflayn xotiraga saqlandi.",
              variant: 'warning', // Assuming 'warning' variant exists or use 'default' with styling
              duration: 3000
            });

            // Remove from active queue to prevent infinite retry loop or blocking
            setUploadQueue(prev => prev.filter(item => item.id !== pending.id));

          } catch (dbError) {
            console.error("Failed to save to offline DB", dbError);
            setUploadQueue(prev => prev.map(item =>
              item.id === pending.id ? { ...item, status: 'error', error: "Offline save failed: " + errorMessage } : item
            ));
          }
        } else {
          // Normal API error (e.g. 400 Bad Request) - Keep in queue with error state
          setUploadQueue(prev => prev.map(item =>
            item.id === pending.id ? { ...item, status: 'error', error: errorMessage } : item
          ));
        }
      }
    };

    processQueue();
  }, [uploadQueue, fastMode, onSuccess, toast, t]);

  /**
   * Auto-focus Client ID when photos are added
   */
  useEffect(() => {
    if (photos.length > 0 && clientIdInputRef.current && !clientId) {
      clientIdInputRef.current.focus();
    }
  }, [photos, clientId]);

  return (
    <>
      <ToastRenderer />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{t('cargo.flight')}</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-800">{t('cargo.addTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('cargo.flight')}: {flightName}</p>
        </div>

        {/* Fast Mode Toggle */}
        <div className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4">
          <div className="flex flex-col gap-3">
            {/* Main Switch */}
            <label className="flex items-center gap-4 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={fastMode}
                  onChange={(e) => setFastMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-gray-300 rounded-full peer-checked:bg-orange-500 peer-focus:ring-4 peer-focus:ring-orange-300 transition-all"></div>
                <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full shadow-md peer-checked:translate-x-6 transition-transform"></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-orange-600" />
                  {t('cargo.fastMode')}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {t('cargo.fastModeDescription')}
                </p>
              </div>
            </label>

            {/* Nested Auto-Camera Toggle (Restored) */}
            {fastMode && (
              <div className="pl-14 pt-1 animate-in slide-in-from-top-2 fade-in">
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoCamera}
                      onChange={(e) => setAutoCamera(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-all"></div>
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform"></div>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-800 transition-colors">
                    {t('cargo.autoOpen')}
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Multi Photo Upload */}
          <div>
            <MultiPhotoUpload
              ref={cameraRef}
              label={t('cargo.photoRequired')}
              value={photos}
              onChange={setPhotos}
              error={errors.photos}
              maxPhotos={10}
              fastMode={fastMode}
              onCameraClose={() => {
                if (clientIdInputRef.current && !clientId) {
                  clientIdInputRef.current.focus();
                }
              }}
            />
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('cargo.clientCode')} <span className="text-red-500">*</span>
            </label>
            <Input
              ref={clientIdInputRef}
              type="text"
              value={clientId}
              onChange={(e) => handleClientIdChange(e.target.value)}
              placeholder={t('cargo.clientCodePlaceholder')}
              className={`text-lg caret-red-500 ${errors.client_id ? 'border-red-500' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  weightInputRef.current?.focus();
                }
              }}
            />
            {errors.client_id && (
              <p className="text-sm text-red-600 mt-2">{errors.client_id}</p>
            )}
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('cargo.weight')} <span className="text-red-500">*</span>
            </label>
            <Input
              ref={weightInputRef}
              type="text"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => handleWeightChange(e.target.value)}
              placeholder={t('cargo.weightPlaceholder')}
              className={`caret-red-500 ${errors.weight_kg ? 'border-red-500' : ''}`}
            />
            {errors.weight_kg && (
              <p className="text-sm text-red-600 mt-2">{errors.weight_kg}</p>
            )}
          </div>

          {/* Price Per Kg */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('cargo.pricePerKg')}
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={pricePerKg}
              onChange={(e) => handlePricePerKgChange(e.target.value)}
              placeholder={t('cargo.pricePerKgPlaceholder')}
              className={`caret-red-500 ${errors.price_per_kg ? 'border-red-500' : ''}`}
            />
            {errors.price_per_kg && (
              <p className="text-sm text-red-600 mt-2">{errors.price_per_kg}</p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('cargo.comment')}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('cargo.commentPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  <span>{fastMode ? t('cargo.saveAndNext') : t('cargo.submit')}</span>
                </div>
              </Button>

              <Button
                type="button"
                onClick={onBack}
                variant="outline"
                className="px-5 py-5"
              >
                {t('cargo.cancel')}
              </Button>
            </div>

            {/* Upload Queue Status */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2 pt-2">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    {item.status === 'pending' && (
                      <p className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        {t('cargo.queuePending')}: <span className="font-semibold">{item.clientId}</span>
                      </p>
                    )}
                    {item.status === 'uploading' && (
                      <p className="text-blue-600 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        {t('cargo.queueUploading')}: <span className="font-semibold">{item.clientId}</span>
                      </p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-red-600 flex items-start gap-2">
                        <span className="w-2 h-2 bg-red-600 rounded-full mt-1.5"></span>
                        <span>
                          {t('cargo.queueError')} (<span className="font-semibold">{item.clientId}</span>): {item.error}
                        </span>
                      </p>
                    )}
                  </div>
                ))}

                {/* Queue summary */}
                {uploadQueue.filter(item => item.status === 'pending' || item.status === 'uploading').length > 0 && (
                  <p className="text-xs text-gray-500 pt-1">
                    {t('cargo.queueSummary')}: {uploadQueue.filter(item => item.status === 'pending' || item.status === 'uploading').length} {t('cargo.queueInQueue')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fast Mode Instructions */}
          {fastMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm whitespace-pre-line">
              <p className="text-blue-800">{t('cargo.fastModeInstructions')}</p>
            </div>
          )}
        </form>
      </div>
    </>
  );
}

