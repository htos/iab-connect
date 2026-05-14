# Story 10.3: Add Backend Module Enforcement

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **security stakeholder**,
I want **disabled-module endpoints to return 403**,
so that **the backend is the real enforcement boundary — not the hidden navigation or the route guard**.

**Requirement:** REQ-087. Epic E10, Story 3 of 5.
**Depends on E10-S1** (`IModuleSettingsService`, `ModuleKeys`). This is **layer 1 of ADR-008's three-layer enforcement — the only actual security control**. E10-S4 (frontend) and the sidebar are UX/convenience only.

## Acceptance Criteria

1. **`ModuleRequirement` + handler.** A `ModuleRequirement : IAuthorizationRequirement` (holds a `ModuleKey` string) and a `ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>` that resolves `IModuleSettingsService`, succeeds when the module is enabled, and otherwise does not succeed (→ 403). Both live in one file in `IabConnect.Api/Authorization/` (the codebase co-locates requirement + handler + provider).
2. **`Module:` policy prefix.** The existing `PermissionPolicyProvider` is **extended** (not replaced) to also recognize a `Module:` policy-name prefix, so route groups can declare `.RequireAuthorization("Module:<key>")` exactly like the existing `Permission:` prefix works.
3. **Denial is audited.** A disabled-module denial writes a security audit event using a new `AuditEventType.ModuleAccessDenied`. (See Q1 for the logging path — `ISecurityAuditLogger.LogAccessDenied` currently hard-codes a different event type.)
4. **Applied to all module route groups.** `.RequireAuthorization("Module:<key>")` is added to the protected route groups for Members, Events, Documents, Communication, Finance, and Partners — per the mapping in Dev Notes. **Anonymous/public sub-groups in those same files are NOT gated** (e.g. the public sponsor group, the anonymous RSVP endpoint, public blog/contact). Public View is special-cased in E10-S5, not here.
4a. **Never gated.** Dashboard, My Profile, Admin, Identity/profile, Privacy (DSGVO self-service), the Settings endpoints, and the module-settings endpoints themselves are **not** gated — confirmed by tests.
5. **Behavior preserved.** With all 7 modules enabled (the seed state), every endpoint behaves exactly as before — no 403s, no latency regression beyond a cached module-state read.
6. **Quality gate.** `dotnet test` from `backend/` green (1837/1837+, 0 warnings) with: API tests proving a disabled module returns 403 + writes the audit event, an enabled module passes, and the never-gated groups stay reachable; Application tests for `ModuleAuthorizationHandler`.

## Tasks / Subtasks

- [ ] **Task 1 — `ModuleRequirement` + `ModuleAuthorizationHandler` (AC: 1, 3)** — new `Api/Authorization/ModuleAuthorizationHandler.cs` (requirement + handler in one file, mirroring `PermissionAuthorizationHandler.cs` which holds all three pieces):
  - [ ] `public sealed class ModuleRequirement : IAuthorizationRequirement { public string ModuleKey { get; } ... }` — mirror `PermissionRequirement`.
  - [ ] `ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>` — override `HandleRequirementAsync`, resolve `IModuleSettingsService`, `await IsEnabledAsync(requirement.ModuleKey, ...)`; on enabled → `context.Succeed(requirement)`; on disabled → do not succeed and write the audit event. **The body becomes genuinely `async`** (unlike the synchronous `PermissionAuthorizationHandler`).
  - [ ] **Register Scoped** (`services.AddScoped<IAuthorizationHandler, ModuleAuthorizationHandler>()`) in `Api/DependencyInjection.cs` next to line 176 — Scoped, because it needs the scoped `IModuleSettingsService` / audit services. (The existing `PermissionAuthorizationHandler` is Singleton because it resolves nothing scoped — this one differs deliberately.)
- [ ] **Task 2 — Extend the policy provider (AC: 2)** — in `Api/Authorization/PermissionAuthorizationHandler.cs`, extend `PermissionPolicyProvider.GetPolicyAsync` (lines ~73–85): add a second `if` branch — if `policyName` starts with `"Module:"` (OrdinalIgnoreCase), strip the prefix and return `new AuthorizationPolicyBuilder().AddRequirements(new ModuleRequirement(key)).Build()`. **Do NOT add a second `IAuthorizationPolicyProvider`** — there can be only one registered; extend this one.
- [ ] **Task 3 — Audit event type + logging path (AC: 3)** — add `ModuleAccessDenied` to `AuditEventType` in `Domain/Audit/AuditEnums.cs` (in the "System events" block, ~line 50). Verify `AuditService.LogActionAsync`'s `AuditEventType → AuditCategory` switch (`Infrastructure/Audit/AuditService.cs` ~142–167) — the `_ => AuditCategory.System` default is correct for `ModuleAccessDenied`. **Logging path (Q1):** `ISecurityAuditLogger.LogAccessDenied` currently hard-codes `AuditEventType.DataViewed` — so either (a) add `LogModuleAccessDenied(...)` to `ISecurityAuditLogger`, or (b) inject `IAuditService` into the handler and call `LogActionAsync(AuditEventType.ModuleAccessDenied, ...)` directly. Recommend (b) — simpler, no interface churn.
- [ ] **Task 4 — Apply `Module:` policies to route groups (AC: 4, 4a, 5)** — add `.RequireAuthorization("Module:<key>")` to the **protected business group** in each endpoint file (NOT the anonymous sub-groups):
  - [ ] **Members** (`Module:members`): `MemberEndpoints.cs` `members` group (~line 31); confirm `MemberSegmentEndpoints.cs` (~20) — see Q2.
  - [ ] **Events** (`Module:events`): `EventEndpoints.cs` (~23); `EventRegistrationEndpoints.cs` — gate the `protectedGroup` (~24) **but not** the `AllowAnonymous` RSVP endpoint (~29); `EventVolunteerEndpoints.cs` (~34, ~67).
  - [ ] **Documents** (`Module:documents`): `DocumentEndpoints.cs` `folders` (~23) and `documents` (~57) groups.
  - [ ] **Communication** (`Module:communication`): `EmailCampaignEndpoints.cs` (~21), `EmailTemplateEndpoints.cs` (~11).
  - [ ] **Finance** (`Module:finance`): all ~21 `/api/v1/finance/*` endpoint groups (full list in Dev Notes). `ArchiveEndpoints.cs` has a `/api/v1/admin/finance` group — see Q3.
  - [ ] **Partners** (`Module:partners`): `SponsorEndpoints.cs` protected group (~27) **but not** the public group (~20); `SupplierEndpoints.cs` (~18).
  - [ ] Leave **un-gated**: `UserEndpoints`, `CustomRoleEndpoints`, `AuditEndpoints`, `BackupEndpoints`, `RetentionEndpoints`, `SettingsEndpoints`, `ModuleSettingsEndpoints`, `IdentityEndpoints`, `PrivacyEndpoints`, `ReportEndpoints`, `SearchEndpoints`, `RegistrationEndpoints`, `UnsubscribeEndpoints`, and the public sub-groups of Blog/Contact/Sponsor.
- [ ] **Task 5 — Tests (AC: 6)**
  - [ ] `IabConnect.Api.Tests`: per module — disabled → 403 + `ModuleAccessDenied` audit row written; enabled → passes; never-gated groups (Settings, ModuleSettings, Admin, Identity, Privacy, Reports, Search) reachable regardless of module state; anonymous endpoints (public sponsors, RSVP, public blog/contact) reachable when their module is "disabled" for authenticated use (or confirm scope — see Q2/Q4).
  - [ ] `IabConnect.Application.Tests` (or Api.Tests): `ModuleAuthorizationHandler` succeeds/fails correctly against a stub `IModuleSettingsService`.
  - [ ] `dotnet test` from `backend/` green, 0 warnings.

## Dev Notes

### The exact pattern to mirror: PermissionAuthorizationHandler.cs

