# Story 9.1: Extend SystemSettings and Add Branding Admin UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Admin**,
I want **to configure organization identity, branding, and contact information — including a logo upload — from the admin settings UI**,
so that **the platform reflects my organization without any code changes, and an unconfigured deployment keeps its current presentation until I change it**.

**Requirement:** REQ-086 (Generic Positioning & White-Label Branding) — PRD-native. Epic E9, Story 1 of 4.
**Epic goal:** Make organization identity and branding admin-configurable and remove hardcoded organization references from user-visible surfaces. The single-tenant architecture is preserved.
**This story is the foundation of E9** — stories E9-S2 (frontend de-branding), E9-S3 (backend de-branding) and E9-S4 (i18n generalization) all render from the `SystemSettings` fields and the `AppSettings` provider that THIS story creates. Build the data model + provider correctly here or the whole epic wobbles.

## Acceptance Criteria

1. **Entity extended.** `SystemSettings` (`backend/src/IabConnect.Domain/Common/SystemSettings.cs`) gains these new fields, all **nullable**, all with private setters: `Description` (string?), `ContactEmail` (string?), `ContactPhone` (string?), `ContactAddress` (string?), `PrimaryColor` (string?), `PublicSiteEnabled` (bool?), `LogoAssetKey` (string?).
2. **Behavior-preserving migration.** One EF Core migration adds the corresponding nullable columns to `system_settings`. The existing single `system_settings` row (and `SystemSettings.CreateDefault()`) remains valid with every new field `NULL`. No data backfill. `dotnet ef database update` on a populated DB does not error and changes no existing column.
3. **Explicit update method.** A new `UpdateOrganizationProfile(...)` method on the entity sets the seven extended fields, following the existing private-setter + explicit-method invariant pattern (mirror `UpdateBranding`). Validation: when a value is non-null/non-blank it is trimmed and format-checked (email shape for `ContactEmail`, hex shape for `PrimaryColor`); `null`/blank is allowed and clears the field. `UpdatedAt`/`UpdatedBy` are stamped.
4. **Admin read/write exposure.** `GET /api/v1/settings` and `PUT /api/v1/settings` (admin-only, unchanged auth) return and accept the seven new fields in addition to the existing four branding fields. `UpdateSettings` calls both `UpdateBranding(...)` and `UpdateOrganizationProfile(...)`.
5. **Public read exposure (non-sensitive subset only).** `GET /api/v1/settings/public` (anonymous) additionally returns `description`, `primaryColor`, `publicSiteEnabled`, and a logo URL — and **does not** return `contactEmail`, `contactPhone`, or `contactAddress` (those are admin-only; contact details are not anonymously exposed).
6. **Logo upload.** An admin-only `POST /api/v1/settings/logo` endpoint accepts a multipart image upload, stores it via `IDocumentStorage` under a stable `branding/` key prefix, persists the returned key to `SystemSettings.LogoAssetKey`, and writes an audit event. File-type allowlist (png/jpeg/svg/webp) and a max size (≤ 1 MB) are enforced; an invalid type or oversized file returns `400` with a safe message. A public passthrough `GET /api/v1/settings/logo` streams the current logo asset (or `404` when none is set) so the frontend has a stable, non-expiring logo URL.
7. **Branding admin tab.** The `/admin/settings` page presents a **Branding** tab (the current `general` tab is renamed/repurposed to `branding` — see Dev Notes for the exact decision). It contains the existing four branding fields *plus* inputs for description (textarea), contact email/phone/address, primary color (color-picker + hex-text pair), a `publicSiteEnabled` toggle, and a logo upload control. A live preview reflects unsaved form values. Page stays `max-w-5xl` and reuses the existing tab-bar / card / message-banner / save-button patterns. `customRoles` tab is untouched.
8. **Save + refresh.** Saving calls `PUT /api/v1/settings` (profile fields) and, when a new logo file is selected, `POST /api/v1/settings/logo`; on success it shows the existing success banner and calls `refreshAppSettings()`. Logo-upload states (uploading / upload failed / invalid type or size) are surfaced inline.
9. **Frontend settings provider extended.** The `AppSettings` interface and `AppSettingsProvider` (`frontend/src/components/providers/AppSettingsProvider.tsx`) are extended with `description`, `primaryColor`, `publicSiteEnabled`, and `logoUrl`, sourced from `GET /api/v1/settings/public`. Defaults remain behavior-preserving.
10. **Audit.** Both the profile update (via `PUT /api/v1/settings`) and the logo upload write an audit event through the existing `AuditEventType.SettingsChanged` path, with old/new values serialized as today.
11. **i18n.** Every new label, hint, toggle state, and upload message in the Branding tab uses a `next-intl` key under `settings.*` in `frontend/messages/de.json` and `en.json`. No hardcoded UI strings. New default/example values must not hardcode "IAB".
12. **Quality gate.** Backend `dotnet test` stays green (currently 1837/1837, 0 warnings) with new tests added (see Testing). Frontend `npm run typecheck` and `npm run lint` pass with new tests added.

## Tasks / Subtasks

- [x] **Task 1 — Extend the `SystemSettings` domain entity (AC: 1, 3)**
  - [x] Add the 7 nullable properties with `private set` to `SystemSettings.cs`, XML-doc each.
  - [x] Add `UpdateOrganizationProfile(...)` — trim non-blank values, validate email/hex shape, allow null/blank to clear, stamp `UpdatedAt`/`UpdatedBy`. Does **not** touch `LogoAssetKey`.
  - [x] Add a focused `SetLogoAssetKey(string? key, string? updatedBy)` method. `CreateDefault()` unchanged (new fields default to `null`).
- [x] **Task 2 — EF configuration + migration (AC: 2)**
  - [x] Added the 7 columns to `SystemSettingsConfiguration.cs` with explicit snake_case `HasColumnName`, sensible `HasMaxLength`, **not** `IsRequired`.
  - [x] Generated migration `20260514160024_ExtendSystemSettingsBranding` — nullable `AddColumn` calls only, no data SQL, class XML-doc explaining REQ-086 + behavior-preserving intent.
- [x] **Task 3 — Settings API: extend read/write DTOs (AC: 4, 5, 10)**
  - [x] Extended `SettingsResponse` and `UpdateSettingsRequest` records with the 7 new fields.
  - [x] Extended `PublicSettingsResponse` with `description`, `primaryColor`, `publicSiteEnabled`, `logoUrl` only — **no contact fields**.
  - [x] `UpdateSettings` handler: captures old values for all extended fields, calls `UpdateBranding` then `UpdateOrganizationProfile`, extends the audit old/new payload; `ArgumentException` from validation → `400`.
  - [x] `GetPublicSettings`/`ToSettingsResponse`: build `logoUrl` as the relative path `/api/v1/settings/logo` (only when `LogoAssetKey` is set).
- [x] **Task 4 — Logo upload + passthrough endpoints (AC: 6, 10)**
  - [x] Added `POST /api/v1/settings/logo` to the **admin** group: `IFormFile`, content-type allowlist + 1 MB size check, `IDocumentStorage.UploadAsync("branding/logo-{guid}", ...)`, persist key via `SetLogoAssetKey`, best-effort delete of the previous asset, `AuditEventType.SettingsChanged`. Returns the new `logoUrl`.
  - [x] Added `GET /api/v1/settings/logo` to the **public** group (`AllowAnonymous`): `404` when no key, else streams via `IDocumentStorage.DownloadAsync` with the stored content-type. Passthrough, not pre-signed URL.
  - [x] Confirmed `IDocumentStorage` is already DI-registered (`S3DocumentStorage`); no new registration.
- [x] **Task 5 — Frontend `AppSettingsProvider` extension (AC: 9)**
  - [x] Extended the `AppSettings` interface with `description`, `primaryColor`, `publicSiteEnabled`, `logoUrl`.
  - [x] Extended `defaultSettings` with behavior-preserving values (empty description, `#EA580C` primary, `publicSiteEnabled: true`, `logoUrl: null`).
  - [x] Mapped the new fields in `fetchSettings()`, resolving the relative `logoUrl` against the API base.
- [x] **Task 6 — Branding admin tab (AC: 7, 8, 11)**
  - [x] Renamed the `general` tab/`Tab` member to `branding`; relabelled via the new `settings.tabBranding` key (`customRoles` untouched).
  - [x] Extended the `SystemSettings` TS interface + `settingsForm` state with the 7 new fields (`mapSettingsToForm` helper).
  - [x] Rendered the new inputs inside the existing `space-y-6` card: primary-color picker, description textarea, `publicSiteEnabled` labelled toggle, route-local logo `<input type="file">`, a `sectionContactTitle` block with email/phone/address. Live preview extended to show the selected/uploaded logo + primary color.
  - [x] `handleSaveSettings`: `PUT /api/v1/settings` then `api.upload` to `/api/v1/settings/logo` when a logo file is staged; logo sub-states (`uploading`/`failed`/`invalid`) surfaced inline.
  - [x] Added all new `settings.*` keys to `de.json` and `en.json` (parallel structure).
