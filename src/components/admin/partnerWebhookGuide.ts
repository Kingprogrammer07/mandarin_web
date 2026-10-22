/**
 * The integration guide a partner cargo's developer needs, shown in the
 * super-admin panel and copied from there as Markdown to send to the partner.
 *
 * Kept in step with the backend sender
 * (backend: src/infrastructure/services/partner_webhooks.py): header names,
 * signature format, retry schedule and the 500-item chunk size are all stated
 * here. The Python example was run against that sender's signing code.
 */

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: [string, string]; rows: [string, string][] }
  | { kind: 'code'; lang: string; code: string };

export interface GuideSection {
  title: string;
  blocks: GuideBlock[];
}

const BODY_EXAMPLE = `{
  "event": "cargo.imported",
  "delivery_id": "6f1c2b0e-3d0a-4c39-9a51-2f8c6f7d1e44",
  "flight_name": "M312",
  "imported_at": "2026-10-22T06:41:52.120000+00:00",
  "items": [
    {
      "id": 981245,
      "client_code": "U-1024",
      "track_code": "79120252553082",
      "track_code_2": null,
      "item_name_cn": "鞋子",
      "item_name_ru": "Обувь",
      "quantity": "2",
      "weight_kg": "3.4",
      "box_number": "17",
      "received_date": "2026-10-18"
    }
  ]
}`;

export const PYTHON_RECEIVER = `"""Mandarin Cargo webhook qabul qiluvchi (FastAPI + SQLite).

O'rnatish:  pip install fastapi uvicorn
Ishga tushirish:
    export MANDARIN_WEBHOOK_SECRET='whsec_...'   # Mandarin bergan kalit
    uvicorn receiver:app --host 0.0.0.0 --port 8000
"""

import hashlib
import hmac
import json
import os
import sqlite3
import time

from fastapi import FastAPI, HTTPException, Request

WEBHOOK_SECRET = os.environ["MANDARIN_WEBHOOK_SECRET"].encode()
MAX_AGE_SECONDS = 300  # 5 daqiqadan eski so'rov qabul qilinmaydi

db = sqlite3.connect("mandarin.db", check_same_thread=False)
db.executescript(
    """
    CREATE TABLE IF NOT EXISTS mandarin_deliveries (
        delivery_id TEXT PRIMARY KEY,
        received_at INTEGER NOT NULL
    );
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
    """
)

app = FastAPI()


def verify_signature(body: bytes, timestamp: str, signature: str) -> None:
    """Imzo noto'g'ri yoki so'rov eski bo'lsa, xato qaytaradi."""
    try:
        ts = int(timestamp)
    except ValueError:
        raise HTTPException(status_code=400, detail="bad timestamp")
    if abs(time.time() - ts) > MAX_AGE_SECONDS:
        raise HTTPException(status_code=400, detail="stale request")

    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET, f"{ts}.".encode() + body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="bad signature")


@app.post("/webhooks/mandarin")
async def mandarin_webhook(request: Request):
    body = await request.body()  # imzo aynan shu baytlardan hisoblanadi
    verify_signature(
        body,
        request.headers.get("X-Mandarin-Timestamp", ""),
        request.headers.get("X-Mandarin-Signature", ""),
    )
    event = json.loads(body)

    if event["event"] == "ping":  # paneldagi "Test" tugmasi
        return {"ok": True}

    with db:  # bitta tranzaksiya: hammasi yoziladi yoki hech narsa
        seen = db.execute(
            "INSERT OR IGNORE INTO mandarin_deliveries VALUES (?, ?)",
            (event["delivery_id"], int(time.time())),
        )
        if seen.rowcount == 0:
            return {"ok": True}  # bu yuborish avval qabul qilingan

        for item in event["items"]:
            db.execute(
                """
                INSERT OR REPLACE INTO mandarin_cargo VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event["flight_name"],
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
    return {"ok": True}  # istalgan 2xx javob = "qabul qilindi"`;

export const GUIDE_TITLE = "Mandarin Cargo webhook: hamkor uchun qo'llanma";

