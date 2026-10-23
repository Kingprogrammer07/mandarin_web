/**
 * The partner courier API guide: how another cargo sends delivery orders to
 * our courier and hears back what happened. Shown and copied like the webhook
 * guide (partnerWebhookGuide.ts).
 *
 * Kept in step with the backend (src/api/routers/partner_courier.py and
 * src/api/services/courier_partner.py): headers, the signed string, fields,
 * limits and status names are stated here. The Python example was run
 * against the backend's `sign_request`.
 */

import type { GuideSection } from './partnerWebhookGuide';

export const COURIER_GUIDE_TITLE = "Mandarin Cargo kuryer API: hamkor uchun qo'llanma";

export const COURIER_API_BASE = 'https://bot.webmandarin.uz';

const ORDER_EXAMPLE = `{
  "order_id": "TZ-1001",
  "client_code": "U-1024",
  "full_name": "Aziza Tursunova",
  "phone": "+998901234567",
  "address": "Yunusobod 4-kvartal, 12-uy, 18-xonadon",
  "note": "2-podyezd, 5-qavat",
  "latitude": 41.3652,
  "longitude": 69.2871,
  "delivery_date": "2026-10-24",
  "items": [
    { "track_code": "YT1234567890", "flight_name": "TZ15", "weight_kg": 2.5, "description": "Poyabzal" }
  ]
}`;

const ORDER_ANSWER = `{
  "order_id": "TZ-1001",
  "status": "waiting",
  "delivery_date": "2026-10-24",
  "eta_at": null,
  "window": null,
  "departed_at": null,
  "arrived_at": null,
  "delivered_at": null,
  "postponed_count": 0,
  "postpone_reason": null,
  "fee_uzs": null,
  "paid_amount": null,
  "payment_method": null
}`;

const STATUS_EXAMPLE = `{
  "event": "courier.status",
  "delivery_id": "0b7c1a52-8f3e-4d8a-9a4f-6c2e1d9b7a10",
  "order_id": "TZ-1001",
  "status": "on_the_way",
  "occurred_at": "2026-10-24T05:12:40.512000+00:00",
  "delivery_date": "2026-10-24",
  "eta_at": "2026-10-24T05:40:00+00:00",
  "courier": { "name": "Bekzod Karimov", "phone": "+998901112233", "car": "Oq Cobalt, 01 A 123 BC" }
}`;

export const PYTHON_CLIENT = `"""Mandarin Cargo kuryeriga zayavka yuborish (Python, requests).

O'rnatish:  pip install requests
Muhit o'zgaruvchilari:
    MANDARIN_PARTNER_ID=7            # Mandarin bergan hamkor ID
    MANDARIN_WEBHOOK_SECRET=whsec_...  # webhook bilan bir xil kalit
"""

import hashlib
import hmac
import json
import os
import time

import requests

BASE_URL = "${COURIER_API_BASE}"
PARTNER_ID = os.environ["MANDARIN_PARTNER_ID"]
SECRET = os.environ["MANDARIN_WEBHOOK_SECRET"].encode()


def call(method: str, path: str, payload: dict | None = None) -> dict:
    body = b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    ts = str(int(time.time()))
    message = f"{ts}.{method}.{path}.".encode() + body
    signature = "sha256=" + hmac.new(SECRET, message, hashlib.sha256).hexdigest()
    response = requests.request(
        method,
        BASE_URL + path,
        data=body,  # imzo aynan shu baytlardan hisoblangan
        timeout=15,
        headers={
            "Content-Type": "application/json",
            "X-Mandarin-Partner": PARTNER_ID,
            "X-Mandarin-Timestamp": ts,
            "X-Mandarin-Signature": signature,
        },
    )
    if response.status_code >= 400:
        raise RuntimeError(f"{response.status_code}: {response.text}")
    return response.json()


print(call("GET", "/api/v1/partner/courier/ping"))  # {"partner": "..."}

order = call("POST", "/api/v1/partner/courier/orders", {
    "order_id": "TZ-1001",
    "client_code": "U-1024",
    "full_name": "Aziza Tursunova",
    "phone": "+998901234567",
    "address": "Yunusobod 4-kvartal, 12-uy, 18-xonadon",
    "note": "2-podyezd, 5-qavat",
    "latitude": 41.3652,
    "longitude": 69.2871,
    "items": [{"track_code": "YT1234567890", "flight_name": "TZ15", "weight_kg": 2.5}],
})
print(order["status"])  # waiting

print(call("GET", "/api/v1/partner/courier/orders/TZ-1001")["status"])
# Kuryer yo'lga chiqmagan bo'lsa, bekor qilish:
# call("POST", "/api/v1/partner/courier/orders/TZ-1001/cancel")`;

