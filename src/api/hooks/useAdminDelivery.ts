import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  adminCreateStandardDelivery,
  adminCreateUzpostDelivery,
  type AdminStandardDeliveryRequest,
} from "../services/adminDeliveryService";

/** Error shape rejected by the apiClient interceptor (client.ts). */
type DeliveryError = { message?: string; data?: { detail?: string } };

/** Prefer the backend's specific `detail` (clear Uzbek) over the interceptor's
 *  generic fallback — e.g. a 404 collapses to "Ma'lumot topilmadi." otherwise. */
function deliveryErrorText(err: unknown, fallback: string): string {
  const e = err as DeliveryError;
  return e?.data?.detail || e?.message || fallback;
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
  res: { message: string; queue_created?: boolean; queue_warning?: string | null },
  fallback: string,
): void {
  if (res.queue_created === false && res.queue_warning) {
    toast.warning(res.queue_warning, { duration: 10_000 });
    return;
  }
  toast.success(res.message || fallback);
}

export const useAdminCreateStandardDelivery = () => {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: AdminStandardDeliveryRequest) =>
      adminCreateStandardDelivery(data),
    onSuccess: (res) => {
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
  return useMutation({
    mutationFn: (formData: FormData) => adminCreateUzpostDelivery(formData),
    onSuccess: (res) => {
      // The uzpost path never spawns a queue, so it reports queue_created=false
      // with no warning — reportDeliveryResult only warns when there is a
      // reason to, which keeps this path's toast green as before.
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
