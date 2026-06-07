# Story E7.S4: Add Content Language Metadata Where Needed

Status: done

## Story

As a content manager,
I want public content records (events and blog posts) to optionally identify their content language,
so that multilingual content can be managed and displayed cleanly without breaking existing routes or existing data.

## Acceptance Criteria

1. The public content entities where it applies — **Event** and **BlogPost** (the only two public, author-managed content aggregates in the codebase) — can carry a content-language value (ISO 639-1, e.g. `de`/`en`/`hi`).
2. Existing content continues to display: records with no language set fall back to the organization's default display behavior; nothing breaks for pre-migration rows.
3. Public pages can display and/or filter by language metadata without changing or breaking the current public routes (`/public/events`, `/public/events/[id]`, `/public/blog`, `/public/blog/[id]`).
4. Setting/changing content language is authorized through the **existing** content-management permissions (Events: `RequireVorstand`; Blog: `RequireVorstand` + `Module:communication`) — no new permission/policy is introduced.
5. The EF migration preserves all existing event and blog-post data (additive nullable column; no data loss, no destructive change).

## Tasks / Subtasks

- [x] Task 0: Spike + resolve scope (AC: 1, 4)
  - [x] Confirmed candidate set: `Event.cs` + `BlogPost.cs` are the only public content aggregates (no News/CMS/Page/Announcement); neither had a language field.
  - [x] Confirmed the language-as-string precedent `InvoiceTemplate.cs:33` (`string Language = "en" // ISO 639-1`). Reused the string shape (DEC-2=A), no new enum.
  - [x] Confirmed blog admin UI gap: no `(dashboard)/blog` route (blog is API-only); event admin forms exist. Drives DEC-1 (A65).
  - [x] Resolved DEC-1=A, DEC-2=A, DEC-3=A (see Debug Log).
- [x] Task 1: Domain — add `ContentLanguage` (AC: 1, 2)
  - [x] Added nullable `ContentLanguage` (`string?`) to `Event` + `BlogPost`, each with a `SetContentLanguage(string?)` write-boundary method. Default `null` = AC-2 (existing content displays with default).
  - [x] Validation at the write boundary via a shared `ContentLanguages.Normalize` (new `Domain/Common/ContentLanguages.cs`): null/whitespace→null; trims+lowercases; rejects codes outside `{de,en,hi}` with `ArgumentException` (→ HTTP 400 via ExceptionHandlingMiddleware). No FluentValidation needed (Events/Blog are repository-direct; the domain method is the single write boundary).
- [x] Task 2: Infrastructure — EF config + migration (AC: 5)
  - [x] Mapped `content_language` (nullable, `varchar(10)`) in `EventConfiguration.cs` + `BlogPostConfiguration.cs`.
  - [x] Generated ONE additive migration `20260607101749_AddContentLanguageMetadata` (after `AddBudgetModel`): two `AddColumn` nullable, no backfill; `Down` drops both. Data-preserving (AC-5).
  - [x] Testcontainers PostgreSQL test (`ContentLanguageMigrationTests`) applies the FULL migration chain via `MigrateAsync` and proves: row without content language reads back null + a written value round-trips, for both Event and BlogPost (4 tests, all green).
- [x] Task 3: Application/API — DTOs + handlers + authorization (AC: 1, 3, 4)
  - [x] Added `contentLanguage` (nullable) to `CreateEventRequest`/`UpdateEventRequest` + `EventDto` (returned by the public `/events/public*` endpoints via the shared `MapToDto`); and to `CreateBlogPostRequest`/`UpdateBlogPostRequest` + `PublicBlogPostDto` (public `/blog/public*`) + `BlogPostAdminDto`. Handlers call `SetContentLanguage`.
  - [x] Authorization UNCHANGED: Events create/update keep `RequireVorstand`; Blog create/update keep `RequireVorstand` + `Module:communication` — verified by the 40 passing Event/Blog Api auth tests (AC-4, no new policy).
  - [x] A63: no new injected service added (only DTO fields + a domain method) → no endpoint-metadata harness change needed. Confirmed (Api.Tests 249/249 green).
  - [x] Audit logging rides the existing create/update path; no new audit surface.
