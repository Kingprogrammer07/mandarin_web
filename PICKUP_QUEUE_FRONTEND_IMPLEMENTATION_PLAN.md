# Pickup Queue Frontend Implementation Plan

## Context

Backend now exposes pickup queue endpoints for:

- POS/cashier creating a queue during bulk payment.
- POS/cashier creating a queue manually for already-paid/partial-paid cargo.
- Warehouse creating a queue manually in special cases.
- Warehouse bell count and grouped queue list.
- TV display activation and read-only status board.

This frontend repo is React + Vite + TypeScript, using:

- `axios` API client in `src/api/client.ts`
- API modules such as `src/api/pos.ts` and `src/api/services/warehouse.ts`
- React Query hooks in `src/api/hooks/useWarehouse.ts`
- Zustand stores in `src/store`
- POS screen in `src/pages/POSDashboard.tsx`
- Warehouse screen in `src/pages/admin/WarehousePage.tsx`
- Warehouse grouped list component in `src/components/warehouse/GroupedTransactionsList.tsx`

Implement the frontend in small, typed slices. Keep API contracts in API modules, UI state in page/components, and server state in React Query.

## Backend API Contract

### Pickup Methods

```ts
type PickupMethod = "self_pickup" | "yandex" | "bts" | "uzpost" | "mandarin";
```

Labels:

- `self_pickup`: `O'zi olib ketadi`
- `yandex`: `Yandex`
- `bts`: `BTS`
- `uzpost`: `UzPost`
- `mandarin`: `Mandarin`

### Queue Status

```ts
type PickupQueueStatus = "preparing" | "ready" | "cancelled" | "expired";
```

UI labels:

- `preparing`: `Tayyorlanmoqda`
- `ready`: `Tayyor`
- `cancelled`: `Bekor qilingan`
- `expired`: `Muddati o'tgan`

### Priority

```ts
type PickupQueuePriority = "vip" | "high" | "normal";
type PickupQueuePriorityFilter = PickupQueuePriority | "all";
```

Labels:

- `vip`: `VIP`
- `high`: `Yuqori`
- `normal`: `Oddiy`

Warehouse UI must display and filter by priority. Use `PickupQueuePriorityFilter` only in UI state; API requests should omit `priority` when the filter is `all`. The queue panel priority filter should default to `all` / `Barchasi` so staff see every new queue first. TV must not display priority.

## Endpoints To Add

### POS Bulk Payment Add-on

Existing:

`POST /api/v1/payments/process-bulk`

Extend request body:

```ts
interface BulkPaymentRequest {
  items: BulkPaymentItem[];
  cashier_note: string | null;
  create_pickup_queue?: boolean;
  pickup_method?: PickupMethod | null;
  pickup_priority?: PickupQueuePriority;
  pickup_note?: string | null;
  pickup_idempotency_key?: string | null;
}
```

Important:

- If `create_pickup_queue` is true, `pickup_method` is required.
- Backend may return HTTP 409 if selected transactions are already in an active queue.
- Show a clear cashier-facing message when 409 happens and do not show "payment successful".

### POS Manual Create

`POST /api/v1/pos/pickup-queue`

Request:

```ts
interface PickupQueueCreateRequest {
  transaction_ids: number[];
  pickup_method: PickupMethod;
  priority?: PickupQueuePriority;
  note?: string | null;
  idempotency_key?: string | null;
}
```

Use this when cargo is already paid/partial-paid and cashier only needs to send "prepare cargo" to warehouse.

### Warehouse Manual Create

`POST /api/v1/warehouse/pickup-queue`

Same request shape as POS manual create.

Use only for warehouse special cases. Backend allows paid/partial transactions.

### Warehouse Bell Count

`GET /api/v1/warehouse/pickup-queue/count?status=preparing`

Optional:

- `pickup_method=self_pickup|yandex|bts|uzpost|mandarin`

Response:

