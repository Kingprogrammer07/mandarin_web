import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Loader2, X, CheckCircle2, AlertCircle, User, Camera, ScanLine,
  Pencil, AlertTriangle, Info, XCircle, PanelBottomClose, PanelBottomOpen, Ban,
  Undo2, Upload, Square, CheckSquare,
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
import {
  getCargoAudioVolume,
  playSuccessSound,
  playErrorSound,
  playWarningSound,
  setCargoAudioVolume,
} from '@/utils/audioUtils';

interface FastEntryPanelProps {
  flightName: string | null;
  onClose: () => void;
  /** When true the queue list expands to fill available height (client list is hidden). */
  isQueueExpanded: boolean;
}

// ── Track validation result for client-first mode ─────────────────────────────

type TrackValidationStatus = 'checking' | 'match' | 'conflict' | 'already_sent' | 'not_found';
type QueueFilter = 'all' | 'ready' | 'issues' | 'split' | 'sent' | 'not_found' | 'wrong_client';

interface TrackValidation {
  status: TrackValidationStatus;
  /** Resolved client code from DB (owner of this track code). */
  resolvedClientCode?: string;
  resolvedClientName?: string | null;
  /** Flight name for already_sent status. */
  alreadySentFlight?: string | null;
}

interface FastEntryDraftRow {
  id: string;
  trackCode: string;
}

interface QueueFilterOption {
  key: QueueFilter;
  label: string;
  count: number;
}

// Stable DOM id for the Html5Qrcode video container
const SCANNER_CONTAINER_ID = 'ec-qr-video-container';

function createDraftRow(): FastEntryDraftRow {
  return { id: crypto.randomUUID(), trackCode: '' };
}

function parseTrackCodes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n|\t|,/)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function formatScanTime(value?: string): string {
  if (!value) return '--:--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

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
  rowNumber: number;
  clientScanCount: number;
  isSplitGroup: boolean;
  splitSegmentCount: number;
  onRemove: (id: string) => void;
  onSetClientCode: (id: string, code: string) => void;
  onAcceptConflictOwner: (id: string) => void;
  onMergeClientGroup: (clientCode: string) => void;
  onPreviewClient: (clientCode: string) => void;
  onToggleReviewed: (id: string) => void;
}

