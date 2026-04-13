# TASK.md — FastEntryPanel edit + WarehousePage mobile redesign

## Objective

1. **FastEntryPanel** `QueueItemRow` da auto-resolve qilingan `client_code` ni bir bosish bilan tahrirlash imkoniyati. Agar `resolvedClientId` bor-u `full_name` null bo'lsa — "Bazada yo'q" warning ko'rsatish.
2. **WarehousePage** ni mobile uchun chiroyli va qulay qilish (desktop sifatini saqlab).

---

## Implementation Plan

### Part 1 — FastEntryPanel (QueueItemRow)
- [x] Resolved holatdagi client_code ni `<button>` ga aylantirib, bosish bilan edit mode ga o'tish
- [x] Edit mode da `Pencil` hover hint ko'rsatish
- [x] `resolvedClientId !== null && resolvedClientName === null` → amber "Bazada yo'q" warning badge
- [x] `isEditingCode` + `tempCode` sync — resolved bo'lganda ham ishlaydi

### Part 2 — WarehousePage mobile
- [x] `WarehouseFilters` — filter chiplarini horizontal scroll ga o'tkazish
- [x] `TransactionsTable` — mobile card layout yaxshilash (katta tap target, toza ierarxiya)
- [x] `WarehousePage` header — mobile da kompakt, qulay