```ts
interface PickupQueueBellCountResponse {
  preparing_count: number;
  priority_counts: Record<string, number>;
}
```

Count is per queue/client request, not per cargo.

### Warehouse Grouped Queue List

`GET /api/v1/warehouse/pickup-queue`

Query params:

```ts
interface WarehousePickupQueueListParams {
  status?: PickupQueueStatus; // default preparing
  pickup_method?: PickupMethod; // default self_pickup
  priority?: PickupQueuePriority; // omit for all
  client_code?: string; // optional server-side search inside queue panel
  order_by_time?: "asc" | "desc";
  page?: number;
  size?: number;
}
```

Response currently returns:

```ts
interface WarehousePickupQueueListResponse {
  page: number;
  size: number;
  total: number;
  items: WarehousePickupQueueEntry[];
}
```

Entry shape:

```ts
interface WarehousePickupQueueEntry {
  queue_id: number;
  display_number: number;
  business_date: string;
  client_code: string;
  pickup_method: PickupMethod;
  queue_status: PickupQueueStatus;
  priority: PickupQueuePriority;
  note: string | null;
  cargo_count: number;
  remaining_cargo_count: number;
  ready_count: number;
  created_at: string;
  ready_at: string | null;
  expires_at: string;
  flights: WarehousePickupQueueFlight[];
}

interface WarehousePickupQueueFlight {
  flight_name: string;
  flight_cargo_photos: string[];
  transactions: WarehousePickupQueueTransaction[];
}

interface WarehousePickupQueueTransaction {
  id: number;
  qator_raqami: number;
  vazn: string;
  summa: number | null;
  payment_status: string | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  is_taken_away: boolean;
  taken_away_date: string | null;
  selected_in_queue: true;
}
```

### Single Queue Read

`GET /api/v1/warehouse/pickup-queue/{queue_id}`

Use for detail drawer/modal if needed.

### Cancel Queue

`POST /api/v1/pickup-queue/{queue_id}/cancel`

Request:

```ts
interface PickupQueueCancelRequest {
  reason?: string | null;
}
```

Cashier can cancel own queues. Superadmin can cancel all. Warehouse should not show cancel button.

### TV Activate

`POST /api/v1/pickup-queue/tv/activate`

Requires admin auth and `pickup_queue:tv` permission. The `passcode` must match backend env `PICKUP_QUEUE_TV_PASSCODE`; current expected value is `1234`.

Request:

```ts
interface PickupQueueTVActivateRequest {
  passcode: string;
}
```

Response:

```ts
interface PickupQueueTVActivateResponse {
  token: string;
  expires_at: string;
}
```

Store token in `localStorage` with expiry metadata.

Errors:

- `401 invalid TV passcode`: show `TV kodi noto'g'ri` and keep the activation form open.
- `401/403 admin auth or permission`: show a clear admin permission/login message; do not try Telegram init-data validation.

### TV List

`GET /api/v1/pickup-queue/tv`

Headers:

```http
X-TV-Token: <token-from-activate>
```

Query params:

```ts
interface PickupQueueTVParams {
  status?: "preparing" | "ready";
  pickup_method?: PickupMethod;
  date_from?: string;
  date_to?: string;
  order_by_time?: "asc" | "desc";
  limit?: number;
}
```

Response:

```ts
interface PickupQueueTVResponse {
  items: PickupQueueTVItem[];
}

interface PickupQueueTVItem {
  display_number: number;
  client_code: string;
  flight_names: string[];
  pickup_method: PickupMethod;
  status: "preparing" | "ready";
  cargo_count: number;
  remaining_cargo_count: number;
  created_at: string;
  ready_at: string | null;
}
```

TV must not display note, priority, phone, name, or admin IDs.

## File Changes

### 1. Add Shared Types

Create:

`src/api/pickupQueue.ts`

Include:

