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

export const useAdminCreateStandardDelivery = () => {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: AdminStandardDeliveryRequest) =>
      adminCreateStandardDelivery(data),
    onSuccess: (res) => {
      toast.success(
        res.message ||
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
      toast.success(
        res.message ||
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
