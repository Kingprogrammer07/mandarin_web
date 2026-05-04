# Admin Delivery Request Page

## Objective
Create a beautiful, reusable, SOLID-compliant admin page that lets warehouse/admin staff create delivery requests on behalf of clients using the new backend endpoints:
- `POST /api/v1/admin/delivery-requests/standard` (JSON)
- `POST /api/v1/admin/delivery-requests/uzpost` (multipart)

## Implementation Plan

- [x] Create `src/api/services/adminDeliveryService.ts`
  - `adminCreateStandardDelivery()` → JSON POST
  - `adminCreateUzpostDelivery()` → multipart POST
- [x] Create `src/api/hooks/useAdminDelivery.ts`
  - `useAdminCreateStandardDelivery()` mutation
  - `useAdminCreateUzpostDelivery()` mutation
- [x] Create reusable components in `src/components/admin/delivery/`
  - `ClientLookupPanel.tsx` — search client by code via grouped warehouse search
  - `FlightSelector.tsx` — multi-select flight cards
  - `CargoPreviewList.tsx` — expandable cargo list per flight
  - `DeliveryTypeSelector.tsx` — 5 type cards (self_pickup, yandex, mandarin, bts, uzpost)
  - `StandardDeliveryForm.tsx` — phone, caption, map picker
  - `UzpostDeliveryForm.tsx` — branch picker, receipt upload, wallet input
- [x] Create `src/pages/admin/AdminDeliveryRequestPage.tsx`
  - Step-based wizard: client → flights → type → form → success
  - Sticky bottom action bar
  - Orange accent theme consistent with warehouse
- [x] Wire routing in `App.tsx`
  - Add `admin-delivery-request` to Page union, paths, ROLE_CONFIG
- [x] Add nav item in `AdminLayout.tsx` sidebar quick access
- [x] Add i18n keys to `uz.json` and `ru.json`
- [x] Build and verify TypeScript + Vite (passes)

## Architecture

```
AdminDeliveryRequestPage
├── Step 1: ClientLookupPanel
│   └── useGroupedWarehouseSearch({ code, payment_status: paid, taken_status: not_taken })
├── Step 2: FlightSelector + CargoPreviewList
│   └── Multi-select flights from ClientGroup.flights
├── Step 3: DeliveryTypeSelector
│   └── self_pickup | yandex | mandarin | bts | uzpost
├── Step 4a: StandardDeliveryForm
│   └── phone, caption, DeliveryMapPickerLazy
├── Step 4b: UzpostDeliveryForm
│   └── phone, UzpostBranchPicker, receiptFile, walletUsed
└── Submit → adminCreateStandardDelivery | adminCreateUzpostDelivery
```

## Files Created/Modified

| File | Action |
|------|--------|
| `src/api/services/adminDeliveryService.ts` | Created |
| `src/api/hooks/useAdminDelivery.ts` | Created |
| `src/components/admin/delivery/ClientLookupPanel.tsx` | Created |
| `src/components/admin/delivery/FlightSelector.tsx` | Created |
| `src/components/admin/delivery/CargoPreviewList.tsx` | Created |
| `src/components/admin/delivery/DeliveryTypeSelector.tsx` | Created |
| `src/components/admin/delivery/StandardDeliveryForm.tsx` | Created |
| `src/components/admin/delivery/UzpostDeliveryForm.tsx` | Created |
| `src/pages/admin/AdminDeliveryRequestPage.tsx` | Created |
| `src/App.tsx` | Modified (routing + roles) |
| `src/components/admin/AdminLayout.tsx` | Modified (nav item + Truck import) |
| `src/i18n/locales/uz.json` | Modified (adminDeliveryRequest keys) |
| `src/i18n/locales/ru.json` | Modified (adminDeliveryRequest keys) |
