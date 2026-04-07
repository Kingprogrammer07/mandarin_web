import { z } from "zod";

export const DELIVERY_METHODS = ["uzpost", "bts", "mandarin", "yandex", "self_pickup"] as const;

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  uzpost: "UzPost",
  bts: "BTS",
  mandarin: "Mandarin yetkazib berish",
  yandex: "Yandex",
  self_pickup: "O'zi olib ketdi",
};

export const markTakenSchema = z.object({
  delivery_method: z.enum(DELIVERY_METHODS, {
    error: "Yetkazib berish usulini tanlang",
  }),
  photos: z
    .array(z.instanceof(File), {
      error: "Kamida bitta rasm yuklang",
    })
    .min(1, "Kamida bitta rasm yuklang")
    .max(10, "Maksimal 10 ta rasm yuklash mumkin"),
});

export type MarkTakenFormValues = z.infer<typeof markTakenSchema>;