- [x] **Task 7 — Tests (AC: 12)**
  - [x] **Domain/Application**: `SystemSettingsTests` — `UpdateOrganizationProfile` trims/validates email+hex/clears on blank/stamps audit/does not touch logo key; `SetLogoAssetKey` set+clear.
  - [x] **API**: `SettingsEndpointTests` — `GET /public` returns the non-sensitive subset and **omits** contact fields; admin-only enforcement (`401`) on `GET /`, `PUT /`, `POST /logo`; public `GET /logo` `404`s when no logo set.
  - [x] **Infrastructure** (Testcontainers PostgreSQL): `SystemSettingsMigrationTests` — applies the migration chain, the lazily-created default row stays valid with new columns `NULL`, the 7 new columns round-trip.
  - [x] **Frontend** (Vitest/Testing Library): `page.test.tsx` — Branding tab renders the new fields, live preview reflects form values, save calls `PUT` (+ logo `POST` when a file is staged), invalid-type + failed-upload states render.

## Dev Notes

### Current state of files being modified (READ THIS — it prevents the review cycle)

**`backend/src/IabConnect.Domain/Common/SystemSettings.cs`** — singleton entity (REQ-059), `: Entity`. Today: 4 branding fields (`ApplicationName`, `LogoText`, `LogoBackgroundColor`, `LogoTextColor`), all `string` with `private set` and non-null defaults; `UpdatedAt`/`UpdatedBy`; private EF ctor; `CreateDefault()` factory; `UpdateBranding(...)` with non-empty validation. **Pattern to mirror exactly:** private setters + one explicit update method that validates, trims, and stamps `UpdatedAt`/`UpdatedBy`. ⚠️ Note: the entity's `ApplicationName` default is still literally `"IAB Connect"` and `LogoText` is `"IAB"` — that hardcoded default is **deliberately left alone in this story** (the de-branding sweep is E9-S2/S3/S4); do not change it here, just don't add new "IAB" defaults.

**`backend/src/IabConnect.Infrastructure/Persistence/Configurations/SystemSettingsConfiguration.cs`** — maps to `system_settings`, every property has explicit snake_case `HasColumnName`, string columns have `HasMaxLength` + `IsRequired`. New columns follow the same style **but nullable** (no `IsRequired`).

**`backend/src/IabConnect.Infrastructure/Persistence/Repositories/SystemSettingsRepository.cs`** — `GetSettingsAsync` lazily creates+saves the row via `CreateDefault()` if none exists; `Update` calls `_context.SystemSettings.Update(...)`. **No change needed** — it works on the whole entity. Do not add per-field methods here.

**`backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs`** — `MapSettingsEndpoints` defines a public group (`/api/v1/settings/public`, `AllowAnonymous`) and an admin group (`RequireAuthorization(policy => policy.RequireRole("admin"))`). `UpdateSettings` already: pulls `userName` via `httpContext.GetUserName()`, captures old values, calls `UpdateBranding`, `repository.Update`, `unitOfWork.SaveChangesAsync`, then `auditService.LogActionAsync(AuditEventType.SettingsChanged, ...)` with a JSON old/new payload. DTOs (`PublicSettingsResponse`, `SettingsResponse`, `UpdateSettingsRequest`) are `sealed record`s defined at the bottom of the class. **Extend these in place** — keep the audit + UoW flow identical, just add the new fields and the two `/logo` endpoints.

**`frontend/src/components/providers/AppSettingsProvider.tsx`** — `"use client"` context. `AppSettings` interface (4 fields), `defaultSettings`, `fetchSettings()` calls `${NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/v1/settings/public` and maps with `data.x || default.x`, swallows errors (app must still work on fetch failure), exposes `{ settings, isLoading, refresh }` via `useAppSettings()`. ⚠️ Current `defaultSettings.applicationName` is `"Association Connect by Harwinder Singh"` / `logoText: "AC"` — i.e. the **frontend default is already de-IAB'd but the backend entity default is not**. This inconsistency is expected and is E9-S2/S4 territory; for this story just keep the new defaults neutral/behavior-preserving and don't "fix" the existing ones.

