# TASK: Astatka "Reyslarni tozalash" tugmasi

## Objective
Foydalanuvchi (2026-10-22): astatka (masalan OSTATKA-21.10.2026) to'liq skanerlangach, uning manba reyslaridagi (M306, M307…) na «olib ketilgan» deb belgilangan, na biror astatkada turgan yuk ombordan isbotsiz chiqib ketgan. Shularni bitta tugma bilan tozalash kerak, tugma nima qilishi oynada aniq yozilsin. M308 kabi yangi reyslar (hali tarqatilmoqda) chiqarilsin; SFFS5, SS9999 kabi kodlar oddiy mijoz.

## Implementation Plan
- [x] Backend: `astatka_cleanups` jadvali (jurnal), ko'rib chiqish / tozalash / bekor qilish / Excel endpointlari, flights:delete huquqi
- [x] Backend: faqat `is_taken_away` o'zgaradi (sana bo'sh), to'lov, isbot, xabar, foto hisobot, astatka yozuvlariga tegilmaydi; to'lov yozuvi yo'q / chek kutilmoqda / navbat yoki yetkazish so'rovidagi yuklar tegilmaydi
- [x] Frontend: /astatka kartasida «Reyslarni tozalash» tugmasi (o'chirish huquqi borlarga), tushuntirishli oyna, reys tanlash (yangi reyslar belgilanmagan), yuklar ro'yxati, nomni yozib tasdiqlash, oldingi tozalashlar (Excel, bekor qilish)
- [x] Testlar: backend Postgres (faqat bitta ustun o'zgaradi, eskirgan ko'rib chiqish, bekor qilish), dialog va sahifa testlari; 320/360/390/1280px, yorug' va qorong'i
- [ ] Commit + push main, deploy

## Walkthrough / Architecture
`GET /astatka-flights/{name}/cleanup` astatkaning o'z yuklaridan manba reyslarni oladi, har bir reysning foto hisobotidagi mijoz yuklarini (kod taxalluslari bitta mijoz) uchga ajratadi: olib ketilgan, biror astatkada (har qanday holat, `M305-M306` kabi qo'shma nom ham), hech qayerda yo'q. Oxirgilari tozalanadi yoki sababi bilan qoldiriladi. Reys astatka boshlanishidan 7 kun ichida kelgan bo'lsa «Yangi reys» — oynada belgilanmagan.

`POST .../cleanup` hammasini qayta hisoblaydi, to'lov qatorlarini `FOR UPDATE` bilan qulflab qayta o'qiydi (shu orada olib ketilgan yuk tashlab ketiladi), `is_taken_away = true`, `taken_away_date = NULL` qiladi va har bir o'zgargan qatorni `astatka_cleanups.items` ga yozadi; audit `ASTATKA_CLEANUP`. Bekor qilish faqat hali tozalash qoldirgan holatdagi (olib ketilgan, sanasiz, isbotsiz) qatorlarni qaytaradi; audit `ASTATKA_CLEANUP_UNDONE`.

Oldingi vazifa (astatka web yuborish rasmsiz yukni xato deb ko'rsatadi): bot 35cc0f2, web 0851451.
