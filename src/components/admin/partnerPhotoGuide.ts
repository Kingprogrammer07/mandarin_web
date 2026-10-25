/**
 * The photo-report half of the partner guide: `photo_report.*` webhooks and
 * the six-month photo links. Part of the «Qo'llanma» (partnerWebhookGuide.ts).
 *
 * Kept in step with the backend (src/infrastructure/services/partner_photo_reports.py,
 * src/api/utils/partner_photo_links.py, src/api/routers/partner_cargo.py):
 * event names, fields, link lifetime, redirects and limits are stated here.
 */

import { COURIER_API_BASE as API_BASE } from './partnerCourierGuide';
import type { GuideSection } from './partnerWebhookGuide';

const PHOTO_LINK_EXAMPLE = `${API_BASE}/api/v1/partner/cargo/photos/55120/0?partner=7&exp=1808438400&sig=9b1f…`;

const REPORT_EXAMPLE = {
  id: 55120,
  flight_name: 'M314',
  client_code: 'U-1024',
  weight_kg: '12.40',
  price_per_kg_usd: '9.50',
  price_usd: '117.80',
  price_uzs: '1490170',
  usd_rate: '12650.00',
  comment: '2 ta quti',
  track_codes: ['YT1234567890', 'YT1234567891'],
  photos: [PHOTO_LINK_EXAMPLE],
  photos_expire_at: '2027-04-23T00:00:00.000000+00:00',
  created_at: '2026-10-24T09:12:40.498120+00:00',
  updated_at: '2026-10-24T09:12:40.498120+00:00',
};

export const PHOTO_REPORT_EXAMPLE = JSON.stringify(
  {
    event: 'photo_report.created',
    delivery_id: '0b7e3c8a-5d21-4f0e-a3c4-1e9d2b7f6a10',
    flight_name: 'M314',
    occurred_at: REPORT_EXAMPLE.updated_at,
    reports: [REPORT_EXAMPLE],
  },
  null,
  2,
);

/** What `POST /photo-reports` answers: the same report objects, paged. */
export const PHOTO_REPORTS_ANSWER = JSON.stringify(
  { reports: [REPORT_EXAMPLE], next_after_id: null },
  null,
  2,
);

const PHOTO_DELETED_EXAMPLE = `{
  "event": "photo_report.deleted",
  "delivery_id": "5c2d9e41-08b3-4a7f-9d6e-3f1a0c8b2e57",
  "flight_name": "M314",
  "occurred_at": "2026-10-24T10:03:11.004518+00:00",
  "reports": [
    { "id": 55120, "flight_name": "M314", "client_code": "U-1024" }
  ]
}`;

