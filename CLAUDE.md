# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript compile + Vite build
npm run lint       # ESLint check
npm run preview    # Preview production build locally
```

No test suite is configured.

# PRIVACY
PRIVACY AND SECURITY IS IMPORTANT!

## Architecture

**Telegram Mini App** for cargo/shipping management. Users interact with it inside Telegram; the app validates Telegram `initData` on every request.

### Entry & Auth Flow

1. `src/main.tsx` → renders `<App />`
2. `TelegramWebAppGuard` wraps the app — validates Telegram context, attempts auto-login with `initData`
3. `App.tsx` checks token validity (`/auth/me`), loads user role, and resolves the initial route
4. Token storage is **split by role**, both keyed `access_token`: admin → `localStorage` (plus `admin_role`), user → `sessionStorage`. Never mix them. Cleared on 401/403 responses.

### Routing

Custom history-based routing — **not** React Router components. `App.tsx` maintains `currentPage` state:
- `resolvePageFromPath()` — maps URL path to page type
- `checkAccess(role, page)` — validates role-based permissions
- `applyRoute()` — syncs state + `window.history` + URL
- `popstate` listener handles browser back/forward

### API Layer (`src/api/`)

All HTTP via Axios (`src/api/client.ts`) with interceptors that:
- Attach `Authorization: Bearer <token>` header
- Attach Telegram `initData` header
- Attach `Accept-Language` from i18next
- On 401/403: clear session, dispatch logout event

Domain services live in `src/api/services/` (auth, cargo, flights, payments, stats, admin, etc.).

### State Management

- **TanStack Query** — server/API state, caching, background refetch
- **Zustand** — client UI state
- **React Hook Form + Zod** — form state and validation

### User Roles & Access

`user` → home, profile, history, reports
`worker` → flight and cargo management
`accountant` → client/transaction verification
`admin` / `super-admin` → full access including user and role management

Admin pages live in `src/pages/admin/` and `src/components/admin/`.

### Internationalization

i18next with Uzbek (`uz`) and Russian (`ru`) locales in `src/i18n/`. Language is sent as `Accept-Language` header on every API request.

### Offline Support

IndexedDB via `idb` library (`src/utils/`) caches cargo data for offline use.

### UI Stack

- **Tailwind CSS 4** + **Radix UI** primitives
- Shadcn-style wrappers in `src/components/ui/`
- **Framer Motion** for animations, **Sonner** for toasts, **Recharts** for stats charts
- **Eruda** for in-browser dev console on mobile

### Design tokens (`--mc-*`)

The client (user) side runs on one token set defined in `src/index.css` — `:root`
for light, `.dark` for dark — exposed to Tailwind through `@theme inline`.

- Colour: `bg-mc-surface`, `bg-mc-surface-2`, `bg-mc-bg`, `border-mc-border`,
  `text-mc-text` / `-text-2` / `-text-3`, `mc-brand` / `-strong` / `-soft`,
  `mc-danger` / `mc-warn` / `mc-success` (+ `-soft`), `mc-cardface` (a bank-card
  graphic: fixed dark in both themes).
- Radius: `rounded-mc-sm|md|lg|xl` (10 / 14 / 18 / 22px). **Nothing else** — an
  arbitrary `rounded-[22px]` is a mistake, the scale already has it.
- Elevation: `shadow-[var(--mc-shadow-card)]`, `shadow-[var(--mc-shadow-cta)]`.
- Type scale in use: 16–17px `font-extrabold` titles, 15px card titles, 13px
  rows, 12px body, 11px meta, 10px uppercase labels. `font-black` is not part
  of it.

**Two tones per semantic hue.** `--mc-brand` fills buttons and dots; `.text-mc-brand`
is rebound (unlayered, bottom of `index.css`) to `--mc-brand-text`, which is dark
enough to clear 4.5:1 on a light card. Same for danger / warn / success. A filled
button pairs its fill with `text-mc-on-<hue>` — never a bare `text-white`, which
sits at 2.3–2.6:1 on brand orange and success green.

Never write a raw palette class (`bg-gray-50`, `text-orange-600`) on a client
screen, and never a `dark:` variant of a token — the token already swaps.

### iOS-first (mandatory for every UI change)

The client is a Telegram Mini App; the majority of it is opened inside
**WKWebView on iPhone**. Treat iOS Safari as the target, not as an edge case.

1. **Inputs never below 16px.** `font-size < 16px` makes Safari zoom the page on
   focus and it does not zoom back on blur — the whole layout stays magnified.
   Applies to `<input>`, `<textarea>`, `<select>`.
2. **`dvh`, never `vh`.** `100vh` is the height with the browser chrome hidden,
   so a `min-h-screen` page is always taller than the visible area. Use
   `min-h-dvh` / `max-h-[92dvh]`.
3. **Safe areas.** Anything fixed to the bottom pads with
   `env(safe-area-inset-bottom)`; content above it clears
   `calc(var(--mc-nav-h) + env(safe-area-inset-bottom))`.
4. **No `hover:` as the only affordance.** iOS fires hover once on tap and then
   leaves it stuck. A control revealed by `group-hover` is invisible on a phone.
   Use `active:scale-*` for press feedback.
5. **Touch targets ≥ 44×44pt** (Apple HIG), ≥ 8px apart.
6. **Scrolling.** The scroll container is an inner element with
   `overflow-y-auto overscroll-contain`, never `body`. Bottom sheets are
   `flex flex-col` with a `shrink-0` header and a `min-h-0 flex-1` body — never a
   `calc(90vh - 73px)` guess at the header height.
7. **Modals** lock body scroll, close on `Escape`, and carry `role="dialog"`,
   `aria-modal` and `aria-labelledby`.
8. Platform resets (`-webkit-text-size-adjust`, `-webkit-tap-highlight-color`,
   `touch-action: manipulation`, `appearance: none`) live in `@layer base` of
   `src/index.css` — do not repeat them per component.

### 320px is the floor — every screen, admin included

**Every screen must work down to 320px CSS width.** Not "degrade acceptably" —
work: no content clipped, no control unreadable, no horizontal page scroll.
320px is an iPhone SE 1, 360px is the common Android, 390px a current iPhone.
Check all three before calling a screen done.

This applies to the **admin panel and the staff consoles too**, not just the
client Mini App. Staff open `/flights` and `/kassa` on their phones, and a flight
name that is cut off is a broken control, not a cosmetic complaint.

**Checking for horizontal overflow does not find these bugs.** An ancestor
usually clips the content, so `document.documentElement.scrollWidth` matches the
viewport and the page looks fine to any "does it scroll sideways" test. The
signal that actually finds it is, for every element:

```js
const cs = getComputedStyle(el)
el.scrollWidth > el.clientWidth + 1          // content is wider than the box
&& !['auto', 'scroll'].includes(cs.overflowX)  // and it is not a scroller
// …but a WORKING ellipsis truncate reports exactly the same thing — that is how
// text-overflow draws the "…". Only count it when the box has been squeezed so
// hard the label stops being readable:
&& !(cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && el.clientWidth >= 56)
```

That last clause matters. Without it the probe flags every healthy truncate and
buries the real defects: a first pass on `/admin/dashboard` reported 33 hits, of
which 32 were ellipses doing their job and **one** was a genuine clip.

The failure that actually hurts is a `truncate` **flexed to near-zero width**.
On `/flights` the board row packed 348px of fixed columns — grip, status chip,
track count, reorder, switch — into the 236px a 320px phone gives it, so the
flight name (`flex-1 min-w-0 truncate`) resolved to width **0** and the label of
the visibility switch rendered as nothing at all. The owner's report was literal:
"reys nomlari ko'rinmagan, qaysini faol qilishni hech kim bilmaydi". Adding
`min-w-0` further down cannot fix that — the fixed siblings have to wrap or
shrink first.

The other recurring cause is a **native control with an intrinsic minimum**:
`<input type="date">` renders ~139px wide and will not go smaller, so two of
them side by side need 342px and cannot fit a phone at any font size that
respects the 16px input floor. Change the layout (stack them, or collapse the
range into one control) rather than fighting the widget.

Never truncate a **number or an identifier**: a clipped `245 915 810,91 so'm`
reads as a different, wrong amount. Wrap it, scale it responsively, or abbreviate
with the full value in `title` — but never show a partial figure as if whole.

