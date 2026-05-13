# Sprint Change Proposal — 2026-05-13

Project: iab-connect
Author: Harry (via bmad-correct-course)
Date: 2026-05-13
Scope classification: **Minor** — Direct Adjustment, no PRD/Architecture/Epic changes
Status: Approved-pending → ready for Dev handoff

---

## 1. Issue Summary

**Trigger:** Epic 1 (Identity Foundation, REQ-009/REQ-010) was implemented across stories E1.S1–E1.S4 and moved to status `review` per the hybrid workflow (skip per-story `bmad-code-review`; bundle review + retrospective at epic boundary).

**Finding:** The 2026-05-13 Epic-Boundary-Review surfaced **11 open `[Review][Patch]` items** across E1.S2, E1.S3, and E1.S4 that must be cleared before the epic moves from `review` to `done`. Some uncommitted partial fixes (P1–P6) are present in the working tree (`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`, `backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`) but the patch list is incomplete and one partial fix introduced a test regression.

**Severity:**
- 5 patches are **critical** (security, test regression, AC violation, user-lockout bug)
- 6 patches are **polish** (audit semantics, observability, privacy notice, OpenAPI metadata)

**Discovery context:** Standard end-of-epic boundary review per the project's hybrid workflow. No change in PRD, architecture, UX scope, or epic plan.

---

## 2. Impact Analysis

### Epic Impact

| Epic / Story | Status | Impact |
|---|---|---|
| E1.S1 Configure Role-Based MFA Policy | `review`, clean (no open patches) | None. Eligible to flip to `done` once dependencies are clean. |
| E1.S2 Add Admin MFA Support Operations | `review` | 3 open patches (1 polish + 2 critical from Epic Boundary). |
| E1.S3 Add Session and Device Visibility | `review` | 4 open patches (2 polish + 2 from Epic Boundary). |
| E1.S4 Add Session Revocation | `review` | 4 open patches (2 polish + 2 critical from Epic Boundary). |
| E1.S5 Add Social/Enterprise Identity Providers | Deferred (per `deferred-work.md`, commit `04e666a`) | None — explicit defer remains. |
| E2–E8 | Backlog | Not blocked, but should not start until E1 is `done`. |

### Story / Artifact Impact

