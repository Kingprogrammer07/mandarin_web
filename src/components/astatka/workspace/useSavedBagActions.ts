import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  astatkaExternalPhotosRootKey,
  astatkaPackagesQueryKey,
  astatkaStatsQueryKey,
  confirmAstatkaPackages,
  deleteAstatkaPackage,
  unconfirmAstatkaPackage,
  updateAstatkaPackage,
  type AstatkaPackage,
  type AstatkaPackageUpdate,
} from "@/api/services/astatkaFlights";
import { isPartnerPackage, sourceCompanyOf } from "@/lib/astatkaSource";
import { apiErrorMessage } from "@/utils/apiError";
import { askConfirm } from "@/utils/askConfirm";

import type { BagEditChanges } from "./BagEditForm";

interface Options {
  flightName: string;
  /**
   * A change went through: this bag's window has nothing more to show. A
   * delete started from a row may finish while another bag's window is open.
   */
  onDone: (pkg: AstatkaPackage) => void;
  /** A delete stopped half-way: the bag is back to "Kutilmoqda", not gone. */
  onPackageChanged: (pkg: AstatkaPackage) => void;
  /** An edit was saved: the bag as the server now holds it. */
  onSaved: (pkg: AstatkaPackage) => void;
}

/**
 * What undoing a confirmation does to the bag. A confirm writes only the
 * astatka's own record — never the old flight, ours or a partner's — so the
 * bag simply waits here again.
 */
const WHERE_IT_GOES_BACK = "Yuk shu ro'yxatda «Kutilmoqda» bo'lib qoladi.";

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Only what the worker changed goes out: the server keeps every field the
 * request leaves out, so a weight another worker saved meanwhile is not
 * overwritten by the value the form was opened with.
 */
export function packageUpdateOf(
  pkg: AstatkaPackage,
  changes: BagEditChanges,
): AstatkaPackageUpdate {
  const body: AstatkaPackageUpdate = {};
  if ("weightKg" in changes) body.weight_kg = changes.weightKg ?? null;
  if (changes.comment !== undefined) body.comment = changes.comment || null;
  if (changes.trackCodes !== undefined) body.track_codes = changes.trackCodes;
  // A confirmed bag's client is fixed; the server refuses a change anyway.
  if (changes.clientCode !== undefined && pkg.status !== "confirmed")
    body.client_code = changes.clientCode;
  return body;
}

/**
 * What the saved list can do to one bag: confirm it on the shelf, undo the
 * confirmation, edit it, delete it. Every success refreshes the list and the
 * flight counters, and so does a refusal: it usually means the bag changed
 * on another device, and the row should show what it is now.
 */