**`frontend/src/app/admin/settings/page.tsx`** — `"use client"`, `REQ-004`. `type Tab = "general" | "customRoles"`, `activeTab` state, two tab buttons with the `border-b-2 ... border-orange-600 text-orange-600` active style. `general` tab: a `rounded-xl bg-white p-6 shadow-sm` card, `space-y-6`, fields = applicationName input, logoText input (`maxLength={5}`), two color pickers (`type=color` + `type=text` hex pair), a logo preview block (round avatar + name), a save button (`bg-orange-600`). Data loads via `apiRef.current.get<SystemSettings>("/api/v1/settings")` in an effect; `handleSaveSettings` does `api.put("/api/v1/settings", settingsForm)` then `loadSettings()` + `refreshAppSettings()`. Uses `useApiClient()` from `@/lib/auth` and `useTranslations("settings")`. **Reuse every one of these patterns.** The `general` → `branding` rename is internal (the `Tab` union member + the i18n label key); `customRoles` is untouched.

### Key decisions made for the dev (don't re-litigate, just implement)

- **One tab, not two.** The `general` tab becomes the `branding` tab — the existing 4 branding fields and the 7 new profile fields live together in one card with `space-y-6` sections (matches the UX "single `rounded-xl bg-white p-6 shadow-sm` card" spec). Do **not** create a separate tab and leave a near-empty `general`. (See open question Q1 if the PM disagrees — but this is the sensible default and what UX describes.)
- **Logo = passthrough endpoint, not pre-signed URL.** `GET /api/v1/settings/logo` streams the asset. A pre-signed URL expires; the logo renders on every page and the public/anonymous shell needs a stable URL. Passthrough is also consistent with "public, non-sensitive branding."
- **Contact fields are admin-only.** `GET /api/v1/settings/public` exposes `description`, `primaryColor`, `publicSiteEnabled`, `logoUrl` — **never** contact email/phone/address. Anonymous visitors do not get the org's contact details from this endpoint (the public *website* contact surface is REQ-049 / E9-S2 territory, separate).
- **`PublicSiteEnabled` default is "on".** Behavior-preserving: a `NULL` value and `true` both mean "public site served". The frontend `defaultSettings.publicSiteEnabled` is `true`. (Note its relationship to REQ-087's `module_settings['public_view']` is an open question — Q2 — but for THIS story just implement the column as REQ-086 specifies; do not wire it to module enforcement.)
- **Logo upload component is route-local.** There is genuinely no shared file-upload component. Do **not** build a new shared `components/ui` component for this — a styled native `<input type="file">` inside `admin/settings/page.tsx` is correct and in-scope. (If a second consumer appears later, extract then.)

### Architecture & project constraints (must follow)

- Modular monolith, Clean Architecture boundaries. Entity change → Domain; EF config + migration + repository → Infrastructure; endpoints + DTOs → Api. No business logic in endpoints. [Source: architecture.md#ADR-001, project-context.md]
- Extend the existing `SystemSettings` singleton — **do not introduce a new entity**. [Source: architecture.md#REQ-086]
- EF migrations live in `backend/src/IabConnect.Infrastructure/Migrations`; never hand-edit schema. Descriptive migration name. Run EF commands from `backend/` with `--project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api`. [Source: project-context.md]
- C# nullable reference types + warnings-as-errors. New nullable props are `string?` / `bool?`. `CancellationToken` flows through new async endpoint handlers. Central package versions only — no new packages expected (multipart `IFormFile` is built into ASP.NET Core). [Source: project-context.md]
- Backend authorization is the security boundary: the `/logo` POST and `PUT /settings` stay under `RequireRole("admin")`; only `GET /public` and `GET /logo` are `AllowAnonymous`. [Source: architecture.md#ADR-003]
- Sensitive admin actions write audit logs — reuse `AuditEventType.SettingsChanged` (confirmed present at `backend/src/IabConnect.Domain/Audit/AuditEnums.cs:49`). [Source: architecture.md#REQ-086, prd.md#REQ-086 AC]
- Frontend: `next-intl` keys for all text, double quotes, 2-space indent, Tailwind class sorting via Prettier, `orange-600`/`orange-700` primary, no blue. Authenticated page layout `<main className="min-h-[calc(100vh-4rem)] ... bg-gray-50">` is already in place — keep it. [Source: project-context.md, ux-design.md#Visual Foundation]
- Frontend enum/contract values must match backend PascalCase — N/A here (no enums), but field names: backend records are PascalCase, JSON is camelCase (System.Text.Json default), TS interfaces camelCase — consistent with the existing 4 fields.
- Repository behavior touching real PostgreSQL semantics → Testcontainers integration test, not EF InMemory. [Source: project-context.md]

### UX specifics [Source: ux-design.md#Platform Branding Configuration]

- Primary screen: `/admin/settings` → Branding tab. Page `max-w-5xl`, existing tab-bar pattern.
- Color pickers keep their hex text inputs as the accessible alternative. The logo upload control needs a `<label>` + accessible name; show the file name after selection. The preview is decorative — keep the explicit success banner as the real confirmation, the preview is not the confirmation.
- States to handle: loading (existing spinner), save success/error (existing banner), logo upload uploading / failed / invalid-type-or-size, unsaved/dirty form, live preview of unsaved values.
- `publicSiteEnabled` toggle needs an explicit on/off **text** label, not color-only.
- i18n: the Branding tab is itself part of de-branding — its default and example values must not hardcode "IAB".

### Testing standards summary

- Backend split: `IabConnect.Application.Tests` (entity/use-case), `IabConnect.Infrastructure.Tests` (persistence/migration, Testcontainers PostgreSQL), `IabConnect.Api.Tests` (routing/auth/serialization). xUnit v3 + FluentAssertions; Moq only for external boundaries. Run `dotnet test` from `backend/` before done. [Source: project-context.md]
- Frontend: Vitest + Testing Library for the Branding tab form/preview/save. Run `npm run typecheck` and `npm run lint` from `frontend/` before done. [Source: project-context.md]
- Settings is a sensitive/audited workflow — regression coverage required when changed. [Source: project-context.md]

### Project Structure Notes

- New/changed files: `SystemSettings.cs` (UPDATE), `SystemSettingsConfiguration.cs` (UPDATE), one new migration (NEW), `SettingsEndpoints.cs` (UPDATE), `AppSettingsProvider.tsx` (UPDATE), `admin/settings/page.tsx` (UPDATE), `de.json` + `en.json` (UPDATE). No new entity, no new repository, no new shared component, no new NuGet/npm package.
- `ApplicationDbContextModelSnapshot.cs` is regenerated automatically by `dotnet ef migrations add` — commit it, don't hand-edit.
- No conflict with recent work: the last 8 commits are all Epic-3 cleanup-sprint (calendar tokens, volunteer shifts) — none touch `SystemSettings`, the settings endpoints, the admin settings page, or the app-settings provider. Backend is at **1837/1837 tests green, 0 warnings** — keep it there.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E9-S1: Extend SystemSettings and Add Branding Admin UI]
- [Source: _bmad-output/planning-artifacts/prd.md#REQ-086 Generic Positioning & White-Label Branding] — acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#REQ-086 Generic Positioning / White-Label Branding]
- [Source: _bmad-output/planning-artifacts/ux-design.md#Platform Branding Configuration]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-05-14.md] — E9-S1 → E9-S2/S3/S4 dependency, READY status
- [Source: backend/src/IabConnect.Domain/Common/SystemSettings.cs] — entity pattern to mirror
- [Source: backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs] — endpoint + DTO + audit flow to extend
- [Source: backend/src/IabConnect.Infrastructure/Migrations/20260513195330_AddVolunteerShiftCancellationState.cs] — column-add migration + XML-doc style
- [Source: backend/src/IabConnect.Application/Common/IDocumentStorage.cs] — storage abstraction for the logo asset

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **Tab merge confirmation.** This story renames the `general` tab → `branding` and merges all org-identity fields into it (per the UX "single card" spec). Confirm there's no separate "General" tab content expected later that would need the slot back.
2. **`SystemSettings.PublicSiteEnabled` vs `module_settings['public_view']` (REQ-087/E10).** REQ-086 puts a `public_site_enabled` flag on `SystemSettings`; REQ-087 (E10) introduces a `public_view` module in the `module_settings` table. These look like two switches for overlapping concerns. This story implements `public_site_enabled` as REQ-086 specifies and does **not** wire it to enforcement — but E10 planning should decide whether one supersedes the other (and whether E10-S5 reads `public_site_enabled` or replaces it). Flagging now so it's resolved before E10-S5.
3. **Logo constraints.** Assumed allowlist png/jpeg/svg/webp and max 1 MB. Confirm acceptable, and whether SVG should be allowed (SVG can carry script — if allowed, it must be served with `Content-Disposition`/CSP such that it cannot execute; the passthrough endpoint streams with the stored content-type, so confirm SVG handling or drop it from the allowlist).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (bmad-dev-story)

### Debug Log References

- Backend dev server held a build lock on the output DLLs; user stopped it manually so migration generation, build, and `dotnet test` could run. Frontend (edit-only) work was done in parallel during the wait.
- `Write` tool repeatedly appended a stray closing tag to created files; each occurrence was stripped with a follow-up edit before building.

### Completion Notes List

- **Task 1–4 (backend):** `SystemSettings` extended with 7 nullable REQ-086 fields + `UpdateOrganizationProfile` (trim/validate email+hex/clear-on-blank/stamp audit) + `SetLogoAssetKey`. EF config maps all 7 as nullable snake_case columns. Migration `20260514160024_ExtendSystemSettingsBranding` is nullable-`AddColumn`-only, no data SQL. `SettingsEndpoints` extended: admin `GET /`, `PUT /`, `POST /logo`; public `GET /public`, `GET /logo`. Public response carries the non-sensitive subset only (no contact fields). Logo upload validates png/jpeg/svg/webp + ≤1 MB, stores under `branding/`, best-effort-deletes the superseded asset, audits via `AuditEventType.SettingsChanged`. Logo read is a stable passthrough (not pre-signed).
- **Task 5–6 (frontend):** `AppSettingsProvider` extended with `description`/`primaryColor`/`publicSiteEnabled`/`logoUrl` (relative URL resolved against API base). Admin settings `general` tab renamed → `branding`; new inputs (primary color, description, public-site toggle with explicit on/off label, route-local logo file input, contact section) added to the existing single card; live preview shows the selected/uploaded logo + primary color. Save does `PUT` then `api.upload` for a staged logo, with inline `uploading`/`failed`/`invalid` sub-states. All new strings are `next-intl` keys in `de.json` + `en.json`; no "IAB" hardcoded in new defaults/examples.
- **Task 7 — tests:** Domain 11 cases, API 6 cases, Infrastructure 2 cases (Testcontainers PostgreSQL via `MigrateAsync`), Frontend 6 cases (Vitest).
- **Task 8 — validations:**
  - Backend `dotnet build IabConnect.sln` → **0 warnings**; `dotnet test` → **1865 passed, 0 failed** (Application 1416, Api 70, Infrastructure 379), up from the 1837 baseline.
  - Frontend `npm run typecheck` → pass. `npx vitest run` (Branding tab) → **6/6 pass**.
  - Frontend `npm run lint` → my changed files are lint-clean. ⚠️ The global `npm run lint` reports **2 pre-existing errors** (`react-hooks/set-state-in-effect`) in `frontend/src/app/members/segments/page.tsx`, a file **not touched by this story** — pre-existing baseline failure, flagged for a separate fix (candidate for the E9 retro / a cleanup item).
- **Open questions:** Q1 (tab merge) implemented as the "single branding tab" default per UX. Q2 (`PublicSiteEnabled` vs E10 `module_settings['public_view']`) — column implemented as REQ-086 specifies, **not** wired to enforcement; left for E10-S5. Q3 (SVG in allowlist) — kept per AC-6 explicit allowlist; passthrough streams with the stored content-type. Recommend the reviewer/PM confirm SVG handling.

### File List

**Backend (new):**
- `backend/src/IabConnect.Infrastructure/Migrations/20260514160024_ExtendSystemSettingsBranding.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260514160024_ExtendSystemSettingsBranding.Designer.cs`
- `backend/tests/IabConnect.Application.Tests/Common/SystemSettingsTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/SettingsEndpointTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/SystemSettingsMigrationTests.cs`

**Backend (modified):**
- `backend/src/IabConnect.Domain/Common/SystemSettings.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/SystemSettingsConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs` (regenerated by `dotnet ef`)
- `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs`

**Frontend (new):**
- `frontend/src/app/admin/settings/page.test.tsx`

**Frontend (modified):**
- `frontend/src/components/providers/AppSettingsProvider.tsx`
- `frontend/src/app/admin/settings/page.tsx`
- `frontend/messages/de.json`
- `frontend/messages/en.json`

### Change Log

- 2026-05-14 — Story 9.1 implemented (REQ-086, E9-S1): `SystemSettings` extended with organization-profile + branding fields, behavior-preserving EF migration, admin/public settings API + logo upload/passthrough endpoints, frontend Branding admin tab + `AppSettingsProvider` extension, i18n keys, and Domain/API/Infrastructure/Frontend tests. Backend 1865/1865 green, 0 warnings. Status → review.

## Review Findings

_Epic-boundary code review — 2026-05-14 (bmad-code-review). 3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

### Decision Needed (resolved 2026-05-14 → patch)

- [x] [Review][Patch] Logo upload/serve pipeline is a stored-XSS vector [`SettingsEndpoints.cs` `UploadLogo`/`GetLogo`] — the upload allowlist trusts the client-supplied multipart Content-Type, and `GET /api/v1/settings/logo` (`AllowAnonymous`) streams stored bytes back with the stored content-type; S1 AC-6 keeps `svg` in the allowlist, so a script-bearing SVG is served same-origin to anonymous visitors. **Resolution: neutralize SVG serving** — keep `svg` in the allowlist (AC-6-compliant) but serve `GET /api/v1/settings/logo` with a restrictive `Content-Security-Policy: default-src 'none'` (+ `Content-Disposition`) so a direct-navigation SVG cannot execute script while `<img>` rendering still works; optionally magic-byte sniff on upload.

### Patches

- [x] [Review][Patch] `UpdateSettings` can leave the tracked entity half-mutated [`SettingsEndpoints.cs` `UpdateSettings`] — `UpdateBranding(...)` runs before `UpdateOrganizationProfile(...)`; if the profile call throws `ArgumentException` the request returns 400 but the branding mutation is already applied to the tracked entity. No `SaveChanges` follows so the DB is safe today, but it is a latent foot-gun — validate before mutating.
- [x] [Review][Patch] `UploadLogo` orphans the new asset if `SaveChangesAsync` throws [`SettingsEndpoints.cs` `UploadLogo`] — the blob is uploaded before the DB write; on a `SaveChangesAsync` failure the freshly-uploaded object is left in storage with no DB reference. Add compensating cleanup of the new key on persistence failure.
- [x] [Review][Patch] `UploadLogo` old-asset cleanup only catches `AmazonS3Exception` [`SettingsEndpoints.cs` `UploadLogo`] — after the new key is committed, the previous-asset `DeleteAsync` is wrapped in `catch (AmazonS3Exception)` only; any other exception (cancellation, non-S3 `IDocumentStorage` impl) faults an already-succeeded request → 500. Catch broadly for best-effort cleanup.
- [x] [Review][Patch] `GetLogo` over-narrow catch + no caching + double round-trip [`SettingsEndpoints.cs` `GetLogo`] — only `AmazonS3Exception` is caught (TOCTOU + breaks non-S3 storage → 500 instead of 404); no `Cache-Control`/`ETag` on a hot anonymous endpoint hit on every public render; `GetFileInfoAsync` + `DownloadAsync` is two storage round-trips. Catch broadly → 404, add caching headers, collapse to one call.
- [x] [Review][Patch] `mapSettingsToForm` persists defaults into previously-NULL columns [`admin/settings/page.tsx` `mapSettingsToForm`] — `primaryColor: data.primaryColor ?? "#ea580c"` and `publicSiteEnabled: data.publicSiteEnabled ?? true` mean the first save by any admin writes concrete values into columns that were NULL, defeating the "NULL = not configured / behavior-preserving" contract S1 AC-1/AC-2 are built on. Pre-fill the form with the real null/empty values so untouched fields stay NULL on save.
- [x] [Review][Patch] Settings save gives no field-level validation feedback [`admin/settings/page.tsx` `handleSaveSettings`] — the free-text `primaryColor`/contact-email inputs accept anything; a backend `ArgumentException` → 400 surfaces only a generic `saveError` and discards all valid branding edits in the same PUT. Add client-side hex/email validation (or parse the 400) with per-field attribution.
- [x] [Review][Patch] Logo preview `<img>` has no error fallback [`admin/settings/page.tsx`] — `<img src={logoPreviewUrl ?? settings?.logoUrl ?? ""}>` renders a broken-image icon if `logoUrl` 404s, and an empty-string `src` triggers a redundant request to the page URL. Add `onError` → fall back to the text-logo block; guard the empty `src`.