- all `PickupMethod`, `PickupQueueStatus`, `PickupQueuePriority` types
- request/response interfaces
- label maps
- endpoint functions

Functions:

```ts
createPosPickupQueue(data)
createWarehousePickupQueue(data)
getWarehousePickupQueueCount(params)
getWarehousePickupQueueList(params)
getWarehousePickupQueue(queueId)
cancelPickupQueue(queueId, data)
activatePickupQueueTV(data)
getPickupQueueTV(params, token)
```

Use existing admin header pattern from `src/api/pos.ts`.

### 2. Extend POS API Types

Update:

`src/api/pos.ts`

Add optional pickup queue fields to `BulkPaymentRequest`.

Also handle 409 duplicate response in the UI layer. Do not swallow it in API function.

### 3. Add React Query Hooks

Create:

`src/api/hooks/usePickupQueue.ts`

Hooks:

- `useWarehousePickupQueueCount`
- `useWarehousePickupQueueList`
- `useCreatePosPickupQueue`
- `useCreateWarehousePickupQueue`
- `useCancelPickupQueue`
- `useActivatePickupQueueTV`
- `usePickupQueueTV`

Query keys:

```ts
export const pickupQueueKeys = {
  count: (params) => ["pickup_queue", "count", params] as const,
  warehouseList: (params) => ["pickup_queue", "warehouse_list", params] as const,
  detail: (id) => ["pickup_queue", "detail", id] as const,
  tv: (params) => ["pickup_queue", "tv", params] as const,
};
```

Polling:

- Bell count: refetch every 2-3 seconds while Warehouse page is open.
- Warehouse list: refetch every 3-5 seconds or invalidate after mark-taken.
- TV list: refetch every 2-3 seconds.

### 4. POS UI Updates

Update:

`src/pages/POSDashboard.tsx`

Add a compact pickup queue control near the bulk payment action area:

- Toggle: `Warehousega yuborish`
- Pickup method select, visible when toggle is on.
- Priority select, visible when toggle is on.
- Optional note input, visible when toggle is on.

Default pickup method:

- `self_pickup`

When cashier submits bulk payment:

- If toggle is on, send:
  - `create_pickup_queue: true`
  - `pickup_method`
  - `pickup_priority`
  - `pickup_note`
  - `pickup_idempotency_key`

Generate idempotency key per user submit attempt:

```ts
const idempotencyKey = crypto.randomUUID();
```

Keep it stable during the request; regenerate after success or reset.

UX:

- Disable submit while request is pending.
- On success with pickup queue enabled, toast:
  - `To'lov qabul qilindi va warehousega yuborildi`
- On 409, show:
  - `Bu yuklar allaqachon navbatda`
  - include display number if response has it.

### 5. POS Manual Queue Flow

Add a button/action in the client transaction/profile drawer for already paid or partial transactions:

- `Warehousega yuborish`

Flow:

1. Cashier selects one or more transactions from the client's transaction list.
2. Opens small modal/sheet.
3. Chooses pickup method.
4. Chooses priority.
5. Optional note.
6. Submit `POST /api/v1/pos/pickup-queue`.

Validation:

- At least one transaction selected.
- All selected transactions should be same client in UI.
- Do not allow already taken transactions if visible.

### 6. Warehouse Bell UI

Update:

`src/pages/admin/WarehousePage.tsx`

Add bell button in header area:

- icon: `Bell` or `BellRing` from `lucide-react`
- badge: `preparing_count`
- if `preparing_count > 0`, badge should be visually noticeable.
- If `priority_counts.vip > 0` or `priority_counts.high > 0`, render the bell in a distinct urgent state: stronger color, pulse/ring animation, and separate small VIP/high count indicator.

Fetch:

`useWarehousePickupQueueCount({ status: "preparing" })`

Polling:

- 2 or 3 seconds.
- Start immediately when `WarehousePage` mounts. Do not wait for the bell to be clicked.

New queue alert:

