# TASK: Hamkor yuk API — reyslar ro'yxati va tanlangan reyslar yuklari (pull)

## Objective
Foydalanuvchi (2026-10-23, "Boshqa kargolar uchun import API"): webhook faqat yangi qatorlarni
yuboradi. Hamkor o'zi ham so'rab olsin: bizdan `cargo_items` dagi reyslar ro'yxatini oladi,
kerakli reyslarni tanlab yuboradi, biz o'z prefiksidagi yuklarni reys nomi va qolgan
ma'lumotlari bilan beramiz. Hamkor uchun API yangilanishi haqida .md hujjat.

## Implementation Plan
- [x] Backend: kuryer API dagi imzo tekshiruvi umumiy modulga (`src/api/partner_signature.py`)
- [x] Backend: `GET /api/v1/partner/cargo/flights`, `POST /api/v1/partner/cargo/items`
      (faqat o'z prefiksi, Xitoy importi, narxsiz, `after_id` bilan sahifalash, 60 s kesh)
- [x] Backend testlari: prefiks chegarasi, sahifalash, imzo/yo'l/tana o'zgarishi, to'xtatilgan hamkor, 422
- [x] Panel: hamkor ID har doim ko'rinadi; Qo'llanmaga pull bo'limlari va Python misoli
- [x] Python misol haqiqiy routerga qarshi ishga tushirildi (1204 qator, 2 sahifa)
- [x] 320/390 px: sarlavha tugmalari o'raladi, qo'llanmadagi uzun kod qatori sig'adi
- [x] `/mnt/project-files/partner-api/API_YANGILANISH_2026-10-23.md`, Telegraph skripti (mavjud sahifani yangilaydi)
- [x] Commit + push main (bot va web)

## Walkthrough / Architecture
Hamkor kuryer API dagi kabi imzolaydi: `X-Mandarin-Partner` (ID), `X-Mandarin-Timestamp`,
`X-Mandarin-Signature` = HMAC-SHA256(webhook kaliti, `<ts>.<METHOD>.<path>.` + tana). Shu
sababli tanlangan reyslar URL da emas, POST tanasida keladi: imzo ularni ham qamraydi.
Nima qaytishini faqat hamkorning paneldagi prefikslari belgilaydi. Qatorlar webhook bilan bir
xil maydonlarda (+`flight_name`), shuning uchun hamkor ikkalasini bitta jadvalga
`(flight_name, client_code, track_code)` bo'yicha upsert qiladi. Panelda o'zgarish kam:
hamkor ID si (imzo uchun kerak) endi kuryer API yoqilmagan hamkorda ham ko'rinadi.
