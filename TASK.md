# TASK: Warehouse qidiruvida astatka yukining asl reysi

## Objective
Foydalanuvchi (2026-10-22): astatka xabaridagidek, warehouse sahifasidan yuk qidirilganda ham asl nomi chiqsin.

Hozir warehouse mijozning yuklarini to'lov qatorlaridan ko'rsatadi. Astatka yukining to'lovi u kelgan reysda turadi, shuning uchun yuk asl reysi (masalan M286-M287) ostida chiqadi. Lekin uning qaysi astatka javonida turgani hech qayerda yozilmaydi. "Reys" maydoniga astatka nomi yozilsa esa hech narsa topilmaydi.

## Implementation Plan
- [x] Backend `search-grouped`: "Reys" maydonida astatka nomi (O…) bo'lsa, shu astatkada tasdiqlangan yuklarning (mijoz, asl reys) juftlari bo'yicha to'lov qatorlari qidiriladi; mijoz kodi bilan birga ham ishlaydi
- [x] Backend: har bir reys guruhiga `astatka_flight_name` qo'shildi (shu mijozning shu reysdagi yuki qaysi astatkada tasdiqlangan)
- [x] Frontend: reys kartasida asl reys nomi sarlavha, ostida "Ostatkada: OSTATKA-…" belgisi; yig'ilgan ko'rinishdagi reys chipida ham astatka nomi
- [x] Yo'lda topilgan xato: mijoz va reys kartalari birinchi bosishda yopilmas edi (ikki marta bosish kerak edi)
- [x] Testlar: backend Postgres (astatka nomi bilan qidirish, alias kod, boshqa reys va boshqa mijoz chiqmasligi), frontend komponent testi; 320/360/390/1280 px skrinshot va overflow tekshiruvi
- [x] Warehouse checkboxlari ko'rinmas edi: `index.css` dagi `appearance: none` checkbox va radioga ham tushardi (qutisi ham, belgisi ham chizilmasdi). Endi faqat matn maydonlariga tushadi; reys tanlash checkboxi 44px bosish joyi bilan, "Isbot yuborilganlarni ko'rsatish" esa toggle (switch)
- [x] "Strict" qidiruv: "Mening faolligim" bo'limidagi "Aniq" checkboxi ko'rinmas edi; endi asosiy qidiruvdagi kabi switch. Ikkalasi bitta `FilterSwitch` komponentidan; faollik qatoridagi input 16px (iPhone zoom qilmasin), qator 42px
- [x] Asl reys nomi bilan qidirishda ham shu guruh "Ostatkada" belgisi bilan chiqadi (backend testi)
- [x] Commit + push main (backend, frontend)

## Walkthrough / Architecture
Astatka 2026-10-16 dan beri faqat `astatka_packages` ga yozadi: to'lov qatori eski reysda qoladi. Backenddagi `src/api/services/astatka_warehouse.py` ikki narsani beradi: astatkadagi yuklarning (mijoz kodi va uning barcha aliaslari, asl reys) juftlari, va berilgan (mijoz, reys) guruhlari uchun astatka nomi. Faqat bizning tasdiqlangan yuklar hisoblanadi: "kutilmoqda" yuk javonda ekani aniq emas, AKB yukining bizda to'lov qatori yo'q.

`ClientTransactionDAO.get_filtered_transactions` va `count_filtered_transactions_by_client_code` ga ixtiyoriy `client_flight_pairs` filtri qo'shildi (`(UPPER(TRIM(client_code)), UPPER(TRIM(reys))) IN (...)`). Excel eksport astatka nomini hali bilmaydi.
