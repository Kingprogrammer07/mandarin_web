# Objective

"Eski reysga tegilmasin": confirming an astatka (`O…` flight) bag of our own cargo stops moving anything off its source flight. Today a confirm re-files the bag's `flight_cargos` rows and track codes under the O name, so the old flight loses its photo report, the client sees the bag twice and cannot pay the real debt. After this change the source flight stays as it was and the astatka keeps its own record in `astatka_packages` (codes, typed weight, retaken photos, sent markers, a snapshot of the source row ids).

Owner rules: "boshqa reyslarning datasiga zarar yetmasin, faqat astatka". Nothing is ever written under an O name either. Weight and photo retakes go to the package only. O flights are edited only in the astatka window. Bags confirmed before the switch are put back on their source flights by a replay script (dry run first; the owner runs `--apply`).

Decided (card D1, 2026-10-16, "Yo'q, tegilmasin"): nothing at all is written to the old flight, neither its rows' `is_sent` flags nor a debt. The astatka's "Yuborish" only notifies the client and marks the astatka's own record (`sent_at` / `sent_web_at`); the payment stays with the old flight's own send.

# Implementation Plan

Backend (`mandarin_webhook_bot`)
- [x] Migration `c8e2a7d4f1b6` (after `f4a7c2e9b1d3`): `snapshot`, `sent_at`, `sent_web_at`, `own_photo_keys` + CHECK + partial index; downgrade refuses while data would be lost.
- [x] Model + DAO: `list_sendable`, `mark_sent` (conditional), `find_confirmed_holders` (alias + spelling overlap), `confirmed_own_holders_of_codes`, `list_legacy_moved`, `board_stats`, `unsent_by_flight`, `has_packages`.
- [x] `astatka_rows.py` leaf: `normalise`, `photo_ids`, `bag_weight`, `package_cargo_ids`, batched `bag_rows_many`.
- [x] Confirm writes only the package: read-only `_vet_track_codes` (R1-R6), snapshot of source row ids, none-shaped journal, overlap-aware duplicate guard. Code-list edits vetted, package-only.
- [x] Unconfirm: refused once the astatka sent the bag; legacy (moved) bags still restored by `astatka_legacy.unconfirm_legacy`.
- [x] Bag window: old flight's photo report read-only (scoped photo read, no Telegram refresh write); weight and photos on the package (`/packages/{id}/photos`).
- [x] `astatka_send.py`: send units from packages, `record_sent` (package markers only; no source flags, no debt).
- [x] Yuborish for O flights: web notification page and bot bulk sender / manual sent / web report read packages and never write `flight_cargos` / `client_transactions`.
- [x] Payments: O-flight guards on the paths that would create an O debt (notification debt, `write_flight_debts`, warehouse take-away of an O-named row).
- [ ] Deferred (not needed for the rule): warehouse search by the O name resolving the source payment rows; searching by the source flight already finds the bag.
- [x] Staff screens: flights board counts packages; O flights refuse photo uploads, expected-cargo edits, rename/delete; `/flights/{O}/export` uses the astatka export.
- [x] Replay script `scripts/astatka_unmove.py`: dry run by default, `--apply`; puts moved rows back, keeps sent state monotonic, reports what it leaves.
- [x] Tests: confirm leaves the other tables byte-identical; send marks only the package; replay; full suite with no new failures.

Frontend (`mandarin_web`)
- [x] Bag window: photo report read-only under "Eski reys (…) foto hisoboti — o'zgartirilmaydi"; new "Astatka rasmlari" block for package photos; scoped photo reads; "Astatkadan yuborilgan" badge; unconfirm copy ("Kutilmoqda bo'lib qoladi").
- [x] Flights board / CargoListPage / CommandPalette open O flights in the astatka window; ExpectedCargoPage shows a notice for O flights.
- [x] Yuborish page: "Unutilgan yuk" disabled for O flights.
- [ ] Deferred: warehouse "O-… astatkada" chip (needs the API field first).
- [x] `vitest` (730), `tsc -b`, `eslint` clean; bag window checked at 320/360/390/1280, light and dark, no clipped content.

# Walkthrough / Architecture

- `astatka_packages` is the only record of what an astatka holds. A package points at its source rows by `snapshot.cargo_ids` (plus legacy journal ids) and the client's aliases + source flight; readers use `astatka_rows.bag_rows_many`, so the window and the send read the same rows.
- `astatka_send.load_units` turns confirmed own packages into send units (typed weight or row weights, own photos or report photos, package track codes). Both send paths (web `flight_notifications` and the bot sender) call it for O flights and then `record_sent`, which flips `sent_at`/`sent_web_at` conditionally and writes nothing else.
- Everything outside the astatka that would write under an O name answers 409 with one shared sentence pointing to the astatka window.
- `astatka_legacy.py` holds the only code that still moves rows, for packages confirmed before the switch; the replay script empties it and a later cleanup deletes it.
