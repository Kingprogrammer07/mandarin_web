import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  adminCreateStandardDelivery,
  adminCreateUzpostDelivery,
  getClientDeliveryContext,
  type AdminDeliverySuccessResponse,
  type AdminStandardDeliveryRequest,
} from "../services/adminDeliveryService";

/** Query keys for the manager's delivery-request page. */
export const adminDeliveryKeys = {
  contexts: ["admin-delivery-context"] as const,
  context: (clientCode: string | null) =>
    ["admin-delivery-context", clientCode] as const,
};

/** Prefix of the warehouse search the client lookup runs (useWarehouse.ts). */
const GROUPED_SEARCH_PREFIX = ["warehouse_grouped_transaction_search"] as const;

/** Error shape rejected by the apiClient interceptor (client.ts). */
type DeliveryError = { message?: string; data?: { detail?: unknown } };

/**
 * The message to show for a failed submission.
 *
 * Prefers the backend's specific `detail` (clear Uzbek) over the interceptor's
 * generic fallback — e.g. a 404 collapses to "Ma'lumot topilmadi." otherwise.
 * Only a string detail qualifies: a validation error carries an array, and a
 * toast given an array shows nothing the manager can act on.
 */
export function deliveryErrorText(err: unknown, fallback: string): string {
  const e = err as DeliveryError | null;
  const detail = e?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return e?.message || fallback;
}

/**
 * Show the result honestly.
 *
 * A saved request whose warehouse queue was not created is not a success — the
 * warehouse receives nothing and the manager, seeing a green toast, has no
 * reason to look. It gets a warning toast that stays on screen long enough to
 * read and says what to do next.
 */
function reportDeliveryResult(
  res: AdminDeliverySuccessResponse,
  fallback: string,
): void {
  // A release that did not happen outranks everything else on screen: the
  // manager believes the parcel has left, and only this line says otherwise.
  if (res.release_warning) {
    toast.warning(res.release_warning, { duration: 12_000 });
    return;
  }
  if (res.queue_created === false && res.queue_warning) {
    toast.warning(res.queue_warning, { duration: 10_000 });
    return;
  }
  toast.success(res.message || fallback, {
    description: res.auto_released
      ? `${res.released_count} ta yuk ombordan chiqarildi · chek printerda${
          res.uzpost_order_number ? ` · ${res.uzpost_order_number}` : ""
        }`
      : undefined,
    duration: res.auto_released ? 8_000 : undefined,
  });
}

/**
 * A client's flights with their rows, the requests already covering them, and
 * the profile name and phone: what the manager page files from.
 *
 * The page, the history panel and the UzPost form share this key, so they share
 * one request. The flights step reads it fresh (`staleTime` 0); the side panels
 * accept a copy up to 30 seconds old.
 */
export function useClientDeliveryContext(
  clientCode: string | null,
  staleTime = 30_000,
) {
  return useQuery({
    queryKey: adminDeliveryKeys.context(clientCode),
    queryFn: () => getClientDeliveryContext(clientCode as string),
    enabled: Boolean(clientCode),
    staleTime,
  });
}

/**
 * What the page shows after a filing must include it: the flights step marks
 * flights already on their way, so the cached context and search results are
 * refetched rather than trusted.
 */
function useRefreshAfterFiling(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminDeliveryKeys.contexts });
    void queryClient.invalidateQueries({ queryKey: GROUPED_SEARCH_PREFIX });
  };
}

export const useAdminCreateStandardDelivery = () => {
  const { t } = useTranslation();
  const refreshAfterFiling = useRefreshAfterFiling();
  return useMutation({
    mutationFn: (data: AdminStandardDeliveryRequest) =>
      adminCreateStandardDelivery(data),
    onSuccess: (res) => {
      refreshAfterFiling();
      reportDeliveryResult(
        res,
        t("adminDeliveryRequest.submit.success", "Zayavka muvaffaqiyatli yuborildi!"),
      );
    },
    onError: (err: unknown) => {
      toast.error(
        deliveryErrorText(
          err,
          t("adminDeliveryRequest.submit.error", "Zayavka yuborishda xatolik"),
        ),
      );
    },
  });
};

export const useAdminCreateUzpostDelivery = () => {
  const { t } = useTranslation();
  const refreshAfterFiling = useRefreshAfterFiling();
  return useMutation({
    mutationFn: (formData: FormData) => adminCreateUzpostDelivery(formData),
    onSuccess: (res) => {
      refreshAfterFiling();
      // The uzpost path never spawns a queue, so it reports queue_created=false
      // with no warning — reportDeliveryResult only warns when there is a
      // reason to, which keeps this path's toast green as before. For a filer
      // with the override it now also carries the release + printer result.
      reportDeliveryResult(
        res,
        t("adminDeliveryRequest.submit.success", "Zayavka muvaffaqiyatli yuborildi!"),
      );
    },
    onError: (err: unknown) => {
      toast.error(
        deliveryErrorText(
          err,
          t("adminDeliveryRequest.submit.error", "Zayavka yuborishda xatolik"),
        ),
      );
    },
  });
};
