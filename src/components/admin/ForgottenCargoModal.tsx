import { useId, useRef, useState, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircle, Bot, Globe, Loader2, X } from 'lucide-react';
import MultiPhotoUpload from '@/components/MultiPhotoUpload';
import type { MultiPhotoUploadHandle } from '@/components/MultiPhotoUpload';
import {
  ChannelCheckbox,
  SelectionMark,
} from '@/components/admin/flight-notifications/SelectionControls';
import { addForgottenCargo, type ForgottenCargoResult } from '@/api/services/flightNotifications';
import { cn } from '@/lib/utils';

interface ForgottenCargoModalProps {
  flightName: string;
  onClose: () => void;
  onSuccess: (result: ForgottenCargoResult) => void;
  /**
   * Where the focus lands once the dialog is gone. It is opened from state,
   * not from a Radix Trigger, so without this the focus is left on <body>.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const LABEL = 'mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-mc-text-2';
const FIELD =
  'w-full rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-base text-mc-text placeholder:text-mc-text-3 focus:border-mc-brand';
const FOOTER_BUTTON =
  'flex h-12 flex-1 items-center justify-center gap-2 rounded-mc-md text-[14px] font-extrabold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none';

function parseTrackCodes(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-mc-danger">
      {' *'}
    </span>
  );
}

export default function ForgottenCargoModal({
  flightName,
  onClose,
  onSuccess,
  returnFocusRef,
}: ForgottenCargoModalProps) {
  const photoUploadRef = useRef<MultiPhotoUploadHandle>(null);
  const fieldId = useId();
  // Shown inside the dialog, not as a toast: Radix hides everything outside
  // an open modal from assistive tech, so a toast would never be announced.
  const [formError, setFormError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [trackCodesRaw, setTrackCodesRaw] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [comment, setComment] = useState('');
  const [sendImmediately, setSendImmediately] = useState(true);
  // Send channel: Bot mirrors to success/fail channels; Web stays silent.
  const [markBot, setMarkBot] = useState(false);
  const [markWeb, setMarkWeb] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedCodeCount = parseTrackCodes(trackCodesRaw).length;
  const hasInput =
    clientId.trim() !== '' ||
    trackCodesRaw.trim() !== '' ||
    weightKg !== '' ||
    pricePerKg !== '' ||
    comment.trim() !== '' ||
    photos.length > 0;

  const handleSubmit = async () => {
    const trimmedClientId = clientId.trim().toUpperCase();
    if (!trimmedClientId) {
      setFormError('Mijoz kodini kiriting');
      return;
    }
    const validCodes = parseTrackCodes(trackCodesRaw);
    if (!validCodes.length) {
      setFormError("Kamida 1 ta trek kod kiritish majburiy");
      return;
    }
    const weight = parseFloat(weightKg);
    if (!weightKg || isNaN(weight) || weight <= 0) {
      setFormError("Og'irlikni to'g'ri kiriting");
      return;
    }
    if (!photos.length) {
      setFormError("Kamida 1 ta rasm qo'shish majburiy");
      return;
    }
    if (sendImmediately && !markBot && !markWeb) {
      setFormError("Kamida bittasini tanlang: Bot yoki Web");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await addForgottenCargo(flightName, {
        clientId: trimmedClientId,
        trackCodes: validCodes,
        weightKg: weight,
        pricePerKg: pricePerKg ? parseFloat(pricePerKg) : undefined,
        comment: comment.trim() || undefined,
        sendImmediately,
        markBot,
        markWeb,
        photos,
      });
      onSuccess(result);
    } catch (err) {
      const errMsg = (err as { message?: string })?.message ?? "Xatolik yuz berdi";
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Content sits inside the overlay and is centred by flexbox, not a
            transform: the photo picker's camera and lightbox are fixed
            full-screen layers, and a transformed ancestor would trap them
            inside this panel. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:items-center sm:p-4">
          <DialogPrimitive.Content
            // Radix hides the page with aria-hidden but does not set this itself.
            aria-modal="true"
            // A half-filled form with photos must not vanish on a stray key or
            // tap; the buttons below are the deliberate way out.
            onEscapeKeyDown={(event) => {
              if (isSubmitting || hasInput) event.preventDefault();
            }}
            onInteractOutside={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => {
              const target = returnFocusRef?.current;
              if (!target?.isConnected) return;
              event.preventDefault();
              target.focus({ preventScroll: true });
            }}
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-mc-xl border border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)] outline-none sm:max-w-lg sm:rounded-mc-xl"
          >

            {/* Header */}
            <div className="flex shrink-0 items-start gap-2 border-b border-mc-border px-5 pb-3 pt-4">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[17px] font-extrabold leading-tight text-mc-text">
                  Unutilgan yuk qo'shish
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-0.5 break-words text-[12px] font-medium text-mc-text-2">
                  Reys: {flightName}
                </DialogPrimitive.Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Yopish"
                className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-mc-sm text-mc-text-2 active:scale-95 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">

              {/* Client ID */}
              <div>
                <label htmlFor={`${fieldId}-client`} className={LABEL}>
                  Mijoz kodi
                  <RequiredMark />
                </label>
                <input
                  id={`${fieldId}-client`}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value.toUpperCase())}
                  placeholder="Masalan: MC-001"
                  aria-required="true"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={cn(FIELD, 'h-11')}
                />
              </div>

              {/* Track codes — textarea */}
              <div>
                <label htmlFor={`${fieldId}-codes`} className={LABEL}>
                  Trek kodlari
                  <RequiredMark />
                  <span className="ml-2 font-semibold normal-case tracking-normal text-mc-text-3">
                    (enter yoki vergul bilan ajrating)
                  </span>
                </label>
                <textarea
                  id={`${fieldId}-codes`}
                  value={trackCodesRaw}
                  onChange={(e) => setTrackCodesRaw(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter adds new line; prevent form submit
                    if (e.key === 'Enter') e.stopPropagation();
                  }}
                  rows={3}
                  placeholder={"TRK001\nTRK002\nTRK003"}
                  aria-required="true"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={cn(FIELD, 'resize-none py-2.5 font-mono')}
                />
                {trackCodesRaw.trim() && (
                  <p aria-live="polite" className="mt-1 text-[11px] font-semibold text-mc-text-2">
                    {parsedCodeCount} ta kod aniqlandi
                  </p>
                )}
              </div>

              {/* Photos — MultiPhotoUpload (camera + gallery) */}
              <div role="group" aria-labelledby={`${fieldId}-photos`}>
                <p id={`${fieldId}-photos`} className={LABEL}>
                  Rasmlar
                  <RequiredMark />
                </p>
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
                <div className="min-w-0">
                  <label htmlFor={`${fieldId}-weight`} className={LABEL}>
                    Og'irlik (kg)
                    <RequiredMark />
                  </label>
                  <input
                    id={`${fieldId}-weight`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="5.5"
                    aria-required="true"
                    className={cn(FIELD, 'h-11')}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={`${fieldId}-price`} className={LABEL}>
                    Narx ($/kg)
                  </label>
                  <input
                    id={`${fieldId}-price`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    placeholder="9.5 (default)"
                    className={cn(FIELD, 'h-11')}
                  />
                </div>
              </div>

              {/* Comment */}
              <div>
                <label htmlFor={`${fieldId}-comment`} className={LABEL}>
                  Izoh (ixtiyoriy)
                </label>
                <textarea
                  id={`${fieldId}-comment`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Qo'shimcha ma'lumot..."
                  className={cn(FIELD, 'resize-none py-2.5')}
                />
              </div>

              {/* Send immediately — checkbox */}
              <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-mc-md border border-mc-border px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mc-brand">
                  <SelectionMark checked={sendImmediately} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-mc-text">Darhol yuborish</span>
                  <span className="block text-[11px] font-medium text-mc-text-2">
                    Saqlagandan keyin darhol Telegram orqali yuboriladi
                  </span>
                </span>
              </label>

              {/* Send channel — only relevant when sending immediately.
                  Bot → success/fail kanalga yoziladi; Web → yozilmaydi. */}
              {sendImmediately && (
                <div
                  role="group"
                  aria-labelledby={`${fieldId}-channel`}
                  aria-describedby={!markBot && !markWeb ? `${fieldId}-channel-error` : undefined}
                >
                  <p id={`${fieldId}-channel`} className={LABEL}>
                    Yuborish kanali
                    <RequiredMark />
                  </p>
                  <div className="flex gap-2">
                    <ChannelCheckbox
                      label="Web"
                      icon={Globe}
                      checked={markWeb}
                      onCheckedChange={setMarkWeb}
                      className="flex-1 justify-center"
                    />
                    <ChannelCheckbox
                      label="Bot"
                      icon={Bot}
                      checked={markBot}
                      onCheckedChange={setMarkBot}
                      className="flex-1 justify-center"
                    />
                  </div>
                  {!markBot && !markWeb && (
                    <p
                      id={`${fieldId}-channel-error`}
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-[12px] font-bold text-mc-danger"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Kamida bittasini tanlang
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] font-medium text-mc-text-2">
                    Bot — xato/muvaffaqiyat guruhiga yoziladi. Web — yozilmaydi.
                  </p>
                </div>
              )}

            </div>

            {/* Above the footer, not in the scrolled body: it must be seen
                whichever field the body is scrolled to. */}
            {formError && (
              <p
                role="alert"
                className="flex shrink-0 items-start gap-2 border-t border-mc-border bg-mc-danger-soft px-5 py-2.5 text-[13px] font-bold text-mc-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{formError}</span>
              </p>
            )}

            {/* Footer */}
            <div className="flex shrink-0 gap-3 border-t border-mc-border px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={cn(FOOTER_BUTTON, 'border border-mc-border bg-mc-surface text-mc-text')}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(FOOTER_BUTTON, 'bg-mc-brand text-mc-on-brand')}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                    Saqlanmoqda...
                  </>
                ) : (
                  sendImmediately ? 'Saqlash va yuborish' : 'Saqlash'
                )}
              </button>
            </div>

          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