export function useSavedBagActions({
  flightName,
  onDone,
  onPackageChanged,
  onSaved,
}: Options) {
  const queryClient = useQueryClient();
  /** Bags with a delete running; another bag can be deleted meanwhile. */
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  // The state above re-renders the rows; this one blocks a second delete of
  // the same bag before that render has happened.
  const deletingRef = useRef(new Set<number>());

  const markDeleting = (id: number, deleting: boolean) => {
    if (deleting) deletingRef.current.add(id);
    else deletingRef.current.delete(id);
    setDeletingIds(new Set(deletingRef.current));
  };

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: astatkaPackagesQueryKey(flightName),
    });
    void queryClient.invalidateQueries({ queryKey: astatkaStatsQueryKey });
    // A re-confirmed partner bag may get a new set of photo copies.
    void queryClient.invalidateQueries({ queryKey: astatkaExternalPhotosRootKey });
  };

  const unconfirm = useMutation({
    mutationFn: (pkg: AstatkaPackage) =>
      unconfirmAstatkaPackage(flightName, pkg.id ?? 0),
    onSuccess: (result, pkg) => {
      toast.success(result.message);
      result.warnings.forEach((warning) => toast.warning(warning));
      onDone(pkg);
      refresh();
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Bekor qilib bo'lmadi."));
      refresh();
    },
  });

  const confirm = useMutation({
    mutationFn: (pkg: AstatkaPackage) =>
      confirmAstatkaPackages(flightName, [
        {
          idempotency_key: newKey(),
          client_code: pkg.client_code,
          source_flight_name: pkg.source_flight_name,
          track_codes: pkg.track_codes,
          scanned_at: new Date().toISOString(),
          source_company: sourceCompanyOf(pkg),
        },
      ]),
    onSuccess: ([result], pkg) => {
      if (
        result &&
        (result.outcome === "conflict" || result.outcome === "error")
      ) {
        toast.error(result.message);
        return;
      }
      toast.success("Tasdiqlandi");
      result?.warnings.forEach((warning) => toast.warning(warning));
      onDone(pkg);
      refresh();
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Tasdiqlab bo'lmadi.")),
  });

  const update = useMutation({
    mutationFn: ({
      pkg,
      changes,
    }: {
      pkg: AstatkaPackage;
      changes: BagEditChanges;
    }) =>
      updateAstatkaPackage(
        flightName,
        pkg.id ?? 0,
        packageUpdateOf(pkg, changes),
      ),
    onSuccess: (saved) => {
      toast.success("Saqlandi");
      // A typed weight reprices an unpaid bag, or says why it could not.
      if (saved.notice) toast.warning(saved.notice, { duration: 8000 });
      onSaved(saved);
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Saqlab bo'lmadi.")),
  });

  const askUnconfirm = async (pkg: AstatkaPackage) => {
    if (
      await askConfirm(
        `${pkg.client_code} yukining tasdig'i bekor qilinsinmi? ${WHERE_IT_GOES_BACK}`,
      )
    ) {
      unconfirm.mutate(pkg);
    }
  };

  /**
   * The server keeps a confirmed bag (it may already be sent from here), so
   * deleting one is two requests: undo the confirmation, then delete the
   * now-waiting bag. Each step reports on its own, because a failure between
   * them leaves a real, different state behind.
   */
  const askDelete = async (pkg: AstatkaPackage) => {
    const id = pkg.id;
    if (id === null || deletingRef.current.has(id)) return;
    const confirmed = pkg.status === "confirmed";
    const question = confirmed
      ? isPartnerPackage(pkg)
        ? `${pkg.client_code} yuki tasdiqlangan. O'chirish uchun avval tasdig'i bekor qilinadi, keyin yuk bu ro'yxatdan o'chiriladi. Davom etilsinmi?`
        : `${pkg.client_code} yuki tasdiqlangan. O'chirish uchun avval tasdig'i bekor qilinadi, keyin yuk bu ro'yxatdan o'chiriladi. ${pkg.source_flight_name || "Eski"} reysidagi ma'lumotlari o'zgarmaydi. Davom etilsinmi?`
      : `${pkg.client_code} ro'yxatdan o'chirilsinmi?`;
    if (!(await askConfirm(question))) return;
    if (deletingRef.current.has(id)) return;

    markDeleting(id, true);
    try {
      if (confirmed) {
        let undone: Awaited<ReturnType<typeof unconfirmAstatkaPackage>>;
        try {
          undone = await unconfirmAstatkaPackage(flightName, id);
        } catch (error) {
          toast.error(
            apiErrorMessage(
              error,
              "Tasdiqni bekor qilib bo'lmadi, yuk o'chirilmadi.",
            ),
          );
          refresh();
          return;
        }
        undone.warnings.forEach((warning) => toast.warning(warning));
        try {
          await deleteAstatkaPackage(flightName, id);
        } catch (error) {
          toast.error(
            `Tasdiq bekor qilindi, lekin yuk o'chirilmadi: ${apiErrorMessage(error, "server rad etdi.")} Yuk endi «Kutilmoqda» holatida — uni qayta o'chirsa bo'ladi.`,
          );
          onPackageChanged(undone.package);
          refresh();
          return;
        }
      } else {
        try {
          await deleteAstatkaPackage(flightName, id);
        } catch (error) {
          toast.error(apiErrorMessage(error, "O'chirib bo'lmadi."));
          refresh();
          return;
        }
      }
      toast.success("Ro'yxatdan o'chirildi");
      onDone(pkg);
      refresh();
    } finally {
      markDeleting(id, false);
    }
  };

  return { confirm, unconfirm, update, askUnconfirm, askDelete, deletingIds };
}

export type SavedBagActions = ReturnType<typeof useSavedBagActions>;
