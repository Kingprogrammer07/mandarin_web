# TASK.md — NBU Ecom Online Payment + Maintenance Mode Frontend Integration

## Objective 1 (Completed)
Integrate NBU online payment into the frontend: probe status → show NBU button in `MakePaymentModal` → call init (with `flight_name`) → redirect → handle success/failure return pages. Surface NBU in payment history breakdown.

## Objective 2 (Completed)
Add a maintenance-mode block screen for non-admin users, driven by the backend `/api/v1/system/maintenance-status` endpoint. Admin users see an amber banner instead of the block screen.

---

## Implementation Plan — NBU Payment

### A. New API service
- [x] Create `frontend/src/api/services/nbuPaymentService.ts`

### B. Success / Failure pages
- [x] Create `frontend/src/pages/payment/PaymentNbuSuccess.tsx`
- [x] Create `frontend/src/pages/payment/PaymentNbuFailure.tsx`

### C. Routing (`App.tsx`)
- [x] Add `payment_nbu_success` and `payment_nbu_failure` to `Page` union
- [x] Map paths in `resolvePageFromPath`
- [x] Treat as public pages

### D. `MakePaymentModal.tsx` modifications
- [x] Add NBU status probe + button + error handling

### E. Payment history — surface NBU column
- [x] Add `nbu` to `PaymentBreakdown` + render in `UserHistoryPage.tsx`

### F. i18n keys
- [x] Add `nbu` keys to uz.json and ru.json

---

## Implementation Plan — Maintenance Mode

### A. New API service
- [x] Create `frontend/src/api/services/systemService.ts`

### B. Block-screen component
- [x] Create `frontend/src/components/system/MaintenanceOverlay.tsx`

### C. Provider / hook
- [x] Create `frontend/src/hooks/useMaintenanceWatcher.ts`

### D. Wire into `App.tsx`
- [x] Call `useMaintenanceWatcher()` after auth ready
- [x] Conditionally render overlay or admin banner

### E. i18n keys
- [x] Add `maintenance` keys to uz.json and ru.json

### F. Verification
- [x] `npm run build` passes
- [x] `npm run lint` — no new errors

## Walkthrough / Architecture
### NBU
1. `MakePaymentModal` mounts → probes `nbu-status` → shows "Onlayn to'lov (NBU)" button when enabled.
2. Click → `nbuPaymentService.init({ flight_name })` → redirects to NBU payment URL.
3. NBU redirects back to `/payment/nbu/success?orderId=...` or `/payment/nbu/failure?orderId=...`.
4. Success page auto-redirects home after 8s.

### Maintenance Mode
1. `AppContent` calls `useMaintenanceWatcher()` which polls `/api/v1/system/maintenance-status` every 30s.
2. If `maintenance=true && is_admin=false` (and auth is ready) → full-screen `<MaintenanceOverlay />` blocks the UI.
3. If `maintenance=true && is_admin=true` → normal app + amber sticky banner at top.
4. If `maintenance=false` → app renders normally.
5. On query error → defaults to no maintenance (fail-open).