function QueueItemRow({
  item,
  rowNumber,
  clientScanCount,
  isSplitGroup,
  splitSegmentCount,
  onRemove,
  onSetClientCode,
  onAcceptConflictOwner,
  onMergeClientGroup,
  onPreviewClient,
  onToggleReviewed,
}: QueueItemRowProps) {
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

  const sheetRowStyle = item.isWrongClient || item.notFound
    ? 'bg-red-50/90 dark:bg-red-950/25 border-red-300 dark:border-red-800 text-red-950 dark:text-red-100'
    : item.isAlreadySent
      ? 'bg-orange-50/90 dark:bg-orange-950/25 border-orange-300 dark:border-orange-800 text-orange-950 dark:text-orange-100'
      : isSplitGroup
        ? 'bg-violet-50/95 dark:bg-violet-950/25 border-violet-300 dark:border-violet-800 text-violet-950 dark:text-violet-100 ring-1 ring-violet-200 dark:ring-violet-800/60'
      : item.isContinuation
        ? 'bg-amber-50/90 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
        : item.isResolved
          ? 'bg-emerald-50/70 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/70 text-zinc-900 dark:text-zinc-100'
          : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100';

  const sheetStatusLabel = item.isWrongClient
    ? `Boshqa mijoz: ${item.conflictClientCode ?? '-'}`
    : item.isAlreadySent
      ? item.alreadySentFlight
        ? `Yuborilgan: ${item.alreadySentFlight}`
        : 'Allaqachon yuborilgan'
      : item.notFound
        ? 'Mijoz topilmadi'
        : isSplitGroup
          ? `Ajralgan guruh: ${splitSegmentCount} joyda, jami ${clientScanCount} ta`
        : item.isContinuation
          ? `Davomi: +${item.priorCountForClient} avval`
          : item.isResolved
            ? item.resolvedClientName ?? 'Aniqlandi'
            : item.clientCode
              ? 'Qo\'lda kiritilgan'
              : 'Tekshirilmoqda';

  const commitClientCode = () => {
    const normalized = tempCode.trim().toUpperCase();
    if (normalized) onSetClientCode(item.id, normalized);
    setIsEditingCode(false);
  };

  return (
    <div
      className={cn(
        'grid min-w-[1060px] grid-cols-[52px_minmax(150px,1fr)_minmax(280px,2fr)_120px_minmax(220px,1.4fr)_176px] border-b text-sm transition-colors',
        sheetRowStyle,
      )}
    >
      <div className="flex h-11 items-center justify-center border-r border-inherit bg-black/[0.02] font-mono text-[12px] text-zinc-400 dark:bg-white/[0.03]">
        {rowNumber}
      </div>

      <div className="flex h-11 min-w-0 items-center border-r border-inherit px-2">
        {item.isAlreadySent ? (
          <span className="truncate font-mono font-bold text-orange-700 dark:text-orange-300">
            {item.clientCode || '-'}
          </span>
        ) : isEditingCode ? (
          <Input
            value={tempCode}
            onChange={(e) => setTempCode(e.target.value.toUpperCase())}
            onBlur={commitClientCode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitClientCode();
                document.getElementById('main-track-input')?.focus();
              } else if (e.key === 'Escape') {
                setTempCode(item.clientCode);
                setIsEditingCode(false);
              }
            }}
            className="h-8 w-full rounded-none border-0 bg-white/70 px-2 font-mono text-sm shadow-none focus-visible:ring-1 focus-visible:ring-orange-500 dark:bg-black/20"
            placeholder="Mijoz kodi"
          />
        ) : (
          <button
            type="button"
            onClick={enterEditMode}
            className={cn(
              'flex min-w-0 items-center gap-1.5 text-left font-mono font-bold',
              item.clientCode ? 'text-zinc-900 dark:text-zinc-100' : 'italic text-zinc-400',
            )}
          >
            <span className="truncate">{item.clientCode || 'AUTO'}</span>
            {!item.isWrongClient && !item.isAlreadySent && (
              <Pencil className="size-3 shrink-0 opacity-40" />
            )}
          </button>
        )}
      </div>

      <div className="flex h-11 min-w-0 items-center border-r border-inherit px-3">
        <span className="truncate font-mono font-semibold tracking-wide">
          {item.trackCode}
        </span>
      </div>

      <div className="flex h-11 items-center justify-center border-r border-inherit px-2">
        <span className="rounded-full border border-current/15 bg-white/60 px-2 py-0.5 font-mono text-[12px] font-black dark:bg-black/20">
          {clientScanCount || '-'}
        </span>
      </div>

      <div className="flex h-11 min-w-0 items-center gap-2 border-r border-inherit px-3">
        {item.isWrongClient ? (
          <AlertCircle className="size-4 shrink-0 text-red-500" />
        ) : item.isAlreadySent ? (
          <Ban className="size-4 shrink-0 text-orange-500" />
        ) : item.notFound ? (
          <XCircle className="size-4 shrink-0 text-red-500" />
        ) : isSplitGroup ? (
          <AlertTriangle className="size-4 shrink-0 text-violet-500" />
        ) : item.isContinuation ? (
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
        ) : item.isResolved ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-orange-400" />
        )}
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold">
            {sheetStatusLabel}
          </div>
          <div className="font-mono text-[10px] text-current/55">
            {formatScanTime(item.scannedAt)}
          </div>
        </div>
      </div>

      <div className="flex h-11 items-center justify-end gap-1 px-2">
        <button
          type="button"
          onClick={() => onToggleReviewed(item.id)}
          className={cn(
            'flex size-7 items-center justify-center rounded-md border border-current/10',
            item.isReviewed
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-white/70 text-zinc-400 hover:text-emerald-600 dark:bg-black/20',
          )}
          title={item.isReviewed ? 'Tekshirildi' : 'Tekshirildi deb belgilash'}
        >
          {item.isReviewed ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
        </button>
        {isSplitGroup && item.clientCode.trim() && !item.isWrongClient && !item.isAlreadySent && !item.notFound && (
          <button
            type="button"
            onClick={() => onMergeClientGroup(item.clientCode)}
            className="h-7 rounded-md bg-violet-600 px-2 text-[11px] font-bold text-white hover:bg-violet-700"
          >
            Birlashtir
          </button>
        )}
        {item.clientCode.trim() && (
          <button
            type="button"
            onClick={() => onPreviewClient(item.clientCode)}
            className="h-7 rounded-md border border-current/15 bg-white/70 px-2 text-[11px] font-bold hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
          >
            Ko'rish
          </button>
        )}
        {item.isWrongClient && item.conflictClientCode && (
          <button
            type="button"
            onClick={() => onAcceptConflictOwner(item.id)}
            className="h-7 rounded-md bg-red-600 px-2 text-[11px] font-bold text-white hover:bg-red-700"
          >
            Shu userga
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
          title="O'chirish"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );

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
  const [draftRows, setDraftRows] = useState<FastEntryDraftRow[]>(() => [createDraftRow()]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [isAutoMergeEnabled, setIsAutoMergeEnabled] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [soundVolume, setSoundVolume] = useState(() => getCargoAudioVolume());
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
  const draftInputRefs = useRef(new Map<string, HTMLInputElement>());
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
    acceptQueueItemConflictOwner,
    mergeClientQueueGroup,
    toggleQueueItemReviewed,
    setQueueItemClientCode,
    removeLatestQueueItem,
    removeFromQueue,
    setSearchQuery,
    setExpandedClient,
    setFastEntryOpen,
    setClientListHidden,
    isClientListHidden,
    addNotification,
  } = useExpectedCargoStore();

  const firstDraftRowId = draftRows[0]?.id;
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstDraftInput = firstDraftRowId ? draftInputRefs.current.get(firstDraftRowId) : null;
      (firstDraftInput ?? trackInputRef.current)?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [firstDraftRowId]);

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
          if (isAutoMergeEnabled) {
            requestAnimationFrame(() => mergeClientQueueGroup(data.client_code));
          }
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

  const handleSoundVolumeChange = useCallback((value: number) => {
    setSoundVolume(value);
    setCargoAudioVolume(value);
  }, []);

  const focusDraftRow = useCallback((rowId: string) => {
    requestAnimationFrame(() => {
      draftInputRefs.current.get(rowId)?.focus();
    });
  }, []);

  const enqueueAutoFillTrackCode = useCallback((raw: string) => {
    const trackCode = raw.trim().toUpperCase();
    if (!trackCode) return false;

    const liveQueue = useExpectedCargoStore.getState().entryQueue;
    if (liveQueue.some((item) => item.trackCode === trackCode)) {
      toast.warning(`${trackCode} allaqachon qo'shilgan`, { duration: 1500 });
      return false;
    }

    enqueueEntry({
      trackCode,
      clientCode: '',
      resolvedClientName: null,
      resolvedClientId: null,
      isResolved: false,
    });
    resolveMutation.mutate(trackCode);
    return true;
  }, [enqueueEntry, resolveMutation]);

  const moveFromDraftRow = useCallback((rowId: string, direction: 1 | -1) => {
    const currentIndex = draftRows.findIndex((row) => row.id === rowId);
    if (currentIndex === -1) return;

    if (direction === -1) {
      const previousRow = draftRows[currentIndex - 1];
      if (previousRow) focusDraftRow(previousRow.id);
      return;
    }

    const nextRow = draftRows[currentIndex + 1];
    if (nextRow) {
      focusDraftRow(nextRow.id);
      return;
    }

    focusDraftRow(rowId);
  }, [draftRows, focusDraftRow]);

  const handleDraftTrackChange = useCallback((rowId: string, value: string) => {
    setDraftRows((rows) =>
      rows.map((row) =>
        row.id === rowId ? { ...row, trackCode: value.toUpperCase() } : row,
      ),
    );
  }, []);

  const commitDraftRow = useCallback((rowId: string, direction: 1 | -1 = 1) => {
    const currentRow = draftRows.find((row) => row.id === rowId);
    if (!currentRow) return;

    const trackCode = currentRow.trackCode.trim().toUpperCase();
    if (trackCode) {
      enqueueAutoFillTrackCode(trackCode);
      setDraftRows((rows) =>
        rows.map((row) =>
          row.id === rowId ? { ...row, trackCode: '' } : row,
        ),
      );
      if (direction === 1) {
        focusDraftRow(rowId);
        return;
      }
    }

    moveFromDraftRow(rowId, direction);
  }, [draftRows, enqueueAutoFillTrackCode, focusDraftRow, moveFromDraftRow]);

  const handleDraftKeyDown = useCallback((rowId: string, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFromDraftRow(rowId, 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFromDraftRow(rowId, -1);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setDraftRows((rows) =>
        rows.map((row) =>
          row.id === rowId ? { ...row, trackCode: '' } : row,
        ),
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraftRow(rowId, event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      commitDraftRow(rowId, event.shiftKey ? -1 : 1);
    }
  }, [commitDraftRow, moveFromDraftRow]);

  const handleDraftPaste = useCallback((rowId: string, event: ClipboardEvent<HTMLInputElement>) => {
    const codes = parseTrackCodes(event.clipboardData.getData('text'));
    if (codes.length <= 1) return;

    event.preventDefault();
    let addedCount = 0;
    for (const code of codes) {
      if (enqueueAutoFillTrackCode(code)) addedCount++;
    }

    setDraftRows((rows) =>
      rows.map((row) =>
        row.id === rowId ? { ...row, trackCode: '' } : row,
      ),
    );

    focusDraftRow(rowId);

    if (addedCount > 1) {
      toast.success(`${addedCount} ta track code jadvalga qo'shildi`, { duration: 1800 });
    }
  }, [enqueueAutoFillTrackCode, focusDraftRow]);

  const handleUndoLatest = useCallback(() => {
    const latest = useExpectedCargoStore.getState().entryQueue
      .filter((item) => !item.isReviewed)
      .sort((a, b) => {
        const bTime = b.scannedAt ? Date.parse(b.scannedAt) : 0;
        const aTime = a.scannedAt ? Date.parse(a.scannedAt) : 0;
        return bTime - aTime;
      })[0];

    if (!latest) {
      toast.info("Qaytaradigan tekshirilmagan row yo'q", { duration: 1500 });
      return;
    }

    removeLatestQueueItem();
    toast.success(`${latest.trackCode} qaytarildi`, { duration: 1500 });
  }, [removeLatestQueueItem]);

  const handleExcelImport = useCallback(() => {
    const lines = importText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let imported = 0;
    let duplicates = 0;

    for (const line of lines) {
      const parts = line
        .split(/\t|,|;|\s{2,}/)
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean);

      if (parts.length >= 2) {
        const [clientCode, trackCode] = parts;
        if (!clientCode || !trackCode) continue;
        const liveQueue = useExpectedCargoStore.getState().entryQueue;
        if (liveQueue.some((item) => item.trackCode === trackCode)) {
          duplicates++;
          continue;
        }
        enqueueEntry({
          trackCode,
          clientCode,
          resolvedClientName: null,
          resolvedClientId: null,
          isResolved: false,
        });
        imported++;
      } else if (parts.length === 1 && enqueueAutoFillTrackCode(parts[0] ?? '')) {
        imported++;
      } else {
        duplicates++;
      }
    }

    if (imported > 0) {
      playSuccessSound();
      toast.success(`${imported} ta row import qilindi`, {
        duration: 2000,
        description: duplicates > 0 ? `${duplicates} ta duplicate o'tkazildi` : undefined,
      });
      setImportText('');
      setIsImportOpen(false);
    } else {
      toast.warning("Import uchun yaroqli row topilmadi", { duration: 1800 });
    }
  }, [enqueueAutoFillTrackCode, enqueueEntry, importText]);

  const handleAutoFillScan = useCallback(() => {
    const raw = trackCodeInput.trim();
    if (!raw) return;
    const trackCode = raw.toUpperCase();

    if (entryQueue.some((i) => i.trackCode === trackCode)) {
      toast.warning(`${trackCode} allaqachon qo'shilgan`, { duration: 1500 });
      setTrackCodeInput('');
      return;
    }

    enqueueAutoFillTrackCode(trackCode);
    setTrackCodeInput('');
    if (!isScanningRef.current) {
      requestAnimationFrame(() => trackInputRef.current?.focus());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackCodeInput, entryQueue, enqueueAutoFillTrackCode]);

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

  const queueStats = useMemo(() => {
    let ready = 0;
    let blocked = 0;
    let alreadySent = 0;
    let notFound = 0;
    let wrongClient = 0;

    for (const item of entryQueue) {
      const hasClientCode = item.clientCode.trim().length > 0;
      if (item.isAlreadySent) alreadySent++;
      if (item.notFound) notFound++;
      if (item.isWrongClient) wrongClient++;

      if (item.isWrongClient || item.isAlreadySent || item.notFound || !hasClientCode) {
        blocked++;
      } else {
        ready++;
      }
    }

    return { ready, blocked, alreadySent, notFound, wrongClient };
  }, [entryQueue]);
  const resolvedCount = queueStats.ready;
  const blockedCount = queueStats.blocked;
  const draftActiveCount = draftRows.filter((row) => row.trackCode.trim()).length;
  const clientScanCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of entryQueue) {
      const code = item.clientCode.trim().toUpperCase();
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [entryQueue]);
  const visibleQueue = useMemo(
    () =>
      [...entryQueue].sort((a, b) => {
        const bTime = b.scannedAt ? Date.parse(b.scannedAt) : 0;
        const aTime = a.scannedAt ? Date.parse(a.scannedAt) : 0;
        return bTime - aTime;
      }),
    [entryQueue],
  );
  const splitClientSegments = useMemo(() => {
    const segments = new Map<string, { segmentCount: number; totalCount: number }>();
    let previousClientCode: string | null = null;

    for (const item of visibleQueue) {
      if (item.isWrongClient || item.isAlreadySent || item.notFound) {
        previousClientCode = null;
        continue;
      }

      const clientCode = item.clientCode.trim().toUpperCase();
      if (!clientCode) {
        previousClientCode = null;
        continue;
      }

      const current = segments.get(clientCode) ?? { segmentCount: 0, totalCount: 0 };
      current.totalCount += 1;
      if (clientCode !== previousClientCode) {
        current.segmentCount += 1;
      }
      segments.set(clientCode, current);
      previousClientCode = clientCode;
    }

    return segments;
  }, [visibleQueue]);
  const splitGroupCount = useMemo(
    () => [...splitClientSegments.values()].filter((segment) => segment.segmentCount > 1).length,
    [splitClientSegments],
  );
  const splitClientCodes = useMemo(
    () =>
      [...splitClientSegments.entries()]
        .filter(([, segment]) => segment.segmentCount > 1)
        .map(([clientCode]) => clientCode),
    [splitClientSegments],
  );
  const splitRowCount = useMemo(
    () =>
      visibleQueue.filter((item) => {
        const clientCode = item.clientCode.trim().toUpperCase();
        return clientCode && (splitClientSegments.get(clientCode)?.segmentCount ?? 0) > 1;
      }).length,
    [splitClientSegments, visibleQueue],
  );
  const queueFilterOptions = useMemo<QueueFilterOption[]>(() => [
    { key: 'all', label: 'Barchasi', count: entryQueue.length },
    { key: 'ready', label: 'Tayyor', count: queueStats.ready },
    { key: 'issues', label: 'Tekshirish', count: queueStats.blocked },
    { key: 'split', label: 'Ajralgan', count: splitRowCount },
    { key: 'sent', label: 'Yuborilgan', count: queueStats.alreadySent },
    { key: 'not_found', label: 'Topilmadi', count: queueStats.notFound },
    { key: 'wrong_client', label: 'Boshqa user', count: queueStats.wrongClient },
  ], [entryQueue.length, queueStats, splitRowCount]);
  const filteredQueue = useMemo(
    () =>
      visibleQueue.filter((item) => {
        const clientCode = item.clientCode.trim().toUpperCase();
        const isSplit = clientCode && (splitClientSegments.get(clientCode)?.segmentCount ?? 0) > 1;
        const isIssue = item.isWrongClient || item.isAlreadySent || item.notFound || !clientCode;

        if (queueFilter === 'ready') return !isIssue;
        if (queueFilter === 'issues') return isIssue;
        if (queueFilter === 'split') return isSplit;
        if (queueFilter === 'sent') return item.isAlreadySent;
        if (queueFilter === 'not_found') return item.notFound;
        if (queueFilter === 'wrong_client') return item.isWrongClient;
        return true;
      }),
    [queueFilter, splitClientSegments, visibleQueue],
  );
  const handleMergeAllSplitGroups = useCallback(() => {
    for (const clientCode of splitClientCodes) {
      mergeClientQueueGroup(clientCode);
    }
    if (splitClientCodes.length > 0) {
      toast.success(`${splitClientCodes.length} ta ajralgan guruh birlashtirildi`, { duration: 1800 });
    }
  }, [mergeClientQueueGroup, splitClientCodes]);
  const handlePreviewClient = useCallback((clientCode: string) => {
    const normalized = clientCode.trim().toUpperCase();
    if (!normalized) return;
    setClientListHidden(false);
    setSearchQuery(normalized);
    setExpandedClient(normalized);
  }, [setClientListHidden, setExpandedClient, setSearchQuery]);

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
              Barcode jadvali
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

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <Switch
              size="sm"
              checked={isAutoMergeEnabled}
              onCheckedChange={setIsAutoMergeEnabled}
              className="data-[state=checked]:bg-violet-500"
            />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Auto-merge
            </span>
          </label>

          <label className="flex items-center gap-1.5 select-none">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Ovoz
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(soundVolume * 100)}
              onChange={(event) => handleSoundVolumeChange(Number(event.target.value) / 100)}
              onMouseUp={() => playSuccessSound()}
              onTouchEnd={() => playSuccessSound()}
              className="h-1.5 w-24 accent-orange-500"
              title={`Ovoz: ${Math.round(soundVolume * 100)}%`}
            />
            <span className="w-8 text-right font-mono text-[10px] font-bold text-orange-500">
              {Math.round(soundVolume * 100)}%
            </span>
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          {entryQueue.length > 0 && (
            <span className={cn(
              'text-xs',
              blockedCount > 0
                ? 'text-red-500 font-semibold'
                : splitGroupCount > 0
                  ? 'text-violet-500 font-semibold'
                  : 'text-zinc-400',
            )}>
              {blockedCount > 0
                ? `${blockedCount} tekshirish kerak`
                : splitGroupCount > 0
                  ? `${splitGroupCount} ajralgan guruh`
                : `${resolvedCount}/${entryQueue.length} tayyor`}
            </span>
          )}

          <button
            onClick={() => setClientListHidden(!isClientListHidden)}
            title={isClientListHidden ? "Preview ro'yxatini ko'rsatish" : "Preview ro'yxatini yashirish"}
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
            <span className="sr-only">
              {isClientListHidden ? "Preview ko'rsatish" : "Preview yashirish"}
            </span>
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
      <div
        className={cn(
          'px-3 py-3 overflow-y-auto',
          isQueueExpanded ? 'flex-1 min-h-0' : 'max-h-72',
        )}
      >
        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Jami: {entryQueue.length}
            </span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
              Tayyor: {queueStats.ready}
            </span>
            <span className={cn(
              'rounded-md border px-2 py-1 font-bold',
              queueStats.blocked > 0
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300'
                : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
            )}>
              Tekshirish: {queueStats.blocked}
            </span>
            <span className={cn(
              'rounded-md border px-2 py-1 font-bold',
              splitGroupCount > 0
                ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
            )}>
              Ajralgan: {splitGroupCount}
            </span>
            <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 font-bold text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-300">
              Draft: {draftActiveCount}/{draftRows.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={handleUndoLatest}
              disabled={entryQueue.length === 0}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <Undo2 className="size-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <Upload className="size-3.5" />
              Import
            </button>
            {splitGroupCount > 0 && (
              <button
                type="button"
                onClick={handleMergeAllSplitGroups}
                className="rounded-md bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700"
              >
                Ajralganlarni birlashtir
              </button>
            )}
            {queueFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setQueueFilter(option.key)}
                disabled={option.count === 0 && option.key !== 'all'}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors',
                  queueFilter === option.key
                    ? 'border-orange-300 bg-orange-500 text-white shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                )}
              >
                {option.label} {option.count}
              </button>
            ))}
          </div>
        </div>

        {isImportOpen && (
          <div className="mb-2 rounded-lg border border-orange-200 bg-orange-50/80 p-3 dark:border-orange-900/60 dark:bg-orange-950/20">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                  Excel import
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Har qatorda `TRACK` yoki `CLIENT_CODE TRACK` formatida paste qiling.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-white hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value.toUpperCase())}
              placeholder={'STCH100\tTRK001\nSTCH100\tTRK002\nTRK003'}
              rows={5}
              className="mb-2 w-full resize-y rounded-md border border-orange-200 bg-white p-2 font-mono text-sm outline-none focus:border-orange-400 dark:border-orange-900/60 dark:bg-zinc-950"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportText('')}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                Tozalash
              </button>
              <button
                type="button"
                onClick={handleExcelImport}
                disabled={!importText.trim()}
                className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
              >
                Import qilish
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid min-w-[1060px] grid-cols-[52px_minmax(150px,1fr)_minmax(280px,2fr)_120px_minmax(220px,1.4fr)_176px] border-b border-zinc-200 bg-zinc-50 text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <div className="flex h-9 items-center justify-center border-r border-inherit font-mono">#</div>
            <div className="flex h-9 items-center border-r border-inherit px-2">A · Mijoz kodi</div>
            <div className="flex h-9 items-center border-r border-inherit px-3">B · Track code</div>
            <div className="flex h-9 items-center justify-center border-r border-inherit px-2">C · Soni</div>
            <div className="flex h-9 items-center border-r border-inherit px-3">Holat</div>
            <div className="flex h-9 items-center justify-center px-2">Amal</div>
          </div>

          {isAutoFill ? (
            draftRows.map((row, index) => {
              const hasTrackCode = row.trackCode.trim().length > 0;
              return (
                <div
                  key={row.id}
                  className="grid min-w-[1060px] grid-cols-[52px_minmax(150px,1fr)_minmax(280px,2fr)_120px_minmax(220px,1.4fr)_176px] border-b border-orange-200 bg-orange-50/60 text-sm dark:border-orange-900/50 dark:bg-orange-950/20"
                >
                  <div className="flex min-h-12 items-center justify-center border-r border-inherit font-mono text-[12px] font-bold text-orange-500">
                    +{index + 1}
                  </div>
                  <div className="flex min-h-12 items-center border-r border-inherit px-2">
                    <span className="font-mono text-sm font-bold text-zinc-400">AUTO</span>
                  </div>
                  <div className="relative flex min-h-12 items-center border-r border-inherit px-2">
                    <Input
                      id={index === 0 ? 'main-track-input' : undefined}
                      ref={(node) => {
                        if (node) {
                          draftInputRefs.current.set(row.id, node);
                          if (index === 0) trackInputRef.current = node;
                        } else {
                          draftInputRefs.current.delete(row.id);
                          if (index === 0) trackInputRef.current = null;
                        }
                      }}
                      value={row.trackCode}
                      onChange={(e) => handleDraftTrackChange(row.id, e.target.value)}
                      onKeyDown={(e) => handleDraftKeyDown(row.id, e)}
                      onPaste={(e) => handleDraftPaste(row.id, e)}
                      placeholder="Barcode skanerlang yoki yozing, Enter"
                      className="h-10 rounded-none border-0 bg-transparent pr-9 font-mono text-sm shadow-none focus-visible:ring-0"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {index === 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {resolveMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin text-orange-400" />
                        ) : (
                          <button
                            type="button"
                            onClick={handleCameraScan}
                            title={isScanning ? "Kamerani yopish" : "Kamera orqali skanerlash"}
                            className={cn(
                              'rounded p-1 transition-colors',
                              isScanning
                                ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/50'
                                : 'text-zinc-400 hover:text-orange-500',
                            )}
                          >
                            <Camera className="size-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-12 items-center justify-center border-r border-inherit px-2 font-mono text-sm font-black text-zinc-600 dark:text-zinc-300">
                    {hasTrackCode ? 1 : '-'}
                  </div>
                  <div className="flex min-h-12 min-w-0 items-center gap-2 border-r border-inherit px-3 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                    <span className="truncate">
                      {hasTrackCode
                        ? 'Enter/Tab bilan queue ga qo\'shiladi'
                        : 'Bo\'sh row: Enter yangi row ochadi'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => commitDraftRow(row.id)}
                    className="min-h-12 bg-orange-500 px-2 text-[12px] font-bold text-white transition-colors hover:bg-orange-600"
                  >
                    {hasTrackCode ? "Qo'sh" : 'Row +'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="grid min-w-[1060px] grid-cols-[52px_minmax(150px,1fr)_minmax(280px,2fr)_120px_minmax(220px,1.4fr)_176px] border-b border-orange-200 bg-orange-50/60 text-sm dark:border-orange-900/50 dark:bg-orange-950/20">
              <div className="flex min-h-12 items-center justify-center border-r border-inherit font-mono text-[12px] font-bold text-orange-500">+</div>
              <div className="flex min-h-12 items-center border-r border-inherit px-2">
                <Input
                  ref={clientInputRef}
                  value={clientCodeInput}
                  onChange={(e) => setClientCodeInput(e.target.value.toUpperCase())}
                  placeholder="Mijoz kodi"
                  className="h-9 rounded-none border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="relative flex min-h-12 items-center border-r border-inherit px-2">
                <textarea
                  value={trackCodesText}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setTrackCodesText(upper);
                    const lines = new Set(
                      upper.split('\n').map((line) => line.trim()).filter(Boolean),
                    );
                    validatedCodesRef.current = new Set(
                      [...validatedCodesRef.current].filter((code) => lines.has(code)),
                    );
                  }}
                  placeholder="Track codelar, har qatorda bitta"
                  rows={2}
                  className="min-h-12 w-full resize-none bg-transparent py-2 font-mono text-sm outline-none placeholder:text-zinc-400"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="flex min-h-12 items-center justify-center border-r border-inherit px-2 font-mono text-sm font-black text-zinc-600 dark:text-zinc-300">
                {parsedCodes.length}
              </div>
              <div className="flex min-h-12 min-w-0 items-center gap-2 border-r border-inherit px-3 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                {isValidating ? (
                  <>
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-orange-400" />
                    <span>Tekshirilmoqda...</span>
                  </>
                ) : (
                  <span className="truncate">
                    {validationCounts.conflict > 0 || validationCounts.alreadySent > 0
                      ? `${validationCounts.conflict + validationCounts.alreadySent} ta muammo`
                      : parsedCodes.length > 0
                        ? `${parsedCodes.length} ta kod tayyor`
                        : 'Manual kiritish'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClientFirstAdd}
                disabled={!clientCodeInput.trim() || parsedCodes.length === 0}
                className="min-h-12 bg-orange-500 px-2 text-[12px] font-bold text-white transition-colors hover:bg-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
              >
                Qo'sh
              </button>
            </div>
          )}

          {scannerReady && (
            <>
              <style>{`
                #${SCANNER_CONTAINER_ID}__scan_region > img { display: none !important; }
                #${SCANNER_CONTAINER_ID}__scan_region video { width: 100% !important; height: auto !important; border-radius: 0.75rem; }
                #${SCANNER_CONTAINER_ID}__dashboard { display: none !important; }
              `}</style>
              <div
                className={isScanning ? 'relative border-b border-zinc-200 dark:border-zinc-800' : ''}
                style={isScanning ? undefined : {
                  position: 'fixed',
                  left: '-9999px',
                  top: '-9999px',
                  width: '320px',
                  height: '240px',
                }}
              >
                <div id={SCANNER_CONTAINER_ID} className="w-full" />
                {isScanning && (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </>
          )}

          {filteredQueue.length === 0 ? (
            <div className="flex h-12 min-w-[1060px] items-center justify-center border-t border-zinc-100 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              Jadvalga birinchi track codeni kiriting
            </div>
          ) : (
            filteredQueue.map((item, index) => (
              (() => {
                const clientCode = item.clientCode.trim().toUpperCase();
                const splitSegment = clientCode ? splitClientSegments.get(clientCode) : undefined;
                return (
                  <QueueItemRow
                    key={item.id}
                    item={item}
                    rowNumber={filteredQueue.length - index}
                    clientScanCount={clientScanCounts.get(clientCode) ?? 0}
                    isSplitGroup={(splitSegment?.segmentCount ?? 0) > 1}
                    splitSegmentCount={splitSegment?.segmentCount ?? 0}
                    onRemove={removeFromQueue}
                    onSetClientCode={setQueueItemClientCode}
                    onAcceptConflictOwner={acceptQueueItemConflictOwner}
                    onMergeClientGroup={mergeClientQueueGroup}
                    onPreviewClient={handlePreviewClient}
                    onToggleReviewed={toggleQueueItemReviewed}
                  />
                );
              })()
            ))
          )}
        </div>
      </div>

      <div className="hidden">
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
      {false && entryQueue.length > 0 ? (
        <div className={cn(
          'px-3 pb-3 overflow-y-auto',
          isQueueExpanded ? 'flex-1 min-h-0' : 'max-h-40',
        )}>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid min-w-[1060px] grid-cols-[52px_minmax(150px,1fr)_minmax(280px,2fr)_120px_minmax(220px,1.4fr)_176px] border-b border-zinc-200 bg-zinc-50 text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <div className="flex h-9 items-center justify-center border-r border-inherit font-mono">#</div>
              <div className="flex h-9 items-center border-r border-inherit px-2">A · Mijoz kodi</div>
              <div className="flex h-9 items-center border-r border-inherit px-3">B · Track code</div>
              <div className="flex h-9 items-center justify-center border-r border-inherit px-2">C · Soni</div>
              <div className="flex h-9 items-center border-r border-inherit px-3">Holat</div>
              <div className="flex h-9 items-center justify-center px-2">Amal</div>
            </div>
            {entryQueue.map((item, index) => (
              <QueueItemRow
                key={item.id}
                item={item}
                rowNumber={entryQueue.length - index}
                clientScanCount={clientScanCounts.get(item.clientCode.trim().toUpperCase()) ?? 0}
                isSplitGroup={false}
                splitSegmentCount={0}
                onRemove={removeFromQueue}
                onSetClientCode={setQueueItemClientCode}
                onAcceptConflictOwner={acceptQueueItemConflictOwner}
                onMergeClientGroup={mergeClientQueueGroup}
                onPreviewClient={handlePreviewClient}
                onToggleReviewed={toggleQueueItemReviewed}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="hidden">
          {isAutoFill
            ? "Barkodni skanerlang — avtomatik mijozga biriktiriladi"
            : "Mijoz kodini kiriting, keyin trek kodlarni yozing yoki paste qiling"}
        </div>
      )}
    </div>
  );
}