- [x] Task 4: Frontend — admin set + public display (AC: 1, 2, 3)
  - [x] Added a content-language `<select>` after the `category` field to BOTH event admin forms (`events/new` + `events/[id]/edit`); options de/en/hi + an empty "Default" option; labels via next-intl (`events.form.contentLanguage`/`contentLanguageDefault` + `language.*`). Empty submits as "" → backend normalizes to null (AC-2). Edit form loads the existing value.
  - [x] Public display (AC-3): content-language badge added to `/public/events` and `/public/blog` cards (only rendered when set), route shapes unchanged.
  - [x] Blog admin: NO net-new blog admin UI (DEC-1=A); blog language is settable via API + visible on the public page. "Blog admin language UI" tracked as a follow-up (E7-FT below).
  - [x] Added next-intl keys to `de.json` + `en.json` (lockstep); Hindi falls back via E7-S3's deep-merge.
- [x] Task 5: Tests (AC: all)
  - [x] Backend: domain/validation tests (`ContentLanguageTests`, 20 — Normalize supported/null/unsupported, Event + BlogPost SetContentLanguage incl. reject-unknown + default-null); Testcontainers migration/round-trip (4); existing Event/Blog API auth/contract tests (40) confirm auth unchanged + DTO shape compiles.
  - [x] Frontend: public-events badge render test (`page.contentlanguage.test.tsx`, 2 — badge renders native language name when set; absent when unset) with stable per-namespace `useTranslations` mock (A64) + `afterEach(cleanup)` + jsdom (A35/A46). Event-form live submit is browser-only → `[!]` manual-verify.
- [x] Task 6: Quality gates (AC: all)
  - [x] A29 per-AC + A65 per-surface table below.
  - [x] Backend: solution builds 0/0; `dotnet test` Application 1556/1556, Api 249/249, migration 4/4 (Docker available). Frontend: `tsc` clean; `eslint` clean on changed files; `vitest run` 222/222. **Prettier note (post-boundary-review):** the modified event/public page files + `events.ts` were already prettier-drifted at HEAD; an initial `prettier --write` was reverted in the boundary review (P1) and only the logical changes re-applied (A58/A72); the new `page.contentlanguage.test.tsx` is clean. See `epic-7-boundary-review-2026-06-07.md`.
  - [x] Updated `docs/10_requirements_status.md` REQ-055 → In Bearbeitung.

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 stub. The story scope is **tightly bounded to exactly two entities**, both of which exist and have NO language field today. Spike findings:

- **Public content aggregates = Event + BlogPost ONLY.** `Event.cs` (`REQ-019`) and `BlogPost.cs` (`REQ-047`, public website). No News/CMS/Page/Announcement entity exists — that is why the AC says "where applicable / product-approved": the applicable set is these two. Do not invent more.
- **Neither has a language field.** Confirmed in `Event.cs:11-69` and `BlogPost.cs:10-19`.
- **Precedent for language-as-string already in the codebase**: `InvoiceTemplate.cs:33` stores `string Language = "en"` with an `// ISO 639-1` comment. Reuse this (nullable string), not a new enum — unless DEC-2 elects an enum.
- **Auth is role-based, no separate ContentManager permission.** Events create/update = `RequireVorstand` (`EventEndpoints.cs`); Blog create/update = `RequireVorstand` + `Module:communication` (`BlogEndpoints.cs`). Adding a DTO field inherits these automatically — AC-4 is satisfied by reuse, not a new policy.
- **Event admin UI exists; Blog admin UI does NOT.** `frontend/src/app/(dashboard)/events/new` + `[id]/edit` are real forms. There is **no** `(dashboard)/blog` admin route — blog is API-only. This is the A65 multi-surface trap: AC-1 names "content/event/blog" but only the event surface has an admin UI. DEC-1 scopes this honestly.
- **Migrations**: `backend/src/IabConnect.Infrastructure/Migrations`, timestamp naming, latest `20260607084312_AddBudgetModel`. One additive nullable column per entity; data-preserving (AC-5).
- **Public routes/endpoints**: `/public/events` + `/public/events/[id]` → `GET /api/v1/events/public*` (`AllowAnonymous` + `RequireModule("public_view")`); `/public/blog` + `/public/blog/[id]` → `GET /api/v1/blog/public*`. Adding a response field is backward-compatible (AC-3 — no route change).

### Files to change

