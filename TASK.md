# Objective

Apply the backend POS cashier-log filtering changes to the frontend POS dashboard so cashiers can filter log rows by date range and payment provider.

# Implementation Plan

- [x] Update POS API types to include `payment_provider` request filtering and the new `summary` response payload.
- [x] Add POS dashboard state for cashier-log date/provider filters and wire those values into the TanStack Query key/request.
- [x] Add a compact cashier-log filter UI in the POS dashboard sidebar with clear/reset behavior.
- [x] Validate the change with the repository build/lint commands where feasible.

# Walkthrough/Architecture

`POSDashboard` owns the visible cashier-log filters because they are UI-only controls for the sidebar log. The component passes normalized query params to `getCashierLog`, which forwards them to `GET /api/v1/payments/cashier-log`. The query key includes the active filter values so TanStack Query caches and refetches each filtered view correctly. The API layer stays as the typed boundary for provider names and the backend summary response shape.

# Verification

- `node_modules\.bin\tsc.cmd -b` passed.
- `npx.cmd eslint src\api\pos.ts src\pages\POSDashboard.tsx` passed.
- `npm.cmd run build` passed when run outside the sandbox after sandboxed esbuild process spawning failed with `EPERM`.
- Full `npm.cmd run lint` still has pre-existing repository issues outside the touched POS files.