export const PARTNER_WEBHOOK_GUIDE: GuideSection[] = [
  {
    title: 'Bu nima',
    blocks: [
      {
        kind: 'p',
        text:
          "Mandarin Cargo Xitoy omboridagi yuk ro'yxatini (manifest) tizimga yuklaganda, mijoz kodi sizning prefiksingiz (masalan `U`) bilan boshlanadigan YANGI qatorlarni sizning serveringizga avtomatik yuboradi.",
      },
      {
        kind: 'list',
        items: [
          "Faqat shu yuklashda qo'shilgan qatorlar keladi. Avval yuborilgan va eski qatorlar qayta yuborilmaydi.",
          "Narx va to'lov ma'lumotlari yuborilmaydi.",
          "Har bir so'rov maxfiy kalit bilan imzolanadi: soxta so'rovni ajratib olasiz.",
        ],
      },
    ],
  },
  {
    title: 'Sizdan nima kerak',
    blocks: [
      {
        kind: 'list',
        items: [
          'POST qabul qiladigan HTTPS manzil, masalan `https://api.sizning-domen.uz/webhooks/mandarin`. Shuni Mandarin administratoriga bering.',
          "15 soniya ichida istalgan 2xx javob (200, 201, 204). Og'ir ishni javobdan keyin bajaring.",
          "Yo'naltirish (301/302) bermang: yakuniy manzilni bering, yo'naltirishga ergashilmaydi.",
          "Mandarin bergan maxfiy kalitni (`whsec_...`) serverda muhit o'zgaruvchisida saqlang. Kodga va gitga yozmang.",
        ],
      },
    ],
  },
  {
    title: "So'rov sarlavhalari (headers)",
    blocks: [
      {
        kind: 'table',
        head: ['Sarlavha', "Ma'nosi"],
        rows: [
          ['Content-Type', '`application/json; charset=utf-8`'],
          ['X-Mandarin-Event', '`cargo.imported` (yangi qatorlar) yoki `ping` (test)'],
          ['X-Mandarin-Delivery', "Yuborishning noyob ID si. Qayta urinishda o'zgarmaydi"],
          ['X-Mandarin-Timestamp', 'Yuborilgan vaqt, Unix soniyalarda'],
          ['X-Mandarin-Signature', '`sha256=<hex>`: imzo, pastda qanday tekshirilishi yozilgan'],
        ],
      },
    ],
  },
  {
    title: "So'rov tanasi (body)",
    blocks: [
      { kind: 'code', lang: 'json', code: BODY_EXAMPLE },
      {
        kind: 'table',
        head: ['Maydon', "Ma'nosi"],
        rows: [
          ['flight_name', 'Reys nomi (Mandarin operatori kiritgan)'],
          ['imported_at', 'Yuklangan vaqt (ISO 8601, UTC)'],
          ['items[].id', "Mandarin bazasidagi qator ID si (ma'lumot uchun)"],
          ['items[].client_code', 'Mijoz kodi, har doim sizning prefiksingiz bilan boshlanadi'],
          ['items[].track_code', 'Asosiy trek kod'],
          ['items[].track_code_2', "Ikkinchi (tuzatilgan) trek kod, bo'lmasa `null`"],
          ['items[].item_name_cn / item_name_ru', 'Mahsulot nomi (xitoycha / ruscha)'],
          ['items[].quantity', 'Soni (matn)'],
          ['items[].weight_kg', "Og'irligi, kg (matn, nuqta bilan: `3.4`)"],
          ['items[].box_number', 'Quti raqami'],
          ['items[].received_date', 'Xitoy omboriga qabul qilingan sana (YYYY-MM-DD)'],
        ],
      },
      {
        kind: 'p',
        text:
          "Matn maydonlari Excel'dan qanday kelsa, shunday yuboriladi va bo'sh bo'lishi mumkin (`null`). Bitta yuborishda ko'pi bilan 500 ta qator bo'ladi: katta yuklash bir nechta yuborishga bo'linadi, har birining o'z `delivery_id` si bor.",
      },
    ],
  },
  {
    title: 'Imzoni tekshirish',
    blocks: [
      {
        kind: 'list',
        items: [
          "So'rov tanasining xom baytlarini oling (JSON ga aylantirishdan oldin).",
          'Xabar = `X-Mandarin-Timestamp` + `.` + tana baytlari.',
          "HMAC-SHA256(maxfiy kalit, xabar) ni hex ko'rinishida hisoblang va oldiga `sha256=` qo'shing.",
          'Natijani `X-Mandarin-Signature` bilan constant-time solishtiring (`hmac.compare_digest`). Mos kelmasa, 401 qaytaring.',
          "Vaqt 5 daqiqadan eski bo'lsa, rad eting: eski so'rovni qayta yuborish hujumidan himoya.",
        ],
      },
    ],
  },
  {
    title: 'Qayta yuborish va takrorlar',
    blocks: [
      {
        kind: 'list',
        items: [
          "2xx bo'lmagan javob, timeout yoki ulanish xatosida Mandarin qayta yuboradi: 30 soniya, 1, 2, 4, 8, 16, keyin har 30 daqiqada. Bu 24 soat davom etadi.",
          "24 soatdan keyin yuborish \"xato\" holatiga o'tadi. Mandarin administratori uni paneldan qayta navbatga qo'yishi mumkin.",
          "Javobingiz yo'lda yo'qolsa, bitta yuborish ikki marta kelishi mumkin. `delivery_id` ni saqlang va takrorini o'tkazib yuboring.",
          "Bir trek kod boshqa `delivery_id` bilan qayta kelishi ham mumkin (masalan, reys qayta yuklansa). Qatorni `(flight_name, client_code, track_code)` bo'yicha yangilang (upsert).",
        ],
      },
    ],
  },
  {
    title: 'Test',
    blocks: [
      {
        kind: 'p',
        text:
          "Mandarin administratori paneldagi \"Test\" tugmasini bossa, `\"event\": \"ping\"` va bo'sh `items` bilan imzolangan so'rov keladi. Imzoni tekshirib, 2xx qaytaring.",
      },
    ],
  },
  {
    title: "Python misol (FastAPI + SQLite, to'liq ishlaydi)",
    blocks: [
      {
        kind: 'p',
        text:
          "Imzoni tekshiradi, takroriy yuborishni o'tkazib yuboradi va qatorlarni bitta tranzaksiyada saqlaydi. SQLite o'rniga o'zingizning bazangizni qo'yishingiz mumkin.",
      },
      { kind: 'code', lang: 'python', code: PYTHON_RECEIVER },
    ],
  },
  {
    title: 'Xavfsizlik',
    blocks: [
      {
        kind: 'list',
        items: [
          "Imzosiz yoki imzosi noto'g'ri so'rovni hech qachon qabul qilmang.",
          "Kalit sizib chiqqan bo'lsa, darhol Mandarin'ga xabar bering: yangi kalit beriladi va eskisi shu zahoti ishlamay qoladi.",
          "Manzil faqat HTTPS bo'lsin, sertifikat haqiqiy bo'lsin (o'zi imzolagan sertifikat qabul qilinmaydi).",
        ],
      },
    ],
  },
];

/** The whole guide as Markdown, to paste into Telegram, Telegraph or an email. */
export function guideToMarkdown(sections: GuideSection[] = PARTNER_WEBHOOK_GUIDE): string {
  const out: string[] = [`# ${GUIDE_TITLE}`];
  for (const section of sections) {
    out.push('', `## ${section.title}`);
    for (const block of section.blocks) {
      out.push('');
      if (block.kind === 'p') out.push(block.text);
      if (block.kind === 'list') out.push(...block.items.map((item) => `- ${item}`));
      if (block.kind === 'code') out.push('```' + block.lang, block.code, '```');
      if (block.kind === 'table') {
        out.push(`| ${block.head[0]} | ${block.head[1]} |`, '| --- | --- |');
        out.push(...block.rows.map(([a, b]) => `| ${a} | ${b} |`));
      }
    }
  }
  return out.join('\n') + '\n';
}

/** Splits text on `inline code` spans: odd indexes are code. */
export function splitInlineCode(text: string): string[] {
  return text.split(/`([^`]+)`/);
}
