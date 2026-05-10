import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Loader2, X, CheckCircle2, AlertCircle, User, Camera, ScanLine,
  Pencil, AlertTriangle, Info, XCircle, PanelBottomClose, PanelBottomOpen, Ban,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  resolveClientByTrackCode,
  type AlreadySentErrorBody,
  type ResolvedClientResponse,
} from '@/api/services/expectedCargo';
import { isAxiosError } from 'axios';
import { useExpectedCargoStore, type FastEntryQueueItem } from '@/store/expectedCargoStore';
import { playSuccessSound, playErrorSound, playWarningSound } from '@/utils/audioUtils';

interface FastEntryPanelProps {
  flightName: string | null;
  onClose: () => void;
  /** When true the queue list expands to fill available height (client list is hidden). */
  isQueueExpanded: boolean;
}

// ── Track validation result for client-first mode ─────────────────────────────

type TrackValidationStatus = 'checking' | 'match' | 'conflict' | 'already_sent' | 'not_found';

interface TrackValidation {
  status: TrackValidationStatus;
  /** Resolved client code from DB (owner of this track code). */
  resolvedClientCode?: string;
  resolvedClientName?: string | null;
  /** Flight name for already_sent status. */
  alreadySentFlight?: string | null;
}

// Stable DOM id for the Html5Qrcode video container
const SCANNER_CONTAINER_ID = 'ec-qr-video-container';

// ── Duplicate-client detection ─────────────────────────────────────────────────
//
// Only warn when the same client reappears AFTER at least one track code from a
// DIFFERENT client was scanned in between.
//
//  STCH3 × 6 consecutive       → silent (normal scanning)
//  STCH3 × 6, OTHER, STCH3     → warning on the 7th scan

function detectContinuation(
  queue: FastEntryQueueItem[],
  resolvedClientCode: string,
): { isContinuation: boolean; priorCount: number } {
  const resolvedQueue = queue.filter((item) => item.isResolved && item.clientCode);
  const sameClientItems = resolvedQueue.filter((item) => item.clientCode === resolvedClientCode);
  if (sameClientItems.length === 0) return { isContinuation: false, priorCount: 0 };

  const lastSameIdx = resolvedQueue.reduce<number>(
    (last, item, idx) => (item.clientCode === resolvedClientCode ? idx : last),
    -1,
  );

  const hasInterleavedOtherClient = resolvedQueue
    .slice(lastSameIdx + 1)
    .some((item) => item.clientCode !== resolvedClientCode);

  return { isContinuation: hasInterleavedOtherClient, priorCount: sameClientItems.length };
}

// ── Queue item row ─────────────────────────────────────────────────────────────

interface QueueItemRowProps {
  item: FastEntryQueueItem;
  onRemove: (id: string) => void;
  onSetClientCode: (id: string, code: string) => void;
}

