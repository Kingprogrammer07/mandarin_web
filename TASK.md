# Objective

Add guided onboarding for saved-card binding/payment usage and render a QR code on the referral page, with strict TypeScript-safe i18n support.

# Implementation Plan

- [x] Add card-binding tour targets and `useGuideTour` wiring in `SavedCardsPage`.
- [x] Add saved-card payment tour wiring in `MakePaymentModal` only on the existing saved-card selector.
- [x] Install and use `qrcode` for referral invite QR rendering.
- [x] Add nested Uzbek and Russian tour translations without touching existing tour controls.
- [x] Verify TypeScript and lint behavior for the changed frontend code.

# Walkthrough / Architecture

`SavedCardsPage` and `MakePaymentModal` use the existing `useGuideTour` hook, which delegates one-time behavior to `runTourOnce` and localStorage. Tour steps target stable `data-tour` attributes and only run when the matching UI is rendered. `ReferralPage` derives a QR image URL from `inviteLink` in an effect and renders it in a white rounded container for dark-mode readability.
