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
4. Session token stored in `sessionStorage`; cleared on 401/403 responses

### Routing

Custom history-based routing — **not** React Router components. `App.tsx` maintains `currentPage` state:
- `resolvePageFromPath()` — maps URL path to page type
- `checkAccess(role, page)` — validates role-based permissions
- `applyRoute()` — syncs state + `window.history` + URL
- `popstate` listener handles browser back/forward

### API Layer (`src/api/`)

All HTTP via Axios (`src/api/apiClient.ts`) with interceptors that:
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