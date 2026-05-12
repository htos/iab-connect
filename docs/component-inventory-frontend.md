# IAB Connect - Frontend Component Inventory

Date: 2026-05-12
Part: Frontend Web App

## Overview

The frontend component structure is compact but important. Most reusable components are in `frontend/src/components`, while feature-heavy pages live directly in the App Router route tree.

The 2026-05-12 rescan found 14 App Router route groups, 8 navigation components, 16 shared UI primitives, 1 provider component, 1 global search component, and 1 feature-level email template form component.

## Navigation Components

| Component | Path | Purpose |
| --- | --- | --- |
| `MainLayout` | `components/navigation/MainLayout.tsx` | Authenticated shell; bypasses login/auth/public routes |
| `Header` | `components/navigation/Header.tsx` | Top navigation/header for authenticated app |
| `Sidebar` | `components/navigation/Sidebar.tsx` | Role-aware and accounting-mode-aware sidebar navigation |
| `SidebarContext` | `components/navigation/SidebarContext.tsx` | Sidebar open/collapse state |
| `LanguageSwitcher` | `components/navigation/LanguageSwitcher.tsx` | Locale switching |
| `PublicHeader` | `components/navigation/PublicHeader.tsx` | Header for public pages |
| `PublicFooter` | `components/navigation/PublicFooter.tsx` | Footer for public pages |

## Provider Components

| Component | Path | Purpose |
| --- | --- | --- |
| `Providers` | `app/providers.tsx` | Session, QueryClient, Sidebar, AppSettings provider wrapper |
| `AppSettingsProvider` | `components/providers/AppSettingsProvider.tsx` | Application settings context |

## Search Components

| Component | Path | Purpose |
| --- | --- | --- |
| `GlobalSearch` | `components/search/GlobalSearch.tsx` | Header/global search UI backed by backend search API |

## Shared UI Primitives

Components under `frontend/src/components/ui`:

- `alert-dialog`
- `alert`
- `badge`
- `button`
- `card`
- `checkbox`
- `dialog`
- `dropdown-menu`
- `input`
- `label`
- `rich-text-editor`
- `select`
- `separator`
- `table`
- `tabs`
- `textarea`

These are the first place to look before creating new one-off UI controls.

## Feature Components

| Component | Path | Purpose |
| --- | --- | --- |
| `EmailTemplateForm` | `components/email-templates/EmailTemplateForm.tsx` | Email template editor form |
| `OnboardingBanner` | `components/OnboardingBanner.tsx` | Onboarding/profile-completion prompt |

## Route-Based Feature UI

Most feature UI is implemented directly in route `page.tsx` files under:

- `app/admin`
- `app/members`
- `app/(dashboard)/events`
- `app/communication`
- `app/documents`
- `app/finance`
- `app/profile`
- `app/public`
- `app/sponsors`
- `app/suppliers`

Route group file counts from the rescan:

| Route Group | Files |
| --- | ---: |
| `(dashboard)` | 5 |
| `admin` | 11 |
| `api` | 1 |
| `auth` | 1 |
| `board` | 2 |
| `communication` | 8 |
| `documents` | 1 |
| `finance` | 24 |
| `login` | 1 |
| `members` | 8 |
| `profile` | 1 |
| `public` | 9 |
| `sponsors` | 4 |
| `suppliers` | 4 |

This keeps feature pages close to routes, but repeated page patterns should be extracted when duplication becomes meaningful.

## Design System Rules

Follow `docs/13_frontend_design_standards.md`:

- Standard authenticated page layout
- orange-600 primary actions
- shared loading states
- search fields on list pages
- next-intl for UI text
- responsive Tailwind classes
- shared card/table/form/button styles

## Observations

- The component inventory is smaller than the route surface; many pages own their own UI.
- Some older code still uses manual SVG icons and blue links. New work should prefer lucide-react and orange primary styling.
- `Sidebar` is business-aware because it hides double-entry accounting navigation when the finance profile is not in DoubleEntry mode.
- Shared UI primitives exist but are not yet a full design system; apply them consistently for new work.

---

Generated using BMAD Method `document-project` workflow.

