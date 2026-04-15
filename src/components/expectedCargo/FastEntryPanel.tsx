import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Loader2, X, CheckCircle2, AlertCircle, User, Camera, ScanLine,
  Pencil, AlertTriangle, Info,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  resolveClientByTrackCode,
  type ResolvedClientResponse,
} from '@/api/services/expectedCargo';
import { useExpectedCargoStore, type FastEntryQueueItem } from '@/store/expectedCargoStore';
import { playSuccessSound, playErrorSound, playWarningSound } from '@/utils/audioUtils';

interface FastEntryPanelProps {
  flightName: string | null;
  onClose: () => void;
}

// Stable DOM id for the Html5Qrcode video container
const SCANNER_CONTAINER_ID = 'ec-qr-video-container';

// ── Duplicate-client detection ─────────────────────────────────────────────────
//
// Rule: warn ONLY when the same client reappears AFTER at least one track code
// from a DIFFERENT client was scanned in between.
//
// Example that DOES trigger:  STCH3, STCH3, STCH3, OTHER, STCH3  ← warning on the last STCH3
// Example that does NOT:      STCH3, STCH3, STCH3                ← no warning (consecutive)

function detectContinuation(
  queue: FastEntryQueueItem[],
  resolvedClientCode: string,
): { isContinuation: boolean; priorCount: number } {
  // Only look at items that were already resolved with a known client code.
  const resolvedQueue = queue.filter((item) => item.isResolved && item.clientCode);

  // How many prior items share this client code?
  const sameClientItems = resolvedQueue.filter((item) => item.clientCode === resolvedClientCode);
  if (sameClientItems.length === 0) return { isContinuation: false, priorCount: 0 };

  // Index of the LAST item in resolvedQueue that matches this client.
  const lastSameIdx = resolvedQueue.reduce<number>(
    (last, item, idx) => (item.clientCode === resolvedClientCode ? idx : last),
    -1,
  );

  // Are there any DIFFERENT clients after that last-same-client item?
  const hasInterleavedOtherClient = resolvedQueue
    .slice(lastSameIdx + 1)
    .some((item) => item.clientCode !== resolvedClientCode);

  return {
    isContinuation: hasInterleavedOtherClient,
    priorCount: sameClientItems.length,
  };
}

// ── Queue item row ─────────────────────────────────────────────────────────────

interface QueueItemRowProps {
  item: FastEntryQueueItem;
  onRemove: (id: string) => void;
  onSetClientCode: (id: string, code: string) => void;
}

