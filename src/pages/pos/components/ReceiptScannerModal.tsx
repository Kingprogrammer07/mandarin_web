/**
 * ReceiptScannerModal — cashier-facing QR/barcode receipt scanner.
 *
 * Two capture paths, both resolve the same `order_id` against the
 * authenticated POS endpoint (`/api/v1/pos/receipt/{order_id}`):
 *
 *   1. **Hardware scanner** (keyboard-wedge): a focused input absorbs the
 *      device's keystrokes and submits on the trailing Enter.
 *   2. **Camera**: `html5-qrcode` reads the QR from the webcam.
 *
 * The QR payload is the receipt URL (`{WEBAPP}/pos?receipt=<order_id>`); we
 * extract the id whether the scan yields the full URL or a bare id.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  ScanLine,
  Camera,
  Keyboard,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  CreditCard,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import {
  posNotificationService,
  type ReceiptResolveResponse,
} from '@/api/services/posNotificationService';

interface ReceiptScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional order_id to resolve immediately (e.g. from a `?receipt=` deep link). */
  initialOrderId?: string | null;
  /** Load the resolved client into the POS center column (full cashier actions). */
  onOpenInPos?: (clientCode: string) => void;
}

const CAMERA_ELEMENT_ID = 'pos-receipt-qr-reader';

/** Pull the order_id out of a scanned URL or a raw id string. */
function extractOrderId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = new URL(s);
    const q = url.searchParams.get('receipt');
    if (q) return q;
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== 'pos') return last;
  } catch {
    // Not a URL — fall through to raw handling.
  }
  const match = s.match(/[0-9a-fA-F-]{16,}/);
  return match ? match[0] : s;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type Mode = 'input' | 'camera';

export default function ReceiptScannerModal({
  open,
  onClose,
  initialOrderId,
  onOpenInPos,
}: ReceiptScannerModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('input');
  const [manualValue, setManualValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptResolveResponse | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resolvingRef = useRef(false);

  const resolve = useCallback(
    async (raw: string) => {
      const orderId = extractOrderId(raw);
      if (!orderId || resolvingRef.current) return;
      resolvingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const data = await posNotificationService.resolveReceipt(orderId);
        setResult(data);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status ?? 0;
        setError(
          status === 404
            ? t('pos.scanner.notFound', 'Chek topilmadi')
            : t('pos.scanner.error', 'Xatolik yuz berdi'),
        );
      } finally {
        setLoading(false);
        resolvingRef.current = false;
      }
    },
    [t],
  );

  // Stop and release the camera (idempotent).
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // Already stopped / never started — ignore.
    }
  }, []);

  // Start the camera when entering camera mode with no result yet.
  useEffect(() => {
    if (!open || mode !== 'camera' || result) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(CAMERA_ELEMENT_ID);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (cancelled) return;
          void stopCamera();
          void resolve(decodedText);
        },
        undefined,
      )
      .catch(() => {
        if (!cancelled) setError(t('pos.scanner.cameraError', 'Kamerani ochib bo\'lmadi'));
      });
    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [open, mode, result, resolve, stopCamera, t]);

  // Keep the hardware-scanner input focused while in input mode.
  useEffect(() => {
    if (open && mode === 'input' && !result) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open, mode, result]);

  // Resolve a deep-linked order id once when opened.
  useEffect(() => {
    if (open && initialOrderId) {
      void resolve(initialOrderId);
    }
    // Only on open / id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialOrderId]);

  // Full reset whenever the modal closes.
  useEffect(() => {
    if (!open) {
      void stopCamera();
      setMode('input');
      setManualValue('');
      setResult(null);
      setError(null);
      setLoading(false);
    }
  }, [open, stopCamera]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setManualValue('');
  }, []);

  const handleClose = useCallback(() => {
    void stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  if (!open) return null;

  const statusColor = (status: string): string => {
    if (status === 'paid') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (status === 'partial') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    return 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300';
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white dark:bg-[#151515] rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center">
                <ScanLine className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                {t('pos.scanner.title', 'Chek skaneri')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label={t('common.close', 'Yopish')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Result view */}
            {result ? (
              <div className="space-y-4">
                {result.source === 'zayafka' && (
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      <Package className="w-4 h-4" />
                      {t('pos.scanner.zayafka', 'Zayafka (UzPost)')}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-center">
                  {result.is_taken_away ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                      <CheckCircle2 className="w-4 h-4" />
                      {t('pos.scanner.takenAway', 'Olib ketilgan')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                      <Package className="w-4 h-4" />
                      {t('pos.scanner.notTakenAway', 'Olib ketilmagan')}
                    </span>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
                  <Row label={t('pos.scanner.client', 'Mijoz')} value={result.client_code || '—'} mono />
                  {result.client_name && <Row label={t('pos.scanner.name', 'Ism')} value={result.client_name} />}
                  {result.branch_name && (
                    <Row label={t('pos.scanner.branch', 'Filial')} value={result.branch_name} />
                  )}
                  <Row label={t('pos.scanner.flight', 'Reys')} value={result.flight_name || '—'} />
                  <Row label={t('pos.scanner.total', 'Jami')} value={`${formatMoney(result.total_amount)} so'm`} />
                  <Row label={t('pos.scanner.paid', "To'langan")} value={`${formatMoney(result.paid_amount)} so'm`} />
                  <Row label={t('pos.scanner.remaining', 'Qoldiq')} value={`${formatMoney(result.remaining_amount)} so'm`} />
                  {result.card_masked && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('pos.scanner.card', 'Karta')}</span>
                      <span className="flex items-center gap-1.5 text-sm font-mono text-gray-900 dark:text-white">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        {result.card_masked}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('pos.scanner.status', 'Holat')}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(result.payment_status)}`}>
                      {result.payment_status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {onOpenInPos && result.client_code && (
                    <button
                      onClick={() => {
                        onOpenInPos(result.client_code as string);
                        handleClose();
                      }}
                      className="w-full h-12 rounded-2xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      {t('pos.scanner.openInPos', "POS'da ochish")}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="w-full h-12 rounded-2xl font-bold text-sm bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('pos.scanner.scanAgain', 'Yana skanerlash')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Mode switch */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-white/5">
                  <button
                    onClick={() => setMode('input')}
                    className={`h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      mode === 'input'
                        ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Keyboard className="w-4 h-4" />
                    {t('pos.scanner.device', 'Skaner')}
                  </button>
                  <button
                    onClick={() => setMode('camera')}
                    className={`h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      mode === 'camera'
                        ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    {t('pos.scanner.camera', 'Kamera')}
                  </button>
                </div>

                {mode === 'input' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void resolve(manualValue);
                    }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('pos.scanner.deviceHint', 'Skaner qurilmasi bilan QR kodni skanerlang yoki kodni qo\'lda kiriting')}
                    </p>
                    <input
                      ref={inputRef}
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      placeholder={t('pos.scanner.placeholder', 'QR / order ID')}
                      autoComplete="off"
                      className="w-full px-4 py-3.5 rounded-xl text-base font-mono
                        bg-white dark:bg-white/[0.04]
                        border border-gray-200 dark:border-white/10
                        text-gray-900 dark:text-white
                        focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={loading || !manualValue.trim()}
                      className="w-full h-12 rounded-2xl font-bold text-sm bg-sky-500 hover:bg-sky-600 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                      {t('pos.scanner.resolve', 'Tekshirish')}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div
                      id={CAMERA_ELEMENT_ID}
                      className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
                    />
                    {loading && (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('pos.scanner.resolving', 'Tekshirilmoqda...')}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-medium">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className={`text-sm font-bold text-gray-900 dark:text-white truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