export const PARTNER_PHOTO_GUIDE: GuideSection[] = [
  {
    title: 'Foto hisobotlar (webhook)',
    blocks: [
      {
        kind: 'p',
        text:
          "Mandarin ombori sizning mijozingiz yukini tortib, rasmga olib, foto hisobot qo'shsa, o'zgartirsa yoki o'chirsa, o'sha manzilga xuddi shu imzo bilan so'rov keladi. `X-Mandarin-Event`:",
      },
      {
        kind: 'table',
        head: ['Voqea', 'Qachon'],
        rows: [
          ['photo_report.created', "Hisobot qo'shildi yoki boshqa mijozdan sizning mijozingizga o'tkazildi"],
          [
            'photo_report.updated',
            "Og'irlik, narx, izoh, rasmlar, mijoz kodi (sizning prefiksingiz ichida) yoki mijozning shu reysdagi trek kodlari o'zgardi",
          ],
          ['photo_report.deleted', "Hisobot o'chirildi, reys tozalandi yoki hisobot sizda bo'lmagan mijozga o'tkazildi"],
        ],
      },
      { kind: 'code', lang: 'json', code: PHOTO_REPORT_EXAMPLE },
      {
        kind: 'table',
        head: ['Maydon', "Ma'nosi"],
        rows: [
          [
            'occurred_at',
            "Voqea versiyasi: `created` / `updated` da hisobotning `updated_at` i, `deleted` da o'chirilgan vaqt (UTC, doim bir xil uzunlikda: matn sifatida solishtirsa bo'ladi)",
          ],
          ['reports[].id', "Mandarin dagi hisobot raqami. O'zgarmaydi: shu bo'yicha saqlang"],
          ['reports[].client_code', 'Mijoz kodi, har doim sizning prefiksingiz bilan'],
          ['reports[].weight_kg', "Og'irligi, kg (matn, nuqta bilan: `12.40`), bo'lmasa `null`"],
          ['reports[].price_per_kg_usd', "1 kg narxi, dollarda (matn: `9.50`), bo'lmasa `null`"],
          ['reports[].price_usd', "Shu yukning narxi, dollarda: og'irlik × kg narxi (`117.80`)"],
          [
            'reports[].price_uzs',
            "Shu yukning narxi, so'mda, `usd_rate` kursi bilan, butun son (`1490170`). Kurs olinmasa `null`",
          ],
          ['reports[].usd_rate', "So'mga o'tkazilgan kurs: 1 $ necha so'm (`12650.00`)"],
          ['reports[].comment', "Omborchining izohi, bo'lmasa `null`"],
          [
            'reports[].track_codes',
            "Mijozning shu reysdagi trek kodlari, Mandarin «kutilayotgan yuklar» ro'yxatidan (bizning mijozga boradigan xabardagidek). Ro'yxat keyin o'zgarsa (kod skanerlansa, tuzatilsa yoki o'chirilsa), `photo_report.updated` keladi",
          ],
          ['reports[].photos', 'Rasm havolalari, olingan tartibida. 6 oy ishlaydi (pastda, «Rasm havolalari»)'],
          ['reports[].photos_expire_at', 'Havolalar shu vaqtgacha ishlaydi'],
          ['reports[].created_at / updated_at', "Hisobot qo'shilgan / oxirgi o'zgargan vaqt"],
        ],
      },
      {
        kind: 'p',
        text: "`photo_report.deleted` da har bir hisobotning faqat `id`, `flight_name`, `client_code` i bo'ladi:",
      },
      { kind: 'code', lang: 'json', code: PHOTO_DELETED_EXAMPLE },
      {
        kind: 'list',
        items: [
          "`created` va `updated` ni bir xil qabul qiling: `id` bo'yicha yozing yoki yangilang (upsert). Ikkalasida ham hisobotning hozirgi to'liq holati keladi.",
          "Qayta urinishda yuborishlar bir-birini quvib o'tishi mumkin. Har hisobot uchun oxirgi `occurred_at` ni saqlang va undan kichigini e'tiborsiz qoldiring. Pull API dagi `updated_at` xuddi shu soat: so'rab olingan hisobotni shu qiymat bilan yozing.",
          "`deleted` kelganda qatorni o'chirmang, «o'chirilgan» deb belgilang. Aks holda kechikkan eski `created` uni qaytarib qo'yadi.",
          "Reys tozalansa, bitta `deleted` da shu reysning sizdagi barcha hisobotlari keladi (bir yuborishda ko'pi bilan 500 ta).",
          "Narx Mandarin mijozi xabaridagidek: og'irlik × kg narxi. So'mdagi narx voqea paytidagi kurs bilan hisoblanadi (`usd_rate`). Kurs o'zgarsa yangi voqea kelmaydi, pull API esa bugungi kurs bilan beradi.",
          'Bizning karta, to\'lov havolalari va "mijozga yuborildi" belgilari yuborilmaydi.',
        ],
      },
    ],
  },
  {
    title: 'Rasm havolalari',
    blocks: [
      {
        kind: 'list',
        items: [
          "Havola 6 oy ishlaydi (`photos_expire_at`). Muddati o'tgach 403 qaytadi: yangi havolalar uchun hisobotni pull API dan qayta oling.",
          "Havola sarlavhasiz ochiladi: uni mijozingizga yoki botingizga berishingiz mumkin. Lekin havolani bilgan har kim rasmni ko'radi, ochiq joyga qo'ymang.",
          "Ochilganda 10 daqiqalik manzilga 302 bilan yo'naltiradi. Brauzer va `requests` o'zi ergashadi. Yo'naltirilgan manzilni saqlamang, faqat bizning havolani saqlang.",
          "Mandarin hamkorni to'xtatsa, havolalar 403 qaytaradi. Hisobot o'chirilsa yoki sizda bo'lmagan mijozga o'tkazilsa, 404.",
          "Rasmlar asosan WebP, eskilari JPEG. Telegram botda yuborish uchun rasmni yuklab olib, fayl sifatida yuborgan ishonchliroq.",
          "Bir IP dan daqiqasiga ko'pi bilan 300 ta rasm so'rovi. Oshsa 429 va `Retry-After` soniya keladi.",
          "Rasm 6 oydan keyin ham kerak bo'lsa, uni yuklab olib, o'zingizda saqlang.",
        ],
      },
    ],
  },
];
