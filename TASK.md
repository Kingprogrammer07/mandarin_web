# TASK.md

## Objective
POS Dashboard cashier log funksionalini yangilash:
1. Backend `/payments/cashier-log` endi barcha kassirlar logini qaytaradi — frontend shunga moslashishi kerak.
2. Har bir kassirning logini o'z rangida ko'rsatish (o'zini — orange, boshqalarni — har xil rangda).
3. Real-time yangilanish: boshqa kassir yozuv qo'shganda avtomatik yangilansin (polling intervali qisqartirilsin).
4. `cashier_id` ni TypeScript interfeyslarga qo'shish.
5. `admin_id` ni JWT claims dan olish (`getAdminJwtClaims` yangilash).

## Implementation Plan

- [x] `AdminJwtClaims` ga `admin_id: number | null` qo'shish va JWT payload dan olish
- [x] `CashierLogItem` ga `cashier_id: number | null` qo'shish
- [x] `getCashierLog` — endpoint o'zgartirilmaydi, lekin endi all-cashier data qaytaradi
- [x] `refetchInterval` ni 60s → 10s ga qisqartirish (real-time polling)
- [x] `LogEntry` komponentini yangilash: rang kodlash va "Men" badge
- [x] `POSDashboard` da `currentAdminId` ni aniqlash va log colorlashni qo'llash

## Walkthrough / Architecture

```
JWT → getAdminJwtClaims() → admin_id (sub field)
         ↓
POSDashboard → jwtClaims.admin_id (currentAdminId)
         ↓
getCashierLog (polling 10s) → CashierLogItem[] (cashier_id populated)
         ↓
LogEntry:
  cashier_id === currentAdminId → orange (own entry) + "Men" badge
  cashier_id !== currentAdminId → deterministic color from palette + "#id" badge
  cashier_id === null            → neutral gray
```

Color palette (boshqa kassirlar uchun, deterministic by cashier_id % palette.length):
- blue, purple, teal, rose, indigo

## Status: DONE ✓