export const PARTNER_COURIER_GUIDE: GuideSection[] = [
  {
    title: 'Bu nima',
    blocks: [
      {
        kind: 'p',
        text:
          "Mijozingiz yukini Toshkent bo'ylab uyiga yetkazishni Mandarin Cargo kuryeriga topshirasiz. Zayavkani API orqali yuborasiz, yukni Mandarin ofisiga olib kelasiz. Kuryer uni o'z yo'nalishiga qo'shib, mijozga olib boradi. Har bir o'zgarish (yo'lga chiqdi, yetib keldi, yetkazdi, keyinga qoldi) sizning webhook manzilingizga darhol yuboriladi.",
      },
      {
        kind: 'list',
        items: [
          "Faqat Toshkent shahri ichida, xaritadagi aniq nuqta (latitude, longitude) bilan.",
          "Yetkazish haqini kuryer eshik oldida mijozdan naqd yoki karta orqali oladi, Mandarin narxi bo'yicha.",
          "Mijozingizga xabarni siz yuborasiz: u Mandarin botida yo'q. Kerakli ma'lumot (vaqt, kuryer ismi, telefoni, mashinasi) webhookda keladi.",
        ],
      },
    ],
  },
  {
    title: 'Ulanish',
    blocks: [
      {
        kind: 'list',
        items: [
          `API manzili: \`${COURIER_API_BASE}\`.`,
          "Mandarin administratori sizga hamkor ID sini beradi va «Kuryer API» ni yoqadi.",
          "Kalit webhook kaliti bilan bir xil (`whsec_...`). Uni faqat serverda saqlang, mobil ilova yoki brauzerga qo'ymang.",
          "Holatlar sizning webhook manzilingizga keladi. U `cargo.imported` bilan bir xil imzolanadi.",
        ],
      },
    ],
  },
  {
    title: "Imzo (har bir so'rovda)",
    blocks: [
      {
        kind: 'table',
        head: ['Sarlavha', "Ma'nosi"],
        rows: [
          ['X-Mandarin-Partner', 'Hamkor ID si (son)'],
          ['X-Mandarin-Timestamp', "Hozirgi vaqt, Unix soniyalarda. Mandarin vaqtidan 5 daqiqadan ko'p farq qilsa, rad etiladi"],
          ['X-Mandarin-Signature', '`sha256=<hex>`: HMAC-SHA256(kalit, xabar)'],
          ['Content-Type', '`application/json`'],
        ],
      },
      {
        kind: 'list',
        items: [
          "Xabar = `<timestamp>.<METHOD>.<path>.` + so'rov tanasining baytlari. Masalan: `1729660000.POST./api/v1/partner/courier/orders.{\"order_id\":...}`.",
          "`path` so'rovning yo'li, domensiz va so'roq belgisisiz: `/api/v1/partner/courier/orders`.",
          "GET va tanasiz POST'da tana bo'sh: xabar nuqta bilan tugaydi.",
          "Imzolangan baytlarni aynan o'zgartirmasdan yuboring. JSON'ni qayta formatlasangiz, imzo mos kelmaydi.",
        ],
      },
    ],
  },
  {
    title: 'Zayavka yuborish',
    blocks: [
      { kind: 'p', text: '`POST /api/v1/partner/courier/orders`' },
      { kind: 'code', lang: 'json', code: ORDER_EXAMPLE },
      {
        kind: 'table',
        head: ['Maydon', "Ma'nosi"],
        rows: [
          ['order_id', "Sizning zayavka ID ingiz, 1–64 belgi: `A-Z a-z 0-9 _ . : -`. Takror yuborsangiz, yangisi ochilmaydi"],
          ['client_code', "Mijoz kodingiz, kuryerga ko'rinadi (ixtiyoriy, 20 belgigacha)"],
          ['full_name', 'Qabul qiluvchining ismi'],
          ['phone', "`+998XXXXXXXXX` (9 raqam ham bo'ladi, `998` o'zi qo'shiladi)"],
          ['address', "Manzil matni, 500 belgigacha"],
          ['note', "Podyezd, qavat, mo'ljal (ixtiyoriy)"],
          ['latitude, longitude', "Xaritadagi aniq nuqta. Toshkent shahridan tashqarisi qabul qilinmaydi"],
          ['delivery_date', "Yetkazish kuni `YYYY-MM-DD` (ixtiyoriy). Bo'lmasa bugun. Ko'pi bilan 14 kun oldinga"],
          ['items[]', "1–50 ta posilka: `track_code`, `flight_name`, `weight_kg`, `description` (hammasi ixtiyoriy)"],
        ],
      },
      {
        kind: 'p',
        text:
          "Javob: yangi zayavka `201`, shu `order_id` avval yuborilgan bo'lsa `200` va saqlangan zayavka. Tarmoq uzilsa, xuddi shu `order_id` bilan bemalol qayta yuboring.",
      },
      { kind: 'code', lang: 'json', code: ORDER_ANSWER },
    ],
  },
  {
    title: "Holatni o'qish va bekor qilish",
    blocks: [
      {
        kind: 'list',
        items: [
          "`GET /api/v1/partner/courier/orders/{order_id}`: zayavka hozir qanday holatda (javob yuqoridagidek).",
          "`POST /api/v1/partner/courier/orders/{order_id}/cancel`: kuryer hali yo'lga chiqmagan bo'lsa, bekor qiladi. Yo'lga chiqqan bo'lsa `409`.",
          "`GET /api/v1/partner/courier/ping`: imzo to'g'riligini va API yoqilganini tekshiradi.",
        ],
      },
      {
        kind: 'table',
        head: ['status', "Ma'nosi"],
        rows: [
          ['waiting', "Kuryer ro'yxatida, navbat kutyapti"],
          ['on_the_way', "Kuryer shu mijozga yo'lga chiqdi"],
          ['delivered', 'Yetkazildi'],
          ['cancelled', 'Bekor qilindi'],
        ],
      },
    ],
  },
  {
    title: 'Holat webhooklari',
    blocks: [
      {
        kind: 'p',
        text:
          "Har bir o'zgarishda webhook manzilingizga `X-Mandarin-Event: courier.status` bilan imzolangan POST keladi. Imzo `cargo.imported` dagidek tekshiriladi: `<timestamp>.` + tana.",
      },
      { kind: 'code', lang: 'json', code: STATUS_EXAMPLE },
      {
        kind: 'table',
        head: ['status', 'Qo\'shimcha maydonlar'],
        rows: [
          ['planned', "Kuryer kunni boshladi: `position` (nechanchi), `total`, `window` (`10:30–11:30`), `eta_at`"],
          ['on_the_way', "Kuryer shu mijozga yo'lda: `eta_at`, `courier` (`name`, `phone`, `car`)"],
          ['arrived', "Kuryer eshik oldida: `fee_uzs` (mijoz to'laydigan summa)"],
          ['delivered', "Topshirildi: `delivered_at`, `paid_amount`, `payment_method` (`cash` / `card`)"],
          ['postponed', "Boshqa kunga o'tdi: `postponed_to`, `reason`, `by` (`courier` yoki `system`: kun tugaguncha yetkazilmadi)"],
        ],
      },
      {
        kind: 'list',
        items: [
          "Vaqtlar ISO 8601, UTC. Toshkent vaqti = UTC + 5.",
          "Bitta voqea ikki marta kelishi mumkin: `delivery_id` ni saqlang. Tartib buzilsa, `occurred_at` bo'yicha eng yangisini oling.",
          "2xx javob bermasangiz, 24 soat davomida qayta yuboriladi (webhook qo'llanmasidagi jadval bo'yicha).",
        ],
      },
    ],
  },
  {
    title: 'Xatolar',
    blocks: [
      {
        kind: 'table',
        head: ['Kod', "Ma'nosi"],
        rows: [
          ['401', "Imzo noto'g'ri, sarlavha yo'q yoki vaqt 5 daqiqadan ko'p farq qiladi"],
          ['403', "Sizda «Kuryer API» yoqilmagan yoki hamkor to'xtatilgan"],
          ['404', '`order_id` topilmadi'],
          ['409', "Bekor qilib bo'lmaydi: kuryer yo'lga chiqqan yoki yetkazgan"],
          ['413', "So'rov 64 KB dan katta"],
          ['422', "Maydon xato: `detail` da qaysi maydon ekani yozilgan. Nuqta Toshkentdan tashqarida yoki sana noto'g'ri"],
          ['429', "Juda ko'p so'rov (daqiqasiga 100 tadan ko'p) yoki 300 tadan ortiq ochiq zayavka"],
        ],
      },
    ],
  },
  {
    title: "Python misol (to'liq ishlaydi)",
    blocks: [{ kind: 'code', lang: 'python', code: PYTHON_CLIENT }],
  },
];
