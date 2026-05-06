import { z } from 'zod';

// O'zbekiston passport seriyalari
export const UZBEKISTAN_NATIVE_PASSPORT_SERIES = [
  'AA', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
  'AB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN',
  'K', 'KA',
];

export const validateUzbekistanPassport = (passport: string): boolean => {
  const regex = /^([A-Z]{2})(\d{7})$/;
  const match = passport.match(regex);
  if (!match) return false;
  const series = match[1];
  return UZBEKISTAN_NATIVE_PASSPORT_SERIES.includes(series);
};

export const validatePINFL = (pinfl: string): boolean => {
  if (!/^\d{14}$/.test(pinfl)) return false;
  const firstDigit = parseInt(pinfl[0]);
  return [3, 4, 5, 6].includes(firstDigit);
};

export const clientSchema = z.object({
  telegram_id: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: 'client.validation.telegramIdInvalid',
    }),
  client_code: z
    .string()
    .max(10, "Kod maksimal 10 ta belgidan iborat bo'lishi kerak")
    .regex(/^[A-Z0-9_]*$/, "Faqat lotin harflari, raqamlar va pastki chiziqcha (_) ruxsat etilgan")
    .optional(),
  full_name: z
    .string()
    .min(1, 'client.validation.fullNameRequired')
    .min(2, 'client.validation.fullNameMin')
    .max(256, 'client.validation.fullNameMax'),
  passport_series: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 2 && val.length <= 10), {
      message: 'client.validation.passportSeriesLength',
    })
    .refine((val) => !val || /^[A-Z]{2}\d{7}$/.test(val), {
      message: 'client.validation.passportSeriesInvalid',
    })
    .refine((val) => !val || validateUzbekistanPassport(val), {
      message: 'client.validation.passportSeriesUzbekistan',
    }),
  pinfl: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{14}$/.test(val), {
      message: 'client.validation.pinflInvalid',
    })
    .refine((val) => !val || validatePINFL(val), {
      message: 'client.validation.pinflInvalid',
    }),
  date_of_birth: z
    .date()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const today = new Date();
      const age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      const dayDiff = today.getDate() - date.getDate();
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        return age - 1 >= 16;
      }
      return age >= 16;
    }, 'client.validation.dateOfBirthAge'),
  region: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 2 && val.length <= 128), {
      message: 'client.validation.regionLength',
    }),
  district: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 2 && val.length <= 128), {
      message: 'client.validation.districtLength',
    }),
  address: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 5 && val.length <= 512), {
      message: 'client.validation.addressLength',
    }),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{9}$/.test(val), {
      message: 'client.validation.phoneNumberInvalid',
    }),
  referrer_telegram_id: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: 'client.validation.referrerTelegramIdInvalid',
    }),
  referrer_client_code: z
    .string()
    .optional()
    .refine((val) => !val || /^[A-Z][A-Z0-9-]*$/.test(val.toUpperCase()), {
      message: 'client.validation.referrerClientCodeInvalid',
    }),
  passportImages: z
    .array(z.instanceof(File))
    .optional()
    .refine(
      (files) => !files || files.every((file) => file.type.startsWith('image/')),
      { message: 'client.validation.passportImagesType' },
    ),
  adjustment_amount: z.string().optional(),
  adjustment_reason: z.string().optional(),
  adjustment_type: z.enum(['bonus', 'penalty', 'silent', '']).optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;