- Domain: `backend/src/IabConnect.Domain/Events/Event.cs`, `backend/src/IabConnect.Domain/Blog/BlogPost.cs`
- Infra: `.../Persistence/Configurations/EventConfiguration.cs`, `BlogPostConfiguration.cs`, new migration under `.../Migrations`
- Application: Event + Blog create/update commands + validators + DTOs (request + public response)
- API: `EventEndpoints.cs`, `BlogEndpoints.cs` (DTO pass-through; auth unchanged)
- Frontend: `events/new` + `events/[id]/edit` forms; `/public/events` + `/public/blog` display; `frontend/messages/{de,en}.json` (+`hi.json` if present)
- Tests: domain + validator + Testcontainers migration + API contract + frontend form/public

### Scope Boundaries

In scope:

- `ContentLanguage` on Event + BlogPost (domain → EF → migration → DTOs).
- Event admin language select; public events + blog language display/filter (additive).
- Validation constrained to supported content languages; reuse existing auth.

Out of scope:

- A net-new blog admin UI (none exists; building one is a separate story) — blog language is settable via API + visible on public pages only (DEC-1).
- Adding language metadata to non-public/unrelated models.
- Translating content bodies, or backend enum contract values.
- Changing public route shapes.

### Architecture Guardrails

- Clean Architecture boundaries: business rule lives in the Domain factory/update methods; validation in Application FluentValidation; EF mapping in Infrastructure; thin endpoints. Pass `CancellationToken` through.
- DTOs stay explicit at the API/Application boundary; never expose the EF entity directly.
- EF schema change goes through a migration in `backend/src/IabConnect.Infrastructure/Migrations` — never a manual schema change. Additive nullable column only (AC-5).
- Authorization is enforced in the backend (reuse existing policies). UI hiding is not security.
- Frontend: shared form components, standard layout, orange primary, next-intl keys (no hardcoded text), `de`/`en` parity.
- A71 (config-scoped visible behavior): if a public language **filter** is added, an empty result for a selected language must read as "no content in this language", not a silent blank — degrade visibly.

### Testing Requirements

- Backend: xUnit v3 + FluentAssertions; Moq only for external boundaries. Domain unit tests for Create/Update; validator tests (reject unknown code, accept null + supported). Testcontainers PostgreSQL for the migration apply + pre-existing-row-null + round-trip (do NOT use EF InMemory for relational/migration correctness). API contract test via `Mvc.Testing` (public DTO field present; auth unchanged).
- Frontend: Vitest + Testing Library; `afterEach(cleanup)` + jsdom for `render()` tests (A35/A46); stable `useTranslations` mock (A64). Form-submit test + public render test.
- Gates: `dotnet test` (backend); `npx eslint`/`prettier --check` on changed files + `vitest run` (A58).

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — blog surface scope (AC-1/AC-3, A65 multi-surface trap).** Blog has no admin UI.
  - (A, recommended) **Both entities get `ContentLanguage` in domain/EF/migration/DTOs; Event gets the admin-UI select + public display; Blog gets the field via API + public display, but NO net-new blog admin UI in this story.** Split the AC in the QGT: `event-admin` done, `blog-admin-UI` deferred-to-follow-up, both public surfaces done. Rationale: building a whole blog admin UI is out of this story's intent and would balloon scope; the data model + public side are fully delivered, and the deferral is explicit (A65 — no overstated ✅).
  - (B) Build a full blog admin UI here too. Rejected: large net-new surface unrelated to "add language metadata"; scope explosion.
  - (C) Event only; ignore BlogPost entirely. Rejected: AC-1 explicitly names blog as applicable content, and the entity exists; dropping it understates the requirement.
- **DEC-2 — storage type (AC-1).** String vs enum?
  - (A, recommended) **Nullable ISO 639-1 `string`**, mirroring `InvoiceTemplate.Language`, validated against the supported content-language set at the write boundary. Lightweight, consistent with the existing precedent, no Domain↔Application enum-home problem (A69).
  - (B) A new `ContentLanguage` enum in Domain. Acceptable if the product wants a closed type, but heavier and diverges from the shipped `InvoiceTemplate` string precedent; only choose if a strongly-typed contract is required.
- **DEC-3 — supported value set (AC-1).** Which codes are allowed?
  - (A, recommended) Constrain to the app's i18n content languages **`de`, `en`, `hi`** (+ null). Keeps content language aligned with the UI locales E7-S3 introduces; validator rejects others.
  - (B) Any ISO 639-1 string. Rejected: unbounded, lets typos/garbage into public display.

### Project Structure Notes

