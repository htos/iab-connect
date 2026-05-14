# Story 10.2: Add Module Settings API and Modules Admin Tab

Status: ready-for-dev

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

- [ ] **Task 1 — MediatR query + command (AC: 1, 5)** — in `IabConnect.Application/ModuleSettings/Queries/` and `/Commands/` (auto-discovered by `RegisterServicesFromAssembly` — no manual DI): `GetModuleSettingsQuery` → returns all 7 module settings with metadata; `UpdateModuleSettingCommand(string moduleKey, bool enabled)` → loads via `IModuleSettingsRepository`, calls `ModuleSetting.SetEnabled(...)`, `repo.Update`, `IUnitOfWork.SaveChangesAsync`, then `IModuleSettingsService.InvalidateCache()`, then audit. FluentValidation validator: `moduleKey` must be in `ModuleKeys.All`.
- [ ] **Task 2 — Admin endpoint group (AC: 1, 6)** — new `Api/Endpoints/ModuleSettingsEndpoints.cs` with `MapModuleSettingsEndpoints`, mirroring the `SettingsEndpoints.cs` admin group (`MapGroup("/api/v1/module-settings")` + `.RequireAuthorization(policy => policy.RequireRole("admin"))`). `GET /` → query; `PUT /{moduleKey}` → command. Register in `EndpointMapper.cs`. **This group must never be `Module:`-gated** (E10-S3 enforces; just don't add the policy here).
- [ ] **Task 3 — `modules` on public settings (AC: 2)** — extend `PublicSettingsResponse` record in `SettingsEndpoints.cs` (lines 139–143) with `IReadOnlyDictionary<string,bool> Modules`; populate it in `GetPublicSettings` (lines 45–56) via `IModuleSettingsService.GetAllAsync(ct)`. **Coordinate with E9-S1**, which also extends `PublicSettingsResponse` (with branding fields) — both add to the same record.
- [ ] **Task 4 — Modules admin tab (AC: 3, 4)** — `frontend/src/app/admin/settings/page.tsx`:
  - [ ] Add `"modules"` to the `Tab` type (line 50 — **note E9-S1 renames `general`→`branding`; coordinate**) and a third tab button (lines 331–352 block) with a `settings.tabModules` i18n key.
  - [ ] New `{activeTab === "modules" && (...)}` panel: a `rounded-xl bg-white p-6 shadow-sm` card, one row per module — label + description text + a labelled toggle (reuse the checkbox pattern from the role modal, lines 826–845) + last-changed metadata. Own `modulesMessage` state for the success/error banner.
  - [ ] Disabling a module → confirmation dialog (reuse the `deleteConfirmId` inline-confirm pattern or a modal); show a dependency-warning alert for known cross-module pairs (Finance↔Events).
  - [ ] Load via `GET /api/v1/module-settings`, save via `PUT /api/v1/module-settings/{key}`, then `refreshAppSettings()`.
  - [ ] Add `settings.tabModules` + per-module name/description + warning/confirmation i18n keys to `de.json` and `en.json`.
- [ ] **Task 5 — Tests (AC: 7)**
  - [ ] `IabConnect.Api.Tests`: `GET`/`PUT /api/v1/module-settings` require admin; non-admin → 403; the module-settings endpoints are reachable regardless of any module state.
  - [ ] `IabConnect.Application.Tests`: command validates `moduleKey`, updates, invalidates cache, audits; query returns all 7.
  - [ ] Vitest: Modules tab renders 7 toggles, disabling shows confirmation, dependency warning renders for Finance↔Events, save calls `PUT` + `refreshAppSettings()`.

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

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.

### File List
