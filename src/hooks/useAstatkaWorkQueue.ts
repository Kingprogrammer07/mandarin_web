import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";

import {
  confirmAstatkaPackages,
  getAstatkaIndex,
  scanAstatkaTrackCode,
  type AstatkaIndexResponse,
  type AstatkaPackage,
  type AstatkaScanResult,
} from "@/api/services/astatkaFlights";
import {
  applyConfirmResult,
  applyScanResult,
  buildConfirmItem,
  canConfirm,
  markWaitingForNetwork,
  mergeSameBag,
  normaliseTrackCode,
  registerScan,
  resolveFromIndex,
  rowView,
  type ScanEffect,
  type WorkRow,
  type WorkRowEdits,
} from "@/lib/astatkaWorkQueue";
import { apiErrorMessage } from "@/utils/apiError";
import { astatkaWorkspaceDb, type QueueBackup } from "@/utils/astatkaWorkspaceDb";
import {
  initializeExpectedCargoSounds,
  playExpectedCargoSound,
} from "@/utils/expectedCargoSoundManager";
import { triggerSoftHaptic, triggerSuccessHaptic } from "@/utils/haptics";

const CONFIRM_CHUNK = 50;

/** Older than this, the base is downloaded again when the window opens. */
const BASE_MAX_AGE_MS = 15 * 60_000;

/** A base saved before it carried leftovers cannot answer offline scans well. */
function isBaseStale(base: AstatkaIndexResponse | null): boolean {
  if (!base || base.candidates === undefined) return true;
  const age = Date.now() - Date.parse(base.synced_at);
  return !Number.isFinite(age) || age > BASE_MAX_AGE_MS;
}

