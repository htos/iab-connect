# Story 10.3: Add Backend Module Enforcement

Status: in-progress

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

- [x] **Task 1 — `ModuleRequirement` + `ModuleAuthorizationHandler` (AC: 1, 3)** — new `Api/Authorization/ModuleAuthorizationHandler.cs` (requirement + handler in one file, mirroring `PermissionAuthorizationHandler.cs` which holds all three pieces):
  - [x] `public sealed class ModuleRequirement : IAuthorizationRequirement { public string ModuleKey { get; } ... }` — mirror `PermissionRequirement`.
  - [x] `ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>` — override `HandleRequirementAsync`, resolve `IModuleSettingsService`, `await IsEnabledAsync(requirement.ModuleKey, ...)`; on enabled → `context.Succeed(requirement)`; on disabled → do not succeed and write the audit event. **The body becomes genuinely `async`** (unlike the synchronous `PermissionAuthorizationHandler`). CancellationToken sourced from `context.Resource as HttpContext` → `RequestAborted`.
  - [x] **Register Scoped** (`services.AddScoped<IAuthorizationHandler, ModuleAuthorizationHandler>()`) in `Api/DependencyInjection.cs` next to the Permission handler — Scoped, because it needs the scoped `IModuleSettingsService` / audit services.
- [x] **Task 2 — Extend the policy provider (AC: 2)** — in `Api/Authorization/PermissionAuthorizationHandler.cs`, extended `PermissionPolicyProvider.GetPolicyAsync`: added a `Module:` (OrdinalIgnoreCase) branch returning `new AuthorizationPolicyBuilder().AddRequirements(new ModuleRequirement(key)).Build()`. No second `IAuthorizationPolicyProvider` — the single provider is extended.
- [x] **Task 3 — Audit event type + logging path (AC: 3)** — added `ModuleAccessDenied` to `AuditEventType` (`Domain/Audit/AuditEnums.cs`, "System events" block). `AuditService.LogActionAsync`'s `_ => AuditCategory.System` default already covers it (verified). **Logging path (Q1): chose option (b)** — `IAuditService` injected into the handler, `LogActionAsync(AuditEventType.ModuleAccessDenied, ...)` called directly; no `ISecurityAuditLogger` interface churn.
- [x] **Task 4 — Apply `Module:` policies to route groups (AC: 4, 4a, 5)** — added `.RequireAuthorization("Module:<key>")` to the **protected business group** in each endpoint file (NOT the anonymous sub-groups):
  - [x] **Members** (`Module:members`): `MemberEndpoints.cs` `members` group; `MemberSegmentEndpoints.cs` (gated under `Module:members` per **Q2** recommendation).
  - [x] **Events** (`Module:events`): `EventEndpoints.cs` — gated the whole `group`, with `.AllowAnonymous()` added to the 5 public/token-based endpoints (`/public`, `/public/{id}`, the 3 `*.ics` feeds) so they opt out; `EventRegistrationEndpoints.cs` — gated the `protectedGroup`, public RSVP stays `.AllowAnonymous()`; `EventVolunteerEndpoints.cs` `roleGroup` + `shiftGroup`.
  - [x] **Documents** (`Module:documents`): `DocumentEndpoints.cs` `folders` + `documents` groups.
  - [x] **Communication** (`Module:communication`): `EmailCampaignEndpoints.cs`, `EmailTemplateEndpoints.cs`.
  - [x] **Finance** (`Module:finance`): all 20 single-group `/api/v1/finance/*` files + `ArchiveEndpoints.cs` (3 groups, incl. the `/api/v1/admin/finance` group — gated per **Q3** recommendation).
  - [x] **Partners** (`Module:partners`): `SponsorEndpoints.cs` protected `group` only (public group left un-gated); `SupplierEndpoints.cs`.
  - [x] Left **un-gated**: `UserEndpoints`, `CustomRoleEndpoints`, `AuditEndpoints`, `BackupEndpoints`, `RetentionEndpoints`, `SettingsEndpoints`, `ModuleSettingsEndpoints`, `IdentityEndpoints`, `PrivacyEndpoints`, `ReportEndpoints`, `SearchEndpoints`, `RegistrationEndpoints`, `UnsubscribeEndpoints`, Blog/Contact, and the public sub-groups of Sponsor/EventRegistration/Event.
