import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminCreateStandardDelivery,
  adminCreateUzpostDelivery,
  type AdminStandardDeliveryRequest,
} from "../services/adminDeliveryService";

export const useAdminCreateStandardDelivery = () => {
  return useMutation({
    mutationFn: (data: AdminStandardDeliveryRequest) =>
      adminCreateStandardDelivery(data),
    onSuccess: (res) => {
      toast.success(res.message || "Zayavka muvaffaqiyatli yuborildi!");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message || "Zayavka yuborishda xatolik");
    },
  });
};

export const useAdminCreateUzpostDelivery = () => {
  return useMutation({
    mutationFn: (formData: FormData) => adminCreateUzpostDelivery(formData),
    onSuccess: (res) => {
      toast.success(res.message || "Zayavka muvaffaqiyatli yuborildi!");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message || "Zayavka yuborishda xatolik");
    },
  });
};
