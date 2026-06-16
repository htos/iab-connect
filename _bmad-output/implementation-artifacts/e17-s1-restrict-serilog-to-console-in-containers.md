# Story E17-S1: Restrict Serilog to Console in containers

Status: done

## Story

As **a container operator (Railway today; any OCI runtime tomorrow)**, I want **the API to emit logs only to Console in every non-Development environment**, so that **the container's log aggregator captures everything and no writes go to the ephemeral filesystem**.

**Requirement:** REQ-088 AC-5. Epic E17, Story 1. Sources:

- [docs/14_beta_railway_setup.md §1 Prerequisites and overall doc structure](../../docs/14_beta_railway_setup.md#1-prerequisites)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E17 — Story E17-S1](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §3 ADR-017 — Logging and Health for Container Runtimes](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E17 Story E17-S1 (lines 1709–1726)](../planning-artifacts/epics-and-stories.md)

## Refresh Notes (2026-06-02, bmad-create-story bulk refresh)

This story was refreshed from the 19-line 2026-05-15 stub against post-Epic-14 reality. Material drift vs. the SCP-2026-05-15 §5 text:

- **AC literal text is already met.** [`backend/src/IabConnect.Api/appsettings.Beta.json:1-5`](../../backend/src/IabConnect.Api/appsettings.Beta.json) already has `"Serilog": { "Using": ["Serilog.Sinks.Console"], "WriteTo": [{ "Name": "Console" }] }`. [`backend/src/IabConnect.Api/appsettings.json:9-20`](../../backend/src/IabConnect.Api/appsettings.json) base has `"WriteTo": [{ "Name": "Console" }]`. [`backend/src/IabConnect.Api/appsettings.Development.json:23-34`](../../backend/src/IabConnect.Api/appsettings.Development.json) preserves the File sink for developer ergonomics. The shipped state likely came from an early Epic-11/12 commit (pre-pivot).
- **Story value shifts to verification + regression coverage + operator-facing documentation.** The dev-agent's job is NOT to re-author already-correct JSON but to (a) prove the current state is correct with regression tests that would fail if a future story re-introduces a File sink in base or Beta, (b) document the contract in [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) Section 25 (E17-S1) so a fork operator can see at a glance what the layering produces in each environment, (c) confirm the in-image filesystem inventory does not retain a `logs/` directory artifact left over from earlier `dotnet publish` runs, and (d) verify the bootstrap Console logger in [`backend/src/IabConnect.Api/Program.cs:10-13`](../../backend/src/IabConnect.Api/Program.cs) is also Console-only (caught the early-startup window before Serilog reads configuration).
- **Post-MVP scope expansion per Harry's standing 2026-06-02 directive ("es handelt sich nicht mehr um ein mvp"):** the verification surface now covers EVERY non-Development environment (Beta + a hypothetical Production + the Testing branch in [Program.cs:66-70](../../backend/src/IabConnect.Api/Program.cs)) rather than only Beta. The A31 cross-story invariant added under "Quality-Gates Closing" enforces this.
- **A49 constraint acknowledged:** [Program.cs:10-13](../../backend/src/IabConnect.Api/Program.cs) bootstrap Serilog + [Program.cs:156-157](../../backend/src/IabConnect.Api/Program.cs) `Log.CloseAndFlush()` means a `WebApplicationFactory<Program>` re-instantiation in the same process trips "the logger is already frozen". Tests in this story therefore use **direct artifact-read** (`File.ReadAllText` + `System.Text.Json`) per A51, NOT a derived factory.
- **A38 doc-bundle pattern carried forward:** docs/14 Section 25 (E17-S1) inserts BETWEEN Section 24 (E14-S5) and the Appendix; Section 26 (E17-S2) and Section 27 (E17-S4) will be appended in their respective stories.
- **A52 endpoint-pattern verification (refresh-time):** SCP §5 AC text does not name any HTTP endpoint, so A52 N/A here. (E17-S2 and E17-S4 do touch endpoint patterns and were re-verified.)
- **A40 shell-command-syntax check:** verification commands in §25.3 are `pwsh` + `Get-Content` + `ConvertFrom-Json` + `Select-Object` — all pwsh built-ins, exercised in-session, no `[!] verify before executing` flag needed.

## Acceptance Criteria

1. **AC-1 (Beta overlay Console-only).** [`backend/src/IabConnect.Api/appsettings.Beta.json`](../../backend/src/IabConnect.Api/appsettings.Beta.json) contains `Serilog:WriteTo` with exactly one Console sink and no File sink. A regression test asserts this by reading the file directly and parsing the JSON.
2. **AC-2 (base config Console-only).** [`backend/src/IabConnect.Api/appsettings.json`](../../backend/src/IabConnect.Api/appsettings.json) contains `Serilog:WriteTo` with exactly one Console sink and no File sink. A regression test asserts this.
3. **AC-3 (Development overlay keeps File sink).** [`backend/src/IabConnect.Api/appsettings.Development.json`](../../backend/src/IabConnect.Api/appsettings.Development.json) contains a File sink configured to write under `logs/iabconnect-.log` with daily rolling and retention. A regression test asserts the File sink is still present (this is a developer-ergonomics regression guard — if a future story accidentally hides Development under the same overlay as Beta, this test fails and explains why).
4. **AC-4 (no overlay re-introduces a File sink).** A regression test enumerates every `appsettings.*.json` file under [`backend/src/IabConnect.Api/`](../../backend/src/IabConnect.Api/) and asserts that for every file whose name is NOT exactly `appsettings.Development.json`, no `"File"` sink token appears in the file's text. This covers Beta, any future `appsettings.Production.json`, and any future per-environment overlay introduced later.
5. **AC-5 (bootstrap logger Console-only).** [`backend/src/IabConnect.Api/Program.cs:10-13`](../../backend/src/IabConnect.Api/Program.cs) `Log.Logger = new LoggerConfiguration()...WriteTo.Console().CreateBootstrapLogger()` is asserted by a code-audit regex test to use Console and not File. (This catches the early-startup window from line 10 of `Program.cs` until Serilog reads `IConfiguration` at line 30 — a brief but real window where a File sink could otherwise crash the container if the logs directory is read-only.)
6. **AC-6 (Testing branch does not write files).** A regression test asserts that the Testing environment branch at [Program.cs:66-70](../../backend/src/IabConnect.Api/Program.cs) reaches the `EnsureCreatedAsync` path without referencing the File sink (verified by absence — Testing inherits base + no Testing overlay exists). Defense in depth so a future `appsettings.Testing.json` addition does not silently add a File sink.
7. **AC-7 (Railway in-image filesystem has no orphan `logs/` directory).** Refresh confirms that [`backend/Dockerfile`](../../backend/Dockerfile) does not `COPY` a `logs/` directory and does not `RUN mkdir logs` (defense-in-depth — even if a future code path tried to open a File sink, the directory wouldn't exist read-write). Verified via direct grep over the Dockerfile + a regression test asserting the same.
8. **AC-8 (docs/14 Section 25 published).** [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) Section 25 documents the four-environment matrix (Development / Testing / Beta / Production-inherits-base), the rationale per ADR-017, and a verification block with `pwsh` commands an operator can copy-paste to re-verify the layering at any time. Section inserts between Section 24 (E14-S5) and the Appendix.
9. **AC-9 (cross-story A31 invariant test).** A regression test reads BOTH [`backend/src/IabConnect.Api/appsettings.json`](../../backend/src/IabConnect.Api/appsettings.json) AND [`backend/src/IabConnect.Api/appsettings.Beta.json`](../../backend/src/IabConnect.Api/appsettings.Beta.json) AND [`backend/src/IabConnect.Api/appsettings.Development.json`](../../backend/src/IabConnect.Api/appsettings.Development.json) and asserts the merged `Serilog:WriteTo` projection per environment matches the docs/14 Section 25 matrix exactly (Development = Console + File; Beta = Console; Production = Console). The test reads docs/14 Section 25 directly so doc-vs-code drift becomes a failing test.
10. **AC-10 (zero new package dependencies).** This story adds NO new NuGet packages. All tests use [`backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj`](../../backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj) baseline (xUnit v3 + FluentAssertions + System.Text.Json).
11. **AC-11 (live Beta evidence — deferred per A47 to Wave-8/9 unified walkthrough).** When the unified Wave-8/9 walkthrough runs, an operator confirms: (a) Railway log viewer shows `api`-service log lines flowing in real time, (b) no error lines referencing `IOException` against `logs/` appear in the first 5 minutes of a fresh deploy, (c) `docker exec railway-api-beta sh -c 'ls -la /app/logs 2>&1 || echo NO_LOGS_DIR'` reports `NO_LOGS_DIR`. Marked `[!]` per A30 because the dev-agent cannot reach the live Beta runtime.

## Decision-Needed (per A32 / A41)

### DEC-1: Test mechanism for the regression assertions

**Scope:** AC-1, AC-2, AC-3, AC-4, AC-7, AC-9 all need to assert facts about file contents.

**Options:**

- **(A) Direct artifact-read with `System.Text.Json.JsonDocument` + Path traversal from the test base dir.** (RECOMMENDED) Mirrors the precedent set by `SecurityHeadersTests.BackendFrontendHeaderParity_StaysAligned_A31Invariant` (E14-S2) and `SensitiveDataDestructuringPolicyTests.AllowlistParity_DestructureFieldsCoverAuditScriptAllowlist` (E14-S5) and `RateLimitingTests.StrictPolicyChained_OnAllThreeTargetEndpoints_CodeAudit` (E14-S4). All three are A51-canonical: read the source-of-truth artifact directly, parse, assert. Zero process-state coupling, zero Serilog re-entry (A49 sidestep), zero environment dependency. Fast (<5ms per assertion).
- **(B) IConfiguration-based: instantiate `ConfigurationBuilder` per environment + `AddJsonFile(appsettings.json) + AddJsonFile(appsettings.{env}.json)` + read the merged config.** Closer to runtime semantics but introduces a non-trivial dependency on the JSON-overlay merge rules. Less direct than (A) and slower (~50ms per test). Picks up real `IConfiguration` behavior but cannot detect base-vs-overlay precedence drift in the way (A) can (the merged view is opaque to "which file said what").
- **(C) Runtime via `WebApplicationFactory<Program>` with `WithWebHostBuilder(b => b.UseEnvironment("Beta"))`.** Most realistic but **empirically blocked by A49** — two `WebApplicationFactory<Program>` instances in one process re-run the bootstrap Serilog setup at Program.cs:10-13, tripping "the logger is already frozen". Three Epic-14 stories already hit this constraint and pivoted to code-audit (E14-S2 DEC-3, E14-S3, E14-S4). Pivoting here would compound that debt.

**Recommendation:** **A**. A51 + A49 together steer hard toward (A). The cost of (C) is recurring infrastructure debt that A49 is already tracking for future refactor. Until A49's Serilog re-entrancy fix lands, runtime tests in this surface are blocked.

### DEC-2: Production-environment coverage scope

**Scope:** AC-4 + AC-9 reference a "future `appsettings.Production.json`" but no such file exists today. Should this story ship one?

**Options:**

- **(A) Ship an empty `appsettings.Production.json` that explicitly re-declares `Serilog:WriteTo: [{Name: "Console"}]` as a defense-in-depth + teaching artifact.** Strong signal that Production is a first-class supported deployment target, not just an aspirational config name. Helps a fork operator understand the layering at a glance.
- **(B) Skip the Production overlay; document in docs/14 Section 25 that Production inherits the base (Console-only) and that no `appsettings.Production.json` exists today.** (RECOMMENDED) Minimum-surface change; matches what was true post-Epic-14. AC-4's "no overlay re-introduces a File sink" already enumerates every overlay that DOES exist, so the regression coverage is complete. Adding an empty config file would be a non-functional change that future stories could mistakenly read as a sign that Production has overlay-specific behaviour that just hasn't been filled in yet.
- **(C) Ship a populated `appsettings.Production.json` with explicit `RetentionEnforcement:Enabled=true`, `Database:AutoMigrate=false`, etc. — the canonical Production posture.** Out of scope for E17 (those properties belong to E15-S2 + E19's Production-readiness epic). Mixing them in here muddies the change.

**Recommendation:** **B**. Skip the Production overlay. Document in Section 25 that Production inherits the Console-only base. If a future story (E19) needs Production overlay properties, it can introduce the file then with a complete, intentional posture.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm current state matches AC literal text (A28 spike-first)

- [x] 0.1 Beta overlay confirmed Console-only (lines 1-5 in `appsettings.Beta.json`).
- [x] 0.2 Base config confirmed Console-only (lines 9-20 in `appsettings.json`).
- [x] 0.3 Development overlay confirmed Console + File (lines 23-34 in `appsettings.Development.json`).
- [x] 0.4 Program.cs bootstrap logger confirmed Console-only (line 12 `.WriteTo.Console()`).
- [x] 0.5 Dockerfile confirmed no `logs/` references.
- [x] 0.6 DEC-1 + DEC-2 resolved via A41 autonomous-mode escape per user directive "implementiere das ganze epic 17 mit den stories. höre erst auf wenn alle stories geamcht sind und führe danach das retro aus. nicht stoppen bis es durch ist. berücksichtige dabei das es sich nicht um ein mvp handelt." (2026-06-02). Resolutions: DEC-1=A (direct artifact-read), DEC-2=B (skip Production overlay). See Debug Log References.
- [x] 0.7 Spike outcome documented in Dev Agent Record below.

### Task 1: Add regression tests for AC-1 / AC-2 / AC-3 / AC-4 / AC-9

- [x] 1.1 Created [`backend/tests/IabConnect.Api.Tests/Logging/ConsoleOnlySerilogConfigurationTests.cs`](../../backend/tests/IabConnect.Api.Tests/Logging/ConsoleOnlySerilogConfigurationTests.cs).
- [x] 1.2 `BetaOverlay_HasOnlyConsoleSink_AC1` — passing.
- [x] 1.3 `BaseConfig_HasOnlyConsoleSink_AC2` — passing.
- [x] 1.4 `DevelopmentOverlay_PreservesFileSink_AC3` — passing. Additionally asserts the File sink's `Args.path` starts with `logs/`.
- [x] 1.5 `AllNonDevelopmentOverlays_DoNotMentionFileSink_AC4` — passing. Enumerated 1 overlay (`appsettings.Beta.json`) at test time.
- [x] 1.6 `LayeringMatrix_MatchesDocs14Section25_AC9` — passing. Reads docs/14 Section 25 + the three JSON files; asserts each environment row appears + asserts the actual JSON sink projections match Console-only / Console+File expectations.

### Task 2: Add code-audit regression test for AC-5 (bootstrap logger)

- [x] 2.1 Created [`backend/tests/IabConnect.Api.Tests/Logging/BootstrapSerilogConfigurationTests.cs`](../../backend/tests/IabConnect.Api.Tests/Logging/BootstrapSerilogConfigurationTests.cs). `Program_BootstrapLogger_UsesConsoleOnly_AC5` — passing.

### Task 3: Add Dockerfile + Testing-branch regression tests for AC-6 / AC-7

- [x] 3.1 `Dockerfile_HasNoLogsDirectoryCreation_AC7` — passing. Asserts absence of VOLUME / mkdir / COPY against `logs`.
- [x] 3.2 `Program_TestingBranch_DoesNotConfigureFileSink_AC6` — passing. Asserts zero `.WriteTo.File(...)` calls anywhere in Program.cs + confirms the Testing branch still exists.

### Task 4: Document layering in docs/14 Section 25 (A38 doc-bundle)

- [x] 4.1 Section 25 inserted between Section 24 (E14-S5) and Appendix.
- [x] 4.2 Section 25 contents written: 25.1 Goal/rationale; 25.2 Layering matrix (4 rows: Development / Testing / Beta / Production); 25.3 Operator verification commands (3 pwsh one-liners); 25.4 Failure tree (4 symptom rows); 25.5 Regression-test pointer; 25.6 Live-deploy verification queue (3 Q-items deferred per A47).
- [x] 4.3 Section anchors confirmed unambiguous (`#25-serilog-console-only-sink-in-container-environments-e17-s1`).
- [x] 4.4 A42 reread-as-a-stranger pass complete. Section 25 reads cold: (a) goal stated before matrix; (b) matrix rows non-contradictory; (c) pwsh command outputs match actual file contents; (d) A45 binary reachability: `Get-Content` + `ConvertFrom-Json` + `Select-String` are pwsh-built-ins; `dotnet test` is operator-provided SDK; (e) Section 25.5 paths match the actual test file locations.

### Task 5: Wire the Production-inheritance documentation (DEC-2=B implementation)

- [x] 5.1 Confirmed no `appsettings.Production.json` is shipped (Glob search returned 0 hits under `backend/src/IabConnect.Api/`).
- [x] 5.2 Section 25.2 Production row reads "no Production overlay shipped today (per E17-S1 DEC-2=B); base inheritance is intentional; future E19 may introduce overlay."
- [!] 5.3 Deferred to E19. The §5 Railway variables table at line 419 documents the `Beta` row only. Adding a `Production` row is out-of-scope for E17-S1 per the story's own escape clause ("if the dev-agent judges this out-of-scope, defer to E19"). E19's Production-readiness epic will add the row alongside its `Database__AutoMigrate=false` + retention-re-enable posture. See Completion Notes Q4.

### Task 6: Run the full test suite + Quality-Gates closing

- [x] 6.1 `dotnet build backend/IabConnect.sln -warnaserror` — 0 warnings, 0 errors.
- [x] 6.2 Full backend test suite: **2058 passed / 0 failed** (Application 1442 + Api 202 + Infrastructure 414). Baseline was 2050 before this story; +8 new from E17-S1.
- [x] 6.3 Targeted filter: `--filter "FullyQualifiedName~Logging.ConsoleOnly|FullyQualifiedName~Logging.Bootstrap"` — **8 passed / 0 failed**.
- [x] 6.4 AC-Subitem Completion Check per A29 — see Quality-Gates Closing table below for per-AC evidence.
- [x] 6.5 A42 reread pass on Section 25 — clean (see 4.4).
- [x] 6.6 Status flipped to `review`.

## Dev Notes

### Current Serilog state (as of refresh time, 2026-06-02)

| File | `Serilog:WriteTo` projection | Notes |
|---|---|---|
| [appsettings.json](../../backend/src/IabConnect.Api/appsettings.json) (base, lines 9-20) | `[{Name: "Console"}]` | E14-S5 added `BearerPresenceEnricher` via `ReadFrom.Services` + `SensitiveDataDestructuringPolicy` via Destructure block — those are Serilog enrichers/destructurers, NOT sinks. The WriteTo array is Console-only as required. |
| [appsettings.Beta.json](../../backend/src/IabConnect.Api/appsettings.Beta.json) (lines 1-5) | `[{Name: "Console"}]` | Beta overlay re-declares the Using block + WriteTo. JSON merge semantics for arrays in .NET configuration is *replacement* not *append* (per [ConfigurationBuilder docs](https://learn.microsoft.com/dotnet/core/extensions/configuration#json)), so an overlay's `WriteTo` array fully replaces base's. |
| [appsettings.Development.json](../../backend/src/IabConnect.Api/appsettings.Development.json) (lines 23-34) | `[{Name: "Console"}, {Name: "File", Args: {path: "logs/iabconnect-.log", ...}}]` | File sink preserved per AC-3. `rollingInterval: "Day"` + `retainedFileCountLimit: 30` means 30 daily log files capped at 30 day retention. |
| No `appsettings.Production.json` | N/A | DEC-2=B: Production inherits base. |
| No `appsettings.Testing.json` | N/A | Testing inherits base. Note that [Program.cs:66-70](../../backend/src/IabConnect.Api/Program.cs) special-cases Testing only for the DB migration branch; Serilog reads the base config. |

### Why the bootstrap logger (Program.cs:10-13) matters

```csharp
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateBootstrapLogger();
```

This sets the initial Serilog static `Log.Logger` BEFORE the `WebApplication.CreateBuilder(args)` call at line 19, BEFORE the `builder.Host.UseSerilog((context, services, configuration) => configuration.ReadFrom.Configuration(context.Configuration)...)` call at line 30 that re-reads from IConfiguration. The bootstrap logger captures `Log.Information("Starting IAB Connect API")` at line 17 — if that line referenced a File sink against a non-existent directory, the container would crash before the configuration-driven logger ever loaded. AC-5 ensures this window is always Console-only.

### What this story does NOT do

- It does not refactor the [Program.cs Serilog setup to be `WebApplicationFactory<Program>`-idempotent](../../backend/src/IabConnect.Api/Program.cs#L10-L13). That is action item A49 (Epic-14 retro 2026-06-02) and remains deferred. The cost of that refactor is high (the bootstrap-logger + `Log.CloseAndFlush()` envelope at lines 155-158 is canonical Serilog hosting pattern; a re-entrancy-safe rewrite needs careful handling of the static `Log.Logger`).
- It does not ship a `Serilog.Sinks.Async` wrapper around Console (a Production-grade hardening that gates Console writes through a background-thread queue to avoid blocking request threads under burst log volume). Out of E17 scope; revisit in E19 if Production rollout reveals a latency hotspot.
- It does not change the bootstrap logger's `MinimumLevel.Information()` to `Debug` or `Warning` in any environment. Bootstrap logger captures ~3-5 lines per startup; level tweaks are sub-noise.
- It does not introduce a log-file rotation policy for Development. The existing `rollingInterval: "Day"` + `retainedFileCountLimit: 30` is healthy for local development; if a developer's `logs/` directory grows beyond 30 daily files, the retention sweeps it.

### A31 cross-story orthogonal-AC invariants in scope for this story

1. **JSON-file layering matrix consistency.** Base + Beta + Development overlay projections in docs/14 Section 25.2 must match the actual `WriteTo` arrays in the three files. AC-9 enforces this.
2. **Bootstrap logger vs configuration logger drift.** Both must be Console-only for non-Development environments. AC-5 covers bootstrap; AC-1/AC-2 cover configuration. A future story that "consolidates" them into a single configuration source must update both AC-5 and AC-1/AC-2 tests.
3. **Dockerfile-vs-application filesystem expectations.** The application has zero file-system write expectations (in non-Development); the Dockerfile has zero `logs/` accommodations (no VOLUME, no mkdir, no COPY). AC-7 enforces the Dockerfile side; the test absence-checks the application side.

## Quality-Gates Closing

| AC | Evidence | Status | Notes |
|---|---|---|---|
| AC-1 | `ConsoleOnlySerilogConfigurationTests.BetaOverlay_HasOnlyConsoleSink_AC1` | covered | Beta overlay = Console-only. |
| AC-2 | `ConsoleOnlySerilogConfigurationTests.BaseConfig_HasOnlyConsoleSink_AC2` | covered | Base = Console-only. |
| AC-3 | `ConsoleOnlySerilogConfigurationTests.DevelopmentOverlay_PreservesFileSink_AC3` | covered | Development = Console + File; File.Args.path starts `logs/`. |
| AC-4 | `ConsoleOnlySerilogConfigurationTests.AllNonDevelopmentOverlays_DoNotMentionFileSink_AC4` | covered | Enumerated `appsettings.Beta.json`; future overlays auto-covered. |
| AC-5 | `BootstrapSerilogConfigurationTests.Program_BootstrapLogger_UsesConsoleOnly_AC5` | covered | Regex over the LoggerConfiguration → CreateBootstrapLogger chain. |
| AC-6 | `BootstrapSerilogConfigurationTests.Program_TestingBranch_DoesNotConfigureFileSink_AC6` | covered | Zero `.WriteTo.File(...)` calls in Program.cs + Testing branch still exists. |
| AC-7 | `BootstrapSerilogConfigurationTests.Dockerfile_HasNoLogsDirectoryCreation_AC7` | covered | Regex over backend/Dockerfile — no VOLUME/mkdir/COPY against `logs`. |
| AC-8 | docs/14 Section 25 published; reread per A42 pass complete | covered | Section anchor `#25-serilog-console-only-sink-in-container-environments-e17-s1`. |
| AC-9 | `ConsoleOnlySerilogConfigurationTests.LayeringMatrix_MatchesDocs14Section25_AC9` | covered | A31 doc-vs-code invariant: edit either side, test fails. |
| AC-10 | `IabConnect.Api.Tests.csproj` unchanged (no new `<PackageReference>` lines) | covered | Zero new packages. |
| AC-11 (a) Railway log viewer shows api logs | live walkthrough (Q1) | `deferred-pending-beta-green` | Per A47 / docs/14 §25.6 Q1. |
| AC-11 (b) no `IOException` on `logs/` in first 5 min | live walkthrough (Q2) | `deferred-pending-beta-green` | Per A47 / docs/14 §25.6 Q2. |
| AC-11 (c) `/app/logs` reports no such dir | live walkthrough (Q3) | `deferred-pending-beta-green` | Per A47 / docs/14 §25.6 Q3. |

## Tests / Evidence

- **Backend integration tests:** 3 NEW [Fact]s in `ConsoleOnlySerilogConfigurationTests.cs` (AC-1, AC-2, AC-3) + 1 NEW [Fact] in same file for AC-4 (enumerated over real overlay set) + 1 NEW [Fact] in same file for AC-9 (doc-vs-code parity).
- **Backend code-audit tests:** 3 NEW [Fact]s in `BootstrapSerilogConfigurationTests.cs` (AC-5, AC-6, AC-7).
- **Doc-bundle deliverable:** docs/14 Section 25 inserted between Section 24 + Appendix.
- **Live-deploy evidence:** deferred to Wave-8/9 walkthrough per A47 (AC-11 sub-items).

## Dev Agent Record

### Debug Log References

**DEC-1 (test mechanism for regression assertions) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** A (direct artifact-read with `System.Text.Json.JsonDocument` + path traversal).
- (b) **Rationale:**
    - Story recommendation: A (matches the SecurityHeadersTests / SensitiveDataDestructuringPolicyTests / RateLimitingTests A51-canonical precedent set in Epic-14).
    - User autonomous-mode verbatim quote: "implementiere das ganze epic 17 mit den stories. höre erst auf wenn alle stories geamcht sind und führe danach das retro aus. nicht stoppen bis es durch ist. berücksichtige dabei das es sich nicht um ein mvp handelt." (2026-06-02).
    - Architectural justification: A49 constraint blocks any `WebApplicationFactory<Program>` re-instantiation; A51 direct-artifact-read is the documented sidestep + has zero process-state coupling.
- (c) **Consequence chain:**
    - AC-1, AC-2, AC-3, AC-4, AC-9 all use direct artifact-read.
    - No `WebApplicationFactory<Program>` instantiation.
    - Files: `ConsoleOnlySerilogConfigurationTests.cs` (NEW).

**DEC-2 (Production environment coverage scope) — resolved B via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** B (skip Production overlay; document inheritance in docs/14 Section 25.2).
- (b) **Rationale:**
    - Story recommendation: B (minimum-surface; AC-4's overlay enumeration already covers the "no overlay re-introduces File sink" invariant for any future overlay).
    - User autonomous-mode verbatim quote: same as DEC-1.
    - Architectural justification: an empty `appsettings.Production.json` would be a non-functional drift signal that future stories might mistake for "Production has overlay-specific behavior just unfilled"; better to leave the inheritance explicit in docs/14 Section 25.2 and let E19 introduce the overlay with intentional Production posture.
- (c) **Consequence chain:**
    - No `appsettings.Production.json` shipped.
    - Section 25.2 Production row reads "no Production overlay shipped today; inherits base (Console-only)."
    - Task 5.3 (adding `Production` row to docs/14 §5 Railway variables) deferred to E19 — see Completion Notes Q4.

### Spike outcome (Task 0.7)

Confirmed AC literal text already met. The Serilog-Console-only state was authored earlier (likely E11/E12 pre-pivot). Story scope = (a) regression-test coverage to prevent re-introduction of the File sink in any non-Development overlay, (b) docs/14 Section 25 to operator-document the layering, (c) A31 invariant test (AC-9) tying docs and code via direct artifact read.

### Completion Notes List

- **What was implemented:** 8 new code-audit tests + 1 new docs/14 section (~110 lines).
- **Test counts:** Backend Api.Tests went from 194 → 202 (+8 new for E17-S1). Full backend suite 2050 → 2058 / 0 failed.
- **What was NOT changed:** zero production code changes. Story is verification-only per the refresh finding that AC literal text was already met.

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-11.a):** During the Wave-8/9 unified walkthrough, confirm Railway log viewer shows `api`-service log lines flowing in real time after a fresh deploy.
- **Q2 (AC-11.b):** Confirm no `IOException` lines referencing `logs/` appear in the first 5 minutes of a fresh Beta deploy.
- **Q3 (AC-11.c):** `docker exec railway-api-beta sh -c 'ls -la /app/logs 2>&1 || echo NO_LOGS_DIR'` reports `NO_LOGS_DIR`.
- **Q4 (Task 5.3 deferral):** Add a `Production` row to docs/14 §5 Railway variables per service table when E19's Production-readiness epic ships — folded together with the `Database__AutoMigrate=false` row and the retention-re-enable posture for a coherent Production-overlay change.

### File List

**NEW:**
- `backend/tests/IabConnect.Api.Tests/Logging/ConsoleOnlySerilogConfigurationTests.cs` (170 lines, 5 [Fact] tests)
- `backend/tests/IabConnect.Api.Tests/Logging/BootstrapSerilogConfigurationTests.cs` (84 lines, 3 [Fact] tests)

**MODIFIED:**
- `docs/14_beta_railway_setup.md` (+~110 lines: new Section 25 inserted between Section 24 and Appendix)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)

### Change Log

- 2026-06-02 — E17-S1 dev-story execution: 2 NEW test files (8 new code-audit tests) + Section 25 in docs/14 + status transitions. DEC-1=A + DEC-2=B auto-resolved via A41 autonomous-mode escape; (a)/(b)/(c) Debug Log per A43. All 8 new tests green; full backend suite 2058/2058 green. AC-1..AC-10 covered; AC-11 (3 sub-items) deferred-pending-beta-green per A47 → unified walkthrough Q1-Q3.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention (`[x]`/`[!]`/`[ ]`)
- **A31** cross-story orthogonal-AC inventory (this story closes 3 invariants — see Dev Notes)
- **A34** bulk spec-refresh at epic start (applied: this is a batch with E17-S2 + E17-S4)
- **A38** doc-bundle pattern (this story adds Section 25 to docs/14)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log template for Decision-Needed resolution
- **A42** + **A45** reread-as-a-stranger pass for doc deliverables (six categories)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (applied to AC-11)
- **A49** Program.cs Serilog re-entrancy constraint (steers DEC-1 to A)
- **A51** A31 invariants tested via direct artifact-read (AC-9 pattern)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-02)

Ultimate context engine analysis completed — comprehensive developer guide created. Dev-story execution complete; 8 new code-audit tests + docs/14 Section 25 shipped; A47 escape applied to AC-11 sub-items.
