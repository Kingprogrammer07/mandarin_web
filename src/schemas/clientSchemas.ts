import { z } from "zod";

export const updateClientPersonalSchema = z.object({
  full_name: z
    .string()
    .min(1, "Harflar kiritilishi shart")
    .max(256, "Juda uzun qiymat")
    .optional(),
  // Client code — routed server-side to the active alias (extra_code / client_code)
  // and checked for uniqueness. Empty is filtered out by the service before send.
  client_code: z
    .string()
    .max(32, "Mijoz kodi juda uzun")
    .optional(),
  phone: z
    .string()
    .max(20, "Telefon raqam uzunligi noto'g'ri")
    .optional(),
  passport_series: z
    .string()
    .max(10, "Pasport seriyasi uzunligi noto'g'ri")
    .optional()
    .nullable(),
  pinfl: z
    .string()
    .max(14, "PINFL uzunligi noto'g'ri")
    .optional()
    .nullable(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati noto'g'ri (YYYY-MM-DD)")
    .optional()
    .nullable(),
  region: z
    .string()
    .max(128, "Viloyat nomi uzunligi noto'g'ri")
    .optional()
    .nullable(),
  district: z
    .string()
    .max(128, "Tuman nomi uzunligi noto'g'ri")
    .optional()
    .nullable(),
  address: z
    .string()
    .max(512, "Manzil uzunligi noto'g'ri")
    .optional()
    .nullable(),
});

export type UpdateClientPersonalFormValues = z.infer<typeof updateClientPersonalSchema>;
