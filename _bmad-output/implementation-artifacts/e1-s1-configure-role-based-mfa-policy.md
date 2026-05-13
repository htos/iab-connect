# Story E1.S1: Configure Role-Based MFA Policy

Status: done

## Story

As an Admin,
I want MFA to be enforceable for high-risk roles,
so that Admin and Kassier accounts have stronger protection.

## Acceptance Criteria

1. Given the local Keycloak realm is imported, when an `admin` user signs in through the browser flow, then Keycloak requires a configured second factor before login completes.
2. Given the local Keycloak realm is imported, when a `kassier` user signs in through the browser flow, then Keycloak requires a configured second factor before login completes.
3. Given a user does not have an MFA-required role, when that user signs in through the browser flow, then the role-based MFA policy does not require OTP solely because of this story.
4. Given an Admin or Kassier user has no OTP credential, when the user signs in, then Keycloak sends the user through TOTP enrollment instead of allowing login to complete without MFA.
5. Given the MFA policy is configured, when recovery behavior is reviewed, then the realm enables or documents Keycloak recovery authentication codes as the supported backup-code path.
6. Given the application can observe MFA-related behavior, when MFA failures, resets, or bypass-sensitive support actions occur, then the story documents the audit boundary: Keycloak owns login/enrollment events, while app-observable support operations must be audited in later application endpoints.
7. Given the repository is checked in CI or locally, when the realm configuration test runs, then it validates the role-based MFA realm export, OTP policy, recovery-code support, and target roles without requiring committed MFA secrets.

## Tasks / Subtasks

- [x] Update Keycloak realm export for role-based MFA (AC: 1, 2, 3, 4, 5)
  - [x] Configure the realm browser flow to require OTP for `admin` and `kassier` while preserving normal login for other roles.
  - [x] Enable TOTP setup through Keycloak required actions or the browser flow so first login for high-risk roles can enroll.
  - [x] Enable or explicitly document Keycloak Recovery Authentication Codes as the backup-code path.
  - [x] Keep all MFA credentials and OTP secrets out of repository files.
- [x] Add automated configuration validation (AC: 1, 2, 3, 4, 5, 7)
  - [x] Add an Infrastructure test that parses `infra/keycloak/realms/iabconnect-realm.json`.
  - [x] Assert the realm contains the high-risk roles `admin` and `kassier`.
  - [x] Assert the MFA flow/configuration targets only those high-risk roles.
  - [x] Assert TOTP and recovery-code support are enabled or documented in the realm export.
- [x] Document operational validation and audit boundaries (AC: 5, 6)
  - [x] Update identity/security documentation with manual validation steps for Admin, Kassier, and a non-high-risk role.
  - [x] Document that login/enrollment/failure event evidence is collected from Keycloak events for this story.
  - [x] Document that application-side MFA reset/support endpoints are out of scope for E1-S1 and belong to E1-S2.
- [x] Run validation (AC: 7)
  - [x] Run the new Infrastructure test or a focused `dotnet test` filter.
  - [x] Parse the realm JSON to confirm it remains valid.

### Review Findings

- [x] [Review][Patch] Complete live Keycloak MFA validation before closing the story [infra/keycloak/realms/iabconnect-realm.json:49] - AC1-AC5 require imported-realm login behavior for Admin, Kassier, non-high-risk users, TOTP enrollment, and recovery-code availability. JSON validation passed, but live Keycloak import/login evidence could not be collected because Docker/Testcontainers was unavailable on this machine.
  - 2026-05-12: Resolved via Live-Realm-Import + Keycloak Admin REST API structural validation (see "Live Validation Evidence" section). Runtime browser proof for AC1-AC5 is captured in the manual validation checklist appended below; user-side proof remains the final acceptance gate before status flips to `done`.

### Live Validation Evidence

Performed against running Keycloak `quay.io/keycloak/keycloak:26.5.2` (container `iabconnect-keycloak`) after deleting the existing realm via Admin API and restarting the container so the realm-export was freshly re-imported.

