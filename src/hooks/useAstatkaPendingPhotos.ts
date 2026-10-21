import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  astatkaBagQueryKey,
  astatkaPackagePhotosQueryKey,
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  type AstatkaPackage,
} from "@/api/services/astatkaFlights";
import {
  MAX_OWN_PHOTOS,
  PendingPhotosError,
  savePendingPhotos,
} from "@/lib/astatkaPendingPhotos";
import { ownPackageIdOf } from "@/lib/astatkaWorkQueue";
import { apiErrorMessage } from "@/utils/apiError";

export type PendingPhotosStatus = "waiting" | "saving" | "failed";

export interface PendingPhotos {
  files: File[];
  status: PendingPhotosStatus;
  /** Why the last save failed; set when `status` is "failed". */
  error: string | null;
  /** The bag the photos go to, known once its confirm saved it. */
  packageId: number | null;
}

type Entries = ReadonlyMap<string, PendingPhotos>;

const EMPTY: PendingPhotos = { files: [], status: "waiting", error: null, packageId: null };

/**
 * Photos taken for a scan-list row whose bag is not saved in this astatka
 * yet. They wait on the device, keyed by row, and go to the bag the moment
 * its confirm saves it. Kept in memory only: they are gone if the page
 * closes first, and the bag window says so.
 */
export function useAstatkaPendingPhotos(flightName: string) {
  const queryClient = useQueryClient();
  const [entries, setEntriesState] = useState<Entries>(() => new Map());
  const entriesRef = useRef<Entries>(entries);

  /** `update` edits a copy; returning false leaves everything as it was. */
  const setEntries = useCallback((update: (draft: Map<string, PendingPhotos>) => boolean | void) => {
    const draft = new Map(entriesRef.current);
    if (update(draft) === false) return;
    entriesRef.current = draft;
    setEntriesState(draft);
  }, []);

  const patch = useCallback(
    (rowId: string, change: (entry: PendingPhotos) => PendingPhotos) => {
      setEntries((draft) => {
        const next = change(draft.get(rowId) ?? EMPTY);
        if (next.files.length > 0) draft.set(rowId, next);
        else draft.delete(rowId);
      });
    },
    [setEntries],
  );

  /** A save in flight sent its list as it was: nothing is taken off it meanwhile. */
  const remove = useCallback(
    (rowId: string, index: number) =>
      patch(rowId, (entry) =>
        entry.status === "saving"
          ? entry
          : { ...entry, files: entry.files.filter((_, at) => at !== index) },
      ),
    [patch],
  );

  const upload = useCallback(
    async (rowId: string, packageId: number) => {
      const entry = entriesRef.current.get(rowId);
      if (!entry || entry.status === "saving") return;
      const files = entry.files;
      patch(rowId, (current) => ({ ...current, status: "saving", error: null, packageId }));
      const refreshBag = () => {
        void queryClient.invalidateQueries({ queryKey: astatkaBagQueryKey(flightName, { packageId }) });
        void queryClient.invalidateQueries({ queryKey: astatkaPackagesQueryKey(flightName) });
        void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
      };
      try {
        const { result, saved, skipped } = await savePendingPhotos(flightName, packageId, files);
        if (result) queryClient.setQueryData(astatkaPackagePhotosQueryKey(packageId), result.photos);
        if (saved > 0) {
          refreshBag();
          toast.success(saved === 1 ? "Rasm yukka saqlandi." : `${saved} ta rasm yukka saqlandi.`);
        }
        if (skipped > 0) {
          toast.warning(
            `${skipped} ta rasm saqlanmadi: yukda ${MAX_OWN_PHOTOS} tadan ortiq rasm bo'lmaydi.`,
          );
        }
        // Photos added while this save ran are still unsent.
        patch(rowId, (current) => {
          const rest = current.files.slice(files.length);
          return rest.length === 0
            ? { ...current, files: rest }
            : { ...current, files: rest, status: "failed", error: `${rest.length} ta rasm hali yuborilmadi.` };
        });
      } catch (error) {
        const saved = error instanceof PendingPhotosError ? error.saved : 0;
        const reason = error instanceof PendingPhotosError ? error.reason : error;
        const message = apiErrorMessage(reason, "Rasmlarni yukka saqlab bo'lmadi.");
        if (saved > 0) {
          void queryClient.invalidateQueries({ queryKey: astatkaPackagePhotosQueryKey(packageId) });
          refreshBag();
        }
        patch(rowId, (current) => ({
          ...current,
          files: current.files.slice(saved),
          status: "failed",
          error: message,
        }));
        toast.error(`Rasmlar saqlanmadi: ${message}`);
      }
    },
    [flightName, patch, queryClient],
  );

  /**
   * `packageId`: the row's bag is already saved here (its confirm landed while
   * the camera was open), so the photos go straight to it.
   */
  const add = useCallback(
    (rowId: string, files: File[], packageId: number | null = null) => {
      patch(rowId, (entry) => ({
        ...entry,
        files: [...entry.files, ...files].slice(0, MAX_OWN_PHOTOS),
      }));
      if (packageId !== null) void upload(rowId, packageId);
    },
    [patch, upload],
  );

  /** The row's confirm saved its bag: the photos follow it there. */
  const saveFor = useCallback(
    (rowId: string, pkg: AstatkaPackage) => {
      if (!entriesRef.current.has(rowId)) return;
      const packageId = ownPackageIdOf(pkg, flightName);
      if (packageId === null) {
        patch(rowId, (entry) => ({
          ...entry,
          status: "failed",
          error: "Yuk bu astatkada saqlanmadi — rasmlarni unga qo'shib bo'lmaydi.",
        }));
        return;
      }
      void upload(rowId, packageId);
    },
    [flightName, patch, upload],
  );

  const retry = useCallback(
    (rowId: string) => {
      const packageId = entriesRef.current.get(rowId)?.packageId;
      if (packageId != null) void upload(rowId, packageId);
    },
    [upload],
  );

  /** Two rows turned out to be one bag: the photos move to the row that stays. */
  const moveRow = useCallback(
    (goneId: string, keptId: string) =>
      setEntries((draft) => {
        const gone = draft.get(goneId);
        if (!gone || gone.status === "saving") return false;
        const kept = draft.get(keptId) ?? EMPTY;
        draft.delete(goneId);
        draft.set(keptId, {
          ...kept,
          files: [...kept.files, ...gone.files].slice(0, MAX_OWN_PHOTOS),
        });
      }),
    [setEntries],
  );

  return { entries, add, remove, retry, saveFor, moveRow };
}

export type AstatkaPendingPhotos = ReturnType<typeof useAstatkaPendingPhotos>;
