import { useState, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';
import type { MultiPhotoUploadHandle } from '@/components/MultiPhotoUpload';
import { addForgottenCargo, type ForgottenCargoResult } from '@/api/services/flightNotifications';
import { useToast } from '@/hooks/useToast';

interface ForgottenCargoModalProps {
  flightName: string;
  onClose: () => void;
  onSuccess: (result: ForgottenCargoResult) => void;
}

function parseTrackCodes(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export default function ForgottenCargoModal({
  flightName,
  onClose,
  onSuccess,
}: ForgottenCargoModalProps) {
  const { toast, ToastRenderer } = useToast();
  const photoUploadRef = useRef<MultiPhotoUploadHandle>(null);

  const [clientId, setClientId] = useState('');
  const [trackCodesRaw, setTrackCodesRaw] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [comment, setComment] = useState('');
  const [sendImmediately, setSendImmediately] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedClientId = clientId.trim().toUpperCase();
    if (!trimmedClientId) {
      toast({ title: 'Mijoz kodini kiriting', variant: 'error' });
      return;
    }
    const validCodes = parseTrackCodes(trackCodesRaw);
    if (!validCodes.length) {
      toast({ title: "Kamida 1 ta trek kod kiritish majburiy", variant: 'error' });
      return;
    }
    const weight = parseFloat(weightKg);
    if (!weightKg || isNaN(weight) || weight <= 0) {
      toast({ title: "Og'irlikni to'g'ri kiriting", variant: 'error' });
      return;
    }
    if (!photos.length) {
      toast({ title: "Kamida 1 ta rasm qo'shish majburiy", variant: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addForgottenCargo(flightName, {
        clientId: trimmedClientId,
        trackCodes: validCodes,
        weightKg: weight,
        pricePerKg: pricePerKg ? parseFloat(pricePerKg) : undefined,
        comment: comment.trim() || undefined,
        sendImmediately,
        photos,
      });
      onSuccess(result);
    } catch (err) {
      const errMsg = (err as { message?: string })?.message ?? "Xatolik yuz berdi";
      toast({ title: errMsg, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <ToastRenderer />
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#111] rounded-t-3xl sm:rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/[0.06] shrink-0">
          <div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">{flightName}</p>
            <h2 className="text-base font-black text-gray-800 dark:text-white">Unutilgan yuk qo'shish</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Client ID */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Mijoz kodi <span className="text-red-500">*</span>
            </label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value.toUpperCase())}
              placeholder="Masalan: MC-001"
              className="w-full h-10 px-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>

          {/* Track codes — textarea */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Trek kodlari <span className="text-red-500">*</span>
              <span className="ml-2 font-normal normal-case text-gray-400">(enter yoki vergul bilan ajrating)</span>
            </label>
            <textarea
              value={trackCodesRaw}
              onChange={(e) => setTrackCodesRaw(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds new line; prevent form submit
                if (e.key === 'Enter') e.stopPropagation();
              }}
              rows={3}
              placeholder={"TRK001\nTRK002\nTRK003"}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none font-mono"
            />
            {trackCodesRaw.trim() && (
              <p className="mt-1 text-[10px] text-gray-400">
                {parseTrackCodes(trackCodesRaw).length} ta kod aniqlandi
              </p>
            )}
          </div>

          {/* Photos — MultiPhotoUpload (camera + gallery) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Rasmlar <span className="text-red-500">*</span>
            </label>
            <MultiPhotoUpload
              ref={photoUploadRef}
              label="Rasm qo'shish"
              value={photos}
              onChange={setPhotos}
              maxPhotos={10}
            />
          </div>

          {/* Weight + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Og'irlik (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="5.5"
                className="w-full h-10 px-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Narx ($/kg)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                placeholder="9.5 (default)"
                className="w-full h-10 px-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Qo'shimcha ma'lumot..."
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
            />
          </div>

          {/* Send immediately — checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none py-2">
            <div className="relative">
              <input
                type="checkbox"
                checked={sendImmediately}
                onChange={(e) => setSendImmediately(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                sendImmediately
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300 dark:border-white/20 bg-white dark:bg-transparent'
              }`}>
                {sendImmediately && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Darhol yuborish</p>
              <p className="text-[11px] text-gray-400">Saqlagandan keyin darhol Telegram orqali yuboriladi</p>
            </div>
          </label>

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-2xl border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saqlanmoqda...
              </>
            ) : (
              sendImmediately ? 'Saqlash va yuborish' : 'Saqlash'
            )}
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
