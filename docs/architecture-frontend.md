# IAB Connect - Frontend Architecture

Date: 2026-05-12
Part: Frontend Web App
Location: `frontend/`

## Purpose

The frontend is a Next.js application that provides the authenticated member/admin experience and public website pages. It consumes the backend API, authenticates through NextAuth/Keycloak, manages translations through next-intl, and applies Tailwind/Radix UI patterns.

## Architectural Style

The frontend uses Next.js App Router with feature routes under `frontend/src/app`. Shared components live under `frontend/src/components`, and cross-feature client code lives under `frontend/src/lib`.

Key frontend boundaries:

- `src/app`: route tree, page components, layouts, API route handlers
- `src/components/navigation`: authenticated shell, header, sidebar, public header/footer
- `src/components/ui`: shared UI primitives
- `src/components/providers`: global context providers
- `src/components/search`: global search UI
- `src/lib/api`: typed feature API wrappers
- `src/lib/services`: feature service helpers
- `src/lib/auth.ts`: auth hooks and API helper wrappers
- `src/types`: shared frontend DTO/type definitions
- `messages`: translation files

## Entry Points

- Root layout: `frontend/src/app/layout.tsx`
- Providers: `frontend/src/app/providers.tsx`
- Main shell: `frontend/src/components/navigation/MainLayout.tsx`
- Auth route: `frontend/src/app/api/auth/[...nextauth]/route.ts`
- Public layout: `frontend/src/app/public/layout.tsx`

## Layout and Navigation

Authenticated pages use `MainLayout`, which renders Header and Sidebar when authenticated. Public/login/auth routes bypass the authenticated shell.

The Sidebar is role-aware and includes module navigation for dashboard, profile, members, events, documents, communication, finance, partner management, and admin. Some finance menu items are controlled by double-entry accounting mode.

Public pages use a separate public layout/header/footer.

## State and Data Fetching

Global providers include:

- `SessionProvider` from next-auth
- `QueryClientProvider` from TanStack Query
- `SidebarProvider`
- `AppSettingsProvider`

The app contains both generic API helpers (`api-client.ts`, `auth.ts`) and feature-specific API modules under `src/lib/api` and `src/lib/services`. Existing code mixes helper usage and direct fetch calls; new work should prefer typed wrappers and consistent refresh patterns.

## Authentication and Authorization UX

`useAuth` exposes session state, roles, access token, and role helpers. Frontend role checks hide navigation and actions, but backend policies remain authoritative.

Known roles include:

- admin
- vorstand
- kassier
- auditor
- member

## Internationalization

The frontend uses next-intl. UI text should use translation keys and files under `frontend/messages`. Existing documentation states that UI text should be English by default with German translations available.

## UI and Styling

Styling uses Tailwind CSS 4 and shared UI components. Existing frontend design standards require:

- orange-600/orange-700 for primary actions and links
- authenticated page layout with gray background and max-width content containers
- search fields on list/table pages
- mobile-first responsive classes
- no hardcoded UI strings
- no new blue primary action styling

Radix primitives and lucide-react are available. Existing code still contains some manual SVGs and blue links; treat new work as an opportunity to align with standards.

## Route Surface

Major route areas:

- `/` dashboard
- `/login`, `/auth/*`
- `/admin/*`: audit, backups, documents, health, register, retention, settings, users
- `/members/*`: members and member segments
- `/events/*`: event management and registrations
- `/communication/*`: email campaigns and templates
- `/documents`, `/board/documents`
- `/finance/*`: dashboard, accounts, transactions, invoices, payments, dunning, receipts, fiscal periods, ledger, reporting, settings
- `/sponsors/*`, `/suppliers/*`
- `/profile`
- `/public/*`: blog, contact, events, newsletter, sponsors, unsubscribe

The 2026-05-12 rescan found 14 App Router route groups. The largest feature areas by file count are `finance`, `admin`, `public`, `members`, and `communication`.

## Testing Strategy

The frontend has Vitest, Testing Library, and Playwright configured, but visible test files are sparse. Add tests when changing shared UI, forms, auth-dependent rendering, routing, or critical workflows.

## Key Risks and Observations

- Some pages use direct `fetch` and inline refresh calls despite newer project rules favoring refresh-trigger state plus effects.
- Some UI still uses inline SVGs and blue links; new work should use lucide-react and orange primary styling.
- The route surface is broad; test coverage should be expanded around shared patterns and critical admin/finance/member workflows.
- Public and authenticated layouts are intentionally separate; avoid blending their navigation models.

---

Generated using BMAD Method `document-project` workflow.