- Track the previous `preparing_count` and `priority_counts` in component state/ref.
- When the count increases, play an audible signal.
- Browser autoplay policies require user activation, so initialize/unlock audio after the first user interaction on the warehouse page, and show a small muted/audio-off state if sound cannot play yet.
- Use a normal sound for `normal` queues.
- If any newly increased count is `vip` or `high`, use a louder/distinct urgent sound and make the bell visual more prominent.
- Do not play sound on the very first successful fetch after page load; only play when a later poll shows a real increase.
- Debounce/throttle sound so repeated polling cannot create overlapping audio spam.
- Add a mute/unmute control near the bell and persist the preference in `localStorage`.

Click behavior:

- Opens a full-screen queue panel/modal focused on pickup queues.
- Default selected pickup method: `self_pickup`.
- Default selected priority filter: `all` / `Barchasi`.
- Options:
  - `self_pickup`
  - `yandex`
  - `bts`
  - `uzpost`
  - `mandarin`
- Priority options:
  - `all` / `Barchasi` (omit `priority` from API params)
  - `vip`
  - `high`
  - `normal`

When method or priority changes:

- Fetch `GET /warehouse/pickup-queue?status=preparing&pickup_method=<method>&priority=<priority>` only when a concrete priority is selected.
- If priority is `all`, omit the `priority` query param.
- Keep method and priority filter controls visible at all times, including when the user enters the queue section from Warehouse filters.
- The pickup method control must not create horizontal page scroll. Use a wrapping segmented control, responsive grid, or contained horizontal scroll inside the control only; the page/body itself must remain `overflow-x: hidden`.

### 7. Warehouse Queue Panel

Create:

`src/components/warehouse/PickupQueuePanel.tsx`

Features:

- Method segmented/select control.
- Priority segmented/select control, default `all` / `Barchasi`.
- Client-code search input in the queue panel header. Send it as `client_code`.
- List of grouped queue entries.
- Each queue card shows:
  - `#display_number`
  - `client_code`
  - pickup method label
  - `remaining_cargo_count / cargo_count`
  - flight names
  - priority
  - note if present
  - created time / expires time

Each queue entry should expand into flights and transactions.

Flight images:

- Backend includes `flight_cargo_photos: string[]` on each flight.
- Render compact thumbnails for these URLs near the flight title or in the expanded flight section.
- Keep image loading lazy and non-blocking. Broken images should not break the queue row.
- Clicking a thumbnail opens a large image modal/lightbox.
- The modal should show the selected image large, preserve aspect ratio, have a clear close button, close on `Esc`/backdrop click, and support previous/next navigation when the flight has multiple images.
- Do not let the image modal interfere with mark-taken selection state.

Actions:

- For all not-taken transactions in a queue, call existing mark-taken bulk modal flow.
- Reuse `MarkTakenModal` where possible.
- Pass exact queue transaction IDs, not all client/flight transactions from search.

Important:

- Queue items are already selected by backend. Do not let the UI accidentally include other cargos from same client/flight.
- If some items are already taken, show them as done and only include remaining items in mark-taken action.

### 8. Adapt Existing Grouped List Carefully

Current `GroupedTransactionsList` expects `ClientGroup[]` with `flights`.

Pickup queue list response has a different top-level shape. Recommended:

- Do not force pickup queue data into `ClientGroup` if it loses queue metadata.
- Either:
  - create a dedicated `PickupQueuePanel`, or
  - extract reusable flight/transaction row subcomponents from `GroupedTransactionsList`.

Keep queue metadata visible in warehouse UI.

### 9. Invalidate After Mark Taken

Update existing mark-taken success handling in:

`src/api/hooks/useWarehouse.ts`

After successful mark-taken:

- invalidate `warehouse_grouped_transaction_search`
- invalidate `pickup_queue count`
- invalidate `pickup_queue warehouse_list`
- invalidate `pickup_queue detail` if used

