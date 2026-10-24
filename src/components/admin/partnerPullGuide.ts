/**
 * The pull half of the partner guide: a partner asks for its own rows instead
 * of waiting for the webhooks. Part of the «Qo'llanma» (partnerWebhookGuide.ts).
 *
 * Kept in step with the backend (src/api/routers/partner_cargo.py,
 * src/api/partner_signature.py): paths, the signed string, body fields,
 * limits and errors are stated here. The Python example was run against that
 * router, photo reports included.
 */

import { COURIER_API_BASE as API_BASE } from './partnerCourierGuide';
import { PHOTO_REPORTS_ANSWER } from './partnerPhotoGuide';
import type { GuideSection } from './partnerWebhookGuide';

const FLIGHTS_ANSWER = `{
  "partner": "TezCargo",
  "prefixes": ["U"],
  "flights": [
    {
      "flight_name": "M314",
      "item_count": 184,
      "first_imported_at": "2026-10-22T17:21:04.512000Z",
      "last_imported_at": "2026-10-22T17:21:04.512000Z",
      "photo_report_count": 41
    },
    {
      "flight_name": "M313",
      "item_count": 97,
      "first_imported_at": "2026-10-19T09:02:11.104000Z",
      "last_imported_at": "2026-10-19T11:40:52.871000Z",
      "photo_report_count": 0
    }
  ]
}`;

const ITEMS_REQUEST = `{
  "flights": ["M314", "M313"],
  "after_id": 0,
  "limit": 500
}`;

const ITEMS_ANSWER = `{
  "items": [
    {
      "id": 845211,
      "flight_name": "M314",
      "client_code": "U-1024",
      "track_code": "YT1234567890",
      "track_code_2": null,
      "item_name_cn": "鞋子",
      "item_name_ru": "Обувь",
      "quantity": "2",
      "weight_kg": "3.4",
      "box_number": "17",
      "received_date": "2026-10-18"
    }
  ],
  "next_after_id": 845211
}`;

export const PYTHON_PULL = `"""Mandarin Cargo'dan o'z yuklaringiz va foto hisobotlaringizni tortib olish
(Python, requests + SQLite).

O'rnatish:  pip install requests
Muhit o'zgaruvchilari:
    MANDARIN_PARTNER_ID=7              # paneldagi hamkor ID
    MANDARIN_WEBHOOK_SECRET=whsec_...  # webhook bilan bir xil kalit
Ishga tushirish:
    python pull.py             # reyslar ro'yxati
    python pull.py M314 M313   # shu reyslarning yuklari va foto hisobotlari mandarin.db ga
"""

import hashlib
import hmac
import json
import os
import sqlite3
import sys
import time

import requests

BASE_URL = "${API_BASE}"
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
        timeout=30,
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


def pages(path: str, key: str, flights: list[str]):
    """Reyslarning hamma yozuvlari, sahifama-sahifa."""
    for start in range(0, len(flights), 20):  # bir so'rovda ko'pi bilan 20 reys
        after_id = 0
        while True:
            page = call("POST", path, {
                "flights": flights[start:start + 20],
                "after_id": after_id,
                "limit": 1000,
            })
            yield from page[key]
            if page["next_after_id"] is None:
                break
            after_id = page["next_after_id"]


if len(sys.argv) == 1:
    for flight in call("GET", "/api/v1/partner/cargo/flights")["flights"]:
        print(
            f"{flight['flight_name']:<14} {flight['item_count']:>6} ta yuk"
            f"  {flight['photo_report_count']:>5} ta foto hisobot"
        )
    sys.exit()

flights = sys.argv[1:]
db = sqlite3.connect("mandarin.db")
db.executescript(
    """
    CREATE TABLE IF NOT EXISTS mandarin_cargo (
        flight_name   TEXT NOT NULL,
        client_code   TEXT NOT NULL,
        track_code    TEXT NOT NULL,
        track_code_2  TEXT,
        item_name_cn  TEXT,
        item_name_ru  TEXT,
        quantity      TEXT,
        weight_kg     TEXT,
        box_number    TEXT,
        received_date TEXT,
        mandarin_id   INTEGER,
        PRIMARY KEY (flight_name, client_code, track_code)
    );
    CREATE TABLE IF NOT EXISTS mandarin_photo_reports (
        id               INTEGER PRIMARY KEY,
        flight_name      TEXT NOT NULL,
        client_code      TEXT NOT NULL,
        weight_kg        TEXT,
        comment          TEXT,
        track_codes      TEXT,
        photos           TEXT,
        photos_expire_at TEXT,
        deleted          INTEGER NOT NULL DEFAULT 0,
        occurred_at      TEXT NOT NULL
    );
    """
)
items = reports = 0
with db:  # webhook qabul qiluvchi bilan bir xil jadvallar: takror yozuv bo'lmaydi
    for item in pages("/api/v1/partner/cargo/items", "items", flights):
        db.execute(
            "INSERT OR REPLACE INTO mandarin_cargo VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                item["flight_name"],
                item["client_code"],
                item["track_code"],
                item["track_code_2"],
                item["item_name_cn"],
                item["item_name_ru"],
                item["quantity"],
                item["weight_kg"],
                item["box_number"],
                item["received_date"],
                item["id"],
            ),
        )
        items += 1
    for report in pages("/api/v1/partner/cargo/photo-reports", "reports", flights):
        # updated_at = webhook dagi occurred_at: eski holat yangisini bosmaydi,
        # bir xil holat esa havolalarni yangilaydi.
        db.execute(
            """
            INSERT INTO mandarin_photo_reports VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            ON CONFLICT (id) DO UPDATE SET
                flight_name = excluded.flight_name,
                client_code = excluded.client_code,
                weight_kg = excluded.weight_kg,
                comment = excluded.comment,
                track_codes = excluded.track_codes,
                photos = excluded.photos,
                photos_expire_at = excluded.photos_expire_at,
                deleted = 0,
                occurred_at = excluded.occurred_at
            WHERE excluded.occurred_at >= mandarin_photo_reports.occurred_at
            """,
            (
                report["id"],
                report["flight_name"],
                report["client_code"],
                report["weight_kg"],
                report["comment"],
                json.dumps(report["track_codes"], ensure_ascii=False),
                json.dumps(report["photos"]),
                report["photos_expire_at"],
                report["updated_at"],
            ),
        )
        reports += 1
print(items, "ta yuk,", reports, "ta foto hisobot saqlandi")`;

