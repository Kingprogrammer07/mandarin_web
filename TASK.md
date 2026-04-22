# Objective
Refactor `DeliveryRequestModal.tsx` and `DeliveryRequestPage.tsx` based on the architectural review, implement rate limiting (429 error) handling for delivery requests, and add an address confirmation step before submission.

# Implementation Plan
- [x] Create `TASK.md`
- [x] Investigate `apiClient` or `deliveryService.ts` to understand how API errors are structured (to properly type-cast and handle 429 status codes).
- [x] Update `DeliveryRequestPage.tsx`:
  - Handle `429 Too Many Requests` error gracefully and show the backend's error message.
  - In Step 3 (both Standard and Uzpost), display the user's current address.
  - Add an address confirmation prompt ("Manzilingiz to'g'rimi?").
  - Add an "Edit Address" button that triggers `onNavigateToProfile()`.
  - Refactor state/error handling slightly to align with best practices without changing core logic.
- [x] Update `DeliveryRequestModal.tsx`:
  - Handle `429` error gracefully.
  - Fix `client_id` fallback bug.
  - Move constants to the top or outside the component.
  - Improve Telegram WebApp type safety.

# Walkthrough / Architecture
1. **API Error Handling**: We will inspect how `axios` errors are propagated. Usually, `err.response.status` and `err.response.data.detail` contain the FastAPI error details. We will safely extract this to show the rate limit warning.
2. **Address Confirmation**: Since the backend `/request/standard` and `/request/uzpost` endpoints use the `client` dependency to get the address, the frontend cannot submit a new address directly in the delivery payload. Therefore, the "Edit Address" action must direct the user to update their profile. We will add a visually distinct address confirmation box in Step 3.
3. **Refactoring**: Minor refactoring to address the Senior Architect review points (avoiding magic strings, ensuring type safety) without rewriting the fundamental state management, strictly adhering to the "do not change core logic" constraint.
# Objective (Dashboard Buttons Redesign)
Improve the UI/UX design of the To'lov and Zayavka buttons on the Dashboard to provide a premium wow effect while maintaining high performance.

# Implementation Plan
- [x] Analyze the current Dashboard.tsx implementation of the two buttons.
- [x] Upgrade button designs using Tailwind CSS for high-performance glassmorphism, animated gradients, and interactive hover states.
- [x] Apply a sweeping shine effect, glowing ambient orbs, and bouncing icons to make them highly appealing.