This ensures bell count and queue list update immediately.

### 10. TV Page

Add route/page:

- path suggestion: `/pickup-tv`
- page file: `src/pages/PickupQueueTVPage.tsx`

Important existing fix:

- Remove Telegram-specific dependencies/assumptions from `PickupQueueTVPage.tsx`.
- TV authentication is only the backend TV activation token flow: activate with passcode `1234` / env `PICKUP_QUEUE_TV_PASSCODE`, store `{ token, expires_at }`, read with `X-TV-Token`.
- Do not require Telegram WebApp, Telegram user, Telegram init data, or Telegram-only layout logic for this page.
- Opening `http://localhost:5173/pickup-tv` must not call `POST /auth/validate-init-data`.
- If the app has a global Telegram auth provider/guard/interceptor, explicitly bypass it for `/pickup-tv`.
- Put `/pickup-tv` outside Telegram/admin protected route trees in `src/App.tsx`. If the root app currently validates Telegram init data on mount, add a route-aware skip for `/pickup-tv` before that validation runs.
- TV read requests should use the `X-TV-Token` flow and must not require Telegram init data.
- TV activation can use the existing admin token only if the backend endpoint requires admin permission. If no admin token is available and backend returns 401/403, show a clear activation/permission message; do not fallback to Telegram init-data validation.
- If activation returns `401` with `invalid TV passcode`, show an incorrect-code message and let the user retry.

Routing:

- Add page key in `src/App.tsx`.
- It can be outside admin layout if it is a full-screen TV view.

Activation state:

- If no valid token in localStorage, show activation screen:
  - passcode input
  - activate button
- On activation success:
  - store `{ token, expires_at }`
  - start TV list polling

TV layout:

- Full-screen dashboard.
- Two sections:
  - `Tayyorlanmoqda`
  - `Tayyor`
- Large display number.
- Client code.
- Cargo count.
- Flight names.
- Pickup method label.

Do not show:

- note
- priority
- full name
- phone
- admin info

Polling:

- 2-3 seconds.

Token expiry:

- If GET returns 401, clear token and return to activation screen.

### 11. Permissions / Navigation

POS users:

- show pickup controls if they have `pos:process` or `pickup_queue:create`.

Warehouse users:

- show bell if they have `warehouse:read`.
- show manual create if they have `pickup_queue:create` and warehouse flow needs it.
- do not show cancel button for warehouse.

Superadmin:

- can see cancel where appropriate.

TV:

- activation requires a logged-in admin with `pickup_queue:tv`.
- after activation, TV reads with `X-TV-Token`.

### 12. Error Handling

Handle these error cases:

- 409 duplicate active queue:
  - show existing display number/client/status if response includes it.
- 400 validation:
  - show backend detail.
- 401 TV token:
  - clear token and ask for passcode again.
- 401 invalid TV passcode during activation:
  - keep activation form open and show `TV kodi noto'g'ri`.
- Network failure:
  - keep previous list on screen if available.
  - show subtle offline state, not a blocking modal.

### 13. UX Details

POS:

- The pickup toggle should not make payment slower or confusing.
- Keep it near the final submit action.
- If toggle is off, existing flow should behave exactly as before.
- For already paid or partial-paid cargo in `POSDashboard`, add a clear `Warehousega yuborish` action so cashier can create a pickup queue without taking a new payment.

Warehouse:

- Bell count is compact.
- Panel/list is operational, dense, and scannable.
- Avoid marketing-style cards. Use compact rows/cards with clear counts and actions.
- Show the highest-signal fields: display number, client code, remaining count, method, flights.
- When the full-screen queue panel is open, hide or visually de-emphasize the main flight/client filters from the underlying warehouse search UI.
- Put client-code queue search in the panel itself.
- Pickup method and priority controls must be responsive and must not create body-level horizontal scrolling.
- New queue audio must be useful in a busy warehouse: normal queues get a clear short signal; VIP/high queues get a louder/distinct urgent signal and stronger bell styling. Respect mute preference.

