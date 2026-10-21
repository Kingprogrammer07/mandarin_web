# TASK: "Boshqa astatkada" qatorini Tasdiqlash bilan qayta tekshirish

## Objective
Foydalanuvchi (2026-10-21): OSTATKA-21.10.2026 da ishlayapti. Eski OSTATKA 16.10 ni o'chirgandan keyin ham ish ro'yxatidagi qatorlar "Bu yuk OSTATKA 16.10 astatkasida turibdi" deb qolyapti va Tasdiqlash tugmasi o'chiq. So'rov: "tasdiqlash bosilganda qayta tekshirib tasdiqlasa bo'lmaydimi?"

Sabab: ish ro'yxatidagi qator serverning skanerlash paytidagi javobini saqlab qoladi; "Boshqa astatkada" holati Tasdiqlash ham, Qayta tekshirish ham bermasdi, qayta skanerlash esa faqat "allaqachon skanerlangan" deydi.

## Implementation Plan
- [x] `CONFIRMABLE` ga `other_astatka` qo'shildi: qatorning Tasdiqlash tugmasi yoqiladi
- [x] "Hammasini tasdiqlash" va Ctrl+Enter o'zgarmadi: ular faqat tayyor qatorlarni yuboradi, boshqa astatkadagi yuk faqat o'z tugmasi bilan yuboriladi
- [x] Testlar: lib (tugma yoqiladi, so'rov mijoz va reys bilan) va hook (server tasdiqlasa yashil, rad etsa xabari bilan qizil; ommaviy tasdiqlashga kirmaydi)
- [x] Lint, typecheck, build, testlar
- [x] Commit + push main

## Walkthrough / Architecture
Server tasdiqlashda yukni o'zi qayta tekshiradi (`astatka_flight.py` confirm). Yuk boshqa astatkada hali tasdiqlangan bo'lsa, javob `conflict` bo'ladi: "Bu yuk X astatkasida tasdiqlangan. Avval u yerdagi tasdiqni bekor qiling." Qator qizil bo'lib, shu xabarni ko'rsatadi. Yuk u yerda faqat kutilmoqda ro'yxatida bo'lsa, server uni shu astatkaga o'tkazadi va ogohlantirish beradi. U astatka o'chirilgan bo'lsa, yuk oddiy tasdiqlanadi.

Ommaviy tasdiqlash bunday qatorlarni olmaydi. Aks holda bitta bosish bilan boshqa astatkalarning ro'yxatidagi yuklar ko'chib ketishi mumkin edi.
