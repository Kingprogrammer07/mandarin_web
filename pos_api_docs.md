# POS Dashboard — Backend API Reference

> **Self-updating rule:** Whenever a new API call is added to `POSDashboard.tsx`, `src/api/pos.ts`, or any hook/component it imports, add the corresponding endpoint to this file before submitting the change.

All POS endpoints require `X-Admin-Authorization: Bearer <access_token>` unless noted otherwise.
Base URL prefix: `/api/v1`

---

## Payments

### Process Bulk Payment
| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/payments/process-bulk` |
| **Auth** | `X-Admin-Authorization` |
| **Source** | `src/api/pos.ts` → `processBulkPayment()` |

**Request body** (`BulkPaymentRequest`):
```json
{
  "items": [
    {
      "cargo_id": 123,
      "flight": "MOS-001",
      "client_code": "A12345",
      "paid_amount": 150000,
      "payment_type": "cash | click | payme | card",
      "use_balance": false
    }
  ],
  "cashier_note": "optional string or null"
}
```
`items` must contain 1–50 entries. All items succeed or the entire batch is rejected (atomic).

**Response** (`BulkPaymentResponse`):
```json
{
  "processed_count": 1,
  "total_paid": 150000,
  "results": [{ "cargo_id": 123, "transaction_id": 77, "paid_amount": 150000, ... }]
}
```

---

### Get Cashier Log
| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/payments/cashier-log` |
| **Auth** | `X-Admin-Authorization` |
| **Source** | `src/api/pos.ts` → `getCashierLog()` |

**Query params** (`CashierLogParams`):
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `size` | integer | 20 | Items per page |
| `date_from` | ISO date string | — | Filter start date |
| `date_to` | ISO date string | — | Filter end date |

**Response** (`CashierLogResponse`): paginated list of `CashierLogItem` entries plus `today_total` (sum of all amounts processed today in UTC).

---

### Adjust Client Balance
| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/v1/payments/adjust-balance` |
| **Auth** | `X-Admin-Authorization` (`pos:adjust` permission) |
| **Source** | `src/api/pos.ts` → `adjustBalance()` |

**Request body** (`AdjustBalanceRequest`):
```json
{
  "client_code": "A12345",
  "amount": 50000,
  "reason": "overpayment-refund"
}
```
`amount` is signed — positive = credit (client owes less), negative = debit (client owes more). Must be non-zero.

**Response** (`AdjustBalanceResponse`): includes `transaction_id`, `new_wallet_balance`.

---

### Get Random Active Payment Card
| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/payments/active-cards/random` |
| **Auth** | `X-Admin-Authorization` |
| **Source** | `src/api/pos.ts` → `getRandomActiveCard()` |

Returns a random active card for display during card-payment flows (`ActiveCardResponse`: `card_number`, `holder_name`, `bank_name`).

---

## Transactions

### Get Client Transactions (POS)
| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/transactions` |
| **Auth** | `X-Admin-Authorization` |
| **Source** | `src/api/pos.ts` → `getPOSClientTransactions()` |

**Query params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `client_code` | string | required | Target client |
| `filter_type` | `all \| taken \| not_taken \| partial \| pending` | `all` | Transaction filter |
| `sort_order` | `asc \| desc` | `desc` | Sort direction |
| `limit` | integer | 20 | Page size |
| `offset` | integer | 0 | Pagination offset |

**Response** (`TransactionsApiResponse`): paginated list of `Transaction` objects.

---

### Update Transaction Taken Status
| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/payments/pos/transactions/{transaction_id}/taken-status` |
| **Auth** | `X-Admin-Authorization` |
| **Source** | `src/api/pos.ts` → `posUpdateTakenStatus()` |

**Path param**: `transaction_id` — integer transaction ID.

**Request body**:
```json
{ "is_taken_away": true, "reason": "manual handover confirmed" }
```

**Response** (`PosTransactionUpdateResponse`): `{ success, transaction_id, message }`.

---

### Update Delivery Request Type
| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/payments/pos/transactions/{transaction_id}/delivery-request-type` |
| **Auth** | `X-Admin-Authorization` (`pos:update_status`) |
| **Source** | `src/api/pos.ts` → `posUpdateDeliveryRequestType()` |

**Request body**:
```json
{ "delivery_request_type": "uzpost|bts|mandarin|yandex", "reason": "operator correction" }
```

---

### Update Delivery Proof Method
| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/payments/pos/transactions/{transaction_id}/delivery-proof-method` |
| **Auth** | `X-Admin-Authorization` (`pos:update_status`) |
| **Source** | `src/api/pos.ts` → `posUpdateDeliveryProofMethod()` |

**Request body**:
```json
{ "delivery_proof_method": "uzpost|bts|mandarin|yandex|self_pickup", "reason": "operator correction" }
```

---

## Verification

### Search Clients
| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/verification/search` |
| **Auth** | Standard `Authorization: Bearer` (Telegram user token) |
| **Source** | `src/api/verification.ts` → `searchClients()` |

**Query params**:
| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (client code, name, phone) |

Returns a list of matching client summaries used to populate the POS search dropdown.

---

### Get Client Unpaid Cargo
| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/verification/{client_code}/cargo/unpaid` |
| **Auth** | Standard `Authorization: Bearer` (Telegram user token) |
| **Source** | `src/api/verification.ts` → `getUnpaidCargo()` |

**Path param**: `client_code` — string client identifier.

Returns an array of unpaid cargo items for the given client. Each item includes `cargo_id`, `flight`, `total_payment`, `remaining_amount`, and wallet/balance info used to build the bulk payment request.

---

### Get Client Profile
| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/v1/verification/{client_code}` |
| **Auth** | Standard `Authorization: Bearer` (Telegram user token) |
| **Source** | `src/api/verification.ts` → `getClientProfile()` + `normalizeClientProfile()` |

**Path param**: `client_code` — string client identifier.

Returns extended client profile data displayed in `ClientProfileDrawer`: `phone`, `passport_series`, `region`, `transaction_count`, `referral_count`, wallet balance, and other stats.

---

## Auth Notes

| Header | Used by | Token source |
|---|---|---|
| `X-Admin-Authorization: Bearer <token>` | All `pos.ts` functions | `localStorage.getItem('access_token') \|\| sessionStorage.getItem('access_token')` |
| `Authorization: Bearer <token>` | `verification.ts` functions | Injected by `apiClient` Axios interceptor (same storage priority) |

Admin tokens are stored in `localStorage`; regular Telegram user tokens use `sessionStorage`. Since the `apiClient` interceptor checks `localStorage` first, admin-authed users can call `verification.ts` endpoints without any special wrapper.