TV:

- Big readable typography.
- No private data.
- Use high contrast.
- Avoid text overlap at TV resolution and mobile preview.
- Ready items can be highlighted more strongly than preparing.

### 14. Suggested Implementation Order

1. Add `src/api/pickupQueue.ts` types and API calls.
2. Extend `BulkPaymentRequest` in `src/api/pos.ts`.
3. Add `src/api/hooks/usePickupQueue.ts`.
4. Add pickup toggle/method/note to POS bulk payment submit flow.
5. Add POS manual create flow for selected paid/partial transactions.
6. Add warehouse bell count to `WarehousePage`.
7. Add `PickupQueuePanel`.
8. Wire mark-taken from queue panel using existing modal.
9. Invalidate pickup queue queries after mark-taken.
10. Fix current Warehouse queue UI regressions: method buttons must not disappear, bell count must poll before click, panel must be full-screen.
11. Add priority filtering with default `all` / `Barchasi`.
12. Add client-code search inside the queue panel.
13. Add image lightbox modal for `flight_cargo_photos`.
14. Add warehouse bell audio alerts with urgent VIP/high variant and mute persistence.
15. Add TV activation + TV board page, fully detached from Telegram init-data validation.
16. Add route/navigation for TV page.
17. Run `npm run build` and fix type errors.
18. Test with backend using realistic queue lifecycle.

### 15. Acceptance Checklist

- POS bulk payment can create pickup queue when toggle is on.
- POS bulk payment works unchanged when toggle is off.
- POS can manually create queue for selected existing transactions.
- Duplicate queue 409 is shown clearly.
- Warehouse bell count updates every 2-3 seconds.
- Bell count counts client queue requests, not cargos.
- Warehouse queue panel defaults to `self_pickup`.
- Warehouse queue panel priority filter defaults to `all` / `Barchasi`.
- Warehouse method filter works for all five pickup methods.
- Warehouse priority filter works for `vip`, `high`, `normal`, and `all`.
- Warehouse queue panel has client-code search and uses backend `client_code` query param.
- Warehouse queue panel opens full-screen and keeps method/priority filters visible.
- Pickup method controls do not cause horizontal page scrolling.
- Queue panel shows priority and note.
- Queue panel shows `flight_cargo_photos` thumbnails per flight.
- Clicking a cargo photo opens a large modal/lightbox with close and previous/next controls.
- Queue panel uses exact queued transaction IDs.
- Mark-taken updates queue progress and removes/reduces remaining items after refetch.
- Bell plays a normal sound when new normal queues arrive after initial load.
- Bell uses distinct urgent visual styling and louder/different sound when new `vip` or `high` queues arrive.
- Bell sound can be muted/unmuted and does not overlap repeatedly.
- TV activation stores token and reads with `X-TV-Token`.
- TV page does not depend on Telegram.
- Opening `/pickup-tv` does not call `/auth/validate-init-data`.
- TV hides note, priority, phone, name, admin IDs.
- TV handles token expiry cleanly.
- `npm run build` passes.

## Backend Fixes Already Covered

Backend has been adjusted for the frontend contract:

1. Concurrent queue creation returns 409 when Redis create lock is contended.
2. Display-number retry uses a savepoint and does not rollback the outer POS payment transaction.
3. Mark-taken queue refresh failures are not swallowed silently.
4. Queue duplicate lookup no longer uses SQL `DISTINCT` over JSON columns.
5. Warehouse queue list supports `client_code` search.
6. Warehouse queue list includes `flight_cargo_photos` per flight.
7. Priority supports `vip`, `high`, and `normal`.
8. TV activation validates `PICKUP_QUEUE_TV_PASSCODE`; current configured value should be `1234`.

QA should still include these cases with realistic concurrent/manual flows.