function baseSummary(base: AstatkaIndexResponse): string {
  const others = base.candidates?.length ?? 0;
  return `${base.packages.length} ta yuk astatkada, ${others} ta boshqa yuk`;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** No response at all: the request never reached the server. */
function isNetworkFailure(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export interface LastScan {
  rowId: string;
  effect: ScanEffect;
  code: string;
  at: number;
}

interface Options {
  flightName: string;
  autoConfirm: boolean;
  /** Saved packages changed on the server: refresh the preview. */
  onPackagesChanged: () => void;
}

/**
 * The astatka work mode's brain: scanning, the offline list, confirming and
 * the queue that survives reloads. The screen only renders what this returns.
 */
export function useAstatkaWorkQueue({ flightName, autoConfirm, onPackagesChanged }: Options) {
  const [rows, setRowsState] = useState<WorkRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [index, setIndex] = useState<AstatkaIndexResponse | null>(null);
  const [isSyncingIndex, setIsSyncingIndex] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  /** The worker's own "work offline" switch, for a warehouse corner where
   *  the connection is up but every request times out. */
  const [offlineMode, setOfflineMode] = useState(false);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);

  const isOnline = networkOnline && !offlineMode;
  const rowsRef = useRef<WorkRow[]>([]);
  const indexRef = useRef<AstatkaIndexResponse | null>(null);
  const onlineRef = useRef(isOnline);
  const autoConfirmRef = useRef(autoConfirm);
  const changedRef = useRef(onPackagesChanged);
  /** Set while an import runs: two hundred beeps help nobody. */
  const quietRef = useRef(false);

  useEffect(() => {
    onlineRef.current = isOnline;
    autoConfirmRef.current = autoConfirm;
    changedRef.current = onPackagesChanged;
  }, [isOnline, autoConfirm, onPackagesChanged]);

  const setRows = useCallback((update: (current: WorkRow[]) => WorkRow[]) => {
    const next = update(rowsRef.current);
    rowsRef.current = next;
    setRowsState(next);
  }, []);

  const patchRow = useCallback(
    (id: string, update: (row: WorkRow) => WorkRow) => {
      setRows((current) => current.map((row) => (row.id === id ? update(row) : row)));
    },
    [setRows],
  );

  // ── Load what this device remembers ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void initializeExpectedCargoSounds();
    void (async () => {
      const [storedRows, storedIndex] = await Promise.all([
        astatkaWorkspaceDb.loadQueue(flightName),
        astatkaWorkspaceDb.loadIndex(flightName),
      ]);
      if (cancelled) return;
      // A confirm in flight when the app died may or may not have landed; its
      // key makes resending safe, so it goes back to the queue.
      const revived = storedRows.map((row) =>
        row.state === "saving" ? { ...row, state: "queued" as const } : row,
      );
      rowsRef.current = revived;
      setRowsState(revived);
      indexRef.current = storedIndex;
      setIndex(storedIndex);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [flightName]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void astatkaWorkspaceDb.saveQueue(flightName, rows);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [rows, hydrated, flightName]);

  useEffect(() => {
    const up = () => setNetworkOnline(true);
    const down = () => setNetworkOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // ── Offline list ──────────────────────────────────────────────────────────
  const rememberPackages = useCallback((packages: AstatkaPackage[]) => {
    const current = indexRef.current;
    if (!current) return;
    const byId = new Map(current.packages.map((pkg) => [pkg.id, pkg]));
    for (const pkg of packages) if (pkg.id !== null) byId.set(pkg.id, pkg);
    const next = { ...current, packages: [...byId.values()] };
    indexRef.current = next;
    setIndex(next);
    void astatkaWorkspaceDb.saveIndex(next);
  }, []);

  /** Download the base to this computer. Resolves to whether it worked. */
  const syncIndex = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!onlineRef.current) {
        if (!silent) toast.error("Internet yo'q. Bazani yuklab bo'lmaydi.");
        return false;
      }
      setIsSyncingIndex(true);
      try {
        const fresh = await getAstatkaIndex(flightName);
        indexRef.current = fresh;
        setIndex(fresh);
        await astatkaWorkspaceDb.saveIndex(fresh);
        if (!silent) {
          toast.success(
            `Baza kompyuterga yuklandi: ${baseSummary(fresh)}. Endi internetsiz ham ishlaydi.`,
          );
        }
        return true;
      } catch (error) {
        if (!silent) toast.error(apiErrorMessage(error, "Bazani yuklab bo'lmadi."));
        return false;
      } finally {
        setIsSyncingIndex(false);
      }
    },
    [flightName],
  );

  /**
   * "Internetsiz ishlash": first the base goes onto this computer, then the
   * window stops asking the server. Without a base it stays online, because
   * every scan would only wait.
   */
  const toggleOfflineMode = useCallback(
    async (next: boolean) => {
      if (!next) {
        setOfflineMode(false);
        return;
      }
      const downloaded = await syncIndex(true);
      const base = indexRef.current;
      if (!base) {
        toast.error("Bazani yuklab bo'lmadi, shuning uchun internetsiz rejim yoqilmadi.");
        return;
      }
      setOfflineMode(true);
      if (downloaded) {
        toast.success(`Baza kompyuterga yuklandi: ${baseSummary(base)}. Internetsiz ishlash yoqildi.`);
      } else {
        toast.warning("Yangi bazani yuklab bo'lmadi. Kompyuterdagi oldingi baza ishlatiladi.");
      }
    },
    [syncIndex],
  );

  // ── Confirm ───────────────────────────────────────────────────────────────
  const sendConfirms = useCallback(
    async (targets: WorkRow[]) => {
      for (let start = 0; start < targets.length; start += CONFIRM_CHUNK) {
        const chunk = targets.slice(start, start + CONFIRM_CHUNK);
        const items = chunk.map((row) => buildConfirmItem(row, row.confirmKey ?? makeId()));
        try {
          const results = await confirmAstatkaPackages(flightName, items);
          const byKey = new Map(results.map((result) => [result.idempotency_key, result]));
          let confirmed = 0;
          let failed = 0;
          const saved: AstatkaPackage[] = [];
          for (const row of chunk) {
            const result = byKey.get(row.confirmKey ?? "");
            if (!result) continue;
            patchRow(row.id, (current) => applyConfirmResult(current, result));
            if (result.package) saved.push(result.package);
            if (result.outcome === "conflict" || result.outcome === "error") failed += 1;
            else confirmed += 1;
            for (const warning of result.warnings) toast.warning(warning);
          }
          rememberPackages(saved);
          if (confirmed > 0) {
            void playExpectedCargoSound("success");
            triggerSuccessHaptic();
          }
          if (failed > 0) {
            void playExpectedCargoSound("error");
            toast.error(
              failed === 1
                ? "1 ta yuk tasdiqlanmadi. Qizil qatorni oching."
                : `${failed} ta yuk tasdiqlanmadi. Qizil qatorlarni oching.`,
            );
          }
          changedRef.current();
        } catch (error) {
          const offline = isNetworkFailure(error);
          for (const row of chunk) {
            patchRow(row.id, (current) =>
              offline
                ? { ...current, state: "queued", message: "Internet qaytganda saqlanadi." }
                : {
                    ...current,
                    state: "failed",
                    message: apiErrorMessage(error, "Saqlab bo'lmadi. Qayta urinib ko'ring."),
                  },
            );
          }
          if (!offline) void playExpectedCargoSound("error");
        }
      }
    },
    [flightName, patchRow, rememberPackages],
  );

  const confirmRows = useCallback(
    async (ids: string[]) => {
      const wanted = new Set(ids);
      const targets = rowsRef.current
        .filter((row) => wanted.has(row.id) && canConfirm(row))
        .map((row) => ({ ...row, confirmKey: row.confirmKey ?? makeId() }));
      if (targets.length === 0) return;
      const online = onlineRef.current;
      const keyed = new Map(targets.map((row) => [row.id, row]));
      setRows((current) =>
        current.map((row) => {
          const target = keyed.get(row.id);
          if (!target) return row;
          return {
            ...target,
            state: online ? "saving" : "queued",
            message: online ? "Saqlanmoqda…" : "Internet qaytganda saqlanadi.",
          };
        }),
      );
      if (!online) {
        void playExpectedCargoSound("success");
        toast.message(
          targets.length === 1
            ? "Navbatga qo'yildi. Internet qaytganda o'zi saqlanadi."
            : `${targets.length} ta yuk navbatga qo'yildi. Internet qaytganda o'zi saqlanadi.`,
        );
        return;
      }
      await sendConfirms(targets);
    },
    [sendConfirms, setRows],
  );

  // ── Scan ──────────────────────────────────────────────────────────────────
  const settleScan = useCallback(
    (rowId: string, result: AstatkaScanResult, fromIndex: boolean) => {
      setRows((current) =>
        mergeSameBag(
          current.map((row) => (row.id === rowId ? applyScanResult(row, result, fromIndex) : row)),
        ),
      );
      const row = rowsRef.current.find((item) => item.id === rowId);
      const taken = Boolean(result.package?.taken_away);
      if (!quietRef.current) {
        if (result.kind === "not_found") void playExpectedCargoSound("error");
        else if (result.kind === "other_astatka" || taken) void playExpectedCargoSound("warning");
        else if (result.package?.status === "confirmed") void playExpectedCargoSound("duplicate");
        else void playExpectedCargoSound("success");
      }

      if (
        row &&
        autoConfirmRef.current &&
        row.state === "ready" &&
        !taken &&
        result.kind === "in_astatka"
      ) {
        void confirmRows([row.id]);
      }
    },
    [confirmRows, setRows],
  );

  const resolveRow = useCallback(
    async (rowId: string, code: string) => {
      const base = indexRef.current;
      const fromIndex = base ? resolveFromIndex(base, code) : null;
      const waitForNetwork = (row: WorkRow) => markWaitingForNetwork(row, base !== null);
      if (!onlineRef.current) {
        if (fromIndex) settleScan(rowId, fromIndex, true);
        else {
          patchRow(rowId, waitForNetwork);
          if (!quietRef.current) void playExpectedCargoSound("warning");
        }
        return;
      }
      try {
        settleScan(rowId, await scanAstatkaTrackCode(flightName, code), false);
      } catch (error) {
        if (fromIndex) {
          settleScan(rowId, fromIndex, true);
        } else if (isNetworkFailure(error)) {
          patchRow(rowId, waitForNetwork);
          void playExpectedCargoSound("warning");
        } else {
          patchRow(rowId, (row) => ({
            ...row,
            state: "failed",
            message: apiErrorMessage(error, "Tekshirib bo'lmadi. Qayta skan qiling."),
          }));
          void playExpectedCargoSound("error");
        }
      }
    },
    [flightName, patchRow, settleScan],
  );

  const scan = useCallback(
    (raw: string, origin: WorkRow["origin"] = "scan"): ScanEffect | null => {
      const code = normaliseTrackCode(raw);
      if (code.length < 3) return null;
      const now = new Date().toISOString();
      const registration = registerScan(rowsRef.current, code, now, makeId(), origin);
      setRows(() => registration.rows);
      setLastScan({ rowId: registration.row.id, effect: registration.effect, code, at: Date.now() });
      triggerSoftHaptic();
      if (registration.effect === "repeat") {
        void playExpectedCargoSound("duplicate");
        return "repeat";
      }
      if (registration.effect === "same_bag") {
        void playExpectedCargoSound("merge");
        return "same_bag";
      }
      void resolveRow(registration.row.id, code);
      return "new";
    },
    [resolveRow, setRows],
  );

  /** Pasted codes: register every row first so the list fills at once, then
   *  ask about them one at a time instead of firing hundreds of requests. */
  const importCodes = useCallback(
    async (codes: string[]) => {
      let rowsNow = rowsRef.current;
      const fresh: { id: string; code: string }[] = [];
      let repeats = 0;
      for (const raw of codes) {
        const code = normaliseTrackCode(raw);
        if (code.length < 3) continue;
        const registration = registerScan(
          rowsNow,
          code,
          new Date().toISOString(),
          makeId(),
          "import",
        );
        rowsNow = registration.rows;
        if (registration.effect === "new") fresh.push({ id: registration.row.id, code });
        else repeats += 1;
      }
      setRows(() => rowsNow);
      quietRef.current = true;
      try {
        for (const item of fresh) await resolveRow(item.id, item.code);
      } finally {
        quietRef.current = false;
      }
      void playExpectedCargoSound(fresh.length > 0 ? "success" : "duplicate");
      return { added: fresh.length, repeats };
    },
    [resolveRow, setRows],
  );

  /** The photo report's weight changed in the bag window; the row follows. */
  const applyBagWeight = useCallback(
    (rowId: string, weightKg: number | null) => {
      patchRow(rowId, (row) => {
        // A weight typed on the row would hide the one just saved.
        const edits = { ...row.edits };
        delete edits.weightKg;
        return {
          ...row,
          edits,
          pkg: row.pkg ? { ...row.pkg, weight_kg: weightKg, weight_edited: false } : row.pkg,
        };
      });
    },
    [patchRow],
  );

  /** A saved bag was edited on the server; show the new facts on its row. */
  const replacePackage = useCallback(
    (rowId: string, pkg: AstatkaPackage) => {
      patchRow(rowId, (row) => ({ ...row, pkg, edits: {} }));
      rememberPackages([pkg]);
    },
    [patchRow, rememberPackages],
  );

  // ── Back online: re-check what waited, send what was queued ──────────────
  const drain = useCallback(async () => {
    if (!onlineRef.current) return;
    const current = rowsRef.current;
    for (const row of current.filter((r) => r.state === "waiting_net" || r.state === "checking")) {
      await resolveRow(row.id, row.trackCode);
    }
    const queued = rowsRef.current.filter((r) => r.state === "queued");
    if (queued.length > 0) {
      setRows((rowsNow) =>
        rowsNow.map((row) =>
          row.state === "queued" ? { ...row, state: "saving", message: "Saqlanmoqda…" } : row,
        ),
      );
      await sendConfirms(queued);
      toast.success("Internet qaytdi. Navbatdagi yuklar yuborildi.");
    }
  }, [resolveRow, sendConfirms, setRows]);

  useEffect(() => {
    if (!hydrated || !isOnline) return;
    void drain();
    if (isBaseStale(indexRef.current)) void syncIndex(true);
  }, [hydrated, isOnline, drain, syncIndex]);

  // ── Row editing and housekeeping ──────────────────────────────────────────
  const updateEdits = useCallback(
    (id: string, edits: WorkRowEdits) => {
      patchRow(id, (row) => ({
        ...row,
        edits,
        // A worker who typed a client for an unknown code made it confirmable.
        state:
          (row.state === "not_found" || row.state === "failed") && edits.clientCode
            ? "ready"
            : row.state,
        message:
          row.state === "not_found" && edits.clientCode
            ? "Qo'lda kiritildi. Tasdiqlang."
            : row.message,
      }));
    },
    [patchRow],
  );

  const removeRow = useCallback(
    (id: string) => {
      const row = rowsRef.current.find((item) => item.id === id);
      if (!row) return;
      void astatkaWorkspaceDb.addBackup(flightName, [row], "Qator o'chirildi");
      setRows((current) => current.filter((item) => item.id !== id));
    },
    [flightName, setRows],
  );

  const undoLast = useCallback(() => {
    const newest = rowsRef.current[0];
    if (!newest) return;
    if (newest.state === "confirmed" || newest.state === "saving" || newest.state === "queued") {
      toast.message(
        "Oxirgi yuk allaqachon tasdiqlangan. Bekor qilish uchun saqlanganlar ro'yxatidan foydalaning.",
      );
      return;
    }
    removeRow(newest.id);
    toast.message(`${newest.trackCode} olib tashlandi`);
  }, [removeRow]);

  const clearRows = useCallback(
    (which: "confirmed" | "all") => {
      const current = rowsRef.current;
      // A queued confirm is work the server has not seen yet; clearing it
      // would silently lose it.
      const removable = current.filter((row) =>
        which === "confirmed"
          ? row.state === "confirmed"
          : row.state !== "queued" && row.state !== "saving",
      );
      if (removable.length === 0) return 0;
      void astatkaWorkspaceDb.addBackup(
        flightName,
        removable,
        which === "confirmed" ? "Tasdiqlanganlar tozalandi" : "Ro'yxat tozalandi",
      );
      const ids = new Set(removable.map((row) => row.id));
      setRows((rowsNow) => rowsNow.filter((row) => !ids.has(row.id)));
      return removable.length;
    },
    [flightName, setRows],
  );

  const restoreBackup = useCallback(
    (backup: QueueBackup) => {
      const present = new Set(rowsRef.current.map((row) => row.id));
      const missing = backup.rows.filter((row) => !present.has(row.id));
      setRows((current) => mergeSameBag([...current, ...missing]));
      return missing.length;
    },
    [setRows],
  );

  const confirmableIds = useMemo(
    () => rows.filter((row) => row.state === "ready" && canConfirm(row) && !rowView(row).takenAway).map((row) => row.id),
    [rows],
  );

  return {
    rows,
    hydrated,
    index,
    isSyncingIndex,
    isOnline,
    networkOnline,
    offlineMode,
    toggleOfflineMode,
    lastScan,
    confirmableIds,
    scan,
    importCodes,
    replacePackage,
    applyBagWeight,
    confirmRows,
    syncIndex,
    drain,
    updateEdits,
    removeRow,
    undoLast,
    clearRows,
    restoreBackup,
  };
}

export type AstatkaWorkQueue = ReturnType<typeof useAstatkaWorkQueue>;
