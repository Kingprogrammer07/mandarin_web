# Objective
Require operators to confirm or update the client delivery address before submitting a delivery request from `DeliveryRequestModal`, while avoiding repeated prompts after confirmation during the same browser session.

# Implementation Plan
- [x] Inspect the current delivery request modal, profile payload shape, and available client update API.
- [x] Add session-scoped address confirmation state and auto-open the existing client edit UI when confirmation is missing.
- [x] Add an explicit save/confirm action that persists the current address/profile fields before enabling delivery request submission.
- [x] Disable delivery submission and show clear helper text until the address has been saved/confirmed.
- [x] Verify TypeScript/lint/build behavior for the touched code.
- [x] Move the newly added modal copy into Uzbek and Russian locale files and wire the component to i18next.

# Walkthrough/Architecture
`DeliveryRequestModal` already owns the editable client delivery fields used in the delivery request payload. The modal will now treat those fields as an address confirmation gate: when opened, it checks a per-client `sessionStorage` flag, opens edit mode if the address is not confirmed this session, and blocks the request button. The operator saves the current full name, phone, region, district, and address through the existing client update API; once that succeeds, the same form values are both the profile snapshot and the delivery request snapshot.