- Backend: `IabConnect.Domain/{Events,Blog}`, `IabConnect.Application` (commands/validators/DTOs), `IabConnect.Infrastructure/{Persistence/Configurations,Migrations}`, `IabConnect.Api/Endpoints/{EventEndpoints,BlogEndpoints}.cs`.
- Backend tests: `IabConnect.Application.Tests` (domain/validator), `IabConnect.Infrastructure.Tests` (Testcontainers migration), `IabConnect.Api.Tests` (contract).
- Frontend: `frontend/src/app/(dashboard)/events/{new,[id]/edit}`, `frontend/src/app/public/{events,blog}`, `frontend/messages/{de,en}.json`.

### References

- `backend/src/IabConnect.Domain/Events/Event.cs:11-69`, `backend/src/IabConnect.Domain/Blog/BlogPost.cs:10-64`
- `backend/src/IabConnect.Domain/Finance/InvoiceTemplate.cs:33` (string-language precedent)
- `backend/src/IabConnect.Api/Endpoints/{EventEndpoints,BlogEndpoints}.cs` (auth policies, public endpoints)
- `backend/src/IabConnect.Infrastructure/Migrations/20260607084312_AddBudgetModel.cs` (latest migration; naming/placement)
- `_bmad-output/planning-artifacts/ux-design.md:547-559` (Multilingual Expansion — public content language)
- `_bmad-output/planning-artifacts/epics-and-stories.md:830-852` (E7-S4 source)
- `_bmad-output/project-context.md` (A56 spike, A61/A63 backend rules, A65 multi-surface trap, A69 cross-layer enum, A71 config-scoped visible degrade)

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-7 dev-ready prep (A34). Stub placeholder ACs + stale tech context replaced with spike-grounded, `file:line`-anchored tasks across the full backend→frontend slice.
- Checklist coverage: ACs concrete + testable; candidate entities verified (Event + BlogPost only); auth reuse confirmed (AC-4); migration data-preservation specified (AC-5); A65 multi-surface trap handled via DEC-1 split; i18n + Testcontainers rules enforced.
- Remaining risk: the blog-admin-UI gap (DEC-1) means a multi-tier review must confirm the QGT marks blog-admin deferred (not ✅). The exact Event create/update command/DTO file names should be confirmed at Task 0 (the spike named the forms + endpoints; the Application command classes follow the Events module convention).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — autonomous Epic-7 dev-story run.

### Debug Log References

**DEC resolution (A41/A43 autonomous-mode escape — (a)/(b)/(c)):**

- (a) **Options chosen:** DEC-1 = A (both entities get the field in domain/EF/migration/DTOs; Event gets admin select + public display; Blog gets field via API + public display, NO net-new blog admin UI); DEC-2 = A (nullable ISO-639-1 string, mirroring `InvoiceTemplate.Language`, not a new enum); DEC-3 = A (constrain to de/en/hi + null).
- (b) **Rationale:** (1) all three are the story's recommended options; (2) user pre-declared autonomous mode verbatim: *"das ganze epic 7 umsetzen ohen stop bis alle stories implementiert ist…"*; (3) downstream — building a whole blog admin UI is out of "add language metadata" scope (DEC-1=A keeps it bounded + honest via A65); string mirrors the shipped precedent and avoids the Domain↔Application enum-home problem (A69); the de/en/hi set keeps content language aligned with the E7-S3 UI locales. All three A41 preconditions hold.
- (c) **Consequence chain:** AC-1 covered for Event+BlogPost data model; AC-2 covered (nullable default null, migration data-preserving); AC-3 covered (public DTOs + badges); AC-4 covered (auth reused, no new policy); AC-5 covered (additive nullable migration). The **blog-admin-UI surface is `deferred`** (A65 — not marked ✅).

**A65 multi-surface honesty (per-surface coverage):**

| Surface | Status |
|---------|--------|
| Event — domain/EF/migration/DTO | ✅ done |
| Event — admin UI select (new + edit) | ✅ done (live submit `[!]`) |
| Event — public display badge | ✅ done (visual `[!]`) |
| BlogPost — domain/EF/migration/DTO | ✅ done |
| BlogPost — language settable via API | ✅ done |
| BlogPost — public display badge | ✅ done (visual `[!]`) |
| BlogPost — **admin UI** | ⏸️ **deferred** (no blog admin UI exists; E7-FT-1, DEC-1=A) |

