import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  Camera,
  CameraOff,
  CheckCheck,
  Database,
  Download,
  History,
  Keyboard,
  Loader2,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  ScanLine,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { ScannerSoundSettingsModal } from "@/components/expectedCargo/ScannerSoundSettingsModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useBarcodeCamera } from "@/hooks/useBarcodeCamera";
import type { AstatkaWorkQueue } from "@/hooks/useAstatkaWorkQueue";
import { useScanFieldFocusLock } from "@/hooks/useScanFieldFocusLock";
import { formatKg, formatScanTime } from "@/lib/astatkaFormat";
import {
  WORK_FILTERS,
  canConfirm,
  countByFilter,
  findRowByCode,
  matchesFilter,
  parseTrackCodes,
  rowView,
  rowsToCsv,
  type WorkFilter,
  type WorkRow,
} from "@/lib/astatkaWorkQueue";
import { cn } from "@/lib/utils";
import { askConfirm } from "@/utils/askConfirm";
import { downloadBlob, fileStamp, safeFileName } from "@/utils/downloadFile";
import type { QueueBackup } from "@/utils/astatkaWorkspaceDb";
import { astatkaWorkspaceDb } from "@/utils/astatkaWorkspaceDb";

import type { BagSheetMode } from "./BagSheet";
import { WorkRowItem } from "./WorkRowItem";
import { WorkRowSheet } from "./WorkRowSheet";
import { WorkspaceDialog } from "./WorkspaceDialog";

const CAMERA_CONTAINER_ID = "astatka-camera";
/** A hardware scanner types a whole code in a few milliseconds per key. */
const SCANNER_KEY_GAP_MS = 80;
const HIGHLIGHT_MS = 2500;

interface Props {
  flightName: string;
  queue: AstatkaWorkQueue;
  autoConfirm: boolean;
  onAutoConfirmChange: (value: boolean) => void;
  previewVisible: boolean;
  onTogglePreview: () => void;
}

/**
 * The bag window. The row is read live by id; the copy is what it still shows
 * if the row leaves the screen while the window is open.
 */
interface OpenRow {
  rowId: string;
  snapshot: WorkRow;
  mode: BagSheetMode;
}

