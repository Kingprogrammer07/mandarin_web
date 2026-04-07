import { z } from "zod";

export const updateClientPersonalSchema = z.object({
  full_name: z
    .string()
    .min(1, "Harflar kiritilishi shart")
    .max(256, "Juda uzun qiymat")
    .optional(),
  phone: z
    .string()
    .max(20, "Telefon raqam uzunligi noto'g'ri")
    .optional(),
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
