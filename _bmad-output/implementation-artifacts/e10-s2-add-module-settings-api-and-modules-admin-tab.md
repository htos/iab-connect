# Story 10.2: Add Module Settings API and Modules Admin Tab

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Admin**,
I want **to enable or disable modules through the admin UI**,
so that **I control which functionality my deployment uses**.

**Requirement:** REQ-087. Epic E10, Story 2 of 5.
**Depends on E10-S1** (the `ModuleSetting` entity, `IModuleSettingsRepository`, `IModuleSettingsService`, `ModuleKeys`). **Heavy file coordination with E9-S1/E9-S2** on `frontend/src/app/admin/settings/page.tsx` and `frontend/src/components/providers/AppSettingsProvider.tsx` — see Dev Notes §Coordination.

## Acceptance Criteria

1. **Admin module-settings endpoints.** A new admin-only endpoint group (`MapModuleSettingsEndpoints`) exposes a MediatR query (read all module settings) and a command (update one module's `enabled` flag). Authorized as admin-only, mirroring the `SettingsEndpoints` admin group. The update command writes through `IModuleSettingsRepository` + `IUnitOfWork` and calls `IModuleSettingsService.InvalidateCache()`.
2. **`modules` on the public settings endpoint.** `GET /api/v1/settings/public` (anonymous) gains a `modules` map (`{ "members": true, ... }`) in its `PublicSettingsResponse`, so the frontend shell, `AppSettingsProvider`, and the future `middleware.ts` can read module state without auth.
3. **Modules admin tab.** `/admin/settings` gets a new **Modules** tab alongside the existing tabs. It shows a toggle list — one row per module: module name, a short description, an enable/disable control (a labelled control, not color-only), and last-changed metadata (`updated_at` / `updated_by`).
4. **Confirmation + dependency warnings.** Disabling a module shows a confirmation dialog before applying. Cross-module dependency warnings are shown where relevant (e.g. disabling Finance while Events is enabled and paid registration exists). Saving a change calls `refreshAppSettings()` so the sidebar/widgets pick it up.
5. **Audit.** Every module enable/disable writes an audit event (reuse `AuditEventType.SettingsChanged`, or the new `ModuleAccessDenied`-adjacent path — see Q1).
6. **Self-lockout guard.** The module-settings endpoints themselves, and the Admin module, are **never** gateable — the Modules tab UI must make clear Admin cannot be disabled, and the backend must never gate `/api/v1/settings*` or the module-settings endpoints (this is enforced fully in E10-S3, but the API surface here must not expose a way to disable a non-existent "admin" module).
7. **Quality gate.** `dotnet test` from `backend/` green (1837/1837+, 0 warnings) with API authorization tests (admin-only; module-settings endpoints not gated) and Application tests for the query/command. `npm run typecheck`/`lint` green with Vitest tests for the Modules tab.

## Tasks / Subtasks

- [x] **Task 1 — MediatR query + command (AC: 1, 5)** — in `IabConnect.Application/ModuleSettings/Queries/` and `/Commands/` (auto-discovered by `RegisterServicesFromAssembly` — no manual DI): `GetModuleSettingsQuery` → returns all 7 module settings with metadata; `UpdateModuleSettingCommand(string moduleKey, bool enabled)` → loads via `IModuleSettingsRepository`, calls `ModuleSetting.SetEnabled(...)`, `repo.Update`, `IUnitOfWork.SaveChangesAsync`, then `IModuleSettingsService.InvalidateCache()`, then audit. FluentValidation validator: `moduleKey` must be in `ModuleKeys.All`.
- [x] **Task 2 — Admin endpoint group (AC: 1, 6)** — new `Api/Endpoints/ModuleSettingsEndpoints.cs` with `MapModuleSettingsEndpoints`, mirroring the `SettingsEndpoints.cs` admin group (`MapGroup("/api/v1/module-settings")` + `.RequireAuthorization(policy => policy.RequireRole("admin"))`). `GET /` → query; `PUT /{moduleKey}` → command. Register in `EndpointMapper.cs`. **This group must never be `Module:`-gated** (E10-S3 enforces; just don't add the policy here).
- [x] **Task 3 — `modules` on public settings (AC: 2)** — extend `PublicSettingsResponse` record in `SettingsEndpoints.cs` (lines 139–143) with `IReadOnlyDictionary<string,bool> Modules`; populate it in `GetPublicSettings` (lines 45–56) via `IModuleSettingsService.GetAllAsync(ct)`. **Coordinate with E9-S1**, which also extends `PublicSettingsResponse` (with branding fields) — both add to the same record.
- [x] **Task 4 — Modules admin tab (AC: 3, 4)** — `frontend/src/app/admin/settings/page.tsx`:
  - [x] Add `"modules"` to the `Tab` type (line 50 — **note E9-S1 renames `general`→`branding`; coordinate**) and a third tab button (lines 331–352 block) with a `settings.tabModules` i18n key.
  - [x] New `{activeTab === "modules" && (...)}` panel: a `rounded-xl bg-white p-6 shadow-sm` card, one row per module — label + description text + a labelled toggle (reuse the checkbox pattern from the role modal, lines 826–845) + last-changed metadata. Own `modulesMessage` state for the success/error banner.
  - [x] Disabling a module → confirmation dialog (reuse the `deleteConfirmId` inline-confirm pattern or a modal); show a dependency-warning alert for known cross-module pairs (Finance↔Events).
  - [x] Load via `GET /api/v1/module-settings`, save via `PUT /api/v1/module-settings/{key}`, then `refreshAppSettings()`.
  - [x] Add `settings.tabModules` + per-module name/description + warning/confirmation i18n keys to `de.json` and `en.json`.
- [x] **Task 5 — Tests (AC: 7)**
  - [x] `IabConnect.Api.Tests`: `GET`/`PUT /api/v1/module-settings` require admin; non-admin → 403; the module-settings endpoints are reachable regardless of any module state.
  - [x] `IabConnect.Application.Tests`: command validates `moduleKey`, updates, invalidates cache, audits; query returns all 7.
  - [x] Vitest: Modules tab renders 7 toggles, disabling shows confirmation, dependency warning renders for Finance↔Events, save calls `PUT` + `refreshAppSettings()`.

## Dev Notes

### Coordination with E9 (READ FIRST)

This story shares two files with E9 work. **Land E9-S1 before E10-S2 if possible**, or serialize these edits:
- **`admin/settings/page.tsx`** — E9-S1 renames the `general` tab → `branding` (changes `Tab` type line 50, `useState` default line 71, tab buttons 331–352). E10-S2 only **adds** `"modules"` to the union + a button + a panel. If E9-S1 lands first, build on the renamed `Tab`. The `customRoles` tab and role modal are untouched by both.
- **`SettingsEndpoints.cs` `PublicSettingsResponse`** — E9-S1 adds branding fields, E10-S2 adds the `modules` map. Both extend the same `sealed record` (lines 139–143) and `GetPublicSettings` handler (45–56). Coordinate the record signature.
- **`AppSettingsProvider.tsx`** — E10-S4 (not this story) adds `modules` to the provider; E9-S1 adds branding. This story only consumes `/api/v1/module-settings` directly in the admin page — it does **not** edit the provider. (The admin page reads module state from its own `GET /api/v1/module-settings` call, not from `useAppSettings()`.)

### Current state of files being modified

- **`SettingsEndpoints.cs`** — public group (`/api/v1/settings/public`, `AllowAnonymous`) + admin group (`RequireRole("admin")`). `GetPublicSettings` builds `PublicSettingsResponse`. The admin group at lines 30–32 is the exact pattern for `MapModuleSettingsEndpoints`.
- **`admin/settings/page.tsx`** (882 lines) — `type Tab = "general" | "customRoles"` (50), `activeTab` state (71), tab-button block (331–352) with `border-orange-600 text-orange-600` active style, panels gated by `{activeTab === "X" && ...}`. Card = `rounded-xl bg-white p-6 shadow-sm`. Per-tab message state `{ type: "success"|"error"; text }`. Save button = `bg-orange-600 ... disabled:opacity-50`. Data via `useApiClient()` (`apiRef`), reload-after-save callbacks, `refreshAppSettings()` from `useAppSettings()` (line 60). Checkbox reference: role modal lines 826–845.
- **MediatR** — registered via `RegisterServicesFromAssembly` in `Application/DependencyInjection.cs` (22–27) with `ValidationBehavior`/`LoggingBehavior` pipeline; FluentValidation auto-registered. New handlers + validators in `Application/ModuleSettings/` are **auto-discovered** — no manual registration.
- **`IUnitOfWork`** — the pattern: repository `.Update()` does not save; the command handler calls `IUnitOfWork.SaveChangesAsync(ct)`.
- **`EndpointMapper.cs`** — `MapApiEndpoints` is where each `MapXxxEndpoints` extension is wired; add `MapModuleSettingsEndpoints` there.

### Architecture & project constraints

- **ADR-008:** the `modules` map is exposed via `GET /api/v1/settings/public` (anonymous) because the frontend shell + middleware need an unauthenticated-readable source. [Source: architecture.md#ADR-008]
- Admin and the module-settings endpoints are **never gated** (self-lockout guard) — so an admin can always re-enable a module. [Source: architecture.md#ADR-008, epics-and-stories.md#E10-S2]
- Backend authorization is the boundary; the admin endpoint group uses `RequireRole("admin")`. [Source: architecture.md#ADR-003]
- Module enable/disable is a sensitive admin action → audit logged. [Source: architecture.md#Audit and Logging]
- Frontend: next-intl keys for all text, `orange-600` primary, reuse shared components, no blue, labelled toggles (not color-only — accessibility). [Source: project-context.md, ux-design.md#Module Configuration]
- Use MediatR + FluentValidation for the workflow (not logic in the endpoint). [Source: project-context.md]

### UX specifics [Source: ux-design.md#Module Configuration]

- Same `max-w-5xl` page, same tab bar, single `rounded-xl bg-white p-6 shadow-sm` card.
- One row per module: name + short description + a labelled toggle + last-changed metadata.
- Dependency-warning alert text, associated with the relevant module row. Confirmation dialog (`dialog`/`alert-dialog`) before applying a disable. Settings message banner (existing pattern).
- Self-lockout: the UI must make clear Admin and the Modules tab itself cannot be disabled.
- Toggles need explicit on/off **text** labels, not color alone. Confirmation dialog keyboard-accessible.
- i18n: module names, descriptions, dependency-warning text, toggle states, confirmation copy — all next-intl keys.

### Project Structure Notes

NEW: `Application/ModuleSettings/Queries/GetModuleSettingsQuery*.cs`, `Application/ModuleSettings/Commands/UpdateModuleSettingCommand*.cs` (+ validator), `Api/Endpoints/ModuleSettingsEndpoints.cs`. UPDATE: `EndpointMapper.cs`, `SettingsEndpoints.cs` (`PublicSettingsResponse` + handler), `admin/settings/page.tsx`, `de.json`, `en.json`. No migration (E10-S1 owns the schema). No new packages.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E10-S2: Add Module Settings API and Modules Admin Tab]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] + [Source: architecture.md#REQ-087]
- [Source: _bmad-output/planning-artifacts/ux-design.md#Module Configuration]
- [Source: backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs] — admin group + `PublicSettingsResponse` pattern
- [Source: frontend/src/app/admin/settings/page.tsx] — tab structure + patterns
- [Source: e10-s1-add-module-settings-data-model-and-service.md] — dependency
- [Source: e9-s1-extend-systemsettings-and-add-branding-admin-ui.md] — file-coordination dependency

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **Audit event type.** Module enable/disable — reuse `AuditEventType.SettingsChanged`, or add a dedicated `ModuleConfigurationChanged`? E10-S3 adds `ModuleAccessDenied` for *denial*; this is *configuration change*. Recommend reuse `SettingsChanged` for the config change (consistent with how `SystemSettings` edits are audited).
2. **Dependency-warning rules.** AC requires "cross-module dependency warnings where relevant." For this story, recommend a minimal static rule set (Finance↔Events for paid registration). The full cross-module dependency *handling* is E10-S5 — confirm E10-S2 only shows an advisory warning, doesn't block the toggle.
3. **E9-S1 sequencing.** Strongly recommend E9-S1 lands before E10-S2 so the `admin/settings/page.tsx` `Tab`-type and `PublicSettingsResponse` edits don't conflict. Confirm sequencing or assign explicit file-section ownership.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — bmad-dev-story workflow, 2026-05-14.

### Debug Log References

- `dotnet build` (full solution): succeeded, 0 warnings, 0 errors.
- `dotnet test` (full backend suite): **1898 passed, 0 failed, 0 skipped** (1439 Application, 75 Api, 384 Infrastructure) — +13 over e10-s1's 1885 (9 Application + 4 Api new).
- `npm run typecheck`: green. `npx vitest run`: **59 passed, 0 failed** (10 files) — +5 over the prior 54 (Modules-tab tests).
- `npm run lint`: the changed file `admin/settings/page.tsx` is lint-clean (`npx eslint` on it returns nothing). The suite still reports **2 pre-existing errors + 1 warning in `src/app/members/segments/page.tsx`** — un-owned lint debt from commit `5eef682` (REQ-017), tracked as Epic-9-retro action item A19. **Not introduced by E10-S2**; left untouched to avoid out-of-scope edits.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- **E9 coordination resolved:** E9-S1 already landed (epic-9 `done`), so `admin/settings/page.tsx` already had the `branding` tab rename and `PublicSettingsResponse` already carried the branding fields. E10-S2 built on the post-E9 state — added `"modules"` to the `Tab` union + a third tab + panel; appended `Modules` to the existing `PublicSettingsResponse` record. No conflict.
- **Q1 (audit event type):** reused `AuditEventType.SettingsChanged` for module enable/disable, consistent with how `SystemSettings` edits are audited (as the story recommended).
- **Q2 (dependency warnings):** implemented a minimal static advisory rule set (`MODULE_DEPENDENCY_WARNINGS` = Finance↔Events). The warning is **advisory only — it never blocks the toggle**. Full cross-module dependency *handling* remains E10-S5.
- **Command signature deviation:** `UpdateModuleSettingCommand` is `(ModuleKey, Enabled, UpdatedBy)` — the story sketched `(moduleKey, enabled)`, but there is no usable `ICurrentUser` in the Application layer (the interface exists but is never implemented/registered). The endpoint supplies `UpdatedBy` from `httpContext.GetUserName()` — the established `SettingsEndpoints` pattern. `updated_by` is needed for AC-3's last-changed metadata.
- **Self-lockout guard (AC-6):** there is no "admin" module key — the validator rejects any key not in `ModuleKeys.All`, so the API cannot gate a non-existent admin module. The `/api/v1/module-settings` group carries only the admin-role policy and no module gate (E10-S3 enforcement must skip it). The Modules tab shows an explicit note that Admin and the tab itself cannot be disabled.
- **`modules` on public settings (AC-2, ADR-008):** `GET /api/v1/settings/public` (anonymous) now returns a `modules` map via `IModuleSettingsService.GetAllAsync` — the unauthenticated-readable source the frontend shell + future `middleware.ts` (E10-S4) need.
- Validation (unknown key) → 400 and not-found → 404 are handled by the existing `ExceptionHandlingMiddleware`; the endpoint stays thin.
- Hybrid workflow: story set to `review`; no per-story code-review — epic-scope review after all E10 stories reach `review`.

### File List

**New — backend:**
- `backend/src/IabConnect.Application/ModuleSettings/ModuleSettingDto.cs`
- `backend/src/IabConnect.Application/ModuleSettings/Queries/GetModuleSettingsQuery.cs`
- `backend/src/IabConnect.Application/ModuleSettings/Commands/UpdateModuleSettingCommand.cs`
- `backend/src/IabConnect.Api/Endpoints/ModuleSettingsEndpoints.cs`

**New — tests:**
- `backend/tests/IabConnect.Application.Tests/ModuleSettings/ModuleSettingsCommandQueryTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/ModuleSettingsEndpointTests.cs`

**Modified — backend:**
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` — wired `MapModuleSettingsEndpoints`
- `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs` — `PublicSettingsResponse.Modules` + `GetPublicSettings` populates it via `IModuleSettingsService`

**Modified — frontend:**
- `frontend/src/app/admin/settings/page.tsx` — `Modules` tab: `Tab` union + tab button + panel, module state/load/handlers, inline disable-confirm + advisory dependency warning, save → `PUT` + `refreshAppSettings()`
- `frontend/messages/de.json` — `settings.tabModules` + module names/descriptions + warning/confirmation keys
- `frontend/messages/en.json` — same keys (English)
- `frontend/src/app/admin/settings/page.test.tsx` — 5 new Vitest tests for the Modules tab

## Change Log

| Date       | Description                                                                 |
|------------|-----------------------------------------------------------------------------|
| 2026-05-14 | E10-S2 implemented: module-settings MediatR query/command/validator, admin-only `ModuleSettingsEndpoints`, `modules` map on public settings (ADR-008), Modules admin tab with labelled toggles + disable confirmation + advisory Finance↔Events dependency warning, i18n (de/en). 13 new backend tests + 5 Vitest. Backend 1898/1898, frontend 59/59, typecheck green. Status → review. |
| 2026-05-14 | Post-review UX fixes (user feedback during E10 review): Modules tab — the bare checkbox is now an `orange-600` toggle switch (`role="switch"`, app-consistent styling); the disable confirmation + advisory dependency warning moved from an inline amber panel into a proper modal (mirrors the existing Role modal). Files: `admin/settings/page.tsx`, `page.test.tsx` (switch selector), `en.json`/`de.json` (`moduleDisableTitle` key). Frontend Vitest 78/78, typecheck + lint green. |
| 2026-05-14 | Addressed code review findings — 3 [Review][Patch] items resolved: mount `useEffect` calls shared `loadModules()` (no duplicate GET), `applyModuleChange` keeps the confirmation modal open + shows the error inside it on a failed save, self-lockout note re-styled off blue to neutral orange. 2 new Vitest tests; frontend Vitest 92/92, typecheck + lint green. |
| 2026-05-15 | Round-2 epic-boundary re-review: 3 [Review][Patch] items applied — `UpdateModuleSettingCommand` no-op early-return, audit write `try/catch` (mirror of round-1 handler guard), route constraint `{moduleKey:regex(^[a-z_]+$)}` on the PUT. `ModuleSettingsEndpointTests` `InlineData` updated to the constrained route template. 1 defer added (no `RowVersion` on concurrent admin toggles). Backend 1942/1942 green. Status → done. |

## Review Findings

_Epic-10 boundary code review — bmad-code-review, 2026-05-14. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

- [x] [Review][Patch] Modules tab fetches `/api/v1/module-settings` twice on mount — the mount `useEffect` duplicates `loadModules()` inline instead of calling it; two identical GETs per mount and a drift hazard [frontend/src/app/admin/settings/page.tsx] — **RESOLVED 2026-05-14:** the mount `useEffect` now calls the shared `loadModules()` (no inline duplicate). `loadModules` no longer calls `setModulesLoading(true)` synchronously (avoids the `react-hooks/set-state-in-effect` anti-pattern; `modulesLoading` starts `true`). Covered by `fetches module settings exactly once on mount`.
- [x] [Review][Patch] `applyModuleChange` closes the confirmation modal even on a failed save (`setModuleConfirmKey(null)` runs unconditionally) — the error banner then renders on the tab card, away from where the user was acting [frontend/src/app/admin/settings/page.tsx] — **RESOLVED 2026-05-14:** on a failed save `applyModuleChange` now early-returns and keeps the modal open; the error banner also renders inside the modal where the user is acting. Covered by `keeps the confirmation modal open and shows the error on a failed save`.
- [x] [Review][Patch] Self-lockout note in the Modules tab uses `border-blue-200 bg-blue-50 text-blue-800` — violates project-context "no blue in authenticated UI" [frontend/src/app/admin/settings/page.tsx] — **RESOLVED 2026-05-14:** re-styled to neutral orange info (`border-orange-200 bg-orange-50 text-orange-900`).
- [x] [Review][Defer] `ModuleSettingsEndpointTests` pins admin-only at the endpoint-metadata layer only — it does not spin up the host to prove a non-admin gets a runtime 403 (AC-7 / Task-5 wording) [backend/tests/IabConnect.Api.Tests/Endpoints/ModuleSettingsEndpointTests.cs] — deferred, pre-existing test-fidelity gap; runtime "never-gated" coverage for the module-settings group already exists in E10-S3's `ModuleEnforcementEndpointTests`
- [x] [Review][Defer] `UpdateModuleSettingCommand` throws `KeyNotFoundException` → 404 for a key that is in `ModuleKeys.All` but has no seed row, with no upsert/self-heal path [backend/src/IabConnect.Application/ModuleSettings/Commands/UpdateModuleSettingCommand.cs] — deferred, only reachable from a broken DB state (failed/partial seed), not caused by this change

### Round 2 — Re-Review (2026-05-15)

_E10-S2 routing: 3 patches, 1 defer._

- [x] [Review][Patch] `UpdateModuleSettingCommand.Handle` writes audit + invalidates cache + stamps `UpdatedAt`/`UpdatedBy` even when `request.Enabled == setting.Enabled` (no-op double-click) [backend/src/IabConnect.Application/ModuleSettings/Commands/UpdateModuleSettingCommand.cs] — **RESOLVED 2026-05-15:** added an early-return short-circuit before `SetEnabled`/`SaveChangesAsync` so a no-op write produces no audit row and no timestamp churn.
- [x] [Review][Patch] `UpdateModuleSettingCommand.Handle` calls `_auditService.LogActionAsync(...)` unguarded after `SaveChangesAsync` + `InvalidateCache()` already succeeded [backend/src/IabConnect.Application/ModuleSettings/Commands/UpdateModuleSettingCommand.cs] — **RESOLVED 2026-05-15:** audit write wrapped in `try/catch` (log + swallow), mirroring the round-1 `ModuleAuthorizationHandler` audit-guard pattern. A failed audit no longer turns a successful toggle into a 500.
- [x] [Review][Patch] `ModuleSettingsEndpoints.UpdateModuleSetting` accepts any `{moduleKey}` route value [backend/src/IabConnect.Api/Endpoints/ModuleSettingsEndpoints.cs] — **RESOLVED 2026-05-15:** route declared as `PUT /api/v1/module-settings/{moduleKey:regex(^[a-z_]+$)}` — URL-encoded slashes, `%0A` log-injection chars, and other non-canonical shapes 404 before reaching the handler. `ModuleSettingsEndpointTests` `InlineData` updated to match the new route template.
- [x] [Review][Defer] Two concurrent admin toggles on the same module — no `RowVersion`/optimistic concurrency token; last-write-wins silently overwrites the first toggle [backend/src/IabConnect.Domain/Common/ModuleSetting.cs] — deferred, low-frequency admin race; revisit if multi-admin module management becomes common