- **Story files** (3): existing `## Review Findings` sections track all 11 patches; no new ACs added, only patch closure.
- **PRD:** no change.
- **Architecture:** no change.
- **UX Design:** no change. Privacy notice (E1.S3 patch #6) adds two next-intl strings, no new screen or flow.
- **Sprint plan:** no change.
- **`sprint-status.yaml`:** flip E1.S1–S4 from `review` → `done` after all patches green.
- **`docs/05_security_privacy.md`:** may need minor wording update for the IP privacy notice (REQ-010 section).

### Technical Impact

- **Backend:**
  - `IabConnect.Infrastructure/Identity/KeycloakAdminService.cs` — GUID validation expansion (S2 #2), Keycloak-400 handling for execute-actions-email (S2 #3), null-Id filter on admin path (S3 #7).
  - `IabConnect.Api/Endpoints/IdentityEndpoints.cs` — logger category fix (S4 #8), client-name filter (S3 #4).
  - `IabConnect.Api/Endpoints/UserEndpoints.cs` — `LogAccessDenied` distinction from infra errors (S2 #1), missing `LogAccessDenied` in `GetUserSessions` not-found path (S3 #5), `Produces(500)` on admin endpoints (S4 #9), idempotent audit on admin revoke not-found (S4 #11).
  - **Tests:** `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceSessionsTests.cs` and `KeycloakAdminServiceRevokeSessionTests.cs` need updates so the 5 existing tests use valid UUIDs after GUID-validation tightening (S4 #10 — currently red).
- **Frontend:**
  - `frontend/src/app/profile/security/page.tsx`, `frontend/src/app/admin/users/[id]/sessions/page.tsx` — add translated privacy notice next to IP (S3 #6).
  - `frontend/messages/{de,en}.json` — new next-intl keys for privacy notice.
- **CI / Build:** Currently `dotnet test` is red because of the S4 #10 regression. Cannot merge or close epic until restored to green.

---

## 3. Recommended Approach

**Selected path: Direct Adjustment**

- No epic restructuring, no PRD or architecture change.
- All 11 patches are scoped within existing E1 story specs.
- Hybrid workflow precedent (per user memory): epic-boundary patches are owned by the originating story; no new "cleanup story" needed.
- Routes to Dev agent per story.

### Effort / Risk

| | Estimate |
|---|---|
| Effort | **Low–Medium** — ~½ day each for S2, S3, S4 if patches are batched per story |
| Technical risk | **Low** — all changes are localized, additive, or restorative (audit, validation, filtering) |
| Schedule impact | **None** — must complete before E2 starts; aligns with planned sequence |

### Alternatives considered

- **Rollback:** Not viable. The implemented behaviour is correct; only edge-case handling and audit/test polish remain.
- **MVP Review:** Not viable. No scope reduction is needed. Identity foundation remains MVP-required.
- **Consolidated cleanup story:** Considered. Rejected because story-internal `Review Findings` lists already track all items; adding a new story would duplicate tracking and break the hybrid workflow.

---

## 4. Detailed Change Proposals

### E1.S2 — Add Admin MFA Support Operations

#### Patch S2.1 — Distinguish audit logging for infrastructure errors

**File:** `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`

**Where:** `ResetUserMfa` handler, generic `catch (Exception ex)` path.

**Change:** Replace `LogAccessDenied` call with a non-audit operational error log (e.g., `_logger.LogError(ex, ...)` plus `LogOperationFailure` if a finer audit verb exists). Reserve `LogAccessDenied` only for actual permission failures.

**Rationale:** Infrastructure failures are not access-denial events. Mislabeled audit entries pollute security audit trails and violate the audit pattern documented in `docs/05_security_privacy.md`.

#### Patch S2.2 — Add GUID validation to all userId-interpolating service methods

**File:** `backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`

**Where:** `ResetUserMfaAsync`, `SendPasswordResetEmailAsync`, and any other method that embeds `userId` directly in Admin API URLs.

**Change:** Apply the same `Guid.TryParse` pattern that P1 introduced for `GetUserSessionsAsync`/`RevokeSessionAsync`. Throw `ArgumentException` early if `userId` is not a valid GUID.

**Rationale:** Path-traversal risk via Keycloak Admin API URL injection. P1 closed two paths; the remaining methods inherit the same exposure.

#### Patch S2.3 — Handle Keycloak 400 in execute-actions-email path

**File:** `backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`

**Where:** `ResetUserMfaAsync` after MFA credentials are deleted, before/around `actionsResponse.EnsureSuccessStatusCode()`.

**Change:** Inspect Keycloak's response status. If 400 (user has no verified email), return a domain-level result (e.g., `KeycloakActionEmailUnavailableException` or a tagged result) that the API layer can surface as a 422/409 with a specific message — instead of throwing as if it were an infrastructure failure. Backend response should make clear that MFA credentials were removed but re-enrollment email could not be sent.

**Rationale:** Otherwise the user is locked out: MFA credentials are gone but no re-enrollment link is delivered, and the admin sees an opaque 500.

### E1.S3 — Add Session and Device Visibility

#### Patch S3.1 — Filter internal Keycloak client names

**File:** `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs` (`SessionMapper.ToDto`)

**Change:** Filter `session.Clients` to exclude internal/system clients. Use a configurable prefix or name-pattern list (e.g., `-backend`, `admin-cli`, `realm-management`, `security-admin-console`, `account`, `broker`) read from configuration with a sensible default.

**Rationale:** Decision recorded: filter internal clients. Avoid surfacing infrastructure-tier client names to end users.

#### Patch S3.2 — Add LogAccessDenied to GetUserSessions KeycloakNotFoundException catch

**File:** `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (`GetUserSessions`)

**Change:** In the `catch (KeycloakNotFoundException)` branch, emit `auditLogger.LogAccessDenied(...)` with the same shape used on the user-not-found branch above (target user metadata, reason `"User not found in Keycloak"`).

**Rationale:** Consistency with the existing audit pattern in the same handler. Today the 404 is silent in the audit log.

#### Patch S3.3 — Add privacy notice next to IP address display

**Files:**
- `frontend/src/app/profile/security/page.tsx` — self-service view
- `frontend/src/app/admin/users/[id]/sessions/page.tsx` — admin view
- `frontend/messages/de.json`, `frontend/messages/en.json` — two new keys

**Change:**

Add a small, translated privacy notice rendered near the IP column / field:

- Self-service (`profileSecurity.ipPrivacyNote`):
  - DE: "Diese Information ist nur für dich sichtbar."
  - EN: "This information is only visible to you."
- Admin (`adminUserSessions.ipPrivacyNote`):
  - DE: "Diese IP-Adresse wird nur für Administrations- und Sicherheitszwecke angezeigt."
  - EN: "This IP address is shown only for administrative and security purposes."

No masking. Full IP is retained in `SessionDto`. Use `text-sm text-gray-500` or equivalent muted styling consistent with `docs/13_frontend_design_standards.md`.

**Rationale:** Decision recorded: show IP with a visible privacy label. Closes the data-protection gap flagged in Epic Boundary Review.

#### Patch S3.4 — Add null-Id session filter to admin GetUserSessions

**File:** `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (`GetUserSessions`)

**Change:** Apply the same null/empty-Id pre-filter that P6 added to `GetCurrentUserSessions` in `IdentityEndpoints.cs`. Sessions with null or empty `Id` must not be returned to the admin UI.

**Rationale:** Admin UI today can render sessions with empty IDs; the subsequent admin-revoke request will 404. Cleaner to omit them at the source.

### E1.S4 — Add Session Revocation

#### Patch S4.1 — Correct logger category in IdentityEndpoints handlers

**File:** `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`

**Change:** Replace injected `ILogger<Program>` (introduced by P5) with `ILogger<IdentityEndpoints>`. Update the static class to expose a logger of its own type or inject a `ILoggerFactory` and create the category at handler entry.

**Rationale:** Logger category should match the originating component for log routing/correlation. Neither `KeycloakAdminService` nor `Program` is correct.

#### Patch S4.2 — Add `Produces(500)` to admin session/MFA endpoints

**File:** `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`

**Where:** `GetUserSessions`, `RevokeUserSession`, and the MFA reset endpoint.

**Change:** Add `.Produces(StatusCodes.Status500InternalServerError)` to each endpoint's OpenAPI metadata, matching the Identity endpoints already patched.

**Rationale:** OpenAPI completeness; clients can generate accurate type bindings for the 500 contract.

#### Patch S4.3 — Fix the 5 session/revoke tests broken by P1 GUID validation

**Files:**
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceSessionsTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceRevokeSessionTests.cs`

**Change:** Replace non-GUID test IDs (`"user-1"`, `"user-2"`, `"missing-user"`, `"session-1"`, `"missing-session"`) with valid lowercase GUIDs. Where the test intent is "invalid input", add a new dedicated test that asserts `ArgumentException` for non-GUID inputs to lock in the new validation contract.

**Rationale:** **Tests are currently red.** P1 tightened the contract correctly; the tests must reflect it. This is the highest-priority patch — `dotnet test` must be green before any epic-close.

#### Patch S4.4 — Add idempotent audit on admin RevokeUserSession KeycloakNotFoundException

**File:** `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (`RevokeUserSession`)

**Change:** Mirror the P3 idempotent-audit pattern from the user self-revoke path: inside the `catch (KeycloakNotFoundException)` that returns `TypedResults.NotFound()`, emit `auditLogger.LogAccessGranted("Session", "RevokeForUser", sessionId, {TargetUserId, TargetEmail, Reason="session-already-gone"})` so the audit log records the revoke intent even when Keycloak reports the session as missing.

**Rationale:** **AC4 violation.** "Admin revocation writes an audit/security event" is satisfied today only on the success path; the session-disappeared path swallows the audit, leaving an admin action without a record.

---

## 5. Implementation Handoff

### Scope classification: **Minor**

All work routes to the **Developer agent (`bmad-dev-story`)** with no PO/PM/Architect involvement required.

### Handoff plan (per-story execution)

| # | Story | Patches | Dev-Agent invocation |
|---|---|---|---|
| 1 | E1.S4 | S4.1, S4.2, **S4.3 (must be first — unblocks CI)**, S4.4 | `bmad-dev-story` against `_bmad-output/implementation-artifacts/e1-s4-add-session-revocation.md` with directive: "address only the open `[ ] [Review][Patch]` items in the Review Findings section" |
| 2 | E1.S3 | S3.1, S3.2, S3.3, S3.4 | Same pattern against `e1-s3-add-session-and-device-visibility.md` |
| 3 | E1.S2 | S2.1, S2.2, S2.3 | Same pattern against `e1-s2-add-admin-mfa-support-operations.md` |

**Suggested order rationale:** S4 first because Patch S4.3 fixes the test regression that currently blocks `dotnet test`. Once green, S3 and S2 can be done in either order; they are independent.

### Verification gates per story

1. Mark each open `[Review][Patch]` checkbox `[x]` only after the change is committed.
2. `dotnet test` from `backend` must be green.
3. Where UI changed (S3.3): `npm run typecheck && npm run lint` from `frontend`, plus the affected Vitest specs.
4. Re-read the story-level acceptance criteria; ensure no regression.

### Epic-close gate

After all three story patch passes are green:

- Flip `e1-s1-configure-role-based-mfa-policy.md`, `e1-s2-add-admin-mfa-support-operations.md`, `e1-s3-add-session-and-device-visibility.md`, `e1-s4-add-session-revocation.md` from `review` → `done`.
- Update `_bmad-output/implementation-artifacts/sprint-status.yaml` accordingly.
- Optional: run `bmad-retrospective` for Epic 1 closure (per hybrid workflow).

### Success criteria

- All 11 `[Review][Patch]` boxes flipped to `[x]` in their respective story files.
- `dotnet test` green from `backend`.
- `npm run typecheck`, `npm run lint`, and frontend Vitest green from `frontend`.
- Audit semantics consistent: `LogAccessDenied` reserved for permission failures only; admin session/MFA paths emit audit events on all branches.
- Privacy notice rendered with translated text on both `/profile/security` and `/admin/users/[id]/sessions`.
- No new acceptance criteria added; no PRD/architecture document touched.

---

## Change Log

- 2026-05-13: Sprint Change Proposal created via `bmad-correct-course` after Epic 1 boundary review surfaced 11 open `[Review][Patch]` items. Recommended path: Direct Adjustment, per-story Dev handoff.