function QueueItemRow({ item, onRemove, onSetClientCode }: QueueItemRowProps) {
  // Auto-open edit mode for items that need manual input (not-found or no client code yet).
  const [isEditingCode, setIsEditingCode] = useState(
    item.notFound || (!item.isResolved && !item.clientCode && !item.isWrongClient),
  );
  const [tempCode, setTempCode] = useState(item.clientCode);
  const [showContinuationTooltip, setShowContinuationTooltip] = useState(item.isContinuation);

  // ── Sync with async resolution without calling setState in an effect ──────────
  const [prevIsResolved, setPrevIsResolved] = useState(item.isResolved);
  const [prevClientCode, setPrevClientCode] = useState(item.clientCode);
  if (item.isResolved !== prevIsResolved || item.clientCode !== prevClientCode) {
    setPrevIsResolved(item.isResolved);
    setPrevClientCode(item.clientCode);
    if (item.isResolved) {
      setIsEditingCode(false);
      setTempCode(item.clientCode);
    }
  }

  useEffect(() => {
    if (!showContinuationTooltip) return;
    const timer = setTimeout(() => setShowContinuationTooltip(false), 2000);
    return () => clearTimeout(timer);
  }, [showContinuationTooltip]);

  const enterEditMode = () => {
    setTempCode(item.clientCode);
    setIsEditingCode(true);
  };

  const isPartialMatch =
    item.isResolved && item.resolvedClientId === null && item.resolvedClientName === null && !!item.clientCode;
  const isGhostClient =
    item.isResolved && item.resolvedClientId !== null && item.resolvedClientName === null;

  const rowStyle = item.isWrongClient
    ? 'bg-red-50 dark:bg-red-950/25 border-red-400 dark:border-red-700 ring-1 ring-red-300 dark:ring-red-700/50'
    : item.isAlreadySent
    ? 'bg-orange-50 dark:bg-orange-950/25 border-orange-400 dark:border-orange-600'
    : item.isContinuation
    ? 'bg-amber-50 dark:bg-amber-950/25 border-amber-400 dark:border-amber-600 ring-1 ring-amber-300 dark:ring-amber-700/50'
    : item.notFound
      ? 'bg-red-50 dark:bg-red-950/25 border-red-400 dark:border-red-700'
      : item.isResolved
        ? isPartialMatch
          ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
          : isGhostClient
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
            : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
        : item.clientCode
          ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700';

  return (
    <div className="relative">
      {/* Continuation tooltip — 2 seconds on first render */}
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
          {item.isWrongClient ? (
            <AlertCircle className="size-4 text-red-500" />
          ) : item.isAlreadySent ? (
            <Ban className="size-4 text-orange-500" />
          ) : item.notFound ? (
            <XCircle className="size-4 text-red-500" />
          ) : item.isContinuation ? (
            <AlertTriangle className="size-4 text-amber-500" />
          ) : item.isResolved ? (
            isPartialMatch ? <Info className="size-4 text-indigo-500" /> :
            isGhostClient ? <AlertCircle className="size-4 text-amber-500" /> :
            <CheckCircle2 className="size-4 text-green-500" />
          ) : item.clientCode ? (
            <User className="size-4 text-zinc-400" />
          ) : (
            <AlertCircle className="size-4 text-zinc-400" />
          )}
        </span>

        {/* Track code */}
        <span className={cn(
          'font-mono text-xs flex-shrink-0 max-w-[40%] truncate',
          item.isWrongClient
            ? 'text-red-700 dark:text-red-400'
            : item.isAlreadySent
            ? 'text-orange-700 dark:text-orange-400'
            : item.notFound
              ? 'text-red-700 dark:text-red-400'
              : 'text-zinc-700 dark:text-zinc-300',
        )}>
          {item.trackCode}
        </span>

        {/* Client code / edit area */}
        <div className="flex-1 min-w-0">
          {item.isWrongClient ? (
            <span className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-red-700 dark:text-red-400 font-semibold truncate">
                {item.clientCode}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-700 px-1.5 py-0.5 rounded-full shrink-0">
                Bu {item.conflictClientCode} mijozniki!
              </span>
            </span>
          ) : item.isAlreadySent ? (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-orange-700 dark:text-orange-400 font-semibold">
                Allaqachon yuborilgan
              </span>
              {item.alreadySentFlight && (
                <span className="text-[10px] text-orange-500 dark:text-orange-500 truncate">
                  ({item.alreadySentFlight})
                </span>
              )}
            </span>
          ) : isEditingCode ? (
            <Input
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
              className={cn(
                'h-7 text-xs font-mono px-2 py-0 focus:ring-1 rounded',
                item.notFound
                  ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20 focus:ring-red-500 placeholder:text-red-400'
                  : 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 focus:ring-orange-500',
              )}
              placeholder={item.notFound ? 'Mijoz kodini kiriting (topilmadi!)' : 'Mijoz kodini kiriting...'}
            />
          ) : item.notFound ? (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-1.5 text-xs w-full text-left"
            >
              <span className="text-red-600 dark:text-red-400 font-semibold italic">
                Topilmadi — bosing, kiriting
              </span>
            </button>
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
                  : 'text-zinc-400 dark:text-zinc-500 italic',
              )}
            >
              {item.clientCode || 'Yuklanmoqda...'}
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

// ── FastEntryPanel ─────────────────────────────────────────────────────────────

export function FastEntryPanel({ flightName, onClose, isQueueExpanded }: FastEntryPanelProps) {
  // ── Shared state ────────────────────────────────────────────────────────────
  const [trackCodeInput, setTrackCodeInput] = useState('');
  const [clientCodeInput, setClientCodeInput] = useState('');
  const [isAutoFill, setIsAutoFill] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [suggestion, setSuggestion] = useState<ResolvedClientResponse | null>(null);

  // ── Client-first mode: textarea + validation map ─────────────────────────
  const [trackCodesText, setTrackCodesText] = useState('');
  const [validationMap, setValidationMap] = useState<Record<string, TrackValidation>>({});
  const [isValidating, setIsValidating] = useState(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validatedCodesRef = useRef<Set<string>>(new Set());

  const trackInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);

  const isAutoFillRef = useRef(isAutoFill);
  useEffect(() => { isAutoFillRef.current = isAutoFill; }, [isAutoFill]);

  const isScanningRef = useRef(isScanning);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

  // Prevents the camera from firing the same barcode multiple times in 1 second.
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const SCAN_COOLDOWN_MS = 2000;

  const {
    entryQueue,
    enqueueEntry,
    resolveQueueItemClient,
    markQueueItemNotFound,
    markQueueItemAlreadySent,
    setQueueItemClientCode,
    removeFromQueue,
    setSearchQuery,
    setExpandedClient,
    setFastEntryOpen,
    setClientListHidden,
    isClientListHidden,
    addNotification,
  } = useExpectedCargoStore();

  useEffect(() => {
    const timer = setTimeout(() => trackInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // ── Parse textarea lines ──────────────────────────────────────────────────

  const parsedCodes = useMemo(() => {
    return [...new Set(
      trackCodesText
        .split('\n')
        .map((l) => l.trim().toUpperCase())
        .filter(Boolean),
    )];
  }, [trackCodesText]);

  // ── Clear validation state when client code changes ───────────────────────

  useEffect(() => {
    setValidationMap({});
    setIsValidating(false);
    validatedCodesRef.current = new Set();
  }, [clientCodeInput]);

  // ── Debounced batch validation for client-first mode ─────────────────────

  useEffect(() => {
    if (isAutoFill) return;

    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);

    if (!clientCodeInput.trim() || parsedCodes.length === 0) {
      setIsValidating(false);
      return;
    }

    const codesToCheck = parsedCodes.filter((c) => !validatedCodesRef.current.has(c));
    if (codesToCheck.length === 0) return;

    setIsValidating(true);

    validationTimerRef.current = setTimeout(() => {
      const normalized = clientCodeInput.trim().toUpperCase();

      Promise.allSettled(
        codesToCheck.map((code) => resolveClientByTrackCode(code, flightName ?? undefined)),
      ).then((results) => {
        setValidationMap((prev) => {
          const next = { ...prev };
          codesToCheck.forEach((code, i) => {
            validatedCodesRef.current.add(code);
            const r = results[i];
            if (r.status === 'fulfilled') {
              const ownerCode = r.value.client_code.toUpperCase();
              next[code] =
                ownerCode === normalized
                  ? { status: 'match', resolvedClientCode: ownerCode, resolvedClientName: r.value.full_name }
                  : { status: 'conflict', resolvedClientCode: ownerCode, resolvedClientName: r.value.full_name };
            } else {
              if (isAxiosError(r.reason) && r.reason.response?.status === 409) {
                const body = r.reason.response.data as AlreadySentErrorBody;
                next[code] = { status: 'already_sent', alreadySentFlight: body.flight_name ?? null };
              } else {
                next[code] = { status: 'not_found' };
              }
            }
          });
          return next;
        });
        setIsValidating(false);
      });
    }, 600);

    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  // intentionally exclude validationMap — codesToCheck is derived from parsedCodes + ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedCodes, clientCodeInput, isAutoFill, flightName]);

  // ── Camera lifecycle ──────────────────────────────────────────────────────

  const stopCamera = useCallback(() => setIsScanning(false), []);

  const processScannedText = useCallback(
    (text: string) => {
      const raw = text.trim();
      if (!raw) return;
      const trackCode = raw.toUpperCase();

      const now = Date.now();
      if (lastScanRef.current?.code === trackCode && now - lastScanRef.current.time < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScanRef.current = { code: trackCode, time: now };

      if (isAutoFillRef.current) {
        const liveQueue = useExpectedCargoStore.getState().entryQueue;
        if (liveQueue.some((i) => i.trackCode === trackCode)) return;
        enqueueEntry({ trackCode, clientCode: '', resolvedClientName: null, resolvedClientId: null, isResolved: false });
        resolveMutation.mutate(trackCode);
      } else {
        setTrackCodeInput(trackCode);
        setSuggestion(null);
        resolveMutation.mutate(trackCode);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueueEntry],
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
      { fps: 15, qrbox: { width: 280, height: 150 } },
      (decodedText) => { playSuccessSound?.(); processScannedText(decodedText); },
      () => {},
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
    setIsScanning((prev) => {
      if (!prev) (document.activeElement as HTMLElement)?.blur();
      return !prev;
    });
  }, []);

  // ── Resolve mutation (used by auto-fill + manual single-code) ────────────

  const resolveMutation = useMutation({
    mutationFn: (trackCode: string) =>
      resolveClientByTrackCode(trackCode, flightName ?? undefined),

    onSuccess: (data, trackCode) => {
      if (isAutoFillRef.current) {
        const currentQueue = useExpectedCargoStore.getState().entryQueue;
        const { isContinuation, priorCount } = detectContinuation(currentQueue, data.client_code);

        resolveQueueItemClient(trackCode, data.client_code.toUpperCase(), data.full_name, data.client_id, isContinuation, priorCount);

        if (isContinuation) {
          playWarningSound();
          const totalCount = priorCount + 1;
          toast.warning(
            `${data.client_code} — orada boshqa mijoz kiritilgan, keyin yana shu mijoz`,
            {
              duration: Infinity,
              description: `"${data.client_code}" uchun avval ${priorCount} ta trek kodi bor edi, yangi: ${trackCode}. Jami: ${totalCount} ta.`,
              action: {
                label: 'Ko\'rish',
                onClick: () => {
                  setClientListHidden(true);
                  setFastEntryOpen(true);
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
        // Manual single-code mode (auto-fill OFF, camera scanning)
        playSuccessSound();
        setSuggestion(data);
        requestAnimationFrame(() => clientInputRef.current?.focus());
      }
    },

    onError: (err, trackCode) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        const body = err.response.data as AlreadySentErrorBody;
        playWarningSound();
        if (isAutoFillRef.current) {
          markQueueItemAlreadySent(trackCode, body.flight_name ?? null);
        }
        toast.warning(`${trackCode} — allaqachon yuborilgan`, {
          duration: 4000,
          description: body.flight_name
            ? `"${body.flight_name}" reysida mavjud`
            : 'Bu trek kodi kutilayotgan yuklarga kiritilgan',
        });
        return;
      }

      playErrorSound();
      if (isAutoFillRef.current) {
        markQueueItemNotFound(trackCode);
        if (!isScanningRef.current) {
          requestAnimationFrame(() => trackInputRef.current?.focus());
        }
        toast.error(`${trackCode} — mijoz topilmadi`, {
          duration: 3000,
          description: 'Mijoz kodini qo\'lda kiriting (qizil qatorda)',
        });
      } else {
        setSuggestion(null);
        toast.warning("Mijoz topilmadi — qo'lda kiriting", { duration: 2000 });
      }
    },
  });

  // ── Auto-fill single-input handlers ──────────────────────────────────────

  const handleAutoFillChange = (checked: boolean) => {
    setIsAutoFill(checked);
    setSuggestion(null);
    setClientCodeInput('');
    setTrackCodeInput('');
    setTrackCodesText('');
    setValidationMap({});
    validatedCodesRef.current = new Set();
    if (!isScanningRef.current) {
      requestAnimationFrame(() => trackInputRef.current?.focus());
    }
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

    enqueueEntry({ trackCode, clientCode: '', resolvedClientName: null, resolvedClientId: null, isResolved: false });
    resolveMutation.mutate(trackCode);
    setTrackCodeInput('');
    if (!isScanningRef.current) {
      requestAnimationFrame(() => trackInputRef.current?.focus());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackCodeInput, entryQueue, enqueueEntry]);

  const handleTrackKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAutoFillScan();
    }
  };

  // ── Client-first mode: add all textarea codes to queue ───────────────────

  const handleClientFirstAdd = useCallback(() => {
    const normalizedClient = clientCodeInput.trim().toUpperCase();
    if (!normalizedClient || parsedCodes.length === 0) return;

    let addedCount = 0;
    let conflictCount = 0;
    let duplicateCount = 0;
    const conflictOwners: string[] = [];

    for (const code of parsedCodes) {
      if (entryQueue.some((item) => item.trackCode === code)) {
        duplicateCount++;
        continue;
      }

      const v = validationMap[code];

      if (v?.status === 'conflict') {
        enqueueEntry({
          trackCode: code,
          clientCode: normalizedClient,
          resolvedClientName: null,
          resolvedClientId: null,
          isResolved: false,
          isWrongClient: true,
          conflictClientCode: v.resolvedClientCode ?? null,
        });
        conflictCount++;
        if (v.resolvedClientCode) conflictOwners.push(v.resolvedClientCode);
      } else if (v?.status === 'already_sent') {
        enqueueEntry({
          trackCode: code,
          clientCode: normalizedClient,
          resolvedClientName: null,
          resolvedClientId: null,
          isResolved: false,
          isAlreadySent: true,
          alreadySentFlight: v.alreadySentFlight ?? null,
        });
        conflictCount++;
      } else {
        enqueueEntry({
          trackCode: code,
          clientCode: normalizedClient,
          resolvedClientName: v?.resolvedClientName ?? null,
          resolvedClientId: null,
          isResolved: v?.status === 'match',
        });
        addedCount++;
      }
    }

    if (conflictCount > 0) {
      const unique = [...new Set(conflictOwners)];
      playWarningSound();
      toast.warning(`${conflictCount} ta xato topildi`, {
        description: unique.length > 0
          ? `Boshqa mijozniki: ${unique.join(', ')}. Navbatga qizil belgi bilan qo'shildi.`
          : 'Allaqachon yuborilgan trek kodlar navbatga qo\'shildi.',
        duration: 5000,
      });
    }
    if (addedCount > 0) {
      playSuccessSound();
    }
    if (duplicateCount > 0) {
      toast.info(`${duplicateCount} ta navbatda allaqachon bor — o'tkazib yuborildi`, { duration: 2000 });
    }

    setTrackCodesText('');
    setValidationMap({});
    validatedCodesRef.current = new Set();
  }, [clientCodeInput, parsedCodes, entryQueue, validationMap, enqueueEntry]);

  // ── Derived counts for validation summary ────────────────────────────────

  const validationCounts = useMemo(() => {
    let match = 0, conflict = 0, notFound = 0, alreadySent = 0, checking = 0;
    for (const code of parsedCodes) {
      const v = validationMap[code];
      if (!v) { checking++; continue; }
      if (v.status === 'match') match++;
      else if (v.status === 'conflict') conflict++;
      else if (v.status === 'not_found') notFound++;
      else if (v.status === 'already_sent') alreadySent++;
      else checking++;
    }
    return { match, conflict, notFound, alreadySent, checking };
  }, [parsedCodes, validationMap]);

  const conflictCodes = useMemo(
    () => parsedCodes.filter((c) => validationMap[c]?.status === 'conflict' || validationMap[c]?.status === 'already_sent'),
    [parsedCodes, validationMap],
  );

  const resolvedCount = entryQueue.filter((i) => i.isResolved || i.clientCode).length;
  const notFoundCount = entryQueue.filter((i) => i.notFound).length;

  return (
    <div className={cn(
      'border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
      isQueueExpanded && 'flex flex-col flex-1 min-h-0',
    )}>
      {/* ── Panel header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
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

        <div className="flex items-center gap-1.5">
          {entryQueue.length > 0 && (
            <span className={cn(
              'text-xs',
              notFoundCount > 0 ? 'text-red-500 font-semibold' : 'text-zinc-400',
            )}>
              {notFoundCount > 0
                ? `${notFoundCount} topilmadi`
                : `${resolvedCount}/${entryQueue.length} tayyor`}
            </span>
          )}

          <button
            onClick={() => setClientListHidden(!isClientListHidden)}
            title={isClientListHidden ? "Mijozlar ro'yxatini ko'rsatish" : "Mijozlar ro'yxatini yashirish"}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isClientListHidden
                ? 'text-orange-500 bg-orange-50 dark:bg-orange-950/30'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
            )}
          >
            {isClientListHidden
              ? <PanelBottomOpen className="size-4" />
              : <PanelBottomClose className="size-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Input area ────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 space-y-2 flex-shrink-0">
        {isAutoFill ? (
          /* ── AUTO-FILL MODE: single barcode input ── */
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="main-track-input"
                  ref={trackInputRef}
                  value={trackCodeInput}
                  onChange={(e) => setTrackCodeInput(e.target.value)}
                  onKeyDown={handleTrackKeyDown}
                  placeholder="Barkodni skanerlang yoki yozing → Enter"
                  className="h-10 text-sm font-mono pr-10 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:border-orange-400"
                  autoComplete="off" autoCorrect="off" spellCheck={false}
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

              <Button
                size="sm"
                onClick={handleAutoFillScan}
                disabled={!trackCodeInput.trim()}
                className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
              >
                Qo'sh
              </Button>
            </div>

            {/* Camera viewfinder */}
            {scannerReady && (
              <>
                <style>{`
                  #${SCANNER_CONTAINER_ID}__scan_region > img { display: none !important; }
                  #${SCANNER_CONTAINER_ID}__scan_region video { width: 100% !important; height: auto !important; border-radius: 0.75rem; }
                  #${SCANNER_CONTAINER_ID}__dashboard { display: none !important; }
                `}</style>
                <div
                  className={isScanning
                    ? "relative rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                    : ""}
                  style={isScanning ? undefined : {
                    position: 'fixed', left: '-9999px', top: '-9999px',
                    width: '320px', height: '240px',
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
                      >
                        <X className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          /* ── CLIENT-FIRST MODE: fixed client code + textarea ── */
          <>
            {/* Fixed client code input */}
            <div className="flex items-center gap-2">
              <User className="size-4 text-zinc-400 flex-shrink-0" />
              <Input
                ref={clientInputRef}
                value={clientCodeInput}
                onChange={(e) => setClientCodeInput(e.target.value.toUpperCase())}
                placeholder="Mijoz kodi (MC-001)"
                className="flex-1 h-9 text-sm font-mono bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:border-orange-400"
                autoComplete="off" autoCorrect="off" spellCheck={false}
              />
            </div>

            {suggestion && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md px-2.5 py-1.5">
                <CheckCircle2 className="size-3 flex-shrink-0" />
                <span className="font-semibold">{suggestion.client_code}</span>
                {suggestion.full_name && <span className="truncate text-green-600/80 dark:text-green-500/80">· {suggestion.full_name}</span>}
              </div>
            )}

            {/* Track codes textarea */}
            <div className="relative">
              <textarea
                value={trackCodesText}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setTrackCodesText(upper);
                  // Invalidate newly typed codes that left the validated set
                  const lines = new Set(
                    upper.split('\n').map((l) => l.trim()).filter(Boolean),
                  );
                  validatedCodesRef.current = new Set(
                    [...validatedCodesRef.current].filter((c) => lines.has(c)),
                  );
                }}
                placeholder={"Trek kodlarni kiriting — har qatorda bitta\n(barkod skaner yoki paste qilsa bo'ladi)"}
                rows={5}
                className="w-full text-sm font-mono resize-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400/30 px-3 py-2 leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                autoComplete="off" autoCorrect="off" spellCheck={false}
              />
              {isValidating && (
                <Loader2 className="absolute top-2.5 right-2.5 size-3.5 text-orange-400 animate-spin" />
              )}
            </div>

            {/* Validation summary */}
            {parsedCodes.length > 0 && (
              <div className="space-y-1.5">
                {/* Count summary line */}
                <div className="flex items-center gap-2 text-[11px] flex-wrap">
                  <span className="text-zinc-400">{parsedCodes.length} ta kod</span>
                  {validationCounts.match > 0 && (
                    <span className="text-green-600 dark:text-green-500 font-medium">
                      ✓ {validationCounts.match} mos
                    </span>
                  )}
                  {validationCounts.notFound > 0 && (
                    <span className="text-zinc-400">
                      ○ {validationCounts.notFound} yangi
                    </span>
                  )}
                  {validationCounts.conflict > 0 && (
                    <span className="text-red-500 font-semibold">
                      ⚠ {validationCounts.conflict} boshqa mijozniki
                    </span>
                  )}
                  {validationCounts.alreadySent > 0 && (
                    <span className="text-orange-500 font-semibold">
                      ⊘ {validationCounts.alreadySent} yuborilgan
                    </span>
                  )}
                  {validationCounts.checking > 0 && (
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                      {validationCounts.checking} tekshirilmoqda
                    </span>
                  )}
                </div>

                {/* Conflict detail rows */}
                {conflictCodes.map((code) => {
                  const v = validationMap[code];
                  return (
                    <div
                      key={code}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs',
                        v.status === 'already_sent'
                          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                          : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
                      )}
                    >
                      <AlertCircle className={cn(
                        'size-3 flex-shrink-0',
                        v.status === 'already_sent' ? 'text-orange-500' : 'text-red-500',
                      )} />
                      <span className={cn(
                        'font-mono font-semibold flex-shrink-0',
                        v.status === 'already_sent' ? 'text-orange-700 dark:text-orange-400' : 'text-red-700 dark:text-red-400',
                      )}>
                        {code}
                      </span>
                      <span className={cn(
                        'truncate',
                        v.status === 'already_sent' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400',
                      )}>
                        {v.status === 'already_sent'
                          ? `Allaqachon yuborilgan${v.alreadySentFlight ? ` (${v.alreadySentFlight})` : ''}`
                          : `Bu ${v.resolvedClientCode} mijozniki`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add button */}
            <Button
              onClick={handleClientFirstAdd}
              disabled={!clientCodeInput.trim() || parsedCodes.length === 0}
              className="w-full h-9 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-sm font-semibold transition-all"
            >
              {parsedCodes.length > 0
                ? `Navbatga qo'shish (${parsedCodes.length} ta)`
                : "Navbatga qo'shish"}
            </Button>
          </>
        )}
      </div>

      {/* ── Queue list ────────────────────────────────────────────────────────── */}
      {entryQueue.length > 0 ? (
        <div className={cn(
          'px-3 pb-3 space-y-1.5 overflow-y-auto',
          isQueueExpanded ? 'flex-1 min-h-0' : 'max-h-40',
        )}>
          {entryQueue.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              onRemove={removeFromQueue}
              onSetClientCode={setQueueItemClientCode}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 pb-3 text-center text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
          {isAutoFill
            ? "Barkodni skanerlang — avtomatik mijozga biriktiriladi"
            : "Mijoz kodini kiriting, keyin trek kodlarni yozing yoki paste qiling"}
        </div>
      )}
    </div>
  );
}