**A69 note:** the cross-layer enum trap was avoided by storing the value as a validated nullable string (DEC-2=A), so there is no Domain↔Application enum-home decision; the supported-set lives in `Domain/Common/ContentLanguages`.

**A71 note:** no public language **filter** was added (only a non-destructive badge), so the "empty filtered result reads as blank" risk does not arise; if a filter is added later it must degrade visibly ("no content in this language").

### Completion Notes List

**A29 AC-Subitem Completion Check (per-AC, with A65 per-surface above):**

- **AC-1 (Event + BlogPost can carry ISO-639-1 language):** ✅ both entities + DTOs.
- **AC-2 (existing content displays; null falls back to default):** ✅ nullable default null; migration additive; Testcontainers null-read-back proves pre-migration rows are unaffected.
- **AC-3 (public pages display/filter without breaking routes):** ✅ public DTOs expose the field + badges on both public pages; routes unchanged. Filter not added (badge only) — visual render `[!]`.
- **AC-4 (authorized via existing permissions, no new policy):** ✅ RequireVorstand (Events) / RequireVorstand + Module:communication (Blog) unchanged; 40 Api auth tests green.
- **AC-5 (migration preserves all existing data):** ✅ additive nullable columns, no backfill; Testcontainers round-trip + null-read-back.

**Follow-up (deferred-work):** E7-FT-1 — net-new Blog admin UI (including a content-language select) is out of scope for "add language metadata"; blog language is currently settable via the admin API + visible on the public page.

**Quality gates:** backend solution build 0 warn/0 err; Application.Tests 1556/1556, Api.Tests 249/249, Infrastructure migration test 4/4 (Testcontainers, Docker available); frontend `tsc` clean, `eslint` clean on changed files, `prettier` clean, `vitest` 222/222.

### File List

**Backend — new:**
- `backend/src/IabConnect.Domain/Common/ContentLanguages.cs` — supported-set + `Normalize` write-boundary validator.
- `backend/src/IabConnect.Infrastructure/Migrations/20260607101749_AddContentLanguageMetadata.cs` (+ `.Designer.cs`) — additive nullable columns.
- `backend/tests/IabConnect.Application.Tests/ContentLanguageTests.cs` — 20 domain/validation tests.
- `backend/tests/IabConnect.Infrastructure.Tests/Migrations/ContentLanguageMigrationTests.cs` — 4 Testcontainers migration round-trip tests.

**Backend — modified:**
- `backend/src/IabConnect.Domain/Events/Event.cs` — `ContentLanguage` + `SetContentLanguage`.
- `backend/src/IabConnect.Domain/Blog/BlogPost.cs` — `ContentLanguage` + `SetContentLanguage`.
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventConfiguration.cs`, `BlogPostConfiguration.cs` — `content_language` column.
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContextModelSnapshot.cs` — regenerated by the migration.
- `backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs` — DTO fields + MapToDto + Create/Update SetContentLanguage.
- `backend/src/IabConnect.Api/Endpoints/BlogEndpoints.cs` — DTO fields + mappers + Create/Update SetContentLanguage.

**Frontend — new:**
- `frontend/src/app/public/events/page.contentlanguage.test.tsx` — public badge render test.

**Frontend — modified:**
- `frontend/src/lib/services/events.ts` — `contentLanguage` on EventDto + CreateEventRequest.
- `frontend/src/app/(dashboard)/events/new/page.tsx`, `.../[id]/edit/page.tsx` — content-language select.
- `frontend/src/app/public/events/page.tsx`, `frontend/src/app/public/blog/page.tsx` — content-language badge.
- `frontend/messages/en.json`, `de.json` — `events.form.contentLanguage` + `contentLanguageDefault`.

**Docs:**
- `docs/10_requirements_status.md` — REQ-055 → In Bearbeitung.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike (Event+BlogPost only, no language field, InvoiceTemplate string precedent, blog-admin-UI gap), DEC-1/2/3, full backend→frontend slice, A65 multi-surface split.
- 2026-06-07: Implemented (autonomous Epic-7 run) — ContentLanguage on Event+BlogPost (domain write-boundary validator, EF mapping, additive migration, public+admin DTOs, event admin select, public badges); blog admin UI deferred (A65). DEC-1/2/3=A. Gates green (build 0/0; Application 1556, Api 249, migration 4; frontend 222). Status → review.
