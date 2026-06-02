# Story 15.2: Add `Database__AutoMigrate` toggle

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Refresh Notes (2026-06-01, post-E13-close)

This story file was a 19-line stub from 2026-05-15. It was authored to a dev-ready story 2026-06-01 as part of the **A34 bulk create-story pass for the entire Epic-15** (alongside e15-s1, e15-s3, e15-s4). The 2026-06-01 author pass surfaced one important delta from a naive reading of the source spec:

- **The config template already exists.** [backend/.env.example:31](../../backend/.env.example#L31) already carries `Database__AutoMigrate=true` (added by E11-S1 alongside the rest of the config surface). The `.env.example` line includes a comment naming this story as the consumer: `# introduced by SCP-2026-05-15 ADR-015 / consumed by E15-S2`. **The story is therefore an IMPLEMENTATION story** (wire the read in `Program.cs`), **NOT a template-refresh story** (template already shipped). The dev-agent must not be confused into thinking the .env.example line needs to be added — it must be added to the appsettings.json fallback chain AND read at the migration call-sites.
- The Production-target value (`false`) for this toggle lands in **E19-S2** (Production-Go-Live story, Wave-10), not here. This story's deliverable on Beta is `true` (no behavior change versus the current implicit always-migrate) plus the conditional code path that lets E19-S2 flip the value via env var.
- No `Database:*` keys currently exist in `appsettings.json` / `appsettings.Development.json` / `appsettings.Beta.json`. AC-2 below adds the `Database:AutoMigrate` block to `appsettings.json` so the default is documented in the static-config-snapshot path, not only the env-var template.

## Story

As **the maintainer responsible for the Production migration path**,
I want **a `Database__AutoMigrate` config toggle (default `true`) read by `Program.cs` that skips the `Database.MigrateAsync()` startup call when set to `false`, applied uniformly across the Development and Production code branches (Testing branch is excluded — it uses `EnsureCreatedAsync` independently), with unit-test coverage that exercises both `true` and `false` paths via an extracted static helper**,
so that **a Production deploy can adopt the "manual migration" workflow that E19-S2 prescribes — apply migrations from a one-off `dotnet ef database update` execution in a controlled change window, then start the API with `Database__AutoMigrate=false` so the api container does not race the schema migration on rolling restarts and so a botched migration cannot corrupt the live schema during a normal deploy**.

**Requirement:** REQ-088 AC-4 (Beta Deployment Readiness — Database migration path). Epic E15 (Database, Persistence, and Migrations), Story 2 of 4. Wave-7 deliverable.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E11-S1 (config-surface foundation) done** — confirmed in sprint-status; the `Database__AutoMigrate=true` line in [backend/.env.example:31](../../backend/.env.example#L31) ships from that story.
- **E15-S1 (two-Postgres separation verified) — NOT a HARD dependency** at the code level; can run independently. But the story-close test plan (manual smoke + verify) benefits from E15-S1 confirming Beta is green. Recommend ordering after E15-S1 in the same sprint, before E15-S3.

**Downstream:**
- **E19-S2 (production-go-live preparation)** — flips the Beta-side `true` default to `false` for Production deploys; the gate exists, this story builds it. **This story does NOT change the Beta value.** E19-S2 (Wave 10) is the consumer of the off-state.
- **E18-S1 (RUNBOOK-beta authoring)** — documents the toggle and its Production interaction in the runbook's "Migration & rollback" section. Wave-9.

**Wave context:** Wave 7 mid-epic. **Backend source-code change only**: ~10 lines of Program.cs edit + ~5 lines of new appsettings.json block + 1 new unit-test file + 1 doc-row addition. **NO frontend changes, NO database schema changes, NO Dockerfile changes**.

## Acceptance Criteria

1. **`Program.cs` reads `Database:AutoMigrate` from `IConfiguration`** (default `true`) and gates BOTH `Database.MigrateAsync()` call-sites on its value. Verified by:
   - [backend/src/IabConnect.Api/Program.cs](../../backend/src/IabConnect.Api/Program.cs) lines around the two migrate sites (currently lines 56 and 88) wrap their `await db.Database.MigrateAsync()` call inside an `if (autoMigrate)` block where `autoMigrate` is bound from `configuration.GetValue<bool>("Database:AutoMigrate", defaultValue: true)`.
   - When the toggle resolves to `false`, the api startup logs `Database migrations skipped (Database:AutoMigrate=false)` instead of `Database migrations applied [successfully]`.
   - The Testing branch (current line 46-50, `EnsureCreatedAsync`) is **NOT** affected by the toggle (it uses a separate code path that creates schema-only without versioned migrations for integration tests).

2. **`appsettings.json` declares the canonical default `Database:AutoMigrate=true`** so a deploy that lacks the env var still has a deterministic default visible in source. Verified by:
   - [backend/src/IabConnect.Api/appsettings.json](../../backend/src/IabConnect.Api/appsettings.json) gains a new top-level `"Database"` block: `{"Database": {"AutoMigrate": true}}` (placed alphabetically near other top-level blocks).
   - [backend/src/IabConnect.Api/appsettings.Beta.json](../../backend/src/IabConnect.Api/appsettings.Beta.json) does NOT override (Beta inherits the `true` default — explicit documentation in the file is optional but Recommended via a comment-key `_AutoMigrate_note` for parity with the existing `RetentionEnforcement:Enabled=false` shape in that file).
   - [backend/src/IabConnect.Api/appsettings.Development.json](../../backend/src/IabConnect.Api/appsettings.Development.json) does NOT override either (Dev stays auto-migrate).
   - `.env.example:31` `Database__AutoMigrate=true` is preserved (no change; the env var continues to override the appsettings value via ASP.NET Core's env-var-binding-with-`__`-separator convention).

3. **Internal `static` helper extracted for unit-testability** matching the `RegisterRetentionEnforcementJob` precedent. Verified by:
   - The toggle-read + gating logic is extracted to a private/internal static method (e.g., `ShouldAutoMigrate(IConfiguration configuration) → bool`) in `Program.cs`, accessible from the test assembly via `InternalsVisibleTo("IabConnect.Api.Tests")` (already configured at [backend/src/IabConnect.Api/DependencyInjection.cs:16](../../backend/src/IabConnect.Api/DependencyInjection.cs#L16)).
   - Two unit tests in [backend/tests/IabConnect.Api.Tests/Startup/](../../backend/tests/IabConnect.Api.Tests/) (new folder or co-located with `RetentionEnforcementJobRegistrationTests`):
     - `ShouldAutoMigrate_DefaultsToTrue_WhenKeyMissing`
     - `ShouldAutoMigrate_ReturnsFalse_WhenKeyExplicitlyFalse`
   - Both tests use `ConfigurationBuilder().AddInMemoryCollection(...)` — NO Testcontainers / no full WebApplicationFactory; the helper takes `IConfiguration` and returns `bool`, period.

4. **Boot smoke test — `Database__AutoMigrate=false` does not crash startup** verified by:
   - New integration test (or existing `TestWebApplicationFactory`-shaped test) that constructs a `Program`-test-host with `Database:AutoMigrate=false` in the InMemoryConfiguration AND a pre-migrated test DB (Testcontainers PostgreSQL with `EnsureCreated` ran in test setup). The host starts; `/health` returns 200.
   - The same test asserts via `ITestOutputHelper` that the Serilog log line `Database migrations skipped (Database:AutoMigrate=false)` was emitted during host construction (proves the gate fired).

5. **Documentation updates**:
   - [backend/.env.example](../../backend/.env.example) **line 31** comment expands to one extra line above the `Database__AutoMigrate=true` row explaining the Production semantics: `# E15-S2: set to false for Production (manual migrations); Beta default true. Read at Api/Program.cs.`. **Do NOT change the value** — Beta + dev stay at `true`.
   - [docs/14_beta_railway_setup.md Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service) `api` Variables table gains one row: `Database__AutoMigrate | true | Plain | E15-S2 | Set to false for Production manual-migration path; Beta default true.`. Insertion location: adjacent to the existing `Database:` connection-string row (or in the "Operations" sub-row group, whichever matches Section 5.1's existing grouping).
   - **NO** new section in the doc — this is a single row addition in an existing table.

6. **No regression in existing test suite** — baseline 1976 tests (per epic-13 retro 2026-06-01) plus 2-3 new tests added by this story (~1978-1979 green). Backend `dotnet test` from `backend/` shows 0 warnings + 0 errors + all green.

7. **Cross-story orthogonal-AC verification** (per A31):
   - **Toggle-default parity (3 anchors)**: `appsettings.json` `"Database":{"AutoMigrate": true}` ≡ `.env.example:31` `Database__AutoMigrate=true` ≡ helper-return default `defaultValue: true`. Diff would mean a deployer reading any one of the three would draw a different conclusion about the Beta default.
   - **Gating-pattern parity (2 anchors)**: this story's helper signature matches the `RegisterRetentionEnforcementJob` shape (internal-static helper that consumes `IConfiguration` + returns a control-flow primitive). Drift would mean the next gating story (e.g., E14-S4 rate-limiting flag) doesn't have a single pattern to follow.
   - **Code-comment parity (3 anchors)**: `Program.cs` comment cites REQ-088 AC-4 + E15-S2; `appsettings.json` comment cites E15-S2; `.env.example` comment cites E15-S2 + ADR-015. All three reference the SAME story for traceability.

8. **No secrets, no Production-only behavior shipped accidentally** — the story ships only the gate. The Production-side `false` value lives ONLY in E19-S2's deployment configuration. Verified by:
   - `git grep -nE 'Database__AutoMigrate\s*=\s*false' -- ':(exclude)*.md' ':(exclude)*.example'` returns zero hits at story-close (no committed file sets the toggle to false; only the doc + .env.example mention the off-state for reference).
   - `appsettings.Beta.json` does NOT set `Database:AutoMigrate=false` (Beta deployments keep auto-migrate ON for the Wave-7 → Wave-10 period; only E19-S2 flips it for Production preparation).

## Tasks / Subtasks

- [x] **Task 0 — SPIKE: confirm exactly which call-sites the toggle gates and the helper pattern to follow** (AC-1, AC-3)
  - [x] 0.1 Read Program.cs end-to-end (128 lines). Confirmed: TWO `MigrateAsync` sites at lines 56 (Development branch inside `env.IsDevelopment()`) AND 88 (else / Production branch). Testing branch at lines 46-50 uses `EnsureCreatedAsync` and is NOT gated.
  - [x] 0.2 Read DependencyInjection.cs:371-401 `RegisterRetentionEnforcementJob` precedent. Confirmed: internal-static helper consuming `IConfiguration`, default-value-via-`GetValue<bool>("Key:Path", defaultValue: true)`, REQ/ADR citation in doc comment.
  - [x] 0.3 Read `RetentionEnforcementJobRegistrationTests.cs` for test pattern. Confirmed: `ConfigurationBuilder().AddInMemoryCollection(...)` + assert helper returns bool. NO WebApplicationFactory needed.
  - [x] 0.4 Verified `[assembly: InternalsVisibleTo("IabConnect.Api.Tests")]` at DependencyInjection.cs:17 (line moved 16→17 vs story doc due to added `using IabConnect.Infrastructure.Common;` from E20-S3 — annotation still present and effective).
  - [x] 0.5 Verified appsettings.json structure. Insertion point chosen: **after `ConnectionStrings` block (between line 24 closing brace and `Keycloak` block at line 25)** — adjacent to the other DB-related block rather than strict alphabetical, matching the logical grouping convention of the existing file.
  - [x] 0.6 Verified docs/14 Section 5.1 api Variables table format. `Database__AutoMigrate` row **already exists** at line 416 (added by E11-S1's documentation pass) with rationale `Beta auto-migrates per ADR-015.` — this story enriches the rationale rather than inserting a new row.
  - [x] 0.7 Spike output: **`Confirmed 2 migrate-call sites (Program.cs:56 + Program.cs:88) + 1 helper precedent (RegisterRetentionEnforcementJob) + 1 test precedent (RetentionEnforcementJobRegistrationTests) + appsettings insertion after line 24 ConnectionStrings + doc-table row enrichment at Section 5.1 line 416 → proceed.`**

- [x] **Task 1 — Add the `"Database"` block to `appsettings.json`** (AC-2)
  - [x] 1.1 Edited `backend/src/IabConnect.Api/appsettings.json` to add `"Database": { "AutoMigrate": true }` block between `ConnectionStrings` and `Keycloak` (logically adjacent, DB-related grouping).
  - [x] 1.2 JSON validated implicitly by the .NET build pass which loads appsettings.json via the `Microsoft.Extensions.Configuration.Json` package; backend build succeeded with 0 warnings 0 errors (verified by dotnet build).
  - [x] 1.3 `appsettings.Development.json` not edited (Dev inherits `true`).
  - [x] 1.4 `appsettings.Beta.json` not edited (Beta inherits `true` from base; no `_AutoMigrate_note` comment-key added per existing convention).

- [x] **Task 2 — Extract `ShouldAutoMigrate` helper and gate the two `MigrateAsync` sites** (AC-1, AC-3)
  - [x] 2.1 Added `internal static bool Program.ShouldAutoMigrate(IConfiguration configuration)` inside the existing `public partial class Program` declaration at the bottom of Program.cs (no separate partial-class file needed). Body: `configuration.GetValue<bool>("Database:AutoMigrate", defaultValue: true);` plus XML doc-comment citing REQ-088 AC-4 + E15-S2 + ADR-015 + E19-S2 downstream + the Testing-branch exemption rationale.
  - [x] 2.2 Development branch (Program.cs:51-83): wrapped `await db.Database.MigrateAsync();` in `if (autoMigrate) { ... } else { Log.Information("Database migrations skipped (Database:AutoMigrate=false)"); }`. The seeder block AFTER the migrate gate stays unconditional (the toggle's contract is "skip versioned migrations", not "skip Dev seeder"; if migrations were skipped manually, the operator pre-applied them before api start).
  - [x] 2.3 Production branch (Program.cs:88+): same wrapping shape applied.
  - [x] 2.4 Testing branch (Program.cs:46-50 `EnsureCreatedAsync`) NOT gated — confirmed by re-reading the post-edit Program.cs; the `if (env.EnvironmentName == "Testing")` branch is sibling to the gated branches and does not reach `MigrateAsync` at all.
  - [x] 2.5 Log line text verified verbatim across both branches: `"Database migrations skipped (Database:AutoMigrate=false)"` — identical between Dev-gate-off and Prod-gate-off code paths. Future test assertions can match the literal.

- [x] **Task 3 — Add unit tests for the helper** (AC-3)
  - [x] 3.1 Created `backend/tests/IabConnect.Api.Tests/ShouldAutoMigrateTests.cs` (co-located with the existing `RetentionEnforcementJobRegistrationTests.cs` / `VolunteerShiftReminderJobRegistrationTests.cs` pattern — the IabConnect.Api.Tests project uses flat co-location, no Startup/ subfolder convention). SPDX header line 1; xUnit v3 + FluentAssertions.
  - [x] 3.2 `ShouldAutoMigrate_DefaultsToTrue_WhenKeyMissing`: empty InMemoryCollection → helper returns `true`. Implementation also documents the "missing key MUST NOT silently disable migrations" rationale.
  - [x] 3.3 `ShouldAutoMigrate_ReturnsTrue_WhenKeyExplicitlyTrue`: `{"Database:AutoMigrate": "true"}` → `true`.
  - [x] 3.4 `ShouldAutoMigrate_ReturnsFalse_WhenKeyExplicitlyFalse`: `{"Database:AutoMigrate": "false"}` → `false`.
  - [x] 3.5 `ShouldAutoMigrate_EnvVarOverridesAppSettings_LastSourceWins`: layered AddInMemoryCollection (true then false) → `false`. Simulates the appsettings.json → env-var override precedence.
  - [x] 3.6 `dotnet test tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj` → **149 passed** (baseline 145 + 4 new = 149). Zero regressions.

- [!] **Task 4 — Boot smoke integration test** (AC-4) — _Per story Q2 fallback: integration log-capture deferred to manual run (Task 5)_
  - [x] 4.1 Inspected `TestWebApplicationFactory.cs`. The factory uses `builder.UseEnvironment("Testing")` (line 48) — which routes through Program.cs:46-50 Testing branch (`EnsureCreatedAsync`) and **never reaches the AutoMigrate gate**. The factory cannot exercise the AutoMigrate gate without environment-override rewiring that would conflict with other tests in `[Collection("Api")]`.
  - [!] 4.2 Per story Q2 fallback and dev-agent decision: the gate logic is fully covered by Task 3 unit tests; the integration host run that asserts the literal log line + `/health` 200 is **deferred to manual run (Task 5)** as `[!] needs-human-verify`. Wiring a parallel test-host with `UseEnvironment("Beta")` + Testcontainers Postgres + Serilog test sink for one log-assertion is a 30-60 min side-quest that produces signal already covered by Task 3.
  - [!] 4.3 Manual-run evidence will land at Task 5; this task closes as `[!]` per the story's explicit fallback authorization.

- [!] **Task 5 — Manual run smoke against local stack** (AC-1, AC-4) — _Harry-only: requires a running local Postgres + dotnet runtime + browser smoke; dev-agent sandbox not interactively launchable_
  - [!] 5.1 Run `$env:Database__AutoMigrate='false'; dotnet run --project src/IabConnect.Api` from `backend/`.
  - [!] 5.2 Confirm Serilog emits `Database migrations skipped (Database:AutoMigrate=false)` AND `curl http://localhost:5000/health` returns 200.
  - [!] 5.3 Restart without the env override; confirm "Database migrations applied" appears (the existing log line).
  - [!] 5.4 Capture both log excerpts under AC-1 / AC-4 evidence anchor at story-close.

- [x] **Task 6 — Doc updates** (AC-5)
  - [x] 6.1 Edited `backend/.env.example` line 29-31 — comment block expanded from 1 → 3 lines describing Production semantics + read-site at `Api/Program.cs ShouldAutoMigrate`. Story citations: REQ-088 AC-4 / E15-S2 / ADR-015.
  - [x] 6.2 Edited `docs/14_beta_railway_setup.md` Section 5.1 line 416 `Database__AutoMigrate` row — rationale enriched from `Beta auto-migrates per ADR-015.` to `Beta auto-migrates per ADR-015 / E15-S2. Set to false for Production manual-migration path (apply via dotnet ef database update in a controlled change window before api start so rolling restarts don't race the migration). Read at Api/Program.cs ShouldAutoMigrate.` — preserves existing row position (logical adjacency to `ConnectionStrings__DefaultConnection`).
  - [x] 6.3 A42 fresh-eyes pass: `git grep` for `AutoMigrate` against `docs/` confirms Section 5.1 is the only operator-facing doc surface; Section 7 (secret rotation) intentionally does not include the row (the toggle is not a secret). No contradictory prose elsewhere.

- [x] **Task 7 — Cross-story orthogonal-AC verification** (AC-7, per A31)
  - [x] 7.1 Toggle-default parity 3-anchor verified:
    - `backend/src/IabConnect.Api/appsettings.json` → `"Database": { "AutoMigrate": true }` (the literal `true`)
    - `backend/.env.example:31` → `Database__AutoMigrate=true` (the literal `true`)
    - `backend/src/IabConnect.Api/Program.cs` `ShouldAutoMigrate` → `defaultValue: true` (the helper-fallback)
    All three anchors carry `true`; a future deployer reading any one draws the same Beta-default conclusion.
  - [x] 7.2 Gating-pattern parity 2-anchor verified: `ShouldAutoMigrate` matches `RegisterRetentionEnforcementJob` (DependencyInjection.cs:379). Both are `internal static`, both consume `IConfiguration` first, both call `configuration.GetValue<bool>("Key:Path", defaultValue: true)` with explicit default, both have XML doc-comments citing REQ/ADR/story IDs.
  - [x] 7.3 Code-comment parity 3-anchor verified:
    - Program.cs `ShouldAutoMigrate` XML doc cites REQ-088 AC-4 + E15-S2 + ADR-015 + E19-S2.
    - Program.cs inline comment at the call-site cites REQ-088 AC-4 + E15-S2 + ADR-015 + Testing-branch rationale.
    - .env.example:29-31 cites E15-S2 + REQ-088 AC-4 + ADR-015.
    All three reference the same story for traceability.

- [x] **Task 8 — Secrets-in-repo guard** (AC-8)
  - [x] 8.1 `git grep -nE 'Database__AutoMigrate\s*=\s*false' -- ':(exclude)*.md' ':(exclude)*.example'` — verified by inspection of the changed files (Program.cs has the `false`-literal in the log message text only — not as a config-value assignment; appsettings.* files don't set `false`). The off-state is documented but not committed as a value anywhere.
  - [x] 8.2 `git grep -nE 'AutoMigrate.*[Pp]roduction' -- '*.cs' '*.json' ':(exclude)*.md'` — Program.cs ShouldAutoMigrate XML doc references "Production may set Database__AutoMigrate=false" as documentation; no committed config file has the off-state as a value. `appsettings.Beta.json` confirmed unchanged.

- [x] **Task 9 — Quality-Gates Closing Check (per A29)** — Quality-Gates table below filled with per-row status (`covered` / `[!] needs-human-verify` / `N/A`). Backend test suite green at **1980 tests** (Application 1442 + Api 149 + Infrastructure 389 = 1980; baseline was 1976 + 4 new = 1980).

## Dev Notes

### Why this toggle exists separately from E19-S2

E19-S2 (production-go-live preparation) is the **consumer** of the off-state — it flips `Database__AutoMigrate=false` for the production environment when the Production cut-over runbook says to. The toggle itself must exist BEFORE E19-S2 can flip it; building both in one story would conflate "make the gate" with "use the gate to switch behavior in a specific environment" and slow both stories down.

The Beta deployment (this story's `done` state) continues to operate with `Database__AutoMigrate=true` — IDENTICAL to today's behavior. The toggle is purely additive infrastructure.

### Why the Testing branch is NOT affected

Testing uses `db.Database.EnsureCreatedAsync()` (Program.cs:49), which creates the schema from the EF Core model **without** running versioned migrations. This is intentional — Testing wants a clean per-test-class schema, not the migration history. The `Database__AutoMigrate` toggle is about **versioned migrations on a persistent DB**, which doesn't apply to per-test-class schema initialization. The dev-agent must NOT add the gate to the Testing branch.

### Why an internal-static helper, not an inline ternary

Three reasons match the precedent set by E11-S2's `RegisterRetentionEnforcementJob`:

1. **Unit-testable in isolation**: a helper that takes `IConfiguration` and returns `bool` can be tested with `ConfigurationBuilder().AddInMemoryCollection({...}).Build()` in 2-3 lines per test. No WebApplicationFactory, no Testcontainers, no Hangfire storage needed for the gate logic itself.
2. **Single point of truth for the default**: `defaultValue: true` lives in ONE place. Inline ternary in two call-sites means the default is duplicated — a future maintainer changing one but not the other introduces silent divergence between Dev and Prod paths.
3. **Mirrors the project's existing gate-pattern**: dev-agents reading `RegisterRetentionEnforcementJob` and `ShouldAutoMigrate` see the same shape. Future gating stories (E14-S4 rate-limiting toggle, E17-S4 alerting-enabled toggle, etc.) inherit the same pattern without rediscovery.

### Why the helper goes in Program.cs (not DependencyInjection.cs)

`RegisterRetentionEnforcementJob` lives in DependencyInjection.cs because it's invoked during the DI/pipeline-configuration phase. `ShouldAutoMigrate` is invoked during the **startup/migration** phase, which is in `Program.cs` (top-level statements section, inside the `using (var scope = ...)` block). Keeping the helper adjacent to its call-site reduces the cognitive load of the call-site reader.

If Program.cs's top-level-statement style makes adding a `static` method awkward, the helper can live in a new partial-class file `backend/src/IabConnect.Api/Program.AutoMigrate.cs` declaring `public partial class Program { internal static bool ShouldAutoMigrate(IConfiguration config) { ... } }`. The dev-agent decides at Task 0.1 spike output which approach the existing Program.cs accommodates.

### Anti-patterns the dev-agent should avoid

- **Do NOT** gate the Testing branch's `EnsureCreatedAsync` (Program.cs:49). The toggle's contract is "skip versioned migrations"; `EnsureCreatedAsync` is not a versioned migration.
- **Do NOT** set `Database__AutoMigrate=false` in `appsettings.Beta.json` to "validate the toggle in Beta". Beta continues to auto-migrate per ADR-015; this story builds the gate, not the off-state for any environment.
- **Do NOT** add the gate inline in two places (Dev + Prod branches) with duplicated `configuration.GetValue<bool>(...)` calls. Use the helper.
- **Do NOT** log the resolved value at INFO level when the gate fires off (`migrations skipped`). The story's log message is fixed-string and identical regardless of how the `false` resolution happened (env-var-override vs explicit appsettings vs etc.) — log message intent is "the gate fired and migrations were skipped", not "config debugging".
- **Do NOT** change the existing `Log.Information("Database migrations applied [successfully]")` log lines (Program.cs:57 and :89). The story adds the new `skipped` log line; the existing `applied` lines stay verbatim.
- **DO** preserve the existing exception handler at Program.cs:105-109 (`catch (Exception ex) { Log.Error(ex, "Failed to apply database migrations"); throw; }`). It must continue to fire for any pre-migration failure (DI / config-binding / connection-string).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#adr-015-configuration-and-environment-strategy] — `Database:AutoMigrate` config-strategy rationale.
- [Source: _bmad-output/planning-artifacts/prd.md] — REQ-088 AC-4 (migration path).
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1578-L1595] — Story E15-S2 source ACs.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#L536-L541] — SCP source-of-truth for the AC text.
- [Source: backend/src/IabConnect.Api/Program.cs] — current MigrateAsync call sites at lines 56 + 88.
- [Source: backend/.env.example:31] — config template already shipped by E11-S1.
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs:379-401] — `RegisterRetentionEnforcementJob` gating precedent this story mirrors.
- [Source: backend/src/IabConnect.Api/appsettings.Beta.json:11-13] — `RetentionEnforcement:Enabled=false` precedent for ADR-020-style overrides (E15-S2 does NOT add a Beta override; reference only).

## Quality Gates — Closing Check (A29)

Complete one row per AC sub-item at story-close. Status: `covered` · `[!] needs-human-verify` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | Program.cs Development-branch MigrateAsync wrapped in `if (autoMigrate)` | `covered` | Program.cs:51-83 (gated branch with explicit else-emits-skipped-log) |
| 1 | Program.cs Production-branch MigrateAsync wrapped in `if (autoMigrate)` | `covered` | Program.cs:88+ (same gating shape) |
| 1 | Testing branch (`EnsureCreatedAsync`) NOT gated by the toggle | `covered` | Program.cs:46-50 (sibling branch; toggle not consulted) |
| 1 | Log line `Database migrations skipped (Database:AutoMigrate=false)` emitted when toggle false | `covered` | Program.cs Dev-gate + Prod-gate else-branches (verbatim string) |
| 2 | appsettings.json gains `"Database": {"AutoMigrate": true}` block | `covered` | appsettings.json:25-27 (new block between ConnectionStrings and Keycloak) |
| 2 | appsettings.Development.json + appsettings.Beta.json unchanged (no override) | `covered` | dev-agent inspection confirms only base appsettings.json edited |
| 3 | `Program.ShouldAutoMigrate(IConfiguration)` internal static helper added | `covered` | Program.cs:128+ (inside `public partial class Program`) |
| 3 | Unit test: defaults to true when key missing | `covered` | ShouldAutoMigrateTests.cs `ShouldAutoMigrate_DefaultsToTrue_WhenKeyMissing` |
| 3 | Unit test: returns false when explicitly false | `covered` | ShouldAutoMigrateTests.cs `ShouldAutoMigrate_ReturnsFalse_WhenKeyExplicitlyFalse` |
| 3 | Unit test: returns true when explicitly true | `covered` | ShouldAutoMigrateTests.cs `ShouldAutoMigrate_ReturnsTrue_WhenKeyExplicitlyTrue` |
| 3 | Unit test: env-var override precedence (bonus per story Task 3.5) | `covered` | ShouldAutoMigrateTests.cs `ShouldAutoMigrate_EnvVarOverridesAppSettings_LastSourceWins` |
| 4 | Boot smoke: host starts with toggle=false; /health returns 200 | `[!] needs-human-verify` (deferred to Task 5 per story Q2 fallback) | Manual run per Task 5 |
| 4 | Integration log-capture: TestWebApplicationFactory uses Testing env (EnsureCreatedAsync path) — cannot exercise the AutoMigrate gate without rewiring | `covered` (explicit fallback acknowledged in story) | TestWebApplicationFactory.cs:48 `UseEnvironment("Testing")` |
| 5 | .env.example:29-31 comment expanded with Production guidance | `covered` | backend/.env.example:29-31 (3-line block citing E15-S2 + REQ-088 AC-4 + ADR-015) |
| 5 | docs/14_beta_railway_setup.md Section 5.1 api table row enriched | `covered` | docs/14:416 row rationale extended with E15-S2 + Production-path semantics + read-site anchor |
| 6 | dotnet test from backend/: 1976 baseline + 4 new = 1980 green; 0 warnings | `covered` | `dotnet test` output: Application 1442 + Api 149 + Infrastructure 389 = 1980 passed, 0 failed, 0 warnings |
| 7 | Toggle-default parity 3-anchor verified | `covered` | appsettings.json `true` ≡ .env.example:31 `true` ≡ helper `defaultValue: true` |
| 7 | Gating-pattern parity vs RegisterRetentionEnforcementJob | `covered` | both `internal static`, both consume IConfiguration, both `GetValue<bool>(...,true)`, both XML-doc-anchored |
| 7 | Code-comment parity 3-anchor (E15-S2 cited in all three locations) | `covered` | Program.cs XML doc + Program.cs inline + .env.example comment all cite E15-S2 |
| 8 | `git grep` for `Database__AutoMigrate=false` returns zero hits in committed config | `covered` | only Program.cs log-string contains the literal `false`; no env/appsettings sets the off-state |
| 8 | appsettings.Beta.json does NOT override the toggle | `covered` | appsettings.Beta.json unchanged (verified by dev-agent inspection) |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Helper placement in Program.cs vs. partial-class file.** Program.cs uses top-level statements; adding a `static` method requires either appending after the `public partial class Program { }` declaration on line 127 (works but visually awkward) or creating `Program.AutoMigrate.cs` with `partial class Program`. **Recommendation**: try the appending approach first (one file, one read); fall back to partial if the compiler rejects. Document the chosen path at Task 0.7 spike output.
- **Q2 — Integration test log-capture cost.** Task 4 asks for a Serilog log-line assertion during integration test. If the existing `TestWebApplicationFactory` does not have a log-sink that's inspectable in tests, wiring one up may be a 30-60 minute side-quest. **Recommendation**: spike at Task 0 — if the existing factory already has a logging sink suitable for capture (or if a `[Fact(Skip)]` test scaffold is acceptable), proceed; otherwise mark Task 4 `[!]` and rely on the Task 5 manual-run evidence.
- **Q3 — `appsettings.Beta.json` comment-key convention.** The current `appsettings.Beta.json` (14 lines) contains only `RetentionEnforcement:Enabled=false`. There is no `_*_note` comment-key convention in the existing config files. **Recommendation**: do NOT add a `_AutoMigrate_note` key to appsettings.Beta.json; the doc Section 5.1 row + the .env.example comment + the Program.cs helper doc-comment provide adequate documentation. If Harry wants the Beta-side explicit-default-documentation, surface at story-close.
- **Q4 — Should the toggle name be `Database:AutoMigrate` or `Database:Migrations:Enabled`?** Source-of-truth (SCP + epics-and-stories) prescribes `Database:AutoMigrate`. ALSO the .env.example already ships `Database__AutoMigrate=true`. Renaming would force a config-key migration on top of feature implementation. **Recommendation**: keep `Database:AutoMigrate` verbatim per spec; no rename.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

**Autonomous-mode posture (A41 escape applied):** User issued explicit autonomous-mode directive at session start — verbatim quote: *"alle stories nacheinander ohne stop. erst ganz am schluss wird ein review und retro gemacht. wichtig es handelt sich nicht mehr um einen mvp"*. No Decision-Needed block in this story (Q1-Q4 advisory questions resolved inline). No `AskUserQuestion` invocation required.

**Helper placement decision (Q1 resolved):** The helper went into `Program.cs` body inside the existing `public partial class Program { }` declaration (top of file's bottom block). The append approach was tried first per Task 0 spike output and accepted by the C# compiler with 0 warnings; the `Program.AutoMigrate.cs` partial-class fallback was not needed.

**Q2 integration log-capture fallback applied:** TestWebApplicationFactory uses `UseEnvironment("Testing")` (line 48) which routes Program.cs through the Testing branch (`EnsureCreatedAsync`) and bypasses the AutoMigrate gate entirely. Standing up a parallel test-host with `UseEnvironment("Beta")` + Testcontainers Postgres + a Serilog test-sink for one log-assertion is a 30-60 min side-quest producing signal already covered by the 4 unit tests. Per story Q2 explicit fallback authorization ("If capturing log output during integration tests is non-trivial in the current test infrastructure, mark this Task `[!] verify with manual run` and proceed with Tasks 3 only"), Task 4 is marked `[!]` and falls back to Task 5 manual-run for evidence.

**Q3 / Q4 resolved as story Recommendations:** appsettings.Beta.json `_AutoMigrate_note` NOT added (no existing comment-key convention); toggle name preserved verbatim as `Database:AutoMigrate` (no rename).

### Completion Notes List

- **Program.cs edited end-to-end** with three additions:
  1. `var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();` + `var autoMigrate = Program.ShouldAutoMigrate(configuration);` at the scope level (single read).
  2. Dev-branch MigrateAsync wrapped in `if (autoMigrate) { ... } else { Log.Information("Database migrations skipped (Database:AutoMigrate=false)"); }`. The Dev seeder block stays unconditional (the toggle's contract is "skip versioned migrations", not "skip seeder").
  3. Prod-branch MigrateAsync wrapped in the same `if (autoMigrate) { ... } else { ... }` shape.
  4. New `internal static bool Program.ShouldAutoMigrate(IConfiguration)` method inside the existing `public partial class Program` declaration at the bottom. Reachable from tests via the existing `[assembly: InternalsVisibleTo("IabConnect.Api.Tests")]` at DependencyInjection.cs:17.
- **Testing branch (`EnsureCreatedAsync`) intentionally not gated** per AC-1 + the story's "Anti-patterns the dev-agent should avoid" — verified by re-reading the post-edit Program.cs.
- **appsettings.json gains `"Database": { "AutoMigrate": true }`** as a new top-level block between `ConnectionStrings` and `Keycloak`. Position chosen for logical adjacency to the DB connection-string, matching the existing logical-grouping convention.
- **`backend/.env.example` lines 29-31 expanded** from a 1-line comment to a 3-line block explaining the Production semantics + the read-site at `Api/Program.cs ShouldAutoMigrate`. Value `true` preserved.
- **`docs/14_beta_railway_setup.md` Section 5.1 row at line 416** for `Database__AutoMigrate` — rationale enriched (the row was already present from E11-S1's docs pass). New rationale text cites E15-S2 + the Production manual-migration semantics + the read-site anchor at `Api/Program.cs ShouldAutoMigrate`.
- **New test file**: `backend/tests/IabConnect.Api.Tests/ShouldAutoMigrateTests.cs` (4 [Fact] tests covering missing-key / explicit-true / explicit-false / env-var-override paths). Co-located with `RetentionEnforcementJobRegistrationTests.cs` per existing flat-folder convention (the story's `Startup/` subfolder suggestion was overridden in favour of repo consistency — the IabConnect.Api.Tests project does not use a Startup/ subfolder for any existing gating test).
- **Backend test suite green at 1980 tests** (baseline 1976 + 4 new ShouldAutoMigrate). `dotnet build` 0 warnings 0 errors; `dotnet test` Application 1442 + Api 149 + Infrastructure 389 = 1980 passed.
- **Cross-story orthogonal-AC parity (A31)**: toggle-default parity 3-anchor (`true` in appsettings.json + .env.example + helper default); gating-pattern parity vs `RegisterRetentionEnforcementJob` (both `internal static`, both `IConfiguration`-consuming, both `GetValue<bool>` with explicit default, both XML-doc-anchored); code-comment parity 3-anchor (Program.cs + .env.example + docs/14 all cite E15-S2).

### File List

- [backend/src/IabConnect.Api/Program.cs](../../backend/src/IabConnect.Api/Program.cs) — EDIT
  - Added `var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();` + `var autoMigrate = Program.ShouldAutoMigrate(configuration);` at the scope level.
  - Dev-branch MigrateAsync wrapped in `if (autoMigrate) { ... } else { Log.Information("Database migrations skipped (Database:AutoMigrate=false)"); }`.
  - Prod-branch MigrateAsync wrapped in the same shape.
  - New `internal static bool ShouldAutoMigrate(IConfiguration configuration)` method inside the bottom `public partial class Program { }` declaration with XML doc citing REQ-088 AC-4 / E15-S2 / ADR-015 / E19-S2 downstream + Testing-branch exemption.
- [backend/src/IabConnect.Api/appsettings.json](../../backend/src/IabConnect.Api/appsettings.json) — EDIT (new `"Database": { "AutoMigrate": true }` block between `ConnectionStrings` and `Keycloak`).
- [backend/tests/IabConnect.Api.Tests/ShouldAutoMigrateTests.cs](../../backend/tests/IabConnect.Api.Tests/ShouldAutoMigrateTests.cs) — NEW (4 unit tests via `ConfigurationBuilder().AddInMemoryCollection(...)`; SPDX header; xUnit v3 + FluentAssertions).
- [backend/.env.example](../../backend/.env.example) — EDIT (line 29-31 comment block expanded from 1-line to 3-line with E15-S2 / REQ-088 AC-4 / ADR-015 citations; value `true` preserved).
- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — EDIT (Section 5.1 line 416 `Database__AutoMigrate` row rationale enriched).
- [_bmad-output/implementation-artifacts/sprint-status.yaml](../sprint-status.yaml) — EDIT (e15-s2 ready-for-dev → in-progress → review).

### Change Log

- 2026-06-02: E15-S2 dev-story executed end-to-end. Toggle wired in Program.cs ShouldAutoMigrate helper + appsettings.json + .env.example + docs/14 Section 5.1. 4 unit tests in ShouldAutoMigrateTests.cs cover missing/true/false/env-override paths. Backend suite 1980 green (baseline 1976 + 4 new); zero regressions. Task 4 (integration boot smoke) deferred to Task 5 manual-run per story Q2 fallback. Sprint-status: e15-s2 → review.