### Path Alias

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

## AI Developer Guidelines (Senior/Pro Level)

When writing or refactoring code in this repository, you MUST act as a Senior Backend/Frontend Architect and strictly adhere to the following standards:

1. **Self-Documenting Code**:
    - Write clear, readable, and modular code (SOLID principles).
    - Variables and function names must be highly descriptive. The logic should explain itself.
    - Use inline comments ONLY to explain _WHY_ a specific technical decision was made, never _WHAT_ the code is doing.

2. **Strict Typing & Docstrings**:
    - **Python**: 100% type hinting is required (`-> str`, `list[int]`, etc.). Use clear Docstrings for all endpoints, complex functions, and classes.
    - **TypeScript**: Strict typing is mandatory. Never use `any`. Always define proper `interfaces` and `types`.

3. **Linting & Formatting Compliance**:
    - Python code must pass `make lint` (Ruff formatting and checks) flawlessly.
    - No unused imports, no unused variables.
    - Ensure clean, PEP-8 compliant structures.

4. **Defensive Programming & Error Handling**:
    - Anticipate edge cases. Always handle `None`, `null`, or `undefined` gracefully (e.g., using optional chaining `?.` or explicit checks).
    - Never use bare `except:` blocks. Catch specific exceptions and log them properly using the structured logger.
    - Use correct HTTP status codes (400, 401, 403, 404, 409, 422) with descriptive error messages in APIs.

5. **Performance & Architecture**:
    - Avoid N+1 query problems in SQLAlchemy (use `selectinload` or `joinedload` appropriately).
    - Write non-blocking, purely asynchronous code (`async/await`).
    - Use Redis caching for heavy read operations and ensure proper cache invalidation.

## Task Planning & Execution (TASK.md)

Whenever I give you a new feature request or a complex task, you MUST act as a Tech Lead and manage the workflow using a file named `TASK.md` in the root directory.

Before writing or modifying any source code, you must:
1. Create or overwrite `TASK.md`.
2. Write a clear **Objective** (what we are trying to achieve).
3. Draft a strict **Implementation Plan** using markdown checkboxes (e.g., `- [ ] Step 1`, `- [x] Step 2`).
4. Write a brief **Walkthrough/Architecture** section explaining how the components will interact.

As you complete each step of the plan, you MUST update `TASK.md` (checking off the boxes). If the plan changes due to errors or new requirements, update the document to reflect the reality. 

This file will serve as our shared "living memory" and progress tracker.