All three pieces — `PermissionRequirement`, `PermissionAuthorizationHandler`, `PermissionPolicyProvider` — live in **one file**: `backend/src/IabConnect.Api/Authorization/PermissionAuthorizationHandler.cs`. Mirror this:
- **`PermissionRequirement`** (~10–18): `sealed`, single string property, ctor-assigned. → `ModuleRequirement` with `ModuleKey`.
- **`PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>`** (~23–58): `sealed`, ctor injects only `ILogger` (it's a **Singleton**). Overrides `HandleRequirementAsync`, on pass `context.Succeed(requirement)`, on fail only logs (never `context.Fail()` — lets other handlers still pass). Returns `Task.CompletedTask`. → `ModuleAuthorizationHandler` differs: it needs scoped services, so register it **Scoped** and make `HandleRequirementAsync` genuinely `async`.
- **`PermissionPolicyProvider : IAuthorizationPolicyProvider`** (~63–96): `private const string PermissionPolicyPrefix = "Permission:"`. `GetPolicyAsync`: if name starts with the prefix, strip it (`policyName[Prefix.Length..]`), build `new AuthorizationPolicyBuilder().AddRequirements(new PermissionRequirement(...)).Build()`; else delegate to the `DefaultAuthorizationPolicyProvider` fallback. → **add a sibling `if` for `"Module:"`** in the same method.
- **DI** (`Api/DependencyInjection.cs` ~175–177): `AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>()` + `AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>()`. Add `AddScoped<IAuthorizationHandler, ModuleAuthorizationHandler>()`. The `PermissionPolicyProvider` registration stays — the class is just extended.

A failing authorization requirement yields **403 Forbidden** by default — exactly the desired "module disabled" response.

### Finance route groups to gate (`Module:finance`)

All under `/api/v1/finance/*`: `AccountEndpoints`, `AccountingReportEndpoints`, `ActivityAreaEndpoints`, `BankImportEndpoints`, `CategoryEndpoints`, `DashboardEndpoints` (finance dashboard), `DunningEndpoints`, `ExpenseClaimEndpoints`, `FinanceExportEndpoints`, `FinanceProfileEndpoints`, `FiscalPeriodEndpoints`, `InvoiceEndpoints`, `InvoiceTemplateEndpoints`, `JournalEntryEndpoints`, `LedgerAccountEndpoints`, `PaymentEndpoints`, `PostingMappingEndpoints`, `ReceiptEndpoints`, `TaxCodeEndpoints`, `TransactionEndpoints`, `ArchiveEndpoints` (3 groups — the `/api/v1/admin/finance` one is admin tooling, see Q3).

### Gating gotcha — mixed public/protected files

`EventRegistrationEndpoints`, `SettingsEndpoints`, `BlogEndpoints`, `ContactEndpoints`, `SponsorEndpoints`, `CustomRoleEndpoints` each declare a public/`AllowAnonymous` group AND a protected group in the same file. Attach `Module:<key>` **only to the protected business group**, never the anonymous one. `EventRegistrationEndpoints` specifically has a public RSVP endpoint at ~line 29 that must stay anonymous even when... actually — if the Events module is disabled, should public RSVP still work? See Q4. Default: gate only the authenticated `protectedGroup`; leave public RSVP to E10-S5's Public View handling.

### Audit facts

- `AuditEventType` enum at `Domain/Audit/AuditEnums.cs` (~6–51), grouped by comment blocks; `ModuleAccessDenied` goes in "System events" (~48–50).
- `AuditService.LogActionAsync` (`Infrastructure/Audit/AuditService.cs` ~142–167) maps event type → category via a `switch` with `_ => AuditCategory.System` default — fine for `ModuleAccessDenied`.
- `ISecurityAuditLogger.LogAccessDenied` (`Application/Authorization/SecurityAuditLogger.cs`, signature ~18–24) is `void`, fire-and-forget, and its impl **hard-codes `AuditEventType.DataViewed`** for the persist call — so it cannot directly emit `ModuleAccessDenied`. Use `IAuditService.LogActionAsync(AuditEventType.ModuleAccessDenied, ...)` directly from the handler (Q1).

### Architecture & project constraints

- **ADR-008:** backend is the single security boundary; layers 2 (middleware) and 3 (nav) are UX only. Model on the existing `Permission*` pattern — there is no `IEndpointFilter` infrastructure in the codebase. [Source: architecture.md#ADR-008]
- **ADR-003:** every protected capability enforces backend authorization; denied access is audit logged. [Source: architecture.md#ADR-003]
- Always-on, never gated: Dashboard, My Profile, Admin — including the module-settings endpoints, so an admin can always re-enable a module. [Source: architecture.md#ADR-008]
- `IModuleSettingsService` is cached (E10-S1); enforcement reads are cheap. The cache is invalidated on write (E10-S2). [Source: architecture.md#ADR-007/008]
- C# nullable + warnings-as-errors; `CancellationToken` through the async handler. [Source: project-context.md]
- Authorization/audit are sensitive — regression tests required. [Source: project-context.md]

### Project Structure Notes

NEW: `Api/Authorization/ModuleAuthorizationHandler.cs`. UPDATE: `Api/Authorization/PermissionAuthorizationHandler.cs` (extend `PermissionPolicyProvider`), `Domain/Audit/AuditEnums.cs`, `Api/DependencyInjection.cs` (register handler), and `~30 endpoint files` (one `.RequireAuthorization("Module:<key>")` line each). No migration, no new packages.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E10-S3: Add Backend Module Enforcement]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] — three-layer enforcement, code-grounded mechanism
- [Source: backend/src/IabConnect.Api/Authorization/PermissionAuthorizationHandler.cs] — the exact pattern to mirror
- [Source: backend/src/IabConnect.Domain/Audit/AuditEnums.cs] + [Source: backend/src/IabConnect.Application/Authorization/SecurityAuditLogger.cs]
- [Source: e10-s1-add-module-settings-data-model-and-service.md] — dependency (`IModuleSettingsService`, `ModuleKeys`)

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **Audit logging path.** `ISecurityAuditLogger.LogAccessDenied` hard-codes `AuditEventType.DataViewed`. Recommend injecting `IAuditService` into `ModuleAuthorizationHandler` and calling `LogActionAsync(AuditEventType.ModuleAccessDenied, ...)` directly, rather than churning the `ISecurityAuditLogger` interface. Confirm.
2. **`MemberSegmentEndpoints` / `ReportEndpoints` / `SearchEndpoints`.** Member segments are member-adjacent — gate under `Module:members`? Reports/Search are cross-cutting — leave un-gated? Recommend: gate `member-segments` under `Module:members`; leave Reports/Search un-gated (they aggregate across modules; gating them is messy). Confirm.
3. **`ArchiveEndpoints` `/api/v1/admin/finance` group.** It's admin tooling under the Finance umbrella. Gate under `Module:finance`, or treat as admin (never gated)? Recommend gate under `Module:finance` (it's finance data).
4. **Anonymous endpoints whose module is disabled.** If Events is disabled, should the public/anonymous RSVP endpoint still work? If Partners is disabled, the public sponsor list? Recommend: E10-S3 gates only authenticated groups; anonymous endpoints tied to a disabled module are handled by E10-S5's Public View logic. Confirm the split.

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