export const PARTNER_PULL_GUIDE: GuideSection[] = [
  {
    title: "Yuklarni o'zingiz so'rab olish (API)",
    blocks: [
      {
        kind: 'p',
        text:
          "Webhook faqat yangi qo'shilgan qatorlarni yuboradi. Eski qatorlar, foto hisobotlar yoki bir reysning hammasi kerak bo'lsa, ularni o'zingiz so'rab olasiz: avval reyslar ro'yxatini olasiz, keyin kerakli reyslarni tanlab, ularning qatorlari va foto hisobotlarini olasiz.",
      },
      {
        kind: 'list',
        items: [
          "Faqat sizning prefiksingizdagi mijozlar qatorlari keladi. Prefiks Mandarin panelida belgilanadi, so'rovda uni o'zgartirib bo'lmaydi.",
          "Webhook bilan bir xil ma'lumot: Xitoy importi qatorlari va foto hisobotlar, o'sha maydonlar, narxlarsiz.",
          `API manzili: \`${API_BASE}\`. Hamkor ID si va kalit (\`whsec_...\`) webhook va kuryer API dagi bilan bir xil.`,
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
          [
            'X-Mandarin-Timestamp',
            "Hozirgi vaqt, Unix soniyalarda. Mandarin vaqtidan 5 daqiqadan ko'p farq qilsa, rad etiladi",
          ],
          ['X-Mandarin-Signature', '`sha256=<hex>`: HMAC-SHA256(kalit, xabar)'],
          ['Content-Type', '`application/json`'],
        ],
      },
      {
        kind: 'list',
        items: [
          "Xabar = `<timestamp>.<METHOD>.<path>.` + so'rov tanasining baytlari. Masalan: `1729660000.POST./api/v1/partner/cargo/items.{\"flights\":[\"M314\"]}`.",
          "`path` domensiz va so'roq belgisisiz: `/api/v1/partner/cargo/items`. Shuning uchun tanlangan reyslar URL da emas, tanada yuboriladi.",
          "GET so'rovida tana bo'sh: xabar nuqta bilan tugaydi (`1729660000.GET./api/v1/partner/cargo/flights.`).",
          "Imzolangan baytlarni o'zgartirmasdan yuboring. JSON'ni qayta formatlasangiz, imzo mos kelmaydi.",
        ],
      },
    ],
  },
  {
    title: "Reyslar ro'yxati",
    blocks: [
      { kind: 'p', text: '`GET /api/v1/partner/cargo/flights`' },
      {
        kind: 'p',
        text:
          "Kamida bitta sizning qatoringiz yoki foto hisobotingiz bor reyslar, eng yangi importi birinchi. `item_count` shu reysdagi sizning qatorlaringiz, `photo_report_count` foto hisobotlaringiz soni. Faqat foto hisoboti bor reyslar (`item_count` 0) ro'yxat oxirida. Ro'yxat bir daqiqagacha keshlanadi: yangi import ko'pi bilan bir daqiqada ko'rinadi.",
      },
      { kind: 'code', lang: 'json', code: FLIGHTS_ANSWER },
    ],
  },
  {
    title: 'Reys yuklari',
    blocks: [
      { kind: 'p', text: '`POST /api/v1/partner/cargo/items`' },
      { kind: 'code', lang: 'json', code: ITEMS_REQUEST },
      {
        kind: 'table',
        head: ['Maydon', "Ma'nosi"],
        rows: [
          ['flights', "1–20 ta reys nomi, ro'yxatdagidek (katta-kichik harf farqi yo'q)"],
          ['after_id', "Birinchi sahifa uchun `0`, keyin oldingi javobdagi `next_after_id`"],
          ['limit', "Bir sahifadagi qatorlar soni, 1–1000 (standart 500)"],
        ],
      },
      { kind: 'code', lang: 'json', code: ITEMS_ANSWER },
      {
        kind: 'list',
        items: [
          "Qator maydonlari webhook dagidek, ustiga `flight_name`. `id` Mandarin dagi qator raqami: o'zgarmaydi.",
          "`next_after_id` `null` bo'lsa, oxirgi sahifa. Aks holda uni `after_id` qilib, xuddi shu reyslar bilan qayta so'rang.",
          "Webhook bilan kelgan qatorlar ham shu yerda bor. `(flight_name, client_code, track_code)` bo'yicha upsert qilsangiz, takror yozuv bo'lmaydi.",
        ],
      },
    ],
  },
  {
    title: "Foto hisobotlarni so'rab olish",
    blocks: [
      { kind: 'p', text: '`POST /api/v1/partner/cargo/photo-reports`' },
      {
        kind: 'p',
        text:
          "Tana va sahifalash «Reys yuklari» dagi kabi (`flights`, `after_id`, `limit`). Javobda `reports` (webhook dagi bilan bir xil maydonlar) va `next_after_id`:",
      },
      { kind: 'code', lang: 'json', code: PHOTO_REPORTS_ANSWER },
      {
        kind: 'list',
        items: [
          "O'chirilgan hisobotlar kelmaydi. Reysni to'liq so'rab olgandan keyin javobda yo'q hisobot o'chirilgan.",
          "Har so'rovda rasm havolalari yangidan, bugundan 6 oyga beriladi. Havolasi eskirayotgan hisobotni qayta so'rab oling.",
          "`updated_at` webhook dagi `occurred_at` bilan bir soat: saqlashda shuni versiya qilib yozing (Python misolida shunday).",
        ],
      },
    ],
  },
  {
    title: 'API xatolari',
    blocks: [
      {
        kind: 'table',
        head: ['Kod', "Ma'nosi"],
        rows: [
          ['401', "Imzo noto'g'ri, sarlavha yo'q yoki vaqt 5 daqiqadan ko'p farq qiladi"],
          ['403', "Hamkor to'xtatilgan: Mandarin administratoriga murojaat qiling"],
          ['413', "So'rov 64 KB dan katta"],
          ['422', "Tana xato: `flights` bo'sh yoki 20 tadan ko'p, `limit` 1000 dan katta, ortiqcha maydon bor. `detail` da qaysi maydon ekani yozilgan"],
          ['429', "Juda ko'p so'rov (daqiqasiga 100 tadan ko'p). `Retry-After` soniyadan keyin qayta urining"],
        ],
      },
    ],
  },
  {
    title: "Python misol: yuklarni tortish (to'liq ishlaydi)",
    blocks: [
      {
        kind: 'p',
        text:
          "Argumentsiz reyslar ro'yxatini chiqaradi. Reys nomlari bilan ishga tushirsangiz, ularning hamma qatorlarini sahifama-sahifa olib, webhook misolidagi jadvalga yozadi.",
      },
      { kind: 'code', lang: 'python', code: PYTHON_PULL },
    ],
  },
];
