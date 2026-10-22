# TASK: Astatka "Yuborish" yuborilgandek ko'rinadi, lekin yuborilmaydi

## Objective
Foydalanuvchi (2026-10-22): OSTATKA-21.10.2026 da SSSS77 ni yuborsa "yuborildi" deydi, mijozga esa hech narsa bormaydi va qator "Kutmoqda" bo'lib qoladi.

Sabab (server ma'lumoti bilan tasdiqlandi): SSSS77 yuki M306 dan tasdiqlangan, lekin M306 da uning foto hisoboti yo'q va astatkada rasm olinmagan. Rasmsiz yukni web yuborish jimgina "o'tkazib yuborardi" (sababsiz), oyna esa "Yuborish yakunlandi" derdi. Bot orqali yuborish shu holatda allaqachon aniq xato beradi.

## Implementation Plan
- [x] Backend: `astatka_send.build_web_report` rasm bo'lmasa `NoPhotoError` ko'taradi (botdagi matn bilan bir xil: "Rasm topilmadi: astatka oynasida yukning rasmini qo'shing"); rasm bor-u, ombor javob bermasa alohida matn
- [x] Backend: web yuborish bu holatni "Xato" deb sanaydi, sababi ro'yxatda chiqadi, logga yoziladi; yuk "Kutmoqda" bo'lib qoladi
- [x] Frontend: hech kimga yetmagan yuborishda oyna sarlavhasi "Hech kimga yuborilmadi"
- [x] Testlar: backend Postgres (rasmsiz yuk → xato, yuborilmaydi, belgilanmaydi), dialog testi
- [ ] Commit + push main (backend, frontend)

## Walkthrough / Architecture
Astatka yuborishda har bir mijoz uchun `build_web_report` xabar yig'adi. Rasm yo'q bo'lsa endi `None` emas, `NoPhotoError` qaytadi; `_run_send_task` uni ushlab `failed` natija yozadi, Redis'dagi vazifa holatida `errors` ro'yxatiga sabab tushadi va `SendProgressDialog` uni qizil "Xatolar" qutisida ko'rsatadi. Oddiy reyslar o'zgarmadi.

Yukni yuborish uchun: astatka oynasida yukning rasmini oling (vaznini ham yozing), keyin qayta yuboring.

Oldingi vazifa (mijoz ilovasi, /pos, /kassa'da "Ostatkada" belgisi): web 9e51972, d836c92; bot a746c8c, 753d59a.
