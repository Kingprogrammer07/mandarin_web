# TASK: Mini App «Kartaga o'tkazma» — aniq summa bilan kartaga to'lov

## Objective
Mijoz reys qarzini o'z bank ilovasidan to'lov kartamizga o'tkazadi, chek yubormaydi.
Server 30 daqiqalik so'rov ochadi: karta va aniq summa (qarz + 1–99 so'm). CardXabar
xabarida aynan shu summa shu kartaga kelsa, to'lov shu mijozniki deb topiladi va admin
bir bosishda tasdiqlaydi (keyin avtomatik). Backend: bot `POST/GET /api/v1/payments/card-intent`,
`flight-details.card_intent_available`.

## Implementation Plan
- [x] `paymentService`: `card_intent_available`, `CardIntent` turi, `openCardIntent`, `getCardIntent`
- [x] `CardTransferPanel`: ochilganda so'rov, 5 s da holat, sanoq, karta va summadan nusxa,
      holatlar open / found / paid / expired, chek banneri, rad javoblari kod bo'yicha
- [x] `MakePaymentModal`: «Kartaga o'tkazma» tugmasi (faqat `card_intent_available`, balans bilan emas),
      2-qadamda panel; eski online usul karta raqamisiz (faqat havolalar) ishlayveradi
- [x] Eski online kartaning yorug' rejimdagi oq-ustiga-oq raqami: `mc-cardface`
- [x] uz / ru tarjimalar
- [x] `npm run build`, `npm run lint`, 320 / 360 / 390 px tekshiruvi
- [x] Commit + push main (bot bilan birga)

## Walkthrough / Architecture
Panel ochilganda `openCardIntent` (POST) chaqiradi: server ochiq so'rovni qaytaradi yoki
yangisini ochadi; puli kelib admin kutayotgan so'rov bo'lsa, o'shani qaytaradi (ikki marta
to'lanmasin). So'ng `getCardIntent` (GET) TanStack Query `refetchInterval` bilan so'raladi:
open/found 5 s, expired 15 s, paid to'xtaydi. Sanoq `expires_at` dan, server soati bilan
farq (`server_time`) hisobga olinadi. Karta raqami faqat `open` holatda keladi.
Rad javoblari `detail = {code, message}`; matn kod bo'yicha tarjimadan, bo'lmasa serverdan.
Server «karta yo'q» uchun 409 qaytaradi: Mini App 502–504 ni texnik ishlar ekrani deb o'qiydi.
