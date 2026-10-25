# TASK: Hamkorga foto hisobot — Mandarin mijozi bilan bir xil ma'lumot

## Objective
Foydalanuvchi (2026-10-25): hamkorga foto hisobot bilan har bir mijozning trek kodlari ham
borsin, va Mandarin mijoziga qanday ma'lumot borsa, hamkorga ham shunday borsin. Kartochkada
tanlangan: narx ham yuboriladi (kg narxi $, narx $ va so'm, kurs). Bizning karta va to'lov
havolalari yuborilmaydi.

## Implementation Plan
- [x] Backend: «kutilayotgan yuklar»da kod qo'shilsa / almashtirilsa / reys yoki mijoz kodi
      o'zgartirilsa / o'chirilsa, hamkorning shu hisobotlariga `photo_report.updated`
      (hisobot `updated_at` i oldinga suriladi: pull API bilan bir soat)
- [x] Backend: unutilgan yuk oqimida mijozning avvalgi hisobotlari ham yangilanadi
- [x] Backend: payload va pull API ga `price_per_kg_usd`, `price_usd`, `price_uzs`, `usd_rate`
      (mijoz xabaridagi kurs manbai; kurs olinmasa so'm `null`)
- [x] Backend testlari
- [x] Qo'llanma: maydonlar, voqealar, Python misollari (narx ustunlari)
- [x] Python misollarini haqiqiy payloadlar bilan sinash (qabul qiluvchi + pull)
- [x] Hamkor hujjati va Telegraph skripti yangilandi
- [x] Commit + push main (bot va web)

## Walkthrough / Architecture
Mijozga boradigan xabar trek kodlarni yuborish paytida o'qiydi; hamkor esa hisobot
saqlanganda olardi. Endi trek kod ro'yxatini o'zgartiruvchi har bir xizmat funksiyasi
commitdan oldin `queue_track_codes_changed` ni chaqiradi: u hamkor prefiksidagi tegishli
hisobotlarni topadi, `updated_at` ni suradi va o'sha tranzaksiyada outboxga `updated`
qo'yadi. Narx mijoz xabaridagidek: og'irlik × kg narxi, so'mga admin kursi (yoki API kursi)
bilan.
