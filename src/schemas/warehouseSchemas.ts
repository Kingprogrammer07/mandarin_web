import { z } from "zod";

export const markTakenSchema = z.object({
  delivery_method: z.string().min(1, "Yetkazib berish usulini tanlang"),
  photos: z
    .array(z.instanceof(File), {
      error: "Kamida bitta rasm yuklang",
    })
    .min(1, "Kamida bitta rasm yuklang")
    .max(10, "Maksimal 10 ta rasm yuklash mumkin"),
  comment: z.string().optional(),
});

export type MarkTakenFormValues = z.infer<typeof markTakenSchema>;