function QueueItemRow({ item, onRemove, onSetClientCode }: QueueItemRowProps) {
  const [isEditingCode, setIsEditingCode] = useState(!item.isResolved && !item.clientCode);
  const [tempCode, setTempCode] = useState(item.clientCode);
  // Show the continuation tooltip for 2 seconds on first render when flagged.
  const [showContinuationTooltip, setShowContinuationTooltip] = useState(item.isContinuation);

  // When the item becomes resolved (async), exit edit mode and sync temp code.
  useEffect(() => {
    if (item.isResolved) {
      setIsEditingCode(false);
      setTempCode(item.clientCode);
    }
  }, [item.isResolved, item.clientCode]);

  // Auto-dismiss the continuation tooltip after 2 seconds.
  useEffect(() => {
    if (!showContinuationTooltip) return;
    const timer = setTimeout(() => setShowContinuationTooltip(false), 2000);
    return () => clearTimeout(timer);
  }, [showContinuationTooltip]);

  const enterEditMode = () => {
    setTempCode(item.clientCode);
    setIsEditingCode(true);
  };

  // Three resolved states — all mean the API returned a client_code, but
  // the amount of associated info differs:
  //
  //  1. Full match   — client_code + full_name + client_id  → green
  //  2. Partial match — client_code only (name & id null)   → indigo/blue
  //  3. Ghost client  — client_code + client_id, but no name (exists in China DB but not ours) → amber
  const isPartialMatch =
    item.isResolved &&
    item.resolvedClientId === null &&
    item.resolvedClientName === null &&
    !!item.clientCode;

  const isGhostClient =
    item.isResolved &&
    item.resolvedClientId !== null &&
    item.resolvedClientName === null;

  // Row background + border based on state (continuation takes highest priority)
  const rowStyle = item.isContinuation
    ? 'bg-amber-50 dark:bg-amber-950/25 border-amber-400 dark:border-amber-600 ring-1 ring-amber-300 dark:ring-amber-700/50'
    : item.isResolved
      ? isPartialMatch
        ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
        : isGhostClient
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
          : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
      : item.clientCode
        ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';

  return (
    <div className="relative">
      {/* Continuation tooltip — appears for 2 seconds after a duplicate-client scan */}
      {showContinuationTooltip && item.isContinuation && (
        <div className="absolute -top-8 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 text-white text-[10px] font-semibold rounded-full shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200">
            <AlertTriangle className="size-3 flex-shrink-0" />
            Orada boshqa mijoz kiritilgan — bu avvalgining davomi
          </div>
        </div>
      )}

      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors', rowStyle)}>
        {/* Status icon */}
        <span className="flex-shrink-0">
          {item.isContinuation ? (
            <AlertTriangle className="size-4 text-amber-500" />
          ) : item.isResolved ? (
            isPartialMatch ? (
              <Info className="size-4 text-indigo-500" />
            ) : isGhostClient ? (
              <AlertCircle className="size-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="size-4 text-green-500" />
            )
          ) : item.clientCode ? (
            <User className="size-4 text-zinc-400" />
          ) : (
            <AlertCircle className="size-4 text-amber-500" />
          )}
        </span>

        {/* Track code */}
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 flex-shrink-0 max-w-[40%] truncate">
          {item.trackCode}
        </span>

        {/* Client code / edit area */}
        <div className="flex-1 min-w-0">
          {isEditingCode ? (
            <Input
              autoFocus
              value={tempCode}
              onChange={(e) => setTempCode(e.target.value.toUpperCase())}
              onBlur={() => {
                if (tempCode.trim()) onSetClientCode(item.id, tempCode.trim());
                setIsEditingCode(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (tempCode.trim()) onSetClientCode(item.id, tempCode.trim());
                  setIsEditingCode(false);
                  document.getElementById('main-track-input')?.focus();
                } else if (e.key === 'Escape') {
                  setTempCode(item.clientCode);
                  setIsEditingCode(false);
                }
              }}
              className="h-7 text-xs font-mono px-2 py-0 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 focus:ring-1 focus:ring-orange-500 rounded"
              placeholder="Mijoz kodini kiriting..."
            />
          ) : item.isResolved || item.isContinuation ? (
            <button
              onClick={enterEditMode}
              title="Mijoz kodini tahrirlash"
              className="flex items-center gap-1.5 text-xs w-full text-left group"
            >
              <span className={cn(
                'font-semibold transition-colors shrink-0',
                item.isContinuation || isGhostClient
                  ? 'text-amber-700 dark:text-amber-400 group-hover:text-orange-600'
                  : isPartialMatch
                    ? 'text-indigo-700 dark:text-indigo-400 group-hover:text-orange-600'
                    : 'text-green-700 dark:text-green-400 group-hover:text-orange-600 dark:group-hover:text-orange-400',
              )}>
                {item.clientCode}
              </span>

              {/* State-specific secondary label */}
              {item.isContinuation ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                  +{item.priorCountForClient} avval
                </span>
              ) : item.resolvedClientName ? (
                <span className="text-green-600/70 dark:text-green-500/70 truncate">
                  {item.resolvedClientName}
                </span>
              ) : isPartialMatch ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded-full shrink-0">
                  Faqat kod
                </span>
              ) : isGhostClient ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                  <AlertCircle className="size-3" />
                  Bazada yo'q
                </span>
              ) : null}

              <Pencil className="size-3 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
            </button>
          ) : (
            <button
              onClick={() => setIsEditingCode(true)}
              className={cn(
                'text-xs font-mono truncate text-left w-full',
                item.clientCode
                  ? 'text-zinc-600 dark:text-zinc-300'
                  : 'text-amber-600 dark:text-amber-400 italic',
              )}
            >
              {item.clientCode || "Bosing → kod kiriting"}
            </button>
          )}
        </div>

        <button
          onClick={() => onRemove(item.id)}
          className="flex-shrink-0 p-1 text-zinc-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Barcode Scanner Panel ──────────────────────────────────────────────────────