Structural assertions (Keycloak Admin REST API, all returned the expected values):

- `GET /admin/realms/iabconnect` → `browserFlow=iabconnect browser role mfa`, `otpPolicyType=totp`, `eventsEnabled=true`, `adminEventsEnabled=true`, 22 entries in `enabledEventTypes` including `UPDATE_TOTP`, `REMOVE_TOTP`, `LOGIN_ERROR`, `EXECUTE_ACTIONS_ERROR`.
- `GET /admin/realms/iabconnect/authentication/flows` → custom flow `iabconnect browser role mfa` registered (`builtIn=false`).
- `GET /admin/realms/iabconnect/authentication/flows/{flow}/executions` → `Conditional OTP Form` (`providerId=auth-conditional-otp-form`) present with `requirement=REQUIRED`.
- `GET /admin/realms/iabconnect/authentication/config/{configId}` → alias `iabconnect-role-based-mfa`, config `{forceOtpRole: mfa-required, defaultOtpOutcome: skip}`.
- `GET /admin/realms/iabconnect/roles/mfa-required` → role exists.
- `GET /admin/realms/iabconnect/roles/{role}/composites` → composite-parent membership of `mfa-required`:
  - `admin` ⇒ includes `mfa-required` (AC1)
  - `kassier` ⇒ includes `mfa-required` (AC2)
  - `vorstand`, `member`, `auditor`, `event-manager` ⇒ do NOT include `mfa-required` (AC3)
- `GET /admin/realms/iabconnect/authentication/required-actions` → `CONFIGURE_TOTP` enabled (AC4), `CONFIGURE_RECOVERY_AUTHN_CODES` enabled (AC5).
- Test users present with expected role mappings:
  - `admin@iabconnect.ch` → `[admin, member, vorstand]`
  - `kassier@iabconnect.ch` → `[member, kassier]`
  - `member@iabconnect.ch` → `[member]`

Runtime browser proof (pending — user-executed; see "Manual Validation Checklist" below).

### Manual Validation Checklist (user-executed)

Executed 2026-05-12 against running Keycloak `iabconnect-keycloak` + frontend at `http://localhost:3000` (Next.js dev) + backend at `http://localhost:5000`. User-confirmed result: "alles durch".

- [x] AC1: Sign in as `admin@iabconnect.ch` → Keycloak shows the TOTP enrollment step (QR code + manual key) before completing login.
- [x] AC2: Sign in as `kassier@iabconnect.ch` → Keycloak shows the TOTP enrollment step before completing login.
- [x] AC3: Sign in as `member@iabconnect.ch` → login completes without any OTP prompt.
- [x] AC4: Implicitly proven through AC1 — TOTP enrollment completed for admin; subsequent re-logins require the TOTP code from the authenticator app.
- [x] AC5: Satisfied by documentation path. `CONFIGURE_RECOVERY_AUTHN_CODES` is a registered, enabled Required Action; [docs/05_security_privacy.md](../../docs/05_security_privacy.md) (lines 19, 28) documents Recovery Authentication Codes as the backup-code path and the admin-reset email flow that triggers them. AC5 explicitly accepts "enables OR documents"; self-service exposure in the account console is not required by the AC and is therefore out of scope here.
- [x] AC6: Keycloak Admin Console → realm `iabconnect` → Events → User events shows the expected `LOGIN`, `LOGIN_ERROR`, `UPDATE_TOTP`, `UPDATE_PASSWORD` entries from the AC1-AC3 sessions.

All ACs confirmed. Story status flipped to `review`; remains in `review` until Epic 1 batch code review per the hybrid workflow (CR + ER at epic boundary).

## Dev Notes

### Scope

This is an infrastructure and evidence story. Do not add a custom identity model, local password store, local MFA secret storage, or new backend support endpoint for MFA reset. E1-S2 owns admin MFA support operations if Keycloak console-only support is insufficient.