- [x] **Task 5 — Tests (AC: 6)**
  - [x] `IabConnect.Api.Tests` (`Endpoints/ModuleEnforcementEndpointTests.cs`): per module — disabled → 403; disabled finance → `ModuleAccessDenied` audit row written; enabled → not blocked by the gate; never-gated groups (Settings, ModuleSettings) reachable with all modules disabled; anonymous endpoints (public settings, public sponsors, public calendar feed) reachable with modules disabled. New test infrastructure: `TestAuthHandler` (header-driven auth scheme) + `TestModuleSettingsService` (mutable double) wired into `TestWebApplicationFactory`.
  - [x] `IabConnect.Api.Tests` (`Authorization/ModuleAuthorizationHandlerTests.cs`): `ModuleAuthorizationHandler` succeeds for enabled / does not succeed (and never `Fail()`s) + audits for disabled, against a Moq `IModuleSettingsService`; plus `PermissionPolicyProvider` `Module:`/`Permission:` prefix coverage. (Placed in Api.Tests — the handler lives in `IabConnect.Api`, unreachable from `Application.Tests`.)
  - [x] `dotnet test` from `backend/` green: **1918/1918** (Application 1439, Api 95 incl. +20 new, Infrastructure 384), **0 warnings**.

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

claude-opus-4-7[1m] (Amelia / bmad-dev-story)

### Debug Log References

- `dotnet build` (backend): succeeded, 0 warnings / 0 errors.
- `dotnet test` (backend full suite): 1918/1918 passed — Application.Tests 1439, Api.Tests 95, Infrastructure.Tests 384. 0 warnings.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- ✅ **Task 1** — `ModuleRequirement` + `ModuleAuthorizationHandler` in one new file mirroring `PermissionAuthorizationHandler.cs`. Handler is genuinely `async`, registered **Scoped** (the Permission handler stays Singleton). CancellationToken sourced from `context.Resource as HttpContext`.RequestAborted.
- ✅ **Task 2** — `PermissionPolicyProvider.GetPolicyAsync` extended with a sibling `Module:` branch; the single registered policy provider is reused, not replaced.
- ✅ **Task 3** — `AuditEventType.ModuleAccessDenied` appended to the "System events" block (value-stable for existing entries). **Q1 resolved → option (b):** the handler injects `IAuditService` and calls `LogActionAsync(ModuleAccessDenied, …)` directly — no `ISecurityAuditLogger` interface churn. `_ => AuditCategory.System` default confirmed correct.
- ✅ **Task 4** — `.RequireAuthorization("Module:<key>")` applied across **31 endpoint files**. Key implementation note: ASP.NET Core's `AuthorizationMiddleware` short-circuits (skips ALL authorization, including custom requirements) when an endpoint carries `IAllowAnonymous` metadata — so gating a whole group is safe as long as every anonymous endpoint in it has `.AllowAnonymous()`. For `EventEndpoints` the 5 public/token-based endpoints had no auth metadata at all, so `.AllowAnonymous()` was added to each (behaviour-preserving) and the whole `group` gated. `EventRegistrationEndpoints`/`EventVolunteerEndpoints`/`EmailTemplateEndpoints` chain `.RequireAuthorization().RequireAuthorization("Module:<key>")` to keep the default-authn requirement.
- **Q2 resolved** → `MemberSegmentEndpoints` gated under `Module:members`. **Q3 resolved** → `ArchiveEndpoints`' `/api/v1/admin/finance` group gated under `Module:finance`. **Q4** → only authenticated groups gated here; anonymous endpoints whose module is disabled are deferred to E10-S5 (verified by `AnonymousEndpoints_StayReachable_WithModulesDisabled`).
- ✅ **Task 5** — New test infrastructure: `TestAuthHandler` (header-driven auth scheme, default-scheme replacement; `NoResult` without the header so existing anonymous→401 tests are unaffected) + `TestModuleSettingsService` (mutable, all-enabled-by-default `IModuleSettingsService` double) wired into the shared `TestWebApplicationFactory`. 20 new tests (16 integration + 4 unit), full suite green with no regressions.

### File List

**New:**
- `backend/src/IabConnect.Api/Authorization/ModuleAuthorizationHandler.cs`
- `backend/tests/IabConnect.Api.Tests/TestAuthHandler.cs`
- `backend/tests/IabConnect.Api.Tests/TestModuleSettingsService.cs`
- `backend/tests/IabConnect.Api.Tests/Authorization/ModuleAuthorizationHandlerTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/ModuleEnforcementEndpointTests.cs`

**Modified — core mechanism:**
- `backend/src/IabConnect.Api/Authorization/PermissionAuthorizationHandler.cs` (`Module:` branch in `PermissionPolicyProvider`)
- `backend/src/IabConnect.Domain/Audit/AuditEnums.cs` (`ModuleAccessDenied`)
- `backend/src/IabConnect.Api/DependencyInjection.cs` (Scoped handler registration)
- `backend/tests/IabConnect.Api.Tests/TestWebApplicationFactory.cs` (test auth scheme + module-settings double)

**Modified — route-group gating (31 endpoint files):**
- Members: `MemberEndpoints.cs`, `MemberSegmentEndpoints.cs`
- Events: `EventEndpoints.cs`, `EventRegistrationEndpoints.cs`, `EventVolunteerEndpoints.cs`
- Documents: `DocumentEndpoints.cs`
- Communication: `EmailCampaignEndpoints.cs`, `EmailTemplateEndpoints.cs`
- Partners: `SponsorEndpoints.cs`, `SupplierEndpoints.cs`
- Finance: `AccountEndpoints.cs`, `AccountingReportEndpoints.cs`, `ActivityAreaEndpoints.cs`, `ArchiveEndpoints.cs`, `BankImportEndpoints.cs`, `CategoryEndpoints.cs`, `DashboardEndpoints.cs`, `DunningEndpoints.cs`, `ExpenseClaimEndpoints.cs`, `FinanceExportEndpoints.cs`, `FinanceProfileEndpoints.cs`, `FiscalPeriodEndpoints.cs`, `InvoiceEndpoints.cs`, `InvoiceTemplateEndpoints.cs`, `JournalEntryEndpoints.cs`, `LedgerAccountEndpoints.cs`, `PaymentEndpoints.cs`, `PostingMappingEndpoints.cs`, `ReceiptEndpoints.cs`, `TaxCodeEndpoints.cs`, `TransactionEndpoints.cs`

## Change Log

| Date       | Change                                                                                          |
|------------|-------------------------------------------------------------------------------------------------|
| 2026-05-14 | E10-S3 implemented: `ModuleRequirement`/`ModuleAuthorizationHandler`, `Module:` policy-provider prefix, `AuditEventType.ModuleAccessDenied`, `.RequireAuthorization("Module:<key>")` across 31 endpoint files. 20 new tests; backend 1918/1918 green, 0 warnings. Status → review. |
| 2026-05-14 | Post-review bug fix (user feedback during E10 review): the whole `members` route group was gated by `Module:members`, which also caught the `/api/v1/members/me*` self-service endpoints — so "My Profile" broke when the members module was disabled (violates AC-4a, "My Profile … not gated"). Fix: `MemberEndpoints.cs` now applies `Module:members` to a `memberManagement` sub-group only; the 3 `/me*` endpoints stay un-gated. New regression test `MyProfileEndpoint_StaysReachable_WhenMembersModuleDisabled` + `ModuleEnforcementEndpointTests` now uses a GUID test `sub`. Backend 1931/1931 green, 0 warnings. |

## Review Findings

_Epic-10 boundary code review — bmad-code-review, 2026-05-14. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

- [ ] [Review][Patch] Move `calendar/token/rotate` + `calendar/token/revoke` off the `Module:events`-gated group so a member can always rotate/revoke a leaked feed token — _(resolves the original Decision: feeds stay always-on per Q4, only token management is un-gated)_ [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs:110-118]
- [ ] [Review][Patch] `/api/v1/my-registrations` and `/api/v1/registrations/check-in/{qrCodeToken}` are mapped directly on `endpoints`, not on `protectedGroup`, so they escape `Module:events` gating — despite Task 4 / the File List claiming `EventRegistrationEndpoints.cs` fully handled (AC-4) [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:184,196]
- [ ] [Review][Patch] `ModuleAuthorizationHandler` deny path calls `IAuditService.LogActionAsync` unguarded — if the audit write throws, the clean 403 is replaced by a 500 and the denial is never recorded; wrap the audit call so a logging failure cannot mask the authorization outcome [backend/src/IabConnect.Api/Authorization/ModuleAuthorizationHandler.cs]
