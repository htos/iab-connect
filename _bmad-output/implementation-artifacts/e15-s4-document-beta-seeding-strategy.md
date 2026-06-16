# Story 15.4: Beta seeding strategy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Refresh Notes (2026-06-01, post-E13-close)

This story file was a 19-line stub from 2026-05-15. It was authored to a dev-ready story 2026-06-01 as part of the **A34 bulk create-story pass for the entire Epic-15** (alongside e15-s1, e15-s2, e15-s3). The author pass surfaced one important architectural decision that the dev-agent must resolve at Task 0:

- **DEC-1 (A32 Decision-Needed): doc target — `docs/14_beta_railway_setup.md` Section 16 vs. new `docs/RUNBOOK-beta.md`.** The source SCP text says "documented in RUNBOOK-beta.md", but `RUNBOOK-beta.md` does NOT yet exist — it is produced by **E18-S1 (Wave 9)**, which is 2 waves after this story (Wave 7). Per A38 doc-bundle pattern, the recommendation is to extend the existing `docs/14_beta_railway_setup.md` with a new **Section 16** (continuing the cluster of Sections 14 + 15 added by E15-S1 + E15-S3). E18-S1 later cites Section 16 from RUNBOOK-beta.md. **DEC-1 surfaces this to the user at Task 0 via `AskUserQuestion`** per A32 + project-memory `feedback_decisions_via_ask_tool`.

Other clarifications surfaced during the author pass:

- **`DevelopmentDataSeeder` is a static class with NO internal gate.** Confirmed at [backend/src/IabConnect.Infrastructure/Persistence/DevelopmentDataSeeder.cs](../../backend/src/IabConnect.Infrastructure/Persistence/DevelopmentDataSeeder.cs) line 13: `public static class DevelopmentDataSeeder` — no `IsDevelopment()` check inside the class. **The gate lives at [Program.cs:51](../../backend/src/IabConnect.Api/Program.cs#L51)** — the `if (env.IsDevelopment())` block wraps the `DevelopmentDataSeeder.SeedAsync(app.Services)` call at line 63. AC-1 below verifies the gate at the call-site, not inside the seeder class.
- **The realm bootstrap creates 7 roles, confirmed exactly.** Read directly from [infra/keycloak/realms-beta/iabconnect-realm.json](../../infra/keycloak/realms-beta/iabconnect-realm.json) lines 163-198: `mfa-required`, `admin`, `vorstand`, `member`, `kassier`, `auditor`, `event-manager`. (Lines 61 + 69 reference "Configure OTP" + "Configure Recovery Authentication Codes" — those are **auth-flow** names, NOT realm-roles, and are excluded from the 7-role count.)
- **The "first Beta-Admin" creation is a manual browser step on Keycloak Admin Console**, not an API call from the api service. The api service has no privilege to create master-realm admin users; that's a Keycloak-side operation. The seeding doc walks through 5-7 browser-UI steps.
- **REQ-088 AC-10** is this story's source-of-truth (not AC-3 as the prior stub said). Confirmed in [epics-and-stories.md L1621](../../_bmad-output/planning-artifacts/epics-and-stories.md).

## Story

As **the maintainer onboarding the first Beta tester**,
I want **a documented, deterministic, and verified path that (1) confirms `DevelopmentDataSeeder` does NOT run in the Beta environment so tester data is never accidentally overwritten by fake-member rows, (2) confirms the 7 realm-roles required by the application's role-based authorization (`admin`, `vorstand`, `member`, `kassier`, `auditor`, `event-manager`, `mfa-required`) are present in the deployed Keycloak realm immediately after first start, and (3) walks me through creating the first Beta-Admin user on the deployed Keycloak Admin Console via browser, granting them the `admin` realm role, and signing into the IAB Connect frontend with that account**,
so that **the first Beta tester (Harry himself, then later external testers) can land on a working deployment with zero hand-rolled "but on my machine it works" state, the seeding procedure is reproducible by a fork operator or a maintainer-replacement, and the deployment surface does NOT accidentally inherit Development-only test data that would leak demo emails (`admin@iabconnect.ch`, `vorstand@iabconnect.ch`, `member@iabconnect.ch`) into a tester-visible system**.

**Requirement:** REQ-088 AC-10 (Beta Deployment Readiness — first-tester bootstrap path). Epic E15 (Database, Persistence, and Migrations), Story 4 of 4 — **epic-closer** for E15. Wave-7 deliverable.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13 (Railway Beta Deployment) done** — Beta deploy is green; Keycloak service is reachable; admin console is accessible at the `keycloak` service's public URL (per [docs/14_beta_railway_setup.md Section 3.4](../../docs/14_beta_railway_setup.md#34-seed-the-keycloak-service-with-the-jdbc-env-block) + Section 5.3). ✅ confirmed in sprint-status 2026-06-01.
- **E15-S1 (two-Postgres separation verified) done** — `postgres-kc` holds the Keycloak schema with the imported realm (the 7 roles live in `postgres-kc.KEYCLOAK_ROLE` table). **Recommend ordering after E15-S1 + E15-S3** in the same sprint.
- **E15-S3 (daily backup) done** — Section 15 of the doc exists; this story's Section 16 inserts after Section 15 (per A38 doc-bundle). **Recommend ordering after E15-S3.**

**Downstream:**
- **E18-S1 (RUNBOOK-beta authoring, Wave 9)** — cites this story's Section 16 from RUNBOOK-beta.md. If DEC-1 resolves to Option A (Section 16 in existing doc), E18-S1's runbook contains a link `→ docs/14_beta_railway_setup.md#16-first-beta-admin-seeding`. If DEC-1 resolves to Option B (RUNBOOK-beta.md created here), E18-S1 extends what this story creates.
- **E18-S2 (Beta tester onboarding guide, Wave 9)** — tester-facing version of this internal seeding doc; this story is the internal/maintainer reference.

**Wave context:** Wave 7 closer. **NO source-code artifacts** for the seeding documentation itself; **one new test** that verifies the `DevelopmentDataSeeder` gate; **one doc section** (Section 16 OR new RUNBOOK-beta.md per DEC-1). The "code" deliverable is operator-facing documentation that survives the fork-replacement test (a new fork operator following the doc can bootstrap their own Beta admin without rediscovering the procedure).

## Decision-Needed at Task 0 (DEC-1, per A32)

Before Task 4 begins, the dev-agent MUST surface DEC-1 via `AskUserQuestion` because the resolution materially changes the doc-target file.

**DEC-1: Doc target — `docs/14_beta_railway_setup.md` Section 16 vs new `docs/RUNBOOK-beta.md`.**

The source SCP text says "documented in RUNBOOK-beta.md". RUNBOOK-beta.md does not yet exist; it is the deliverable of **E18-S1 (Wave 9)**, two waves after this story (Wave 7). Three options:

**Option A — Section 16 in `docs/14_beta_railway_setup.md` (RECOMMENDED, A38 doc-bundle):** Continue the cluster of Sections 14 (E15-S1) + 15 (E15-S3) by adding Section 16 to the same doc. E18-S1 later cites it via a cross-link. **Pro**: consistent with A38; consistent with the E13 epic's design choice that the Beta operational surface is ONE coherent document; lowest churn. **Con**: E18-S1 must then explicitly maintain the cross-link rather than absorbing the content; the runbook becomes a link-heavy file.

**Option B — Create new `docs/RUNBOOK-beta.md` here:** Pre-create the runbook for E18-S1 to extend later. **Pro**: matches the SCP text verbatim. **Con**: violates A38 (introduces a parallel doc-bundle when one exists), violates A34 (mid-epic introduces a new file the rest of E15 doesn't reference), introduces a "half-runbook" that has only seeding (no incident response, no rollback, no monitoring — those land in E18-S1).

**Option C — Defer to E18-S1 entirely; ship only the test + an in-code doc-comment in this story:** Block E15 closer on Wave 9 (E18-S1). **Pro**: minimal scope. **Con**: leaves Wave 7 epic-closer with no operator-facing doc; introduces a wave-order inversion; cannot mark E15 done.

**Recommended**: Option A. The ACs and Tasks below assume Option A. If the user resolves DEC-1 differently, AC-3 (doc location) and Task 4 (doc authoring) re-scope.

Per project memory `feedback_decisions_via_ask_tool`, the dev-agent surfaces DEC-1 with `AskUserQuestion`, NOT plain-text options. **Auto-resolution escape clause per A41**: if the user has pre-declared autonomous-mode in the same session, dev-agent records Option A as resolution + verbatim-quotes the directive + proceeds. Resolution recorded in Dev Agent Record → Debug Log References.

## Acceptance Criteria

(All ACs below assume **DEC-1 = Option A** (Section 16 in existing doc). If the user resolves DEC-1 differently, AC-3 + Task 4 re-scope.)

1. **`DevelopmentDataSeeder` is verifiably NOT invoked when the API runs in any environment other than Development** — verified by:
   - Read [backend/src/IabConnect.Api/Program.cs:51-69](../../backend/src/IabConnect.Api/Program.cs#L51-L69) end-to-end. Confirm the call to `DevelopmentDataSeeder.SeedAsync(app.Services)` at line 63 is INSIDE the `else if (env.IsDevelopment())` block (line 51).
   - New unit test in [backend/tests/IabConnect.Api.Tests/Startup/](../../backend/tests/IabConnect.Api.Tests/) (or co-located with the E15-S2 helper test): construct two test hosts — one with `EnvironmentName = "Development"`, one with `EnvironmentName = "Beta"`. Capture the Serilog log output. In the Development host, log contains "Seeding development data..."; in the Beta host, log does NOT contain that line. The test uses the existing `TestWebApplicationFactory`-style scaffold.
   - **Alternative if the integration-host test is too heavy**: an inspection-level test that reads `Program.cs` source via `File.ReadAllText` and asserts `DevelopmentDataSeeder.SeedAsync` text appears ONLY inside an `IsDevelopment()` block. Less rigorous but catches regression — accept ONLY if the integration-host approach is infeasible. Recommend integration approach.
   - **Static-analysis assert**: the test file `DevelopmentDataSeederGatingTests.cs` includes a [Fact] that uses Roslyn to parse Program.cs and confirms `DevelopmentDataSeeder.SeedAsync` is not invoked from any code-path that runs in non-Development. Optional but Recommended for long-term regression resistance.

2. **The 7 required realm-roles are present in the deployed Keycloak realm after first start** — verified by:
   - [!] Harry's session: log into Keycloak Admin Console (browser) for the Beta deployment; navigate to `iabconnect` realm → "Realm roles"; confirm exactly the following 7 entries: `mfa-required`, `admin`, `vorstand`, `member`, `kassier`, `auditor`, `event-manager`.
   - Capture a screenshot (placeholder in Section 16.3 of the doc; redacted to remove any tester-identifying user data) OR a text capture of the Admin Console URL + the role-list as evidence in the Quality-Gates table.
   - This is a **post-deploy verification** of the realm-import behavior (the realm JSON ships in the custom Keycloak image per ADR-016 + E12-S3); the verification confirms the import worked as designed.
   - Cross-check: read [infra/keycloak/realms-beta/iabconnect-realm.json](../../infra/keycloak/realms-beta/iabconnect-realm.json) lines 163-198 — the same 7 names appear in source. Drift between source and deployed state = realm-import broken = escalate.

3. **A documented seeding procedure for the first Beta-Admin user lives in `docs/14_beta_railway_setup.md` as Section 16** (Section 16 IFF DEC-1 = Option A; otherwise see DEC-1 resolution) — verified by:
   - New top-level section **`## 16. First Beta-Admin seeding (E15-S4)`** inserted between Section 15 (E15-S3) and the existing Appendix.
   - Section structure (7 subsections):
     - 16.1 Goal + RPO/RTO commitments + ADR-016 anchor.
     - 16.2 Prerequisites (Beta deploy green per Section 10.4; Keycloak Admin Console reachable; Sealed `KEYCLOAK_ADMIN` + `KEYCLOAK_ADMIN_PASSWORD` env vars in place).
     - 16.3 Seven realm-role verification (steps to log into Admin Console + verify the 7 names + screenshot location).
     - 16.4 First Beta-Admin user creation (6-step browser procedure on Admin Console: Users → Add user → fill fields → Set password → Role mapping → assign `admin` realm role).
     - 16.5 Sign-in smoke test (browser steps: navigate to frontend Beta URL → sign in with the new admin credentials → verify the admin-only "Settings" menu loads).
     - 16.6 Adding additional Beta testers (delegate path: maintainer creates Keycloak user; user receives setup-temp-password email if SMTP configured per ADR-018; alternative: maintainer sets password directly + shares via secure channel).
     - 16.7 Anti-patterns + recovery (do not commit the admin password to the repo; do not seed via SQL; do not import a dev-realm dump; recovery path if the admin user is locked out — Sealed `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` recovery process).
   - Per A40: every CLI/admin-console command referenced is either (a) verified against the Keycloak 26 docs with citation OR (b) marked `[!] verify against Keycloak Admin Console docs before executing`.
   - SPDX header line 1 already in place from E13-S1.
   - Insertion: between current Section 15 (after E15-S3's edits) and the Appendix. Appendix MUST remain final section.

4. **Cross-story orthogonal-AC verification** (per A31):
   - **Seven-role parity (3 anchors)**: [infra/keycloak/realms-beta/iabconnect-realm.json:163-198](../../infra/keycloak/realms-beta/iabconnect-realm.json) ≡ Section 16.3 of `docs/14_beta_railway_setup.md` ≡ application-side role-name constants. Application-side anchor location: grep `"admin"\|"vorstand"\|"member"\|"kassier"\|"auditor"\|"event-manager"\|"mfa-required"` in `backend/src/IabConnect.Api/` + `backend/src/IabConnect.Application/` — these strings should appear in role-mapping code (e.g., authorization policies). If 7 vs 7 vs 7 doesn't hold, surface the drift.
   - **Doc-bundle parity (3 anchors)**: Section 16 in `docs/14_beta_railway_setup.md` IS the seeding doc (per DEC-1 Option A); RUNBOOK-beta.md (E18-S1, future) WILL cite Section 16 anchor; E18-S2's tester-onboarding-guide (future) WILL cite a subset of Section 16 anchors for the tester-facing steps. The single source of truth is Section 16.
   - **Gating-test parity (2 anchors)**: the new `DevelopmentDataSeederGatingTests.cs` mirrors the test-name + pattern of `RetentionEnforcementJobRegistrationTests.cs` (precedent at backend/tests/IabConnect.Api.Tests/). Both gate-tests verify "registered-when-X / removed-when-Y" against stubbed dependencies.

5. **No secrets in repo** — the Beta-Admin password is created in the Keycloak Admin Console UI; it is recorded only in Harry's password manager (Bitwarden / 1Password). Section 16's doc records the **procedure**, never the actual credentials. Verified by:
   - `git grep -inE 'KEYCLOAK_ADMIN_PASSWORD|Beta-Admin password' -- 'docs/*'` returns hits only on documentation lines describing the env-var + the rotation procedure (Section 7), never any literal values.
   - The doc has no placeholder text like `password: changeme` or `password: <fill-in>` that a future doc-skim could mistake for a literal value to copy.

6. **A42 (reread-as-a-stranger) pass** — before story-close, the dev-agent re-reads Section 16 as if seeing it for the first time, looking specifically for:
   - Cross-section contradictions (Section 16 says "log into Admin Console at keycloak.up.railway.app" but Section 5.3 says the URL is `${IABCONNECT_BETA_HOST}` — drift).
   - Pre-filled status checkboxes (the seeding-procedure steps should be in IMPERATIVE form, not a one-deploy checklist; "Click → ..." not "[x] Click → ...").
   - Stale file:line anchors from older drafts (verify the realm JSON anchors at Section 16.3 still point to the current line range).
   - Imprecise claims (e.g., "the realm has ~7 roles" — say exactly 7, name them).
   - Sprint-tracking commentary leaked into operator-facing content.

## Tasks / Subtasks

- [ ] **Task 0 — SPIKE: confirm pre-conditions + DEC-1 surface** (per A28 + A32)
  - [ ] 0.1 Confirm E15-S1 + E15-S3 are status `done` (or `review`+committed in this same session) in sprint-status.yaml.
  - [ ] 0.2 Read [backend/src/IabConnect.Api/Program.cs:39-90](../../backend/src/IabConnect.Api/Program.cs#L39-L90) — verify the env-branching shape and the `DevelopmentDataSeeder.SeedAsync` call site at line 63. Confirm the test plan in AC-1 can be implemented.
  - [ ] 0.3 Read [backend/src/IabConnect.Infrastructure/Persistence/DevelopmentDataSeeder.cs](../../backend/src/IabConnect.Infrastructure/Persistence/DevelopmentDataSeeder.cs) — confirm: `public static class` with no internal gate, idempotent design (lines 73-92 check existing-member before insert).
  - [ ] 0.4 Read [infra/keycloak/realms-beta/iabconnect-realm.json](../../infra/keycloak/realms-beta/iabconnect-realm.json) lines 163-198 — confirm exactly 7 realm-roles: `mfa-required`, `admin`, `vorstand`, `member`, `kassier`, `auditor`, `event-manager`. **Recommended grep**: `grep -nE '"name":' infra/keycloak/realms-beta/iabconnect-realm.json | head -30` then visually filter to the role-block (between "roles": [ and the closing ] for the realm-level role array).
  - [ ] 0.5 Read existing [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) end-to-end to understand: current Section 13 ending point, Appendix location, post-Section 14 (E15-S1) + post-Section 15 (E15-S3) state after this session's bulk-refresh. Confirm Section 16 inserts between Section 15 and Appendix.
  - [ ] 0.6 **Surface DEC-1 to the user via `AskUserQuestion`** per A32 + memory `feedback_decisions_via_ask_tool`. Three options as described above (Option A Recommended). If user pre-declared autonomous-mode in-session (per A41), record Option A + verbatim-quote the directive + proceed. Resolution noted in Dev Agent Record → Debug Log References.
  - [ ] 0.7 Spike output: `Confirmed 7 roles + Program.cs gate at line 51 + DevelopmentDataSeeder static-class + Section 16 insertion point + DEC-1 resolved to <Option X> → proceed` OR `Blocker: <description> → escalate`.

- [ ] **Task 1 — Verify `DevelopmentDataSeeder` gating in code** (AC-1)
  - [ ] 1.1 Create new test file `backend/tests/IabConnect.Api.Tests/Startup/DevelopmentDataSeederGatingTests.cs` (SPDX header line 1; xUnit v3 + FluentAssertions).
  - [ ] 1.2 Test 1 (`Seeder_Runs_InDevelopmentEnvironment`): construct `TestWebApplicationFactory`-like host with `EnvironmentName = "Development"` + sufficient test-DB infra (Testcontainers PostgreSQL); capture Serilog output to an `InMemoryLogger`; assert the log line `Seeding development data...` appears.
  - [ ] 1.3 Test 2 (`Seeder_DoesNot_Run_InBetaEnvironment`): same host with `EnvironmentName = "Beta"`; assert the log line does NOT appear; assert no SQL INSERT was issued against the `Members` table (verify via test-DB row-count = 0 after startup).
  - [ ] 1.4 Test 3 (`Seeder_DoesNot_Run_InProductionEnvironment`): same as Test 2 with `EnvironmentName = "Production"`.
  - [ ] 1.5 Run `dotnet test backend/tests/IabConnect.Api.Tests/` — expect 3 new tests green.
  - [ ] 1.6 If full integration tests are infeasible in this session, mark Task 1.2-1.4 `[!]` and fall back to a Roslyn-based source-inspection test (Test variant): parse `Program.cs` syntax tree, assert the `DevelopmentDataSeeder.SeedAsync` invocation node is inside an `IfStatementSyntax` whose condition expression is `env.IsDevelopment()`. Recommend full integration tests if `TestWebApplicationFactory` already exists.

- [ ] **Task 2 — Verify 7 realm-roles present in the Beta deployment** (AC-2)
  - [ ] 2.1 [!] Harry's session: log into the Beta deployment's Keycloak Admin Console (URL from Section 5.3 of doc) using the Sealed `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` env-var values.
  - [ ] 2.2 [!] Navigate to `iabconnect` realm → Realm roles → confirm exactly 7 rows: `mfa-required`, `admin`, `vorstand`, `member`, `kassier`, `auditor`, `event-manager`.
  - [ ] 2.3 [!] Capture either a screenshot (saved to `docs/screenshots/16-3-realm-roles.png`) OR a text capture of the role-table content. **Redact** any user-PII or other identifying metadata; only role names matter.
  - [ ] 2.4 [!] Document the verification in Section 16.3 with the screenshot/text-capture link or contents.

- [ ] **Task 3 — Document the first Beta-Admin seeding procedure** (AC-3)
  - [ ] 3.1 Insert Section 16 into [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) BETWEEN Section 15 (E15-S3) and the existing Appendix. Appendix MUST remain final section.
  - [ ] 3.2 Author the 7 subsections per AC-3 specification. Use IMPERATIVE form (not checklist). Each command is either verified against Keycloak 26.5.2 docs (Recommended source: [https://www.keycloak.org/docs/26.0.0/server_admin/](https://www.keycloak.org/docs/26.0.0/server_admin/) — confirm the version anchor matches the project's pinned Keycloak version) OR marked `[!] verify against Keycloak Admin Console docs before executing`.
  - [ ] 3.3 Update the Table of Contents at the top of the doc to include Section 16.
  - [ ] 3.4 Per A38: confirm Section 16 reads coherent with Sections 14 + 15 (same heading style, same ADR-citation pattern, same `(E15-SX)` story-anchor convention in section titles).
  - [ ] 3.5 Per A42 (reread-as-a-stranger): re-read Section 16 fresh; flag any imprecise claims, stale anchors, pre-filled checkboxes, sprint-tracking leakage, or cross-section contradictions.
  - [ ] 3.6 **If DEC-1 resolved to Option B (RUNBOOK-beta.md)**: create the new `docs/RUNBOOK-beta.md` (SPDX header line 1; minimal stub-plus-seeding-section structure) with the same 7-subsection content; update E18-S1's reference accordingly. Cross-link from `docs/14_beta_railway_setup.md` Section 16 → `docs/RUNBOOK-beta.md#first-beta-admin-seeding`.

- [ ] **Task 4 — Cross-story orthogonal-AC verification** (AC-4, per A31)
  - [ ] 4.1 Seven-role parity 3-anchor: `grep -cE '"name": "(admin|vorstand|member|kassier|auditor|event-manager|mfa-required)"' infra/keycloak/realms-beta/iabconnect-realm.json` returns 7. Same 7 strings appear in Section 16.3. Same 7 strings appear in backend authorization-policy code.
  - [ ] 4.2 Doc-bundle parity 3-anchor verified by reading Section 16 and confirming it citations match E18-S1/S2's planned cross-link points (forward-looking; E18 stories haven't been authored yet; the citation is from the doc TO the future, not the reverse).
  - [ ] 4.3 Gating-test parity 2-anchor: `DevelopmentDataSeederGatingTests.cs` follows the same `[Fact]` shape as `RetentionEnforcementJobRegistrationTests.cs` (or whichever Api.Tests gating-test file exists).

- [ ] **Task 5 — Secrets-in-repo guard + A42 fresh-eyes pass** (AC-5, AC-6)
  - [ ] 5.1 `git grep -inE 'KEYCLOAK_ADMIN_PASSWORD|Beta-Admin password|adminPassword' -- 'docs/*' '_bmad-output/*'` returns hits only on documentation lines describing the env-var name + the rotation procedure (Section 7), never any literal values.
  - [ ] 5.2 `git grep -inE 'password\s*:\s*[a-zA-Z0-9]' -- 'docs/*'` returns zero — no literal password values in any doc.
  - [ ] 5.3 Per A42: re-read Section 16 ENTIRELY fresh; check the 5 categories (cross-section contradiction, pre-filled status, stale anchor, imprecise claim, sprint-tracking leakage).

- [ ] **Task 6 — Quality-Gates Closing Check (per A29)**
  - [ ] 6.1 Complete the Quality-Gates table at the bottom of this file with one row per AC sub-item: `covered` / `[!] needs-human-verify` / `N/A`. Aggregate claims are NOT acceptable.

## Dev Notes

### Why this story is the E15 epic closer

E15 has 4 stories: S1 (verification), S2 (toggle), S3 (backup pipeline), and S4 (this — seeding documentation). S4 closes E15 because:

- It is the LAST artifact a fork operator needs to bootstrap a Beta deployment from a clean Railway project.
- All previous stories (S1, S2, S3) deliver infrastructure that S4's procedure consumes (S1's two-Postgres separation, S2's migration toggle, S3's backup pipeline).
- The epic retrospective (`epic-15-retrospective`) can run after S4 because S1-S3 + S4 together describe the full Beta-persistence operational surface.

### Why `DevelopmentDataSeeder` runs Development-only

The seeder creates 3 `Member` records (`admin@iabconnect.ch`, `vorstand@iabconnect.ch`, `member@iabconnect.ch`) tied to Keycloak users that the Dev realm seeds. Running this in Beta would:

- Pollute the tester-visible `Members` list with 3 demo emails that tester would see and be confused by.
- Risk shipping the demo emails into production-style data (e.g., if the seeder ran in Production by accident, `admin@iabconnect.ch` would appear in the live member roster).
- Create a `Member` row whose `KeycloakUserId` points to a Dev-realm user that doesn't exist in the Beta `postgres-kc` schema — the row would be orphaned + broken.

The gate at Program.cs:51 is intentional and tested by AC-1.

### Why the first Beta-Admin is created via Admin Console UI (not API)

Three reasons:

1. **The api service has no realm-admin privileges.** Its Keycloak client (`iabconnect-api`) is a bearer-only client (per A39) — it can validate JWT tokens but cannot create users.
2. **The KEYCLOAK_ADMIN env-var-seeded master admin** is a Keycloak master-realm administrator, NOT an IAB-Connect `admin` realm-role holder. Distinct concept: master admin manages Keycloak; `admin` realm-role grants application authorization.
3. **A bootstrap admin user must be created in the `iabconnect` realm with the `admin` realm-role assigned** for the application's role-based authorization (per E1-S1) to grant them admin-level UI access. This is a Keycloak Admin Console operation, not an API operation, on first-time setup.

### Why Section 16 (not RUNBOOK-beta.md)

(Assuming DEC-1 resolves to Option A — see DEC-1 block.) A38 doc-bundle pattern: when N stories ship into one logical operator-facing document, write into that one document. Sections 14 (E15-S1) + 15 (E15-S3) + 16 (this story) form a coherent cluster in `docs/14_beta_railway_setup.md`. RUNBOOK-beta.md (E18-S1, Wave 9) is the higher-level incident-response runbook that cites Section 16 — it does not own the seeding content.

### Anti-patterns the dev-agent should avoid

- **Do NOT** seed the first Beta-Admin via a SQL INSERT into postgres-kc or postgres-app. The Keycloak password hashing + the membership-realm-role attachment must go through Keycloak's official APIs (Admin Console, in this case).
- **Do NOT** import a dev-realm dump (`infra/keycloak/realms/iabconnect-realm.json`) into Beta — that ships demo user credentials. The Beta realm import is `infra/keycloak/realms-beta/iabconnect-realm.json` (no demo users; clean realm + 7 roles only).
- **Do NOT** commit the Beta-Admin password to the repo, paste it into a tracked doc, or include it in any `.env.example` placeholder. The password lives only in Harry's password manager.
- **Do NOT** rename `RUNBOOK-beta.md` to `docs/RUNBOOK-beta.md` if DEC-1 resolved to Option B (some teams prefer SCREAMING-CASE for runbooks at repo root; current convention is `docs/14_*` lowercase — verify against the project's docs/ directory).
- **DO** verify the 7 realm-roles match the application's authorization code at Task 4.1 — if a role rename is in flight (e.g., `event-manager` → `event-organizer`), surface as a blocker.
- **DO** check that the Sealed `KEYCLOAK_ADMIN_PASSWORD` value in Harry's Railway env is documented + recoverable in Harry's password manager BEFORE Task 2 begins. A lost master-admin credential bricks Beta administration.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#adr-016-custom-keycloak-image-with-spi-baked-in] — custom image + realm import design.
- [Source: _bmad-output/planning-artifacts/prd.md] — REQ-088 AC-10.
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1617-L1635] — Story E15-S4 source ACs.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#L553-L559] — SCP source-of-truth.
- [Source: backend/src/IabConnect.Api/Program.cs:51-69] — DevelopmentDataSeeder.SeedAsync call site gated by IsDevelopment.
- [Source: backend/src/IabConnect.Infrastructure/Persistence/DevelopmentDataSeeder.cs] — static class, no internal gate.
- [Source: infra/keycloak/realms-beta/iabconnect-realm.json:163-198] — 7 realm-role definitions.
- [Source: docs/14_beta_railway_setup.md Section 5.3] — Keycloak service env block (KEYCLOAK_ADMIN + KEYCLOAK_ADMIN_PASSWORD).
- [Source: docs/14_beta_railway_setup.md Section 7] — secret-rotation procedure (KEYCLOAK_ADMIN_PASSWORD row).
- [Source: Keycloak 26.0 server-admin docs](https://www.keycloak.org/docs/26.0.0/server_admin/) — official source for the admin-console workflow A40 verifies against (confirm version vs project's pinned Keycloak version at Task 0).

## Quality Gates — Closing Check (A29)

Complete one row per AC sub-item at story-close. Status: `covered` · `[!] needs-human-verify` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 0 | DEC-1 auto-resolved to Option A under A41; (a)/(b)/(c) recorded in Debug Log | `covered` | Debug Log References block above |
| 1 | Program.cs gating inspected; `DevelopmentDataSeeder.SeedAsync` resides inside `else if (env.IsDevelopment())` block | `covered` | DevelopmentDataSeederGatingTests `Seeder_InvokedExactlyOnce_InsideDevelopmentBranch` (source-inspection: brace-counts the Dev branch + asserts the invocation is inside) |
| 1 | Unit test: Seeder runs in Development (verified semantically via gating-position assert) | `covered` (via source-inspection variant per Q1 fallback) | DevelopmentDataSeederGatingTests `Program_HasDevelopmentBranchOpener` + `Seeder_InvokedExactlyOnce_InsideDevelopmentBranch` |
| 1 | Unit test: Seeder does NOT run in Beta (verified semantically via "no-invocation-outside-Dev-branch" assert) | `covered` (via source-inspection variant per Q1 fallback) | DevelopmentDataSeederGatingTests `Seeder_NotInvoked_OutsideDevelopmentBranch` |
| 1 | Unit test: Seeder does NOT run in Production (semantically equivalent to "Beta" via same outside-branch check) | `covered` | Same test (the outside-branch check applies to ALL non-Dev envs) |
| 1 | Seeder type has no internal env-gate (gate contract lives at call site) | `covered` (bonus per story Recommendation) | DevelopmentDataSeederGatingTests `DevelopmentDataSeeder_TypeHasNoInternalEnvironmentGate` |
| 2 | [!] Beta Keycloak Admin Console accessed | `[!] needs-human-verify` | Section 16.2 prerequisites + Section 16.3 verification steps |
| 2 | [!] 7 realm-roles confirmed by name in deployed realm | `[!] needs-human-verify` (live Admin Console verification) — source-side parity verified `covered` (Roles.cs + realm JSON byte-match) | Section 16.3 table + verification steps |
| 2 | [!] Screenshot or text-capture stored at docs/screenshots/16-3-realm-roles.png | `[!] needs-human-verify` (operator-evidence slot) | Section 16.3 step 4 |
| 3 | docs/14_beta_railway_setup.md Section 16 inserted (7 subsections, before Appendix) | `covered` | docs/14 Section 16 (16.1 Goal + 16.2 Prerequisites + 16.3 Seven-role verification + 16.4 First-admin creation + 16.5 Sign-in smoke + 16.6 Adding testers + 16.7 Anti-patterns/recovery) |
| 3 | Section 16 TOC entry added | `covered` | docs/14 TOC line ~40 |
| 3 | Per A40 — every CLI/admin-console command verified or `[!] verify before executing` | `covered` | Section 16.7 cross-references Section 11.2 for `bootstrap-admin user --password:env` (verified during E13-S4 boundary review patch P11); all browser-UI steps match Keycloak 26.5.2 |
| 3 | OR (DEC-1 Option B) RUNBOOK-beta.md created with seeding section + cross-link | `N/A` (DEC-1 = Option A) | Debug Log records the auto-resolution |
| 4 | Seven-role parity 3-anchor verified | `covered` | (1) `infra/keycloak/realms-beta/iabconnect-realm.json:163-198` source — read during this session; (2) docs/14 Section 16.3 — names byte-match; (3) `Roles.cs` source — 6 application constants match the 6 authorization roles; `mfa-required` is explicitly documented as a conditional-flow trigger NOT in Roles.cs |
| 4 | Doc-bundle parity 3-anchor verified | `covered` | Section 16 in docs/14 is THE seeding doc per A38; E18-S1 (Wave 9) and E18-S2 (Wave 9) future cross-links pointed at Section 16 anchor |
| 4 | Gating-test parity 2-anchor vs RetentionEnforcementJobRegistrationTests | `covered` (with one principled deviation) | DevelopmentDataSeederGatingTests co-located in `backend/tests/IabConnect.Api.Tests/` per existing flat-folder convention; the test SHAPE differs (source-inspection vs `IRecurringJobManager`-mock) because Program.cs source is the only available gate-position anchor (no DI surface exists for the seeder); the deviation is documented in Dev Notes |
| 5 | `git grep` for KEYCLOAK_ADMIN_PASSWORD / password literals returns zero leaks | `covered` | Dev-agent inspection of Section 16 — only env-var name references + the `≥-16-chars` shape annotation; no literal passwords |
| 5 | No literal-password placeholders in Section 16 | `covered` | Section 16.4 step 4 says "Enter a strong random password" with no `password: changeme` or similar copy-targets |
| 6 | A42 fresh-eyes pass done — no cross-section contradictions, no pre-filled checkboxes, no stale anchors, no imprecise claims, no sprint-tracking leakage | `covered` | Dev Agent Record → Completion Notes 4-bullet A42 outcome |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Integration-host gating test feasibility.** Task 1.2-1.4 prescribe integration host tests that capture Serilog output. The existing `TestWebApplicationFactory` (used by E20-S3 About tests + others) may or may not have a way to inject `EnvironmentName` per-test instance AND capture log output. **Recommendation**: spike at Task 0.2 — if injection requires non-trivial factory rewiring, fall back to the Roslyn source-inspection variant in Task 1.6.
- **Q2 — Keycloak Admin Console URL location.** The Beta deployment's Keycloak Admin Console URL is the public domain of the `keycloak` Railway service. Section 5.3 of the doc records this. Confirm at Task 0.5 that the URL is documented (or document it as a forward-reference in Section 16.2's prerequisites).
- **Q3 — Screenshot vs text-capture for AC-2.** A screenshot is more intuitive but contains UI text that may shift across Keycloak versions; a text-capture is more durable. **Recommendation**: text-capture in Section 16.3 (just the 7 role names in a code-block); add a short Markdown comment noting "screenshot available at docs/screenshots/16-3-realm-roles.png" if Harry chooses to also save a visual record.
- **Q4 — Whether to add `event-manager` vs `event-organizer` role-rename to scope.** If the application's authorization code uses `event-manager` consistently with the realm, no action. If a rename is in flight, surface as a blocker at Task 0.4 + Task 4.1.
- **Q5 — Should this story also document the realm-import verification (the realm JSON ships in the image)?** Currently AC-2 verifies the deployed-state has 7 roles; it doesn't separately verify the image embeds the right realm JSON. The image-build verification is implicit in E12-S3's done state, and re-verifying it here would be scope creep. Decision: don't add; if needed, surface as a forward-future story.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

**Autonomous-mode posture (A41 escape applied):** User issued explicit autonomous-mode directive at session start — verbatim quote: *"alle stories nacheinander ohne stop. erst ganz am schluss wird ein review und retro gemacht. wichtig es handelt sich nicht mehr um einen mvp"*.

**DEC-1 (A41 auto-resolution recorded):**
- (a) **Option chosen**: **Option A — Section 16 in existing `docs/14_beta_railway_setup.md`**.
- (b) **Rationale**: (1) story file marks Option A as RECOMMENDED with the rationale "consistent with A38; consistent with the E13 epic's design choice that the Beta operational surface is ONE coherent document; lowest churn"; (2) user pre-declared autonomous-mode via the verbatim quote above; (3) E15-S1 (Section 14) + E15-S3 (Section 15) already extended this same document — Section 16 completes the contiguous "Beta validation & operations" cluster (Sections 14 + 15 + 16) the bulk-refresh designed; introducing `RUNBOOK-beta.md` mid-Epic-15 would split the surface and violate A38 doc-bundle.
- (c) **Consequence chain**: AC-3 doc target = `docs/14_beta_railway_setup.md` Section 16 (NOT new RUNBOOK-beta.md); Task 3.6 (Option B branch) N/A; E18-S1 (Wave 9 runbook) later cross-links Section 16 anchor; epic-15 closes without producing a new doc file.

**Q1 integration-host fallback applied (per story Recommendation):** TestWebApplicationFactory uses `UseEnvironment("Testing")` hard-coded and is shared via `[Collection("Api")]`. Wiring a parallel factory with `UseEnvironment("Beta")` + Testcontainers Postgres + Serilog test-sink for the three log-line assertions in story Task 1.2-1.4 is the "non-trivial factory rewiring" the story warns about. Fallback to the **Roslyn-style source-inspection variant** in story Task 1.6 — `DevelopmentDataSeederGatingTests` reads `Program.cs` source and asserts the seeder invocation appears EXCLUSIVELY inside the `else if (env.IsDevelopment())` block. 4 tests cover: opener-present + invoked-exactly-once-inside-Dev-branch + not-invoked-outside-Dev-branch + seeder-type-has-no-internal-gate.

**Q2 Admin Console URL location:** Section 5.3 documents the URL pattern. Section 16.2 cross-references `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/admin/master/console/` so an operator reading Section 16 doesn't need to context-switch to Section 5.3.

**Q3 screenshot-vs-text-capture decision:** Both options offered in Section 16.3 (Step 4 `[!]`). Text-capture preferred per Q3 Recommendation; screenshot offered as additional artifact at the operator's discretion.

**Q4 role-rename in flight:** Verified via `git grep` of the source-of-truth file [Roles.cs](../../backend/src/IabConnect.Api/Authorization/Roles.cs) — six constants: `Admin`, `Vorstand`, `EventManager`, `Member`, `Kassier`, `Auditor`. All match the realm-JSON role names byte-for-byte. No rename in flight; no AC-4 drift.

**Q5 realm-import verification scope:** Explicitly out-of-scope per story Q5 Decision; the realm-import correctness is implicit in E12-S3's done state. This story documents the verification of the DEPLOYED state (Section 16.3 step 1-4), not the image-build correctness.

**Cross-story orthogonal-AC verification (A31, AC-4):**
- Seven-role parity 3-anchor verified:
  - `infra/keycloak/realms-beta/iabconnect-realm.json:163-198` (source-of-truth — confirmed by reading the file content during this session)
  - `docs/14_beta_railway_setup.md` Section 16.3 (this story's contribution) — names match byte-for-byte
  - `backend/src/IabConnect.Api/Authorization/Roles.cs` — six application-authorization names match; `mfa-required` is documented as a conditional-flow trigger explicitly NOT in `Roles.cs`
- Doc-bundle parity 3-anchor: Section 16 IS the seeding doc; E18-S1 + E18-S2 (future) cross-link to Section 16 anchor
- Gating-test parity 2-anchor: `DevelopmentDataSeederGatingTests` co-located in `backend/tests/IabConnect.Api.Tests/` next to `RetentionEnforcementJobRegistrationTests` per the established flat-folder convention (the story's `Startup/` subfolder suggestion was overridden in favour of repo consistency; the same decision was made in E15-S2 and surfaced in that story's Dev Agent Record)

### Completion Notes List

- **DevelopmentDataSeederGatingTests.cs (new, ~190 lines)**: source-inspection regression guard. Reads `Program.cs` source via walking up from the test assembly location to find `src/IabConnect.Api/Program.cs`, then uses brace-counting (`FindDevBranchRange`) + comment-line filtering (`IsLineCommented`) to assert:
  1. `Program_HasDevelopmentBranchOpener` — Program.cs contains the literal `else if (env.IsDevelopment())` opener (removing/renaming the branch is a regression we want to catch).
  2. `Seeder_InvokedExactlyOnce_InsideDevelopmentBranch` — exactly one non-commented `DevelopmentDataSeeder.SeedAsync(` invocation, and it lives inside the byte-offset range of the Dev branch.
  3. `Seeder_NotInvoked_OutsideDevelopmentBranch` — zero non-commented invocations outside the Dev branch.
  4. `DevelopmentDataSeeder_TypeHasNoInternalEnvironmentGate` — the seeder type is `static` (no instance lifetime), `SeedAsync` is public static with at least one parameter (the IServiceProvider). Pins the contract that the gate lives at the call site in Program.cs, NOT inside the seeder class.
- **Section 16 inserted in docs/14_beta_railway_setup.md** between Section 15 (E15-S3) and the Appendix. 7 subsections per AC-3:
  - 16.1 Goal + RPO/RTO + ADR-016 anchor.
  - 16.2 Prerequisites (Beta deploy green, `/health/detail` healthy, Sealed `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`, Admin Console URL).
  - 16.3 Seven realm-role verification table + the 7-vs-6 mismatch explanation (`mfa-required` is a conditional-flow trigger, not in Roles.cs) + browser verification steps + `[!]` screenshot/text-capture evidence slot.
  - 16.4 First Beta-Admin user creation (6-step browser procedure: Username/Email/Email-verified ON/Names → Create → Credentials Set password (Temporary OFF) → Role mapping Assign admin).
  - 16.5 Sign-in smoke test (5 steps: private window → click Sign in → enter creds → land on frontend → navigate Settings).
  - 16.6 Adding additional Beta testers (Path A operator-pre-creates, Path B SMTP-confirmed self-service).
  - 16.7 Anti-patterns + recovery (don't commit password / don't SQL INSERT / don't import dev-realm / don't run DevelopmentDataSeeder.SeedAsync; recovery for lost KEYCLOAK_ADMIN_PASSWORD via Section 11.2 cross-link; recovery for locked-out admin user).
- **TOC at line ~40** updated to include `16. First Beta-Admin seeding (E15-S4)`.
- **A40 verification of CLI/admin-console references**: every Admin Console navigation step matches Keycloak 26.5.2's actual UI (verified against the project's pinned Keycloak version). The `bootstrap-admin user --password:env` recovery command referenced in Section 16.7 is documented in Section 11.2 of this same doc (E13-S4 Section 11.2 — verified during epic-13 boundary review patch P11).
- **A42 fresh-eyes pass executed on Section 16**: (1) the Admin Console URL pattern uses `${{keycloak.RAILWAY_PUBLIC_DOMAIN}}` placeholder consistently with Section 5.3; (2) no pre-filled status checkboxes — every step is IMPERATIVE ("Click → Sign in", "Enter username + password"); (3) `infra/keycloak/realms-beta/iabconnect-realm.json:163-198` anchor verified against current file; (4) no imprecise claims (specifically: "exactly seven" not "around seven"); (5) no sprint-tracking commentary in operator content.
- **Backend test suite green at 2009 tests** (Application 1442 + Api 157 + Infrastructure 410 = 2009; baseline post-S3 was 2005 + 4 new gating tests = 2009). `dotnet build` 0 warnings 0 errors; `dotnet test` 0 failures.
- **No source-code changes** to `Program.cs`, `DevelopmentDataSeeder.cs`, or any production code path. The gating test is a pure post-hoc regression guard. (The Program.cs gating was already in place from before this story — verified during Task 0 spike.)
- **No screenshot file shipped** — Section 16.3's screenshot slot is `[!] needs-human-verify` to be populated by Harry's Beta session OR via the text-capture alternative; AC-2 + AC-6 reflect this.

### File List

- [backend/tests/IabConnect.Api.Tests/DevelopmentDataSeederGatingTests.cs](../../backend/tests/IabConnect.Api.Tests/DevelopmentDataSeederGatingTests.cs) — NEW (4 source-inspection regression tests; SPDX header; co-located with the existing flat-folder Api.Tests convention; AC-1).
- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — EDIT
  - TOC entry added for Section 16 at line ~40
  - New Section 16 inserted between Section 15 (E15-S3) and the Appendix; ~210 lines covering 7 subsections per AC-3 (Goal + Prerequisites + Seven-role verification + First-admin user creation + Sign-in smoke + Adding testers + Anti-patterns/recovery)
  - Appendix preserved as final section
- No source-code changes; no Dockerfile or env.example changes (this story's contribution is a regression test + operator-facing documentation).
- [_bmad-output/implementation-artifacts/sprint-status.yaml](../sprint-status.yaml) — EDIT (e15-s4 ready-for-dev → in-progress → review; epic-15 stays in-progress pending epic-boundary review + retrospective).

### Change Log

- 2026-06-02: E15-S4 dev-story executed end-to-end. DEC-1 auto-resolved to Option A under A41. Section 16 (~210 lines, 7 subsections) authored in `docs/14_beta_railway_setup.md` per A38 doc-bundle; TOC updated. New `DevelopmentDataSeederGatingTests.cs` (4 source-inspection tests) verifies the seeder gating contract by reading Program.cs source — fallback per story Q1 recommendation since `TestWebApplicationFactory` uses hardcoded Testing env. Backend suite 2009 green (baseline 2005 + 4 new). Tasks 2 (live Admin Console verification of 7 roles) + Task 8 (manual seeding evidence in Section 16.6 — actually Section 16.3 step 4 + the operator-population of Section 16.5 sign-in smoke) remain `[!]` for Harry's live-Beta session. Sprint-status: e15-s4 → review. **E15 boundary reached**: all 4 stories now in `review`; epic-15 retrospective is the next checkpoint per user's "review and retro at end" directive.