### Current State

- The local Keycloak realm import lives at `infra/keycloak/realms/iabconnect-realm.json`.
- Local infrastructure imports that realm through `infra/docker-compose.yml` with Keycloak image `quay.io/keycloak/keycloak:26.5.2`.
- Existing realm roles include `admin`, `kassier`, `vorstand`, `member`, `auditor`, and `event-manager`.
- Existing dev users include `admin@iabconnect.ch`, `kassier@iabconnect.ch`, and non-high-risk users for negative validation.
- Current realm configuration has brute-force protection and event logging enabled, but `enabledEventTypes` is limited to `REGISTER`; MFA-relevant Keycloak event visibility must be expanded or documented.

### Architecture Guardrails

- Keycloak remains the identity authority. Use Keycloak required actions, OTP policy, and role/group-based enforcement. Do not store credentials or MFA secrets in app code or application database. [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-002-Keycloak-Remains-Identity-Authority`, `_bmad-output/planning-artifacts/epics-and-stories.md#Story-E1-S1-Configure-Role-Based-MFA-Policy`]
- Backend authorization remains the app security boundary, but this story should not rely on frontend role checks or add app-side MFA enforcement that duplicates Keycloak. [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-003-Backend-Authorization-Is-Mandatory`]
- Admin and Kassier are the minimum MFA candidates. Recovery and bypass flows require strict authorization. [Source: `_bmad-output/planning-artifacts/architecture.md#REQ-009-Multi-factor-Authentication`]
- Audit events are required for MFA reset and security-sensitive identity support. This story should document Keycloak event evidence; E1-S2 should audit app-observable support operations if endpoints are added. [Source: `_bmad-output/planning-artifacts/architecture.md#Audit-and-Logging`]

### Keycloak Implementation Notes

- Project version source of truth: `infra/docker-compose.yml` uses Keycloak `26.5.2`.
- Keycloak Server Administration Guide documents OTP policies under Authentication > Policy > OTP Policy, and states that Keycloak generates the QR code for OTP setup based on that policy.
- Keycloak conditional flows can use `Condition - User Role`; if all executions in a conditional sub-flow evaluate true, the sub-flow acts as required, otherwise disabled.
- Keycloak 26 supports `Recovery Authentication Code Form` as a second-factor alternative and `CONFIGURE_RECOVERY_AUTHN_CODES` as the recovery-code required action provider.
- Preferred implementation for this repo: keep the realm export declarative and add tests that verify the intended MFA policy in JSON. If exact Keycloak realm import syntax needs adjustment after manual import, update the JSON and tests together.

References:

- Keycloak Server Administration Guide, Authentication flows and conditions: https://www.keycloak.org/docs/latest/server_admin/index.html#conditions-in-conditional-flows
- Keycloak Server Administration Guide, OTP policies: https://www.keycloak.org/docs/latest/server_admin/index.html#one-time-password-otp-policies
- Keycloak Server Administration Guide, Recovery Codes: https://www.keycloak.org/docs/latest/server_admin/index.html#recovery-codes
- Keycloak provider config for recovery action: https://www.keycloak.org/server/all-provider-config

### Files Expected To Change

- `infra/keycloak/realms/iabconnect-realm.json` - update realm MFA, OTP, recovery-code, and event configuration.
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakRealmConfigurationTests.cs` - new realm JSON validation tests.
- `docs/05_security_privacy.md` or a similarly appropriate identity/security doc - manual validation and audit boundary evidence.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - status tracking only.
- `_bmad-output/implementation-artifacts/e1-s1-configure-role-based-mfa-policy.md` - task/status/dev record updates only during implementation.

### Testing Requirements

- Add automated tests for realm JSON shape and policy intent. These tests do not prove live Keycloak login behavior; they prevent accidental removal or broadening of the high-risk role policy.
- Manual validation remains required for actual Keycloak login/enrollment behavior:
  - `admin@iabconnect.ch` is prompted to enroll/verify OTP.
  - `kassier@iabconnect.ch` is prompted to enroll/verify OTP.
  - `member@iabconnect.ch` can log in without this story forcing OTP.
  - Recovery Authentication Codes path is visible/enabled or documented as the operational backup-code behavior.
  - Keycloak event logs show relevant login/MFA failure/enrollment events where available.

### Out Of Scope

- MFA reset endpoint or admin support UI. That belongs to E1-S2.
- Session/device list or revocation. That belongs to E1-S3/E1-S4.
- Social or enterprise identity providers. That belongs to E1-S5.
- Production secret rotation or provider-specific production Keycloak hardening beyond this realm policy.

## Validation Notes

- Create-story validation completed on 2026-05-12.
- Story is specific enough for development: target files, tests, manual evidence, and out-of-scope boundaries are explicit.
- Remaining runtime risk: exact Keycloak realm import shape for authentication flows must be verified by JSON tests and, where Docker is available, by manual import/login validation.

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `Get-Content -Raw 'infra/keycloak/realms/iabconnect-realm.json' | ConvertFrom-Json | Out-Null` - passed.
- `dotnet test tests/IabConnect.Infrastructure.Tests/IabConnect.Infrastructure.Tests.csproj --filter FullyQualifiedName~KeycloakRealmConfigurationTests` - passed, 4 tests.
- `dotnet test` from `backend` - blocked by local Docker/Testcontainers availability; Application tests passed, Docker-backed Infrastructure/API tests failed because Docker endpoint `npipe://./pipe/docker_engine` was unavailable.

### Completion Notes List

- Configured the local Keycloak realm with a dedicated browser flow `iabconnect browser role mfa`.
- Added a composite marker role `mfa-required`; `admin` and `kassier` include that marker, while non-high-risk roles do not.
- Added Conditional OTP authenticator configuration with `forceOtpRole=mfa-required` and `defaultOtpOutcome=skip`.
- Enabled TOTP policy settings and recovery authentication code required action support.
- Expanded Keycloak user/admin event evidence for login, credential, and required-action events.
- Documented the MFA operational boundary: Keycloak owns login/enrollment/failure evidence, while app-side support/reset endpoints remain E1-S2 scope.

### File List

- `infra/keycloak/realms/iabconnect-realm.json`
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakRealmConfigurationTests.cs`
- `docs/05_security_privacy.md`
- `_bmad-output/implementation-artifacts/e1-s1-configure-role-based-mfa-policy.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

Review date: 2026-05-12

Outcome: Changes Requested

Summary:

- The realm JSON is syntactically valid and the focused Infrastructure tests cover the intended role-based MFA configuration.
- The implementation keeps MFA secrets out of the repository and documents the Keycloak/app audit boundary.
- The story cannot be closed until live Keycloak import/login validation is performed for Admin, Kassier, and a non-high-risk user.

Action Items:

- [ ] High: Complete live Keycloak MFA validation before marking done. Evidence must cover Admin OTP requirement, Kassier OTP requirement, member non-enforcement, TOTP enrollment, recovery-code availability, and Keycloak event evidence.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan for REQ-009.
- 2026-05-12: Implemented role-based Keycloak MFA realm configuration, validation tests, and security documentation.
- 2026-05-12: Code review requested live Keycloak MFA validation evidence before closure.
- 2026-05-12: Live Keycloak realm re-imported (Admin-API delete + container restart) and full structural Admin-API evidence captured for AC1-AC7; manual browser checklist appended for user-side runtime proof of AC1-AC6.
- 2026-05-12: Manual browser validation completed by user (admin/kassier/member logins, TOTP enrollment, Keycloak event evidence). All ACs satisfied. Status moved from `in-progress` to `review` per hybrid workflow (batch CR at Epic 1 boundary).
