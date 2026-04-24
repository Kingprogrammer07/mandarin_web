# Objective
Align POS and admin audit frontend with backend verification/POS updates: support new transaction enrichment fields and new single-cargo update endpoints from `POSDashboard.tsx`, plus reflect new audit log events in `AdminAuditLogsPage.tsx`.

# Implementation Plan
- [x] Inspect `POSDashboard.tsx` and related API services (`src/api/pos.ts`, verification/payment services) for current payload/response contracts.
- [x] Add/update API methods and strict types for new POS update endpoints (taken status, delivery request type, delivery proof method).
- [x] Wire `POSDashboard.tsx` to use new endpoints and show/update new fields (`delivery_request_type`, `delivery_proof_method`) with required reason handling.
- [x] Update `AdminAuditLogsPage.tsx` mappings/UI so new POS audit actions render meaningful labels/details.
- [x] Run lint checks for edited files.

# Walkthrough/Architecture
1. Backend now enriches transaction data with delivery fields and centralizes status resolution.
2. POS UI should call dedicated update endpoints instead of overloading one mutation, while always passing mandatory reason.
3. Audit page should decode new action names so operators can trace who changed cargo taken status, request type, and proof method.