/** A phone or tablet: focusing a field there pops the on-screen keyboard. */
function hasTouchKeyboard(): boolean {
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Work mode: scan a bag, see whose it is and from which flight, confirm it.
 *
 * A worker uses a hardware scanner, the phone camera, or types the code. The
 * scanner works even when the field lost focus — it types faster than any
 * person, and that is how the keys are told apart.
 */
export function WorkPanel({
  flightName,
  queue,
  autoConfirm,
  onAutoConfirmChange,
  previewVisible,
  onTogglePreview,
}: Props) {
  const [input, setInput] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [sheet, setSheet] = useState<OpenRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [backups, setBackups] = useState<QueueBackup[] | null>(null);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // On a touch screen the field is kept focused with the on-screen keyboard
  // folded away (a Bluetooth scanner still types into it); the keyboard
  // opens only when the worker asks for it.
  const [touchKeyboard] = useState(hasTouchKeyboard);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /** Set while the field is re-focused on purpose to bring the keyboard up. */
  const reopeningRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { rows, scan, lastScan } = queue;
  const refocusScanField = useScanFieldFocusLock(inputRef);

  // Re-render once the highlight window passes so the ring fades.
  useEffect(() => {
    if (!lastScan) return;
    const timer = window.setTimeout(() => setNow(Date.now()), HIGHLIGHT_MS + 50);
    return () => window.clearTimeout(timer);
  }, [lastScan]);

  const openKeyboard = (field: HTMLInputElement) => {
    // The attribute is set before React re-renders: the keyboard decides on
    // focus, and this refocus has to happen inside the tap to be allowed.
    field.inputMode = "text";
    setKeyboardOpen(true);
    reopeningRef.current = true;
    field.blur();
    field.focus({ preventScroll: true });
    reopeningRef.current = false;
  };

  const closeKeyboard = () => {
    const field = inputRef.current;
    setKeyboardOpen(false);
    if (!field) return;
    field.inputMode = "none";
    field.blur();
    field.focus({ preventScroll: true });
  };

  const submit = useCallback(
    (raw: string) => {
      const codes = parseTrackCodes(raw);
      if (codes.length === 0) return;
      if (codes.length === 1) scan(codes[0]);
      else void queue.importCodes(codes);
      setInput("");
      refocusScanField();
    },
    [scan, queue, refocusScanField],
  );

  // Hardware scanner with the focus somewhere else on the page.
  useEffect(() => {
    let buffer = "";
    let lastKeyAt = 0;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const nowMs = performance.now();
      if (nowMs - lastKeyAt > SCANNER_KEY_GAP_MS) buffer = "";
      lastKeyAt = nowMs;
      if (event.key === "Enter") {
        if (buffer.length >= 3) {
          event.preventDefault();
          scan(buffer);
        }
        buffer = "";
        return;
      }
      if (event.key.length === 1) buffer += event.key;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scan]);

  useBarcodeCamera({
    containerId: CAMERA_CONTAINER_ID,
    active: cameraOn,
    onCode: (code) => scan(code),
    onError: (message) => {
      toast.error(message);
      setCameraOn(false);
    },
  });

  const confirmNewest = useCallback(() => {
    const target = rows.find((row) => row.state === "ready" && canConfirm(row));
    if (target) void queue.confirmRows([target.id]);
  }, [rows, queue]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      confirmNewest();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit(input);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !input) {
      event.preventDefault();
      queue.undoLast();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const codes = parseTrackCodes(event.clipboardData.getData("text"));
    if (codes.length > 1) {
      event.preventDefault();
      void queue.importCodes(codes).then(({ added, repeats }) =>
        toast.success(`${added} ta kod qo'shildi${repeats ? `, ${repeats} tasi takror` : ""}`),
      );
    }
  };

  const counts = useMemo(() => countByFilter(rows), [rows]);
  const visible = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [rows, filter]);
  const pending = counts.waiting;

  const lastRow = useMemo(() => {
    if (!lastScan) return null;
    return (
      rows.find((row) => row.id === lastScan.rowId) ?? findRowByCode(rows, lastScan.code) ?? null
    );
  }, [rows, lastScan]);
  const highlightId =
    lastScan && now - lastScan.at < HIGHLIGHT_MS ? lastRow?.id ?? null : null;

  const onConfirmRow = useCallback((row: WorkRow) => void queue.confirmRows([row.id]), [queue]);
  const onRemoveRow = useCallback(
    (row: WorkRow) => {
      queue.removeRow(row.id);
      // A confirmed row's bag is saved on the server: its row leaving the
      // screen must not read as the bag being deleted.
      if (row.state === "confirmed") toast.success("Ekrandan olib tashlandi. Yuk bazada saqlangan.");
    },
    [queue],
  );
  const onEditRow = useCallback(
    (row: WorkRow) => setSheet({ rowId: row.id, snapshot: row, mode: "edit" }),
    [],
  );
  const onOpenRow = useCallback(
    (row: WorkRow) => setSheet({ rowId: row.id, snapshot: row, mode: "view" }),
    [],
  );
  const sheetRow = sheet ? rows.find((row) => row.id === sheet.rowId) : undefined;

  const confirmAll = async () => {
    const ids = queue.confirmableIds;
    if (ids.length === 0) return;
    if (ids.length > 1 && !(await askConfirm(`${ids.length} ta yukni tasdiqlaysizmi?`))) return;
    void queue.confirmRows(ids);
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.message("Ro'yxat bo'sh");
      return;
    }
    downloadBlob(
      `astatka_${safeFileName(flightName)}_ekran_${fileStamp()}.csv`,
      new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
  };

  const clear = async (which: "confirmed" | "all") => {
    const question =
      which === "confirmed"
        ? "Tasdiqlangan qatorlar ekrandan olib tashlansinmi? Ular bazada qoladi."
        : "Ekrandagi hamma qatorlar olib tashlansinmi? Navbatdagilar qoladi. Keyin «Backupdan tiklash» bilan qaytarsa bo'ladi.";
    if (!(await askConfirm(question))) return;
    const removed = queue.clearRows(which);
    toast.message(removed ? `${removed} ta qator olib tashlandi` : "Olib tashlanadigan qator yo'q");
  };

  const openBackups = async () => setBackups(await astatkaWorkspaceDb.listBackups(flightName));

  const runImport = async () => {
    const codes = parseTrackCodes(importText);
    if (codes.length === 0) return;
    setImporting(true);
    try {
      const { added, repeats } = await queue.importCodes(codes);
      toast.success(`${added} ta kod qo'shildi${repeats ? `, ${repeats} tasi takror` : ""}`);
      setImportText("");
      setImportOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const importCount = parseTrackCodes(importText).length;
  const base = queue.index;
  const baseInfo = base
    ? `${base.packages.length} ta astatka yuki, ${base.candidates?.length ?? 0} ta eski reys yuki${
        base.source_flights?.length ? ` (${base.source_flights.length} ta reysdan)` : ""
      } · ${formatScanTime(base.synced_at)}`
    : "hali yuklanmagan";
  const preparingOffline = queue.isSyncingIndex && !queue.offlineMode;

  return (
    <div className="flex flex-col gap-3 @container">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      {/* One row on a wide panel; on a phone the two switches share a row so
          the scan field is not pushed below the fold. */}
      <div className="grid grid-cols-2 gap-2 @2xl:flex @2xl:flex-wrap @2xl:items-center">
        <span
          className={cn(
            "col-span-2 inline-flex h-9 items-center gap-1.5 justify-self-start rounded-full px-3 text-[12px] font-extrabold",
            queue.isOnline ? "bg-mc-success/12 text-mc-success" : "bg-mc-warn-soft text-mc-warn",
          )}
        >
          {queue.isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {queue.isOnline
            ? "Internet bor"
            : queue.offlineMode
              ? "Internetsiz rejim"
              : "Internet yo'q"}
          {pending > 0 && <span className="tabular-nums">· {pending} ta kutmoqda</span>}
        </span>
        <label
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface px-2.5 py-1 text-[12px] font-bold leading-tight text-mc-text-2"
          title="Baza kompyuterga yuklanadi va skanerlash internetsiz ishlaydi"
        >
          <Switch
            className="shrink-0"
            checked={queue.offlineMode}
            disabled={preparingOffline}
            onCheckedChange={(next) => void queue.toggleOfflineMode(next)}
          />
          {preparingOffline ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              Baza yuklanmoqda…
            </span>
          ) : (
            "Internetsiz ishlash"
          )}
        </label>
        <label
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-mc-sm border border-mc-border bg-mc-surface px-2.5 py-1 text-[12px] font-bold leading-tight text-mc-text-2"
          title="Ro'yxatdagi yuk skanerlansa, o'zi tasdiqlanadi"
        >
          <Switch className="shrink-0" checked={autoConfirm} onCheckedChange={onAutoConfirmChange} />
          Avtomatik tasdiqlash
        </label>
        <div className="col-span-2 flex items-center justify-end gap-1 @2xl:ml-auto">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-3 text-[13px] font-bold text-mc-text active:scale-[0.97]"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            type="button"
            onClick={() => setSoundsOpen(true)}
            aria-label="Ovozlar"
            title="Ovozlar"
            className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border bg-mc-surface text-mc-text-2 active:scale-95"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            aria-label={previewVisible ? "Saqlanganlarni yashirish" : "Saqlanganlarni ko'rsatish"}
            title={previewVisible ? "Saqlanganlarni yashirish" : "Saqlanganlarni ko'rsatish"}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-mc-sm border active:scale-95",
              previewVisible
                ? "border-mc-border bg-mc-surface text-mc-text-2"
                : "border-mc-brand bg-mc-brand-soft text-mc-brand",
            )}
          >
            {previewVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Yana"
                className="flex h-11 w-11 items-center justify-center rounded-mc-sm border border-mc-border bg-mc-surface text-mc-text-2 active:scale-95"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[250px]">
              <DropdownMenuItem onClick={() => void queue.syncIndex()} disabled={queue.isSyncingIndex}>
                <Database className="size-4" />
                Bazani kompyuterga qayta yuklash
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="size-4" />
                Excel (CSV) — saqlashdan oldin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void openBackups()}>
                <History className="size-4" />
                Backupdan tiklash
              </DropdownMenuItem>
              <DropdownMenuItem onClick={queue.undoLast}>
                <Undo2 className="size-4" />
                Oxirgi skanni olib tashlash
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void clear("confirmed")}>
                <CheckCheck className="size-4" />
                Tasdiqlanganlarni ekrandan tozalash
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void clear("all")}>
                <Trash2 className="size-4" />
                Hammasini ekrandan tozalash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Scan field ───────────────────────────────────────────────────── */}
      <div className="rounded-mc-lg border border-mc-border bg-mc-surface p-3 shadow-[var(--mc-shadow-card)]">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-mc-text-3" />
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              onPaste={onPaste}
              onClick={(event) => {
                // Tapping the field itself means "I want to type".
                if (touchKeyboard && !keyboardOpen) openKeyboard(event.currentTarget);
              }}
              onBlur={(event) => {
                if (reopeningRef.current || !touchKeyboard) return;
                // Leaving the field folds the keyboard away for good, so the
                // focus lock bringing it back does not pop it up again.
                event.currentTarget.inputMode = "none";
                setKeyboardOpen(false);
              }}
              inputMode={touchKeyboard && !keyboardOpen ? "none" : "text"}
              // Shorter beside the keyboard button: a 320px phone has room
              // for one word next to it, and a clipped "skaner" reads wrong.
              placeholder={touchKeyboard ? "Skanerlang" : "Trek kodni skanerlang"}
              aria-label="Trek kod"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              className={cn(
                "h-12 w-full rounded-mc-md border border-mc-border bg-mc-surface-2 pl-9 font-mono text-[18px] font-bold tracking-wide text-mc-text outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-mc-text-3 focus:border-mc-brand",
                touchKeyboard ? "pr-12" : "pr-2",
              )}
            />
            {touchKeyboard && (
              <button
                type="button"
                // Kept off the pointer path: a press here must not first
                // hand the focus to the button.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  const field = inputRef.current;
                  if (!field) return;
                  if (keyboardOpen) closeKeyboard();
                  else openKeyboard(field);
                }}
                aria-label={keyboardOpen ? "Klaviaturani yopish" : "Klaviatura bilan yozish"}
                aria-pressed={keyboardOpen}
                className={cn(
                  "absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-mc-sm active:scale-95",
                  keyboardOpen ? "text-mc-brand" : "text-mc-text-3",
                )}
              >
                <Keyboard className="h-5 w-5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => submit(input)}
            className="hidden h-12 shrink-0 rounded-mc-md bg-mc-brand px-4 text-[14px] font-extrabold text-mc-on-brand active:scale-[0.97] @md:block"
          >
            Qidirish
          </button>
          <button
            type="button"
            onClick={() => setCameraOn((on) => !on)}
            aria-label={cameraOn ? "Kamerani yopish" : "Kamera bilan skanerlash"}
            title={cameraOn ? "Kamerani yopish" : "Kamera bilan skanerlash"}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-mc-md border active:scale-95",
              cameraOn
                ? "border-mc-brand bg-mc-brand text-mc-on-brand"
                : "border-mc-border bg-mc-surface text-mc-text",
            )}
          >
            {cameraOn ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </button>
        </div>
        {cameraOn && (
          <div
            id={CAMERA_CONTAINER_ID}
            className="mt-3 overflow-hidden rounded-mc-md bg-black [&_video]:!w-full [&_video]:object-cover"
          />
        )}
        <p className="mt-2 hidden text-[11px] font-medium text-mc-text-3 @lg:block">
          Enter — qidirish · Ctrl+Enter — oxirgisini tasdiqlash · Ctrl+Z — oxirgi skanni olib
          tashlash · Kursor doim shu maydonda turadi, skanerlayvering
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-mc-text-3">
          <span className="min-w-0">Kompyuterdagi baza: {baseInfo}</span>
          <button
            type="button"
            onClick={() => void queue.syncIndex()}
            disabled={queue.isSyncingIndex}
            className="inline-flex h-8 items-center gap-1 font-bold text-mc-brand disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", queue.isSyncingIndex && "animate-spin")} />
            Yangilash
          </button>
        </p>
      </div>

      {/* ── What was just scanned ────────────────────────────────────────── */}
      {lastRow && (
        <LastScanBanner
          row={lastRow}
          effect={lastScan?.effect ?? "new"}
          onConfirm={onConfirmRow}
          onOpen={onOpenRow}
        />
      )}

      {/* ── Filters + bulk ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {WORK_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[12px] font-bold active:scale-[0.97]",
              filter === key
                ? "border-mc-brand bg-mc-brand text-mc-on-brand"
                : "border-mc-border bg-mc-surface text-mc-text-2",
            )}
          >
            {label}
            <span className="tabular-nums">{counts[key]}</span>
          </button>
        ))}
        {queue.confirmableIds.length > 0 && (
          <button
            type="button"
            onClick={() => void confirmAll()}
            className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-mc-sm bg-mc-success px-3 text-[13px] font-extrabold text-mc-on-success active:scale-[0.97]"
          >
            <CheckCheck className="h-4 w-4" />
            Hammasini tasdiqlash ({queue.confirmableIds.length})
          </button>
        )}
      </div>

      {/* ── The list ─────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="rounded-mc-lg border border-dashed border-mc-border bg-mc-surface px-4 py-8 text-center">
          <ScanLine className="mx-auto h-8 w-8 text-mc-text-3" />
          <p className="mt-2 text-[14px] font-bold text-mc-text-2">Hali hech narsa skanerlanmadi</p>
          <p className="mx-auto mt-1 max-w-[340px] text-[12px] font-medium text-mc-text-3">
            Yukdagi trek kodni skanerlang. Skaner qurilmasi bo'lsa, shunchaki skanerlang — kod o'zi
            tushadi. Telefonda kamera tugmasini bosing.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-[13px] font-semibold text-mc-text-3">
          Bu bo'limda yuk yo'q
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <WorkRowItem
              key={row.id}
              row={row}
              highlighted={row.id === highlightId}
              onOpen={onOpenRow}
              onConfirm={onConfirmRow}
              onEdit={onEditRow}
              onRemove={onRemoveRow}
            />
          ))}
        </ul>
      )}

      {sheet && (
        <WorkRowSheet
          flightName={flightName}
          queue={queue}
          row={sheetRow ?? sheet.snapshot}
          onScreen={sheetRow !== undefined}
          mode={sheet.mode}
          onModeChange={(mode) => setSheet((current) => (current ? { ...current, mode } : current))}
          onClose={() => setSheet(null)}
          onConfirm={onConfirmRow}
          onRemove={onRemoveRow}
        />
      )}

      <WorkspaceDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Trek kodlarni import qilish"
        description="Har bir qatorga bitta trek kod. Excel yoki skanerdan nusxa olib qo'ying."
        footer={
          <button
            type="button"
            onClick={() => void runImport()}
            disabled={importCount === 0 || importing}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-mc-md bg-mc-brand text-[14px] font-extrabold text-mc-on-brand active:scale-[0.98] disabled:opacity-50"
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            Qo'shish ({importCount} ta)
          </button>
        }
      >
        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={10}
          placeholder={"YT1234567890\nYT1234567891\n…"}
          className="w-full resize-y rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 py-2.5 font-mono text-[16px] text-mc-text outline-none focus:border-mc-brand"
        />
      </WorkspaceDialog>

      <WorkspaceDialog
        open={backups !== null}
        onOpenChange={(open) => !open && setBackups(null)}
        title="Backupdan tiklash"
        description="Ekrandan tozalangan qatorlar shu yerda saqlanadi."
      >
        {backups && backups.length === 0 && (
          <p className="py-6 text-center text-[13px] font-semibold text-mc-text-3">Backup yo'q</p>
        )}
        <ul className="space-y-2">
          {(backups ?? []).map((backup) => (
            <li
              key={backup.id}
              className="flex items-center gap-3 rounded-mc-md border border-mc-border bg-mc-surface-2 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-mc-text">{backup.reason}</p>
                <p className="text-[12px] font-medium text-mc-text-3">
                  {formatScanTime(backup.savedAt)} · {backup.rows.length} ta qator
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const restored = queue.restoreBackup(backup);
                  toast.success(
                    restored ? `${restored} ta qator tiklandi` : "Bu qatorlar ekranda bor",
                  );
                  setBackups(null);
                }}
                className="h-11 shrink-0 rounded-mc-sm bg-mc-brand px-3 text-[13px] font-extrabold text-mc-on-brand active:scale-[0.97]"
              >
                Tiklash
              </button>
            </li>
          ))}
        </ul>
      </WorkspaceDialog>

      <ScannerSoundSettingsModal open={soundsOpen} onOpenChange={setSoundsOpen} />
    </div>
  );
}

function LastScanBanner({
  row,
  effect,
  onConfirm,
  onOpen,
}: {
  row: WorkRow;
  effect: "new" | "same_bag" | "repeat";
  onConfirm: (row: WorkRow) => void;
  onOpen: (row: WorkRow) => void;
}) {
  const view = rowView(row);
  const bad =
    row.state === "not_found" || row.state === "other_astatka" || row.state === "failed";
  const warn = view.takenAway || row.state === "waiting_net" || effect === "repeat";
  const good = row.state === "confirmed";
  const headline =
    effect === "repeat"
      ? "Bu kod allaqachon skanerlangan"
      : effect === "same_bag"
        ? "Shu yukning yana bir kodi"
        : row.message;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-mc-lg border-2 p-3",
        bad
          ? "border-mc-danger bg-mc-danger-soft"
          : warn
            ? "border-mc-warn bg-mc-warn-soft"
            : good
              ? "border-mc-success bg-mc-success/12"
              : "border-mc-brand bg-mc-brand-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* basis-48: on a phone the button drops under the text instead of
            squeezing the client code into a narrow column. */}
        <button
          type="button"
          onClick={() => onOpen(row)}
          title="Rasmlar va foto hisobot ma'lumotlari"
          className="min-w-0 flex-1 basis-48 text-left active:opacity-80"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-mc-text-3">
            Oxirgi skan · <span className="font-mono normal-case">{row.scannedCodes.at(-1)}</span>
          </p>
          <p className="break-all text-[24px] font-extrabold leading-tight text-mc-text">
            {view.clientCode || "—"}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-mc-text-2">
            {view.sourceFlight || "Reys noma'lum"} · {view.trackCount} ta trek ·{" "}
            {formatKg(view.weightKg)}
          </p>
          <p
            className={cn(
              "mt-1 text-[13px] font-bold",
              bad ? "text-mc-danger" : warn ? "text-mc-warn" : good ? "text-mc-success" : "text-mc-brand",
            )}
          >
            {view.takenAway && row.state === "ready"
              ? "Diqqat: tizimda bu yuk mijozga berilgan deb turibdi."
              : headline}
          </p>
        </button>
        {canConfirm(row) && (
          <button
            type="button"
            onClick={() => onConfirm(row)}
            className="h-12 w-full shrink-0 rounded-mc-md bg-mc-brand px-5 text-[15px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] active:scale-[0.97] @sm:w-auto"
          >
            Tasdiqlash
          </button>
        )}
      </div>
    </div>
  );
}
