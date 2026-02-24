import { useState, useEffect } from 'react';
import { updateCargo, type CargoPhoto } from '@/api/services/cargo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';
import { X, Save } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

interface EditCargoModalProps {
  cargo: CargoPhoto;
  onClose: () => void;
  onSuccess: (updatedCargo: CargoPhoto) => void;
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

export default function EditCargoModal({ cargo, onClose, onSuccess }: EditCargoModalProps) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState(cargo.client_id);
  const [weightKg, setWeightKg] = useState(cargo.weight_kg?.toString() || '');
  const [pricePerKg, setPricePerKg] = useState(cargo.price_per_kg?.toString() || '');
  const [comment, setComment] = useState(cargo.comment || '');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { toast, ToastRenderer } = useToast();

  // Weight validation
  const handleWeightChange = (value: string) => {
    const cleaned = normalizeNumber(value);
    if (cleaned === null) return;

    setWeightKg(cleaned);
    if (errors.weight_kg) {
      setErrors({ ...errors, weight_kg: '' });
    }
  };

  // Price per kg validation
  const handlePricePerKgChange = (value: string) => {
    const cleaned = normalizeNumber(value);
    if (cleaned === null) return;

    setPricePerKg(cleaned);
    if (errors.price_per_kg) {
      setErrors({ ...errors, price_per_kg: '' });
    }
  };


  // Client ID validation
  const handleClientIdChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setClientId(cleaned);
    if (errors.client_id) {
      setErrors({ ...errors, client_id: '' });
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!clientId.trim()) {
      newErrors.client_id = t('cargo.validation.clientCodeRequired');
    } else if (!/^[A-Z][A-Z0-9-]*$/.test(clientId)) {
      newErrors.client_id = t('cargo.validation.clientCodeInvalid');
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

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const updatedCargo = await updateCargo(
        cargo.id,
        cargo.flight_name,
        clientId !== cargo.client_id ? clientId : undefined,
        weightKg ? Number(weightKg) : undefined,
        pricePerKg ? Number(pricePerKg) : undefined,
        comment.trim() || undefined,
        newPhotos.length > 0 ? newPhotos : undefined
      );

      toast({
        title: `✅ ${t('cargo.messages.updateSuccess')}`,
        description: t('cargo.messages.updateSuccessDescription'),
        variant: 'success',
        duration: 2000
      });

      onSuccess(updatedCargo.photo);
      onClose();

    } catch (error: unknown) {
      const errorMessage = (() => {
        if (typeof error === 'object' && error !== null) {
          const e = error as { message?: string; data?: { detail?: string } };
          return e.data?.detail ?? e.message ?? null;
        }
        return null;
      })() || t('cargo.messages.updateError');


      toast({
        title: `❌ ${t('cargo.messages.updateError')}`,
        description: errorMessage,
        variant: 'error',
        duration: 5000
      });

      console.error('Update failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      <ToastRenderer />

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
            <h2 className="text-xl font-bold text-gray-800">{t('cargo.editTitle')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Client ID (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('cargo.clientCode')} *
              </label>
              <Input
                type="text"
                value={clientId}
                onChange={(e) => handleClientIdChange(e.target.value)}
                placeholder={t('cargo.clientCodePlaceholder')}
                className={`caret-red-500 ${errors.client_id ? 'border-red-500 uppercase' : 'uppercase'}`}
                disabled={isSubmitting}
              />
              {errors.client_id && (
                <p className="text-sm text-red-600 mt-2">{errors.client_id}</p>
              )}
            </div>

            {/* Photo Update - Show current count and allow replacing ALL */}
            <div>
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700">
                  {t('cargo.photoOptional')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('cargo.currentPhotos')}: {cargo.photo_file_ids.length} {t('cargo.photos')}.
                  {newPhotos.length > 0
                    ? ` ${t('cargo.newPhotosReplace')}: ${newPhotos.length} ${t('cargo.photosWillReplace')}.`
                    : ` ${t('cargo.noChangePhotos')}.`}
                </p>
              </div>
              <MultiPhotoUpload
                label=""
                value={newPhotos}
                onChange={setNewPhotos}
                maxPhotos={10}
              />
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('cargo.weight')} <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => handleWeightChange(e.target.value)}
                placeholder={t('cargo.weightPlaceholder')}
                className={`caret-red-500 ${errors.weight_kg ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-5 text-sm"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('cargo.saving')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="w-5 h-5" />
                    <span>{t('cargo.submit')}</span>
                  </div>
                )}
              </Button>

              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                disabled={isSubmitting}
                className="px-5 py-5"
              >
                {t('cargo.cancel')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
