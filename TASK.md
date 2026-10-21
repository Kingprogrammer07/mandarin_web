# TASK: Astatka — skanerlash tartibida saqlash, ro'yxat va Excel

## Objective
Foydalanuvchi (2026-10-21): yuklar qanday skanerlangan bo'lsa, shu tartibda saqlansin — bazada ham, Excel'da ham. Saqlangan ro'yxatga "Skanerlash tartibida" saralash qo'shilsin.

## Implementation Plan
- [x] Frontend: "Hammasini tasdiqlash" yuklarni birinchi skanerlangandan boshlab yuborsin (`confirmRows`), oflayn navbatda bir vaqtda bosilganlar ham skanerlash tartibida (`inPressOrder` tie-break)
- [x] Backend: `scanned` saralash kaliti (skanerlangan vaqt, bo'lmasa tasdiqlangan vaqt; keyin id), schema Literal
- [x] Backend: Excel skanerlash tartibida (skanerlanmagan "Kutilmoqda" yuklar oxirida, avvalgidek kargo/reys/mijoz bo'yicha), "Skanerlangan vaqti" ustuni, vaqtlar Toshkent vaqtida
- [x] Frontend: saralash ro'yxatiga "Skanerlash tartibida", oflayn nusxada ham xuddi shunday taqqoslash
- [x] Testlar (pytest + vitest), lint, build
- [x] Commit + push main (backend, frontend)

## Walkthrough / Architecture
Har bir yukda `scanned_at` bor: tasdiqlovchi qatorning qurilmadagi birinchi skanerlangan vaqti (oflayn navbat soatlab kechiksa ham to'g'ri). Server so'rovdagi yuklarni kelgan tartibda qayta ishlaydi, shuning uchun frontend ularni skanerlash tartibida yuborsa, yangi yozuvlarning id va `confirmed_at` qiymatlari ham shu tartibda bo'ladi. Ro'yxat va Excel esa to'g'ridan-to'g'ri `scanned_at` bo'yicha saralanadi — kim qachon bosganidan qat'i nazar. Serverda partiyani qayta saralamaymiz: bitta yukning qo'lda tuzatilgan ikki qatori bosilgan tartibda qo'llanishi kerak (`inPressOrder` izohi).