export function FastEntryPanel({ flightName, onClose }: FastEntryPanelProps) {
  const [trackCodeInput, setTrackCodeInput] = useState('');
  const [clientCodeInput, setClientCodeInput] = useState('');
  const [isAutoFill, setIsAutoFill] = useState(true);
  const [suggestion, setSuggestion] = useState<ResolvedClientResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);

  const trackInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);

  // Ref to latest isAutoFill value — prevents stale closure in async mutation callbacks
  const isAutoFillRef = useRef(isAutoFill);
  useEffect(() => {
    isAutoFillRef.current = isAutoFill;
  }, [isAutoFill]);

  const {
    entryQueue,
    enqueueEntry,
    resolveQueueItemClient,
    setQueueItemClientCode,
    removeFromQueue,
    setSearchQuery,
    setExpandedClient,
    setFastEntryOpen,
    addNotification,
  } = useExpectedCargoStore();

  useEffect(() => {
    const timer = setTimeout(() => trackInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // ── Camera lifecycle ────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    setIsScanning(false);
  }, []);

  const processScannedText = useCallback(
    (text: string) => {
      const raw = text.trim();
      if (!raw) return;
      const trackCode = raw.toUpperCase();

      if (isAutoFillRef.current) {
        if (entryQueue.some((i) => i.trackCode === trackCode)) {
          toast.warning(`${trackCode} allaqachon qo'shilgan`, { duration: 1500 });
          return;
        }
        enqueueEntry({
          trackCode,
          clientCode: '',
          resolvedClientName: null,
          resolvedClientId: null,
          isResolved: false,
        });
        resolveMutation.mutate(trackCode);
      } else {
        setTrackCodeInput(trackCode);
        setSuggestion(null);
        resolveMutation.mutate(trackCode);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryQueue, enqueueEntry],
  );

  useEffect(() => {
    if (!isScanning) return;
    if (!scannerReady) setScannerReady(true);
  }, [isScanning, scannerReady]);

  useEffect(() => {
    if (!scannerReady || qrInstanceRef.current) return;

    const qr = new Html5Qrcode(SCANNER_CONTAINER_ID, {
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      verbose: false,
    });
    qrInstanceRef.current = qr;

    qr.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: { width: 300, height: 120 } },
      (decodedText) => {
        playSuccessSound?.();
        processScannedText(decodedText);
      },
      () => {
        // Per-frame decode errors are expected (no barcode in frame) — ignore
      },
    ).catch((err: unknown) => {
      console.error('Camera start error:', err);
      toast.error("Kamera ochilmadi. Brauzer sozlamalarida kameraga ruxsat bering.");
      qrInstanceRef.current = null;
      setScannerReady(false);
      setIsScanning(false);
    });
  }, [scannerReady, processScannedText]);

  useEffect(() => {
    return () => {
      if (qrInstanceRef.current) {
        qrInstanceRef.current.stop().catch(() => {});
        qrInstanceRef.current = null;
      }
    };
  }, []);

  const handleCameraScan = useCallback(() => {
    setIsScanning((prev) => !prev);
  }, []);

  // ── Resolve mutation ────────────────────────────────────────────────────────

  const resolveMutation = useMutation({
    mutationFn: (trackCode: string) =>
      resolveClientByTrackCode(trackCode, flightName ?? undefined),

    onSuccess: (data, trackCode) => {
      if (isAutoFillRef.current) {
        const currentQueue = useExpectedCargoStore.getState().entryQueue;
        const { isContinuation, priorCount } = detectContinuation(currentQueue, data.client_code);

        resolveQueueItemClient(
          trackCode,
          data.client_code,
          data.full_name,
          data.client_id,
          isContinuation,
          priorCount,
        );

        if (isContinuation) {
          playWarningSound();

          const totalCount = priorCount + 1;

          // Persistent warning toast — stays until dismissed by the admin.
          // Clicking "Ko'rish" navigates to the client in the list and closes
          // the scanner panel so the user can see the full client row.
          toast.warning(
            `${data.client_code} — orada boshqa mijoz kiritilgan, keyin yana shu mijoz`,
            {
              duration: Infinity,
              description: `"${data.client_code}" uchun avval ${priorCount} ta trek kodi bor edi, yangi: ${trackCode}. Jami: ${totalCount} ta.`,
              action: {
                label: 'Ko\'rish',
                onClick: () => {
                  setFastEntryOpen(false);
                  setSearchQuery(data.client_code);
                  setExpandedClient(data.client_code);
                },
              },
            },
          );

          addNotification({
            type: 'warning',
            title: `Takroriy mijoz: ${data.client_code}`,
            description: `Orada boshqa mijoz kiritilganidan keyin "${data.client_code}" qayta topildi. Avvalgisi: ${priorCount} ta, jami: ${totalCount} ta trek kodi.`,
            navigateTo: { flightName: flightName ?? '', clientCode: data.client_code },
          });
        } else {
          playSuccessSound();
        }
      } else {
        playSuccessSound();
        setSuggestion(data);
        requestAnimationFrame(() => clientInputRef.current?.focus());
      }
    },

    onError: (_err, trackCode) => {
      playErrorSound();
      if (isAutoFillRef.current) {
        resolveQueueItemClient(trackCode, '', null, null, false, 0);
        toast.warning(`${trackCode} — mijoz topilmadi, qo'lda kiriting`, { duration: 2000 });
      } else {
        setSuggestion(null);
        toast.warning("Mijoz topilmadi — qo'lda kiriting", { duration: 2000 });
      }
    },
  });

  // ── Text input handlers ─────────────────────────────────────────────────────

  const handleAutoFillChange = (checked: boolean) => {
    setIsAutoFill(checked);
    setSuggestion(null);
    setClientCodeInput('');
    setTrackCodeInput('');
    requestAnimationFrame(() => trackInputRef.current?.focus());
  };

  const handleAutoFillScan = useCallback(() => {
    const raw = trackCodeInput.trim();
    if (!raw) return;
    const trackCode = raw.toUpperCase();

    if (entryQueue.some((i) => i.trackCode === trackCode)) {
      toast.warning(`${trackCode} allaqachon qo'shilgan`, { duration: 1500 });
      setTrackCodeInput('');
      return;
    }

    enqueueEntry({
      trackCode,
      clientCode: '',
      resolvedClientName: null,
      resolvedClientId: null,
      isResolved: false,
    });
    resolveMutation.mutate(trackCode);
    setTrackCodeInput('');
    requestAnimationFrame(() => trackInputRef.current?.focus());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackCodeInput, entryQueue, enqueueEntry]);

  const handleManualScan = useCallback(() => {
    const raw = trackCodeInput.trim();
    if (!raw) return;
    setSuggestion(null);
    resolveMutation.mutate(raw.toUpperCase());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackCodeInput]);

  const handleManualAdd = useCallback(() => {
    const trackCode = trackCodeInput.trim().toUpperCase();
    const clientCode = clientCodeInput.trim().toUpperCase();
    if (!trackCode) { trackInputRef.current?.focus(); return; }

    if (entryQueue.some((i) => i.trackCode === trackCode)) {
      toast.warning(`${trackCode} allaqachon qo'shilgan`, { duration: 1500 });
      setTrackCodeInput('');
      setClientCodeInput('');
      setSuggestion(null);
      requestAnimationFrame(() => trackInputRef.current?.focus());
      return;
    }

    enqueueEntry({
      trackCode,
      clientCode,
      resolvedClientName: suggestion?.full_name ?? null,
      resolvedClientId: suggestion?.client_id ?? null,
      isResolved: !!clientCode && clientCode === suggestion?.client_code,
    });
    setTrackCodeInput('');
    setClientCodeInput('');
    setSuggestion(null);
    requestAnimationFrame(() => trackInputRef.current?.focus());
  }, [trackCodeInput, clientCodeInput, entryQueue, enqueueEntry, suggestion]);

  const handleAcceptSuggestion = () => {
    if (!suggestion) return;
    setClientCodeInput(suggestion.client_code);
    setSuggestion(null);
    clientInputRef.current?.focus();
  };

  const handleTrackKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isAutoFill) handleAutoFillScan(); else handleManualScan();
    }
  };

  const handleClientKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleManualAdd(); }
  };

  const resolvedCount = entryQueue.filter((i) => i.isResolved || i.clientCode).length;

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* ── Panel header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ScanLine className="size-4 text-orange-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Barcode kiritish
              {flightName && (
                <span className="ml-1 font-normal text-orange-500">· {flightName}</span>
              )}
            </span>
          </div>

          {/* Auto-fill toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <Switch
              size="sm"
              checked={isAutoFill}
              onCheckedChange={handleAutoFillChange}
              className="data-[state=checked]:bg-orange-500"
            />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Auto-fill
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {entryQueue.length > 0 && (
            <span className="text-xs text-zinc-400">
              {resolvedCount}/{entryQueue.length} tayyor
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Input area ────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 space-y-2">
        {/* Track code input — camera icon inside the input on the right */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id="main-track-input"
              ref={trackInputRef}
              value={trackCodeInput}
              onChange={(e) => setTrackCodeInput(e.target.value)}
              onKeyDown={handleTrackKeyDown}
              placeholder={
                isAutoFill
                  ? "Barkodni skanerlang yoki yozing → Enter"
                  : "Trek kodi → Enter"
              }
              className="h-10 text-sm font-mono pr-10 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:border-orange-400"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {resolveMutation.isPending ? (
                <Loader2 className="size-4 text-orange-400 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={handleCameraScan}
                  title={isScanning ? "Kamerani yopish" : "Kamera orqali skanerlash"}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isScanning
                      ? 'text-orange-500 bg-orange-50 dark:bg-orange-950/30'
                      : 'text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400',
                  )}
                >
                  <Camera className="size-4" />
                </button>
              )}
            </div>
          </div>

          {isAutoFill && (
            <Button
              size="sm"
              onClick={handleAutoFillScan}
              disabled={!trackCodeInput.trim()}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
            >
              Qo'sh
            </Button>
          )}
        </div>

        {/* ── Camera viewfinder ──────────────────────────────────────────────── */}
        {scannerReady && (
          <div
            className={isScanning
              ? "relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700"
              : ""}
            style={!isScanning ? {
              position: 'fixed',
              left: '-9999px',
              top: '-9999px',
              width: '320px',
              height: '160px',
              overflow: 'hidden',
            } : {
              maxHeight: '160px',
              overflow: 'hidden',
            }}
          >
            <div id={SCANNER_CONTAINER_ID} className="w-full" />
            {isScanning && (
              <>
                <div className="absolute bottom-0 left-0 right-0 py-2 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                  <span className="text-[11px] text-white/90 font-medium">
                    Barkodni kamera oldiga olib keling
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 rounded-full p-1.5 text-white transition-colors"
                  title="Kamerani yopish"
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Manual mode: suggestion badge + client code input ─────────────── */}
        {!isAutoFill && (
          <>
            {suggestion && (
              <button
                type="button"
                onClick={handleAcceptSuggestion}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 text-left transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/40"
              >
                <User className="size-3.5 flex-shrink-0 text-blue-500" />
                <span className="font-mono font-semibold">{suggestion.client_code}</span>
                {suggestion.full_name && (
                  <span className="text-blue-500/80 truncate">{suggestion.full_name}</span>
                )}
                <span className="ml-auto text-blue-400 text-[10px] flex-shrink-0">
                  ← qabul qilish
                </span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <Input
                ref={clientInputRef}
                value={clientCodeInput}
                onChange={(e) => setClientCodeInput(e.target.value.toUpperCase())}
                onKeyDown={handleClientKeyDown}
                placeholder="Mijoz kodi (badge bosing yoki qo'lda yozing)"
                className="flex-1 h-10 text-sm font-mono bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:border-orange-400"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                size="sm"
                onClick={handleManualAdd}
                disabled={!trackCodeInput.trim()}
                className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
              >
                Qo'sh
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Queue list ────────────────────────────────────────────────────────── */}
      {entryQueue.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
          {entryQueue.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              onRemove={removeFromQueue}
              onSetClientCode={setQueueItemClientCode}
            />
          ))}
        </div>
      )}

      {entryQueue.length === 0 && (
        <div className="px-3 pb-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {isAutoFill
            ? "Barkodni skanerlang — avtomatik mijozga biriktiriladi"
            : "Trek kodi yozing → Enter, so'ng mijoz kodini tasdiqlang"}
        </div>
      )}
    </div>
  );
}
