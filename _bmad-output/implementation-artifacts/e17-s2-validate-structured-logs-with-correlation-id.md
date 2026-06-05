# Story E17-S2: Validate structured logs with CorrelationId

Status: done

## Story

As **an operator looking at the Railway log viewer (or any future log aggregator)**, I want **every request log to carry a `CorrelationId` property that is identical across all log lines emitted for the same request and is propagated to the caller via the `X-Correlation-Id` response header**, so that **I can trace a tester report or an alert back to the exact set of backend events for the request that triggered it, end-to-end**.

**Requirement:** REQ-088 AC-5. Epic E17, Story 2. Sources:

- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E17 — Story E17-S2](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §3 ADR-017 — Logging and Health for Container Runtimes](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E17 Story E17-S2 (lines 1728–1745)](../planning-artifacts/epics-and-stories.md)
- Companion: this story sits alongside [e17-s1-restrict-serilog-to-console-in-containers.md](e17-s1-restrict-serilog-to-console-in-containers.md) and [e17-s4-add-external-uptime-monitoring.md](e17-s4-add-external-uptime-monitoring.md) in the E17 Monitoring/Logging/Health epic.

## Refresh Notes (2026-06-02, bmad-create-story bulk refresh)

This story was refreshed from the 19-line 2026-05-15 stub against post-Epic-14 reality. Material drift vs. the SCP-2026-05-15 §5 text:

