import { useState, useEffect } from 'react';
import { updateCargo, type CargoPhoto } from '@/api/services/cargo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';
import { X, Save, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import { normalizeNumber } from '@/utils/numberFormat';

interface EditCargoModalProps {
  cargo: CargoPhoto;
  onClose: () => void;
  onSuccess: (updatedCargo: CargoPhoto) => void;
}

const INPUT_CLS = [
  "h-11 rounded-xl",
  "bg-gray-50 dark:bg-white/5",
  "border-gray-200 dark:border-white/10",
  "text-gray-900 dark:text-white",
  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
  "focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:border-orange-500 focus-visible:ring-offset-0",
  "transition-all duration-100",
].join(' ');

const ERR_CLS = "!border-red-400 focus-visible:!ring-red-400/20 focus-visible:!border-red-400";

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

  const handleWeightChange = (value: string) => {
    const cleaned = normalizeNumber(value);
    if (cleaned === null) return;
    setWeightKg(cleaned);
    if (errors.weight_kg) setErrors(prev => { const n = { ...prev }; delete n.weight_kg; return n; });
  };

  const handlePricePerKgChange = (value: string) => {
    const cleaned = normalizeNumber(value);
    if (cleaned === null) return;
    setPricePerKg(cleaned);
    if (errors.price_per_kg) setErrors(prev => { const n = { ...prev }; delete n.price_per_kg; return n; });
  };

  const handleClientIdChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setClientId(cleaned);
    if (errors.client_id) setErrors(prev => { const n = { ...prev }; delete n.client_id; return n; });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!clientId.trim()) newErrors.client_id = t('cargo.validation.clientCodeRequired');
    else if (!/^[A-Z][A-Z0-9-]*$/.test(clientId)) newErrors.client_id = t('cargo.validation.clientCodeInvalid');
    if (!weightKg.trim()) newErrors.weight_kg = t('cargo.validation.weightRequired');
    else if (isNaN(Number(weightKg))) newErrors.weight_kg = t('cargo.validation.weightInvalid');
    if (pricePerKg && isNaN(Number(pricePerKg))) newErrors.price_per_kg = t('cargo.validation.weightInvalid');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const updatedCargo = await updateCargo(
        cargo.id, cargo.flight_name,
        clientId !== cargo.client_id ? clientId : undefined,
        weightKg ? Number(weightKg) : undefined,
        pricePerKg ? Number(pricePerKg) : undefined,
        comment.trim() || undefined,
        newPhotos.length > 0 ? newPhotos : undefined
      );
      toast({ title: `✅ ${t('cargo.messages.updateSuccess')}`, description: t('cargo.messages.updateSuccessDescription'), variant: 'success', duration: 2000 });
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
      toast({ title: `❌ ${t('cargo.messages.updateError')}`, description: errorMessage, variant: 'error', duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      <ToastRenderer />

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 animate-in fade-in duration-200" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative bg-white dark:bg-[#0d0a04] rounded-2xl shadow-xl shadow-black/30 max-w-md w-full max-h-[94vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-150 border border-orange-100/80 dark:border-orange-500/15"
          onClick={e => e.stopPropagation()}
        >
          {/* accent bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-orange-500 to-transparent z-10" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/30">
                <Edit2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-800 dark:text-gray-100">{t('cargo.editTitle')}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">{cargo.client_id}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors active:scale-90">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative overflow-y-auto max-h-[calc(92vh-80px)]">
            <div className="p-6 space-y-5">

              {/* Client ID */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                  {t('cargo.clientCode')} <span className="text-red-500">*</span>
                </label>
                <Input type="text" value={clientId} onChange={e => handleClientIdChange(e.target.value)}
                  placeholder={t('cargo.clientCodePlaceholder')} disabled={isSubmitting}
                  className={`${INPUT_CLS} uppercase font-mono tracking-widest text-base caret-orange-500 ${errors.client_id ? ERR_CLS : ''}`} />
                {errors.client_id && (
                  <p className="text-xs font-semibold text-red-500 mt-1.5">{errors.client_id}</p>
                )}
              </div>

              {/* Photos */}
              <div>
                <div className="mb-2">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('cargo.photoOptional')}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t('cargo.currentPhotos')}: {cargo.photo_file_ids.length} {t('cargo.photos')}.{' '}
                    {newPhotos.length > 0
                      ? `${t('cargo.newPhotosReplace')}: ${newPhotos.length} ${t('cargo.photosWillReplace')}.`
                      : t('cargo.noChangePhotos')}
                  </p>
                </div>
                <MultiPhotoUpload label="" value={newPhotos} onChange={setNewPhotos} maxPhotos={10} />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                  {t('cargo.weight')} <span className="text-red-500">*</span>
                </label>
                <Input type="text" inputMode="decimal" value={weightKg}
                  onChange={e => handleWeightChange(e.target.value)}
                  placeholder={t('cargo.weightPlaceholder')} disabled={isSubmitting}
                  className={`${INPUT_CLS} caret-orange-500 ${errors.weight_kg ? ERR_CLS : ''}`} />
                {errors.weight_kg && (
                  <p className="text-xs font-semibold text-red-500 mt-1.5">{errors.weight_kg}</p>
                )}
              </div>

              {/* Price per kg */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                  {t('cargo.pricePerKg')}
                </label>
                <Input type="text" inputMode="decimal" value={pricePerKg}
                  onChange={e => handlePricePerKgChange(e.target.value)}
                  placeholder={t('cargo.pricePerKgPlaceholder')} disabled={isSubmitting}
                  className={`${INPUT_CLS} caret-orange-500 ${errors.price_per_kg ? ERR_CLS : ''}`} />
                {errors.price_per_kg && (
                  <p className="text-xs font-semibold text-red-500 mt-1.5">{errors.price_per_kg}</p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                  {t('cargo.comment')}
                </label>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder={t('cargo.commentPlaceholder')} rows={3} disabled={isSubmitting}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all resize-none disabled:opacity-50" />
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <Button type="submit" disabled={isSubmitting}
                  className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 active:scale-[0.98] text-white font-black rounded-xl shadow-md shadow-orange-500/30 border-0 transition-all disabled:opacity-60">
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('cargo.saving')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      <span>{t('cargo.submit')}</span>
                    </div>
                  )}
                </Button>
                <Button type="button" onClick={onClose} variant="outline" disabled={isSubmitting}
                  className="h-12 px-5 rounded-xl border-2 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 font-bold transition-colors">
                  {t('cargo.cancel')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}