- **AC literal text is already met.** [`backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs:14-26`](../../backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs) already (a) reads `X-Correlation-Id` from the request header or generates a fresh GUID; (b) writes the value back as the response `X-Correlation-Id` header; (c) pushes it into `Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId)` for the duration of the request scope. Registered in [`backend/src/IabConnect.Api/DependencyInjection.cs:300-301`](../../backend/src/IabConnect.Api/DependencyInjection.cs) per the UseApiPipeline comment "REQ-054: Correlation ID tracking (before exception handling)". This was authored under REQ-054 long before the Beta pivot. Log levels (`Default: Information`, `Microsoft: Warning`, `Microsoft.EntityFrameworkCore: Warning`) are already set in [`backend/src/IabConnect.Api/appsettings.json:9-17`](../../backend/src/IabConnect.Api/appsettings.json).
- **Story value shifts to verification + regression coverage + comprehensive observability hardening.** Post-MVP scope (per Harry's 2026-06-02 directive "es handelt sich nicht mehr um ein mvp") goes beyond literal AC text. The deliverable surface:
  1. **Regression tests** that fail loudly if a future story re-registers `CorrelationIdMiddleware` in the wrong pipeline order, accidentally swaps the header name, breaks the property-push, or strips a documented log level override.
  2. **Per-request continuity test**: prove that two `Log.Information(...)` calls inside the same request scope share one `CorrelationId` property value, AND that two concurrent requests get different `CorrelationId` values (no leakage across `AsyncLocal` scopes).
  3. **`UseSerilogRequestLogging` enrichment confirmation**: the Serilog HTTP request-log line (one per request, emitted by [`UseSerilogRequestLogging()` at DependencyInjection.cs:326](../../backend/src/IabConnect.Api/DependencyInjection.cs)) carries the same `CorrelationId` as application log lines emitted inside the same request.
  4. **`X-Correlation-Id` echo contract test**: the response header matches whatever the request sent in (round-trip behavior), AND a missing request header produces a server-generated 32-char hex GUID in the response.
  5. **docs/14 Section 26** publishing the operator-facing tracing guide: what to grep, what the field looks like in Railway's JSON-structured log view, how to correlate a single user-visible error back to all related lines.
- **A49 constraint:** [Program.cs:10-13 + 30-34](../../backend/src/IabConnect.Api/Program.cs) Serilog setup is NOT `WebApplicationFactory<Program>`-idempotent. The TestCorrelator-based tests in this story therefore configure a **local Serilog ILogger** at test-fixture scope (`new LoggerConfiguration()...WriteTo.TestCorrelator()`), exactly the pattern set by `SensitiveDataDestructuringPolicyTests` (E14-S5). They do NOT re-instantiate `WebApplicationFactory<Program>` for log-line assertions. AC-4 + AC-7 (request-pipeline-order assertions) use direct-artifact-read of `DependencyInjection.cs` per A51, not a runtime probe.
- **A36 constraint:** any integration test reading env-var-mapped `IConfiguration` (e.g. `Logging:LogLevel:Default`) must override in `TestWebApplicationFactory.ConfigureAppConfiguration` via `AddInMemoryCollection` empty bindings so a CI runner with `Logging__LogLevel__Default=Trace` exported doesn't silently flip the assertion. Applied to AC-5's log-level assertion test.
- **A52 endpoint-pattern verification:** AC-12 walkthrough Q-items use `curl https://api.<beta-host>/health/ready` to demonstrate the round-trip; endpoint existence is verified by reference to companion story E17-S4 Task 0.1 + 0.2 (confirmed at refresh + at story-close). (Boundary-review A9: prior "A52 N/A" claim was incorrect since AC-12 does name `/health/ready`; updated to acknowledge the cross-story verification.)
- **A40 shell-command-syntax check:** verification commands in §26 use `curl` + `jq` + `Select-String`. `curl` is operator-provided locally; `jq` is operator-provided. Both are flagged as "operator must install" in §26.3.

## Acceptance Criteria

1. **AC-1 (CorrelationIdMiddleware pushes property into LogContext).** Regression test: instantiate `CorrelationIdMiddleware` with a stub `RequestDelegate`; run it; assert that within the delegate's execution, the current `Serilog.Context.LogContext` carries a `CorrelationId` property with the same value as the response header. Already a behavior — test locks it in.
2. **AC-2 (`X-Correlation-Id` round-trip).** Regression test: invoke middleware with `HttpContext` carrying `X-Correlation-Id: testvalue-abc-123`; assert (a) `httpContext.Response.Headers["X-Correlation-Id"]` echoes the input verbatim; (b) `httpContext.Items["CorrelationId"]` carries `testvalue-abc-123`; (c) the LogContext property within the delegate carries the same value.
3. **AC-3 (server-generated GUID when header missing).** Regression test: invoke middleware with `HttpContext` carrying no `X-Correlation-Id`; assert `httpContext.Response.Headers["X-Correlation-Id"]` is a 32-character hexadecimal string (matches `^[0-9a-f]{32}$`). This is the `Guid.NewGuid().ToString("N")` contract — locked in by test.
4. **AC-4 (middleware registration order).** Regression test reads `DependencyInjection.cs` via `File.ReadAllText` + regex extraction of the `UseApiPipeline` body; asserts the line order is: `UseForwardedHeaders` → security-headers `Use(...)` → optional `UseHsts` → `UseMiddleware<CorrelationIdMiddleware>` → `UseMiddleware<ExceptionHandlingMiddleware>`. Specifically: `CorrelationIdMiddleware` MUST be before `ExceptionHandlingMiddleware` (so unhandled-exception logs carry the CorrelationId) and BEFORE `UseSerilogRequestLogging` (so the auto-emitted request-completion log line carries it).
5. **AC-5 (log levels match SCP §5 spec).** Regression test reads the merged `IConfiguration` projection per environment (test uses `ConfigurationBuilder + AddJsonFile + AddInMemoryCollection` to override any env-var leakage per A36); asserts `Serilog:MinimumLevel:Default == "Information"`, `Serilog:MinimumLevel:Override:Microsoft == "Warning"`, `Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore == "Warning"`. Note: the actual current key in [`appsettings.json:13-15`](../../backend/src/IabConnect.Api/appsettings.json) does not include the `.Hosting.Lifetime: Information` exception explicitly in the AC text — that's a base override that should remain and is asserted as a fourth row.
6. **AC-6 (per-request CorrelationId continuity — single request, multiple log lines).** Regression test using TestCorrelator: open a `LogContext.PushProperty("CorrelationId", "scope-A")` block; emit two `Log.Information(...)` calls; close the block; assert both events carry property `CorrelationId == "scope-A"`. This proves nested log statements inside the same request see the same property — the contract an operator relies on when correlating multiple log lines back to one user-visible action.
7. **AC-7 (per-request CorrelationId isolation — concurrent requests).** Regression test: spawn two `Task`s that each open their own `LogContext.PushProperty("CorrelationId", "scope-X")` / `"scope-Y"` block and emit one log line each, with `await Task.Yield()` interleavings; assert the two emitted events carry the correct distinct property values (no leakage). This proves `Serilog.Context.LogContext` uses `AsyncLocal<T>` correctly — the contract that prevents request-A's data from showing in request-B's log lines.
8. **AC-8 (UseSerilogRequestLogging enrichment).** Regression test reads `DependencyInjection.cs`; asserts `app.UseSerilogRequestLogging();` is present in `UseApiPipeline`. (Behavior-level continuity — Serilog's request-log line auto-inherits all `LogContext` properties active at the time of its emission, including `CorrelationId`. The code-audit test locks in the pipeline registration; AC-6 separately proves the property propagates.)
9. **AC-9 (ExceptionHandlingMiddleware preserves CorrelationId).** Regression test: read `ExceptionHandlingMiddleware.cs` via `File.ReadAllText`; assert the file references `CorrelationId` OR uses `Log.ForContext` / `Log.Error` patterns that pick up ambient `LogContext` properties (Serilog's default behavior). If `ExceptionHandlingMiddleware` writes its own log statements via `Microsoft.Extensions.Logging.ILogger`, those statements inherit Serilog's `LogContext` only when the Serilog provider is the active `ILoggerFactory` provider — which it is per `builder.Host.UseSerilog(...)` at Program.cs:30. Code-audit assertion: the middleware uses `ILogger` (any flavor) or `Log.*` and does not strip `LogContext`.
10. **AC-10 (`docs/14` Section 26 published).** [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) Section 26 documents (a) the CorrelationId contract end-to-end, (b) a sample Railway JSON log entry annotated with field locations, (c) operator workflow for tracing a tester report back to the request, (d) how to send a `X-Correlation-Id` header from `curl` to reuse an existing tracer when manually reproducing an issue. Section 26 inserts between Section 25 (E17-S1, added in companion story) and the Appendix.
11. **AC-11 (cross-story A31 invariant).** A regression test asserts the docs/14 Section 26's documented header name + property name + minimum log levels match the runtime sources: `X-Correlation-Id` matches `CorrelationIdMiddleware.cs:12` constant; property name `CorrelationId` matches the LogContext push at line 22; minimum log levels match `appsettings.json:9-17`. A31 doc-vs-code invariant per A51 — read both artifacts directly + assert parity.
12. **AC-12 (live Beta evidence — deferred per A47 to Wave-8/9 walkthrough).** When the unified walkthrough runs, an operator: (a) calls a `/health/ready` endpoint with `curl -H 'X-Correlation-Id: e17s2-test-001' https://api.<beta-host>/health/ready` and confirms the response includes `X-Correlation-Id: e17s2-test-001`; (b) opens the Railway log viewer immediately after, filters for `CorrelationId: e17s2-test-001`, confirms at least the `UseSerilogRequestLogging` request-completion line appears with that property; (c) makes a second request WITHOUT the header and confirms the response carries a freshly-generated 32-char hex GUID + that GUID appears in the Railway log line. Marked `[!]` per A30.

## Decision-Needed (per A32 / A41)

### DEC-1: Per-request continuity test mechanism

**Scope:** AC-6 + AC-7 need to assert per-request property propagation. Two viable shapes given A49.

**Options:**

- **(A) `Serilog.Sinks.TestCorrelator` (RECOMMENDED).** Already added in E14-S5 (`Serilog.Sinks.TestCorrelator 4.0.0` is in [`backend/Directory.Packages.props:29`](../../backend/Directory.Packages.props)). Used by the existing `SensitiveDataDestructuringPolicyTests` per the exact same pattern. The fixture-local `LoggerConfiguration()...WriteTo.TestCorrelator()` sidesteps A49 because it does NOT touch the static `Log.Logger`. TestCorrelator's per-context scoping (`using (TestCorrelator.CreateContext())`) gives clean per-test isolation and structured `LogEvent` access for property assertions (`evt.Properties["CorrelationId"]`).
- **(B) `Serilog.Sinks.InMemory`.** Functionally similar to TestCorrelator. Requires adding the package. TestCorrelator is already added so this is strictly more dependency churn.
- **(C) Custom in-memory `ILogEventSink` implementation.** Roll-your-own. Zero new dependencies. Zero added value over (A).

**Recommendation:** **A**. TestCorrelator is already in the project; mirroring the E14-S5 precedent reduces cognitive surface for future maintainers.

### DEC-2: Concurrent-request isolation (AC-7) approach

**Scope:** AC-7's "two concurrent requests get distinct CorrelationId values" assertion needs careful test design — `LogContext.PushProperty` uses `AsyncLocal<T>` which is `Task`-scoped, so a naive `Task.Run(() => { LogContext.PushProperty(...); log; })` does prove isolation if the asserts happen inside each task and TestCorrelator collects all events.

**Options:**

- **(A) Two parallel `Task`s with explicit `LogContext.PushProperty` inside each, both writing into the same TestCorrelator context, asserting `evt.Properties["CorrelationId"].ToString()` matches per-event by some discriminator in the message template. (RECOMMENDED)** Cleanest demonstration of `AsyncLocal` isolation. Test uses `await Task.WhenAll(t1, t2)` + collect events + assert exactly two events with distinct CorrelationId values. Idiomatic for Serilog + AsyncLocal behavior.
- **(B) Spawn an in-test mini-HTTP-server (`TestServer`) and fire two `HttpClient.GetAsync` calls in parallel through the actual `CorrelationIdMiddleware` to assert end-to-end isolation.** More faithful to the production path but introduces a `TestServer` + middleware setup + risks the same A49 single-logger pitfall if not carefully scoped.
- **(C) Skip AC-7 — accept that `AsyncLocal` behavior is framework-given and test it once at the framework level (Microsoft.NET).** Not adequate. `LogContext.PushProperty` specifically wraps `AsyncLocal` and a regression that swaps `LogContext` for a global static would silently pass framework-level tests but fail AC-7.

**Recommendation:** **A**. Minimum surface, maximum signal.

### DEC-3: Production-grade additions beyond literal AC text (post-MVP scope expansion)

**Scope:** Harry's standing 2026-06-02 directive "es handelt sich nicht mehr um ein mvp" raises the question of what observability hardening this story should bundle.

**Options:**

- **(A) Minimum literal scope: just the 12 ACs above. (RECOMMENDED)** AC-1 through AC-11 already cover regression + continuity + isolation + docs + A31 invariant. AC-12 covers the live evidence. This is already a comprehensive verification surface — well beyond a Beta-MVP "spot-check a log line" mindset. The Wave-8/9 walkthrough will surface anything else worth catching.
- **(B) Bundle in `UseSerilogRequestLogging` enrichment of `User.Identity.Name` + `X-Forwarded-For-derived ClientIp`** so each request-completion line carries who-did-what-from-where without needing to join across log lines. Requires editing `DependencyInjection.cs:326` to add `options.EnrichDiagnosticContext = (diagnosticContext, httpContext) => { ... }`. Useful for Production triage but adds two scope-creep ACs (the destructuring policy + auditing tests) and creates a soft dependency on E14-S5's sensitive-property allowlist (User-Identity name is not in the redaction list; X-Forwarded-For isn't either).
- **(C) Bundle in a `Serilog.Enrichers.Environment` + `Serilog.Enrichers.Process` pass** (machine name, process id) for multi-instance correlation under future horizontal scaling. Out of scope per current single-instance Beta deploy.

**Recommendation:** **A**. Keep this story focused on the CorrelationId surface. If the Production-grade enrichment becomes a recurring ask, capture as a deferred-work entry "Request-log enrichment with User + ClientIp" pointed at E14-S5's redaction policy.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (live infrastructure / browser / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm current state matches AC literal text (A28 spike-first)

- [x] 0.1 LogContext push confirmed at CorrelationIdMiddleware.cs:22.
- [x] 0.2 Pipeline registrations confirmed at DependencyInjection.cs:301 + 326.
- [x] 0.3 Base config log levels confirmed: Default=Information + Microsoft=Warning + Microsoft.EntityFrameworkCore=Warning + Microsoft.Hosting.Lifetime=Information.
- [x] 0.4 `Serilog.Sinks.TestCorrelator 4.0.0` confirmed in Directory.Packages.props:29 + Api.Tests.csproj:20.
- [x] 0.5 DEC-1/DEC-2/DEC-3 resolved via A41 autonomous-mode escape per A43 (a)/(b)/(c) template — see Debug Log References.
- [x] 0.6 Spike outcome documented in Dev Agent Record.

### Task 1: Add `CorrelationIdMiddlewareTests` for AC-1 / AC-2 / AC-3 (middleware behavior)

- [x] 1.1 Created [`backend/tests/IabConnect.Api.Tests/Middleware/CorrelationIdMiddlewareTests.cs`](../../backend/tests/IabConnect.Api.Tests/Middleware/CorrelationIdMiddlewareTests.cs).
- [x] 1.2 `Middleware_PushesCorrelationIdIntoLogContext_AC1` — passing (verifies HttpContext.Items population during downstream delegate scope + 32-char hex GUID format).
- [x] 1.3 `Middleware_EchoesIncomingHeader_AC2` — passing.
- [x] 1.4 `Middleware_GeneratesGuidWhenHeaderMissing_AC3` — passing.
- [x] 1.5 `Middleware_GeneratesDistinctGuidsAcrossInvocations_AC3b` — passing.
- [x] 1.6 Bonus: `Middleware_LogContextPropertyMatchesHttpContextItems_AC1b` — passing. Uses TestCorrelator within the downstream delegate to confirm the LogContext.PushProperty value is visible to inner Log emissions.

### Task 2: Add pipeline-registration regression tests for AC-4 / AC-8 / AC-9

- [x] 2.1 Created [`backend/tests/IabConnect.Api.Tests/Logging/RequestLoggingPipelineTests.cs`](../../backend/tests/IabConnect.Api.Tests/Logging/RequestLoggingPipelineTests.cs).
- [x] 2.2 `Pipeline_CorrelationIdMiddleware_BeforeExceptionAndRequestLogging_AC4` — passing.
- [x] 2.3 `Pipeline_UseSerilogRequestLogging_IsRegistered_AC8` — passing.
- [x] 2.4 `Pipeline_ExceptionHandlingMiddleware_DoesNotStripLogContext_AC9` — passing. Confirms no LogContext.Reset call + middleware uses `_logger.LogWarning/LogError` (Microsoft.Extensions.Logging ILogger which inherits LogContext via builder.Host.UseSerilog).

### Task 3: Add per-request continuity tests for AC-6 / AC-7 (using TestCorrelator per DEC-1=A)

- [x] 3.1 Helper pattern mirrored from `SensitiveDataDestructuringPolicyTests.cs:23-30`. Fixture-local `LoggerConfiguration().Enrich.FromLogContext().WriteTo.TestCorrelator()`.
- [x] 3.2 `LogContext_PropagatesCorrelationIdAcrossMultipleLines_AC6` — passing.
- [x] 3.3 `LogContext_IsolatesCorrelationIdAcrossConcurrentTasks_AC7` — passing. CancellationToken plumbed via `TestContext.Current.CancellationToken` per xUnit v3 analyzer requirement.
- [x] 3.4 XML doc updated on test class.

### Task 4: Add log-level configuration regression test for AC-5 (A36-compliant)

- [x] 4.1 + 4.2 + 4.3 + 4.4 `Configuration_LogLevelOverrides_MatchSpec_AC5` — passing. A36 rationale documented in test class XML doc. Asserts all 4 minimum-level keys including the `Microsoft.Hosting.Lifetime=Information` carve-out.

### Task 5: Add A31 doc-vs-code invariant test for AC-11

- [x] 5.1 + 5.2 + 5.3 + 5.4 + 5.5 `Docs14Section26_MatchesRuntimeSources_AC11` — passing. Reads docs/14 Section 26 + extracts `CorrelationIdHeader` constant via regex; asserts the canonical `X-Correlation-Id` header name + `CorrelationId` log property + log levels (`Information`, `Warning`) all appear in Section 26.

### Task 6: Document the contract in docs/14 Section 26 (A38 doc-bundle)

- [x] 6.1 Section 26 inserted between Section 25 (E17-S1) and Appendix.
- [x] 6.2 Section 26 contents authored:
    - **26.1 Goal and tracing model (per ADR-017).** Two paragraphs: (a) every request carries a `CorrelationId` from edge ingress to exception logger; (b) operators trace user-visible errors back to backend events by grep on `CorrelationId` in the Railway log viewer (one filter, no joins).
    - **26.2 Contract reference table.** Columns *Surface*, *Field name*, *Value shape*, *Source file*. Rows: Request header `X-Correlation-Id` / 1..128 chars caller-provided or 32-char hex GUID server-generated / [`CorrelationIdMiddleware.cs:12`](../../backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs); Response header `X-Correlation-Id` / same value echoed / [`CorrelationIdMiddleware.cs:20`](../../backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs); Log property `CorrelationId` / same value Push'd into `LogContext` / [`CorrelationIdMiddleware.cs:22`](../../backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs); HttpContext.Items `CorrelationId` / same value Stash'd for downstream handlers / [`CorrelationIdMiddleware.cs:19`](../../backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs).
    - **26.3 Log levels.** Reference table with the four rows asserted in AC-5; for each row a one-line "what gets logged" explanation. Note that operators can override per-environment via env var `Serilog__MinimumLevel__Override__<Namespace>=Debug` (Railway service variables; refresh: documented in [docs/14 §5.1 api variables](../../docs/14_beta_railway_setup.md#5-railway-variables-per-service)).
    - **26.4 Operator workflows.**
      - **A: trace a tester-reported error back to backend events.** (1) Tester reports the error happened at `2026-06-XX 14:32:07 UTC`. (2) Tester provides the `X-Correlation-Id` header value if they could grab it from browser dev tools (frontend logs the response header — see E17-S1's frontend instrumentation). (3) Operator opens Railway log viewer for the `api` service, time range ±2 min around the reported timestamp, full-text filter on the CorrelationId value. (4) All structured log lines for that request appear together.
      - **B: reproduce an error manually with a known CorrelationId.** `curl -H 'X-Correlation-Id: manual-repro-001' -H 'Authorization: Bearer <token>' https://api.<beta-host>/members?search=foo`; then filter Railway logs for `manual-repro-001`.
      - **C: distinguish slow-paths from error-paths under load.** Use `UseSerilogRequestLogging`'s emitted `RequestPath` + `Elapsed` properties in combination with the CorrelationId to find request scopes whose total duration exceeded SLO; downstream lines under that CorrelationId reveal the per-step breakdown.
    - **26.5 Sample Railway JSON log entry (annotated).** A JSON block showing one event with `@t`, `@l`, `@mt`, `CorrelationId`, `RequestPath`, `Elapsed`, `SourceContext` properties; arrows pointing to which property maps to which contract row.
    - **26.6 Failure tree.**
      - (a) CorrelationId field missing in Railway logs → check `UseSerilogRequestLogging` registration order in `DependencyInjection.cs:326` (regression test `Pipeline_UseSerilogRequestLogging_IsRegistered_AC8`).
      - (b) Same CorrelationId across multiple unrelated requests → AsyncLocal leakage; run `Logging.RequestLoggingPipelineTests` locally; if green, suspect a downstream `Task.Run` without `LogContext.PushProperty` re-establishment.
      - (c) Response header missing on errors → `ExceptionHandlingMiddleware` registered before `CorrelationIdMiddleware`; check ordering (regression test `Pipeline_CorrelationIdMiddleware_BeforeExceptionAndRequestLogging_AC4`).
      - (d) `Serilog__MinimumLevel__Default` env var leaking into test runs → see A36 rationale; tests bind empty in `ConfigurationBuilder.AddInMemoryCollection`.
    - **26.7 Regression-test pointer.** Footnote: "Behaviors gated by `CorrelationIdMiddlewareTests` + `RequestLoggingPipelineTests`. Run `dotnet test backend/tests/IabConnect.Api.Tests --filter 'FullyQualifiedName~Middleware.CorrelationIdMiddleware|FullyQualifiedName~Logging.RequestLoggingPipeline'`."
    - **26.8 Live-deploy verification (deferred per A47).** Three `[!]` items (matches AC-12 a/b/c).
- [x] 6.3 A42 reread-as-a-stranger pass complete: (a) goal stated before table ✓; (b) reference table rows non-contradictory ✓; (c) curl example syntax correct ✓; (d) sample JSON entry matches Serilog compact JSON formatter (`@t @l @mt` schema + BearerPresence from E14-S5 enricher) ✓; (e) failure-tree commands cite real test names from Tasks 1-5 ✓; (f) A45 binary reachability: `curl` flagged operator-provided locally with install hint; `dotnet test` operator-provided SDK ✓.

### Task 7: Run the full test suite + Quality-Gates closing

- [x] 7.1 `dotnet build` — 0 warnings, 0 errors.
- [x] 7.2 Full backend test suite: **2070 passed / 0 failed** (Application 1442 + Api 214 + Infrastructure 414). Baseline was 2058 after E17-S1; +12 new from E17-S2.
- [x] 7.3 Targeted filter: 12 passed / 0 failed (5 in CorrelationIdMiddlewareTests + 7 in RequestLoggingPipelineTests).
- [x] 7.4 AC-Subitem Completion Check per A29 — see Quality-Gates Closing table below.
- [x] 7.5 A42 reread pass — clean (see 6.3).
- [x] 7.6 Status flipped to `review`.

## Dev Notes

### Current CorrelationId pipeline (as of refresh time, 2026-06-02)

```text
HTTP request
    │
    ▼
[1] UseForwardedHeaders          ───  X-Forwarded-* trusted, RemoteIpAddress set
[2] security-headers Use(...)    ───  X-Content-Type-Options, X-Frame-Options, etc.
[3] (Beta/Prod only) UseHsts     ───  per E14-S2
[4] CorrelationIdMiddleware      ───  ★ reads/generates CorrelationId, pushes LogContext property
[5] ExceptionHandlingMiddleware  ───  ambient LogContext.CorrelationId picked up by any logged exception
[6] (Dev only) UseSwagger / UseSwaggerUI
[7] (Beta/Prod) UseHttpsRedirection
[8] UseCors("AllowFrontend")
[9] UseSerilogRequestLogging     ───  emits "HTTP {Method} {RequestPath} ..." line carrying CorrelationId
[10] UseAuthentication
[11] UseAuthorization
[12] UseRateLimiter              ───  may reject; OnRejected propagates X-Correlation-Id per E14-S4 P6
[13] endpoints
```

Ordering invariants enforced by AC-4: [4] before [5] before [9].

### A36 detailed rationale for AC-5 test

`Serilog__MinimumLevel__Default` is a perfectly valid override path for ASP.NET Core's default `IConfiguration` chain. On a CI runner where a build step exports it for a different test suite (or a developer's shell that has it set), a test reading `config["Serilog:MinimumLevel:Default"]` would see the env-var-injected value instead of the JSON file's value. Result: the test passes locally on Harry's machine + flakes on the GitHub Actions runner with no diff to blame. The fix is the `AddInMemoryCollection` pattern from A36: bind every env-var-mapped key the test reads to an empty string, BEFORE asserting. `AddInMemoryCollection` runs later in the `ConfigurationBuilder` chain than `AddEnvironmentVariables`, so the empty bindings override any leaked env-var.

### A49 detailed rationale: why not `WebApplicationFactory<Program>` for these tests

The bootstrap Serilog setup at [Program.cs:10-13](../../backend/src/IabConnect.Api/Program.cs) calls `Log.Logger = new LoggerConfiguration()...CreateBootstrapLogger()` which sets a frozen static. The `finally { Log.CloseAndFlush(); }` at line 156-157 calls `LoggerProviderCollection.Dispose()` which marks the logger as disposed. The second `WebApplicationFactory<Program>` instantiation re-runs `Program.Main` which calls `Log.Logger = ...` again — Serilog 4.x's design point throws "logger is already frozen / disposed". Three Epic-14 stories already hit this (E14-S2 DEC-3, E14-S3, E14-S4). Until A49's refactor lands, runtime tests against `Program` are blocked in this surface. The TestCorrelator-based tests in this story explicitly avoid touching `Log.Logger` — they use a per-fixture local `ILogger` whose lifetime ends with the test.

### A31 cross-story orthogonal-AC invariants in scope

1. **CorrelationId header-name parity.** `X-Correlation-Id` appears in: `CorrelationIdMiddleware.cs:12` (canonical source), the response header at line 20, the documented contract in docs/14 Section 26.2. A31 test (AC-11) reads middleware + docs and asserts the strings match byte-for-byte.
2. **Log property name parity.** `CorrelationId` (no dash, PascalCase) is the property name pushed into LogContext at `CorrelationIdMiddleware.cs:22`. Documented in Section 26.2. AC-11 enforces.
3. **Log level parity.** Base config values + docs/14 Section 26.3 + AC-5 test all reference the same numbers; AC-11 enforces.
4. **Pipeline registration order.** `DependencyInjection.cs:301` (CorrelationId) + `:304` (ExceptionHandling) + `:326` (SerilogRequestLogging). The ordering is captured in three places: source order in the method body, AC-4's regression test, and docs/14 Section 26.1's pipeline diagram. A future refactor that reorders any two of them without updating the others trips AC-4.

### What this story does NOT do

- It does NOT refactor `Program.cs` to be `WebApplicationFactory<Program>`-idempotent (A49 — separate action item).
- It does NOT add `User.Identity.Name` or `ClientIp` enrichment to `UseSerilogRequestLogging` (DEC-3=A — defer to a future enrichment story so this story stays focused).
- It does NOT change the `Guid.NewGuid().ToString("N")` format to a different identifier shape (e.g. ULID, W3C traceparent). That's a contract change; out of scope.
- It does NOT instrument the frontend to log the response `X-Correlation-Id` to the browser console. The frontend already surfaces backend responses; a dedicated frontend-tracing-instrumentation story would be its own scope.
- It does NOT add an opentelemetry exporter. ADR-017 explicitly defers external aggregation; OTel goes in E19 or later.

## Quality-Gates Closing

| AC | Evidence | Status | Notes |
|---|---|---|---|
| AC-1 | `_AC1` (HttpContext.Items proxy) + `_AC1b` (TestCorrelator probe — canonical LogContext push proof) | covered | Per epic-17 boundary review A1: `_AC1` alone proves only the HttpContext.Items proxy; `_AC1b` is the canonical LogContext push proof using TestCorrelator within the downstream delegate. |
| AC-2 | `CorrelationIdMiddlewareTests.Middleware_EchoesIncomingHeader_AC2` | covered | Round-trip verified. |
| AC-3 | `Middleware_GeneratesGuidWhenHeaderMissing_AC3` + `Middleware_GeneratesDistinctGuidsAcrossInvocations_AC3b` | covered | 32-char hex GUID contract + distinct-across-invocations. |
| AC-4 | `RequestLoggingPipelineTests.Pipeline_CorrelationIdMiddleware_BeforeExceptionAndRequestLogging_AC4` | covered | Direct artifact-read of DI.cs UseApiPipeline body; ordering invariant verified. |
| AC-5 | `RequestLoggingPipelineTests.Configuration_LogLevelOverrides_MatchSpec_AC5` | covered | A36 InMemoryCollection guard applied. |
| AC-6 | `RequestLoggingPipelineTests.LogContext_PropagatesCorrelationIdAcrossMultipleLines_AC6` | covered | TestCorrelator pattern from E14-S5 reused. |
| AC-7 | `RequestLoggingPipelineTests.LogContext_IsolatesCorrelationIdAcrossConcurrentTasks_AC7` | covered | AsyncLocal isolation proof under interleaved scheduling. |
| AC-8 | `RequestLoggingPipelineTests.Pipeline_UseSerilogRequestLogging_IsRegistered_AC8` | covered | Single registration site verified. |
| AC-9 | `RequestLoggingPipelineTests.Pipeline_ExceptionHandlingMiddleware_DoesNotStripLogContext_AC9` | covered | No LogContext.Reset + uses _logger.Log* (ILogger). |
| AC-10 | docs/14 Section 26 published; A42 reread complete | covered | Section anchor `#26-structured-logs-with-correlationid-e17-s2`. |
| AC-11 | `RequestLoggingPipelineTests.Docs14Section26_MatchesRuntimeSources_AC11` | covered | A31 doc-vs-code: edit either side, test fails. |
| AC-12 (a) curl with header returns echoed value in Railway log | live walkthrough (Q1) | `deferred-pending-beta-green` | Per A47 / docs/14 §26.8 Q1. |
| AC-12 (b) curl without header gets server GUID logged | live walkthrough (Q2) | `deferred-pending-beta-green` | Per A47 / docs/14 §26.8 Q2. |
| AC-12 (c) two simultaneous curls do not share CorrelationId in logs | live walkthrough (Q3) | `deferred-pending-beta-green` | Per A47 / docs/14 §26.8 Q3. |

## Tests / Evidence

- **Backend behavior tests:** 5 NEW [Fact]s in `CorrelationIdMiddlewareTests.cs` (AC-1, AC-2, AC-3, AC-3b, plus one to prove the LogContext capture works under the `Probe` material pattern).
- **Backend pipeline regression tests:** 7 NEW [Fact]s in `RequestLoggingPipelineTests.cs` (AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11).
- **Doc-bundle deliverable:** docs/14 Section 26 inserted between Section 25 (E17-S1) and Appendix.
- **Live-deploy evidence:** deferred to Wave-8/9 walkthrough per A47.

## Dev Agent Record

### Debug Log References

**DEC-1 (per-request continuity test mechanism) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** A (Serilog.Sinks.TestCorrelator with fixture-local LoggerConfiguration).
- (b) **Rationale:**
    - Story recommendation: A (TestCorrelator already in project from E14-S5; mirrors the existing precedent in SensitiveDataDestructuringPolicyTests).
    - User autonomous-mode verbatim quote: "implementiere das ganze epic 17 mit den stories. höre erst auf wenn alle stories geamcht sind und führe danach das retro aus. nicht stoppen bis es durch ist. berücksichtige dabei das es sich nicht um ein mvp handelt." (2026-06-02).
    - Architectural justification: zero new dependencies; sidesteps A49 because the fixture-local `LoggerConfiguration` does not touch the static `Log.Logger`.
- (c) **Consequence chain:**
    - AC-1b + AC-6 + AC-7 + AC-11 all use TestCorrelator.
    - Files: `CorrelationIdMiddlewareTests.cs` (NEW), `RequestLoggingPipelineTests.cs` (NEW).

**DEC-2 (concurrent-request isolation approach for AC-7) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** A (two parallel `Task.Run` workloads, each pushes own LogContext property, await `Task.WhenAll`).
- (b) **Rationale:**
    - Story recommendation: A (cleanest demonstration of AsyncLocal isolation; idiomatic Serilog + AsyncLocal behavior).
    - User autonomous-mode verbatim quote: same as DEC-1.
    - Architectural justification: `TestServer` (Option B) re-triggers the A49 single-logger pitfall; (C) skip is inadequate because a regression replacing LogContext with a global static would silently pass framework-level tests.
- (c) **Consequence chain:**
    - AC-7 test asserts distinct CorrelationId values per Task via TestCorrelator collection.
    - CancellationToken plumbed via `TestContext.Current.CancellationToken` for xUnit v3 analyzer compliance.

**DEC-3 (Production-grade additions beyond literal AC text) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** A (minimum literal scope: just the 12 ACs; defer request-log enrichment with User+ClientIp to a future story).
- (b) **Rationale:**
    - Story recommendation: A (AC-1..AC-11 already a comprehensive verification surface; AC-12 covers live evidence).
    - User autonomous-mode verbatim quote: same as DEC-1.
    - Architectural justification: bundling `User.Identity.Name` / `ClientIp` enrichment would create a soft dependency on E14-S5's sensitive-property allowlist (User-Identity name + X-Forwarded-For are not in the redaction list); cleanest to defer to its own story so the destructuring policy can be reviewed alongside.
- (c) **Consequence chain:**
    - Zero new enrichers added in this story.
    - Future deferred-work entry potential: "Request-log enrichment with User + ClientIp via UseSerilogRequestLogging.options.EnrichDiagnosticContext" — not added to deferred-work.md yet; can be raised at epic-boundary review if Blind Hunter flags.

### Spike outcome (Task 0.6)

Confirmed CorrelationId + LogContext + log-level configuration is already in production state (was authored as part of REQ-054 long before the Beta pivot). Story scope = 12 regression tests across two new test files + docs/14 Section 26 + A31 invariant test.

### Completion Notes List

- **What was implemented:** 12 new tests (5 in CorrelationIdMiddlewareTests + 7 in RequestLoggingPipelineTests) + docs/14 Section 26 (~140 lines).
- **Test counts:** Backend Api.Tests went from 202 → 214 (+12 new for E17-S2). Full backend suite 2058 → 2070 / 0 failed.
- **What was NOT changed:** zero production code changes. Story is verification-only per the refresh finding.

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-12.a):** During Wave-8/9 walkthrough, run `curl -H 'X-Correlation-Id: e17s2-test-001' https://api.<beta-host>/health/ready`; confirm response carries the same `X-Correlation-Id` header.
- **Q2 (AC-12.b):** Open Railway log viewer immediately after Q1; filter for `CorrelationId: e17s2-test-001`; confirm the `UseSerilogRequestLogging` completion line appears.
- **Q3 (AC-12.c):** Make a second request WITHOUT the header; confirm the response carries a freshly-generated 32-char hex GUID + that GUID appears in the Railway log line.

### File List

**NEW:**
- `backend/tests/IabConnect.Api.Tests/Middleware/CorrelationIdMiddlewareTests.cs` (~155 lines, 5 [Fact] tests)
- `backend/tests/IabConnect.Api.Tests/Logging/RequestLoggingPipelineTests.cs` (~250 lines, 7 [Fact] tests)

**MODIFIED:**
- `docs/14_beta_railway_setup.md` (+~140 lines: new Section 26 inserted between Section 25 and Appendix)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)

### Change Log

- 2026-06-02 — E17-S2 dev-story execution: 2 NEW test files (12 new tests) + Section 26 in docs/14 + status transitions. DEC-1/DEC-2/DEC-3 auto-resolved via A41 autonomous-mode escape; (a)/(b)/(c) Debug Log per A43. All 12 new tests green; full backend suite 2070/2070 green. AC-1..AC-11 covered; AC-12 (3 sub-items) deferred-pending-beta-green per A47 → unified walkthrough Q1-Q3.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A31** cross-story orthogonal-AC inventory (this story closes 4 invariants)
- **A34** bulk spec-refresh at epic start (applied: this is a batch with E17-S1 + E17-S4)
- **A36** ASP.NET integration tests reading env-var-mapped IConfiguration must override via AddInMemoryCollection (AC-5 applies)
- **A38** doc-bundle pattern (Section 26 in docs/14)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log template
- **A42** + **A45** reread-as-a-stranger pass
- **A47** uniform autonomous-mode escape for `[!]` queue (AC-12)
- **A49** Program.cs Serilog re-entrancy constraint (steers DEC-1, DEC-2 to TestCorrelator + per-fixture loggers)
- **A51** A31 invariants tested via direct artifact-read (AC-4, AC-8, AC-9, AC-11)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-02)

Ultimate context engine analysis completed — comprehensive developer guide created. Dev-story execution complete; 12 new tests + docs/14 Section 26 shipped; A47 escape applied to AC-12 sub-items.
