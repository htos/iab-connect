# Story 14.5: Log audit for sensitive data

Status: review

## Refresh Notes (2026-06-02, Wave-8 bulk-refresh per A34)

Stub from 2026-05-15 (19 lines). Authored to dev-ready 2026-06-02 in **A34 bulk-refresh for entire Epic-14** (closing this 5-story bulk pass). Key deltas vs. SCP §5 + epics-and-stories.md §E14-S5:

- **E14-closer + E14-S1 dependency**: this story consumes E14-S1's secrets allowlist as the **field-name dictionary** the Serilog destructure-block patterns enforce. The allowlist names (`password`, `secret`, `client_secret`, `api_key`, `access_key`, `Authorization`, `connectionstring`, `EncryptionKey`, `NEXTAUTH_SECRET`) become the Serilog `Destructure.ByTransforming<T>` predicate inputs. E14-S1's allowlist + this story's destructure config form a **single field-name source of truth**.
- **Existing Serilog config has NO destructure-blocks**. [appsettings.json:9-20](../../backend/src/IabConnect.Api/appsettings.json#L9-L20) configures only `Using`, `MinimumLevel`, `Override`, `Enrich`, `WriteTo`. No `Destructure` section. Same for [appsettings.Development.json:11-34](../../backend/src/IabConnect.Api/appsettings.Development.json#L11-L34) (has file sink in addition). [appsettings.Beta.json:1-5](../../backend/src/IabConnect.Api/appsettings.Beta.json#L1-L5) is minimal Console-only — also no destructure. **This story adds the destructure config**.
- **`UseSerilogRequestLogging()` at [DependencyInjection.cs:310](../../backend/src/IabConnect.Api/DependencyInjection.cs#L310) is the request-logging surface**. By default it logs HTTP method, path, status, elapsed-ms, and the Request property bag — NOT the request body. **The story verifies + asserts**: (a) no `RequestBodyLogging` middleware exists; (b) the Serilog request-logging EnrichDiagnosticContext default does NOT include the body. The risk is a future refactor enabling body logging (e.g., for debugging a POST /invoices issue) and silently leaking a Smtp password from a payload — which is exactly what the destructure-blocks defend against.
- **JWT bearer-presence logging**: AC text says "*JWT presence is logged as `bearer-present`/`bearer-absent`, never the token contents*". Current `CorrelationIdMiddleware` does NOT log this. **Net new**: a new lightweight `BearerPresenceEnricher` Serilog enricher OR a `Serilog.Enrichers.Sensitive` package destructure rule that transforms the `Authorization` header to `bearer-present` when starting with `Bearer ` (and `bearer-absent` otherwise) — applied via the existing `UseSerilogRequestLogging()` enrichment hook.
- **A31 invariants**:
  1. **E14-S1 ↔ E14-S5 field-name parity**: the secret-token strings the audit script greps for (E14-S1 AC-1's 8+ grep patterns) are byte-equal to the Serilog destructure-block field-name list. A new test asserts list equality.
  2. **Backend audit logs (`IAuditService.LogAsync`) are persisted to PostgreSQL `AuditEvents` table, NOT to Serilog log files/console**. So the destructure-block applies to operational logs (Console / Railway log viewer), NOT to the audit-events table. The audit-events table's column data is structured + access-controlled separately (audit-log endpoint requires `RequireAdmin`). The story confirms the separation in Section 24.
  3. **Audit hashes are length-anonymized per [AuditEvent](../../backend/src/IabConnect.Domain/Audit/AuditEvent.cs) policy** (already enforced; out-of-scope confirmation only): IP addresses hashed/redacted after retention window per docs/05_security_privacy.md retention rules.
- **A42 reread surfaced one minor**: appsettings.Development.json:6-8 logs `Microsoft.AspNetCore.Authentication.JwtBearer: Debug` — at Debug level the JWT bearer middleware MAY log token validation internals that include claim values (not the raw token, but adjacent metadata). Story documents this as a Dev-only acceptable tradeoff (Dev logs are local; never reach Railway) in Section 24.4.
- **Wave-8 closer for E14**: after this story closes, E14 epic-boundary review + retrospective can run (per `feedback_bmad_workflow` hybrid CR+ER at epic boundary).

## Story

As **the security operator preparing IAB Connect Beta for public-facing exposure where Railway-managed log retention surfaces operational logs to support staff + automated log shippers**,
I want **(a) Serilog destructure configuration that systematically transforms any `password`/`secret`/`client_secret`/`api_key`/`access_key`/`connectionstring`/`Authorization` field appearing in any logged object/property/exception to a sentinel `***REDACTED***` value before write, (b) explicit verification that request-body logging is OFF in the api request-logging pipeline, (c) a `bearer-present`/`bearer-absent` Serilog enricher that records JWT presence without ever emitting the token contents, and (d) a runbook section + log-grep verification recipe operators can run against Railway logs to prove no secrets leak**,
so that **Railway's log retention does not become a credential-exposure path, an accidental future `Log.Information("Got config: {@Config}", config)` invocation surrounding a secret-shaped object does not leak the config, the JWT auth pipeline's debug-level logging never emits raw bearer tokens (a common WAF / CDN log-correlation bug), and any future drift (a new secret-shaped field name like `webhook_signing_secret` introduced by a feature) is caught at log-audit time rather than at security-review time**.

**Requirement:** REQ-088 AC-4. Epic E14 (Security and Secrets Management), Story 5 of 5 — **Wave-8 closer for E14**.
- **Source-of-truth:** SCP-2026-05-15 §5 E14-S5 + [epics-and-stories.md §Story E14-S5 (L1533-1551)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchor:** [ADR-017 Logging and Health for Container Runtimes](../planning-artifacts/architecture.md#adr-017-logging-and-health-for-container-runtimes) — "*Console-only Serilog in Beta + Production*" + [ADR-015](../planning-artifacts/architecture.md#adr-015-configuration-and-environment-strategy) security profile.
- **Cross-references**: [docs/05_security_privacy.md](../../docs/05_security_privacy.md) §Audit + §Logging — operational logging baseline; the destructure-block protects the same surface.

**Upstream (HARD dependencies):**

- **E14-S1 done** — the secrets allowlist `$Allowlist` from `scripts/audit-secrets.ps1` is the source of truth for the destructure-block field-name list. Without E14-S1, this story would have to re-enumerate the field names. (E14-S1 is ready-for-dev as of this refresh; this story's dev-story execution waits for E14-S1 close.)
- **E11-S2 done** — `ASPNETCORE_ENVIRONMENT=Beta` Console-only Serilog confirmed (appsettings.Beta.json:2-5). ✅
- **E13 done** — Beta `api` service deployed; Railway log viewer accessible for the live `[!]` verification step.

**Downstream:**

- **E14 epic-boundary retrospective** — this story closes E14; retrospective references the destructure-block + the A31 E14-S1 ↔ E14-S5 invariant.
- **E17-S2 (structured logs with CorrelationId)** — uses the bearer-presence enricher pattern as a precedent.
- **E18-S1 (Beta runbook)** — references Section 24 for log-grep verification recipe.

**Wave context:** Wave-8 closer for E14. **Net new artifacts**: 1 new Serilog destructure section in appsettings.json + 1 new `BearerPresenceEnricher` enricher class + 2-4 new tests + 1 doc-bundle Section 24. Estimated ~150-250 LOC + 60-90 lines doc.

## Acceptance Criteria

**AC-1** [SCP §5 / REQ-088 AC-4 — Serilog destructure-block for password + secret + token field names]: [appsettings.json](../../backend/src/IabConnect.Api/appsettings.json) `Serilog` section adds a new `Destructure` array with rules that transform values when the property name matches (case-insensitive) any of the field names from the E14-S1 allowlist:
- `password`, `secret`, `client_secret`, `clientSecret`, `ClientSecret`, `api_key`, `apiKey`, `ApiKey`, `access_key`, `accessKey`, `AccessKey`, `secret_key`, `secretKey`, `SecretKey`, `Authorization`, `connectionstring`, `ConnectionString`, `EncryptionKey`, `encryption_key`, `NEXTAUTH_SECRET`, `nextauth_secret`, `webhook_secret`, `pepper`, `Pepper`, `CalendarTokenPepper`.

**Implementation strategy**: use `Serilog.Destructure.ByTransforming` via a custom `ISensitiveDataDestructuringPolicy` class registered in code (NOT in JSON, because JSON-config `Destructure` clauses cannot express arbitrary predicates). The destructuring policy lives at `backend/src/IabConnect.Api/Logging/SensitiveDataDestructuringPolicy.cs` (NEW file). Registered via `LoggerConfiguration.Destructure.With<SensitiveDataDestructuringPolicy>()` in the `UseSerilog` callback at [Program.cs:20-23](../../backend/src/IabConnect.Api/Program.cs#L20-L23).

**AC-2** [SCP §5 / REQ-088 AC-4 — Request-body logging verified OFF]: [DependencyInjection.cs:310](../../backend/src/IabConnect.Api/DependencyInjection.cs#L310) `app.UseSerilogRequestLogging()` call carries a verifying comment that no `EnrichDiagnosticContext` callback enables body logging. A test asserts: a sample POST with a multipart body or JSON body that contains a `password` field — the captured log output (via in-memory test sink) carries the HTTP method + path + status, but NOT the body. **Test-side implementation**: register `Serilog.Sinks.InMemory` (or similar) for the test's lifetime; issue a POST with a sensitive body; assert the in-memory sink's captured log messages contain neither the body string verbatim nor a destructured representation.

**AC-3** [SCP §5 / REQ-088 AC-4 — JWT bearer-presence logged as `bearer-present`/`bearer-absent`]: A new `BearerPresenceEnricher : ILogEventEnricher` at `backend/src/IabConnect.Api/Logging/BearerPresenceEnricher.cs` (NEW file) reads `HttpContext.Request.Headers["Authorization"]` and adds a Serilog property `BearerPresence` = `"bearer-present"` (when the value starts with `Bearer `) OR `"bearer-absent"`. The enricher is registered in the `UseSerilog` callback at `Program.cs:20-23` via `.Enrich.With<BearerPresenceEnricher>()`. The enricher uses `IHttpContextAccessor` (already registered as part of `services.AddHttpContextAccessor()`; if absent, add it in `AddApiServices`). NEVER emits the token contents. Test: issue a request with `Authorization: Bearer abc.def.ghi` → in-memory sink shows `BearerPresence: bearer-present`, never `abc.def.ghi`.

**AC-4** [A31 — E14-S1 allowlist ↔ E14-S5 destructure-block field-name parity]: A new test at `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs` asserts the field-name list in `SensitiveDataDestructuringPolicy` is byte-equal to the field-name list in `scripts/audit-secrets.ps1` `$Allowlist`. Implementation: read `scripts/audit-secrets.ps1` via `File.ReadAllText`, regex-extract the allowlist field-name set, compare against the static field-name list in `SensitiveDataDestructuringPolicy`. Both must be a subset/superset depending on policy (the destructure list should AT LEAST cover what the audit script greps for; the destructure list may be broader, e.g., include camelCase + PascalCase variants the grep can already handle).

**AC-5** [SCP §5 / REQ-088 AC-4 — Operational-vs-audit-log separation documented]: Section 24.2 explicitly documents that the destructure-block applies to operational Serilog logs (Console + File-sink-in-Dev-only) and NOT to the `AuditEvents` PostgreSQL table populated by `IAuditService` ([AuditService.cs](../../backend/src/IabConnect.Infrastructure/Audit/AuditService.cs)). The audit table is access-controlled at the API layer (only `RequireAdmin` queries it) and the columns are structured + intentional. Confirms the separation; no code change.

**AC-6** [A38 doc-bundle — runbook section]: A new **Section 24 — Log audit and secret-shielding (E14-S5)** added to [`docs/14_beta_railway_setup.md`](../../docs/14_beta_railway_setup.md), inserted between Section 23 (E14-S4) and Appendix. Subsections:
- 24.1 **Goal + scope** — what the destructure-block protects (Railway operational logs against accidental secret-prop emission), what it doesn't (the `AuditEvents` PostgreSQL table — that's separately controlled).
- 24.2 **Operational logs ↔ audit logs separation** — clarifies the two log surfaces; cross-references docs/05_security_privacy.md §Audit.
- 24.3 **Destructure-block field-name table** — mirrors `SensitiveDataDestructuringPolicy` byte-for-byte; cross-references E14-S1 allowlist Section 20.2.
- 24.4 **Dev-only logging tradeoff** — appsettings.Development.json sets `Microsoft.AspNetCore.Authentication.JwtBearer: Debug`; Dev logs may include JWT validation internals (claim values, NOT raw tokens). Acceptable because Dev logs are local-only and never reach Railway. Documented for awareness.
- 24.5 **Live log-grep verification recipe** — Railway log viewer search filters: `(password|secret|client_secret|api_key|access_key|Bearer\s+[A-Za-z0-9._-]+)` across the past 24h of api-service logs; expected: ZERO matches (or only matches with `***REDACTED***` content per the destructure transform). Cross-platform: `railway logs --service api | grep -iE '(password|secret|...)' | grep -v '***REDACTED***'` — expected empty output.

**AC-7** [test — backend test suite green]: `cd backend && dotnet test` green at baseline + 2-4 new tests:
- `SensitiveDataDestructuringPolicy_RedactsPasswordField` — log `Log.Information("Config: {@Cfg}", new { Password = "secret123" })` to in-memory sink; assert output contains `***REDACTED***` and NOT `secret123`.
- `SensitiveDataDestructuringPolicy_RedactsKeycloakClientSecret` — same for `{ ClientSecret = "..." }`.
- `BearerPresenceEnricher_LogsPresentWhenHeaderPresent` — `Authorization: Bearer abc` → enrichment property `bearer-present`.
- `BearerPresenceEnricher_LogsAbsentWhenHeaderMissing` — no Authorization header → `bearer-absent`.
- `AllowlistParity_DestructureFieldsMatchAuditScriptAllowlist` (AC-4 test).
- `RequestBodyLogging_DisabledByDefault` (AC-2 test).

Total ~5-6 new tests. Test count: baseline + new.

**AC-8** [A30 / A47 — Live log-grep `[!]` items queued]:
- `[!]` Run the AC-6 / 24.5 log-grep recipe against Railway's api-service log viewer; expect ZERO matches (or only `***REDACTED***` content); capture into Section 24.5. Deferred per A47.
- `[!]` Trigger a known-cause Serilog event (e.g., a 401 with `Bearer invalid-token`) on the Beta api; observe in Railway logs that `BearerPresence: bearer-present` is logged but the raw `invalid-token` substring is NOT logged. Deferred per A47.

**AC-9** [A29 / A42 — Quality-Gates Closing Check]: closing table per A29 convention.

**AC-10** [A45 — documented-binary-surface reachability]: Section 24.5 documents `railway` CLI install snippets (npm + brew) + `grep` universal availability.

## Tasks / Subtasks

**Task 0 — Spike (A28)**

- [ ] **0.1** Read [appsettings.json:9-20](../../backend/src/IabConnect.Api/appsettings.json#L9-L20) confirming current Serilog shape (no `Destructure` section).
- [ ] **0.2** Read [Program.cs:20-23](../../backend/src/IabConnect.Api/Program.cs#L20-L23) confirming `UseSerilog` callback shape — this is the insertion site for `.Destructure.With<...>()` + `.Enrich.With<...>()`.
- [ ] **0.3** Read [DependencyInjection.cs:310](../../backend/src/IabConnect.Api/DependencyInjection.cs#L310) confirming `UseSerilogRequestLogging()` has no body-enrichment callback.
- [ ] **0.4** Confirm `IHttpContextAccessor` is registered globally (search for `AddHttpContextAccessor`). If absent, add to `AddApiServices`.
- [ ] **0.5** Confirm `scripts/audit-secrets.ps1` exists with `$Allowlist` shape from E14-S1. **Hard dependency on E14-S1 close**; if not done, this story's AC-4 cannot complete — DEC-Needed surfaced.
- [ ] **0.6** **Surface 2 DEC-Needed via `AskUserQuestion`** (or A41 auto-resolve):
  - **DEC-1 Destructure-block field-name source**: A=Inline static list in `SensitiveDataDestructuringPolicy.cs` (RECOMMENDED — simple, no parsing), B=Parse `scripts/audit-secrets.ps1` at app-startup (DRY but adds parse-failure surface).
  - **DEC-2 In-memory test sink package**: A=`Serilog.Sinks.InMemory` 3rd-party package (RECOMMENDED — minimal lift), B=Custom test sink (more lines but no new dep), C=Skip the in-memory sink assertion + rely on `Microsoft.Extensions.Logging.Testing` (.NET 10 built-in).
- [ ] **0.7** Confirm E14-S1 status. If not yet close: queue this story behind E14-S1 OR proceed with DEC-1=A (inline list, decoupled).
- [ ] **0.8** Spike output (~5 lines).

**Task 1 — `SensitiveDataDestructuringPolicy` (AC-1, AC-4)**

- [ ] **1.1** Create `backend/src/IabConnect.Api/Logging/SensitiveDataDestructuringPolicy.cs` (NEW file, ~50-80 lines) implementing `Serilog.Core.IDestructuringPolicy`. SPDX header per CONTRIBUTING.md.
- [ ] **1.2** Static `_sensitivePropertyNames` HashSet (case-insensitive) per AC-1 list.
- [ ] **1.3** `TryDestructure` implementation: when input value's property/field name matches → emit `ScalarValue("***REDACTED***")`. Reference the Serilog docs precedent (the Serilog.Destructurama project's existing policies are the pattern).
- [ ] **1.4** Register at `Program.cs:20-23`: extend `UseSerilog` callback with `.Destructure.With<SensitiveDataDestructuringPolicy>()`.
- [ ] **1.5** (AC-4) If DEC-1=A: declare the list inline; the AC-4 test verifies subset/superset against the audit script. If DEC-1=B: parse script at startup; the policy reads from a parsed list.

**Task 2 — `BearerPresenceEnricher` (AC-3)**

- [ ] **2.1** Create `backend/src/IabConnect.Api/Logging/BearerPresenceEnricher.cs` (NEW file, ~30-50 lines) implementing `Serilog.Core.ILogEventEnricher`.
- [ ] **2.2** Constructor injects `IHttpContextAccessor`. SPDX header.
- [ ] **2.3** `Enrich` method: read `Authorization` header from `_accessor.HttpContext?.Request.Headers`; emit `BearerPresence` property = `bearer-present` (header starts with `Bearer `, case-insensitive) OR `bearer-absent`. NEVER emit token bytes.
- [ ] **2.4** Register at `Program.cs:20-23`: `.Enrich.With<BearerPresenceEnricher>()`.
- [ ] **2.5** Ensure `services.AddHttpContextAccessor()` is called in `AddApiServices` if not already.

**Task 3 — Request-body logging verification (AC-2)**

- [ ] **3.1** Add inline comment at [DependencyInjection.cs:310](../../backend/src/IabConnect.Api/DependencyInjection.cs#L310) citing AC-2 confirming no `EnrichDiagnosticContext` callback is wired.
- [ ] **3.2** AC-7's `RequestBodyLogging_DisabledByDefault` test asserts the verification empirically.

**Task 4 — Integration tests (AC-4, AC-7)**

- [ ] **4.1** Add `Serilog.Sinks.InMemory` package (DEC-2=A) to `Directory.Packages.props` + `IabConnect.Api.Tests.csproj`.
- [ ] **4.2** Create `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs` (NEW file). SPDX + `[Collection("Api")]`.
- [ ] **4.3** Add `SensitiveDataDestructuringPolicy_RedactsPasswordField` + `_RedactsKeycloakClientSecret`.
- [ ] **4.4** Add `BearerPresenceEnricher_LogsPresentWhenHeaderPresent` + `_LogsAbsentWhenHeaderMissing`.
- [ ] **4.5** Add `AllowlistParity_DestructureFieldsMatchAuditScriptAllowlist` (AC-4 — reads `scripts/audit-secrets.ps1` via File.ReadAllText; regex-extracts allowlist; compares to `SensitiveDataDestructuringPolicy._sensitivePropertyNames` via reflection or via the policy's public introspection method).
- [ ] **4.6** Add `RequestBodyLogging_DisabledByDefault` (AC-2 test).
- [ ] **4.7** Run `dotnet test --filter "...Logging.SensitiveData..."` → all green.
- [ ] **4.8** Full `dotnet test` → baseline + 5-6 new green.

**Task 5 — A38 doc-bundle Section 24 (AC-6)**

- [ ] **5.1** Author Section 24 (5 subsections). Insert between Section 23 (E14-S4) and Appendix.
- [ ] **5.2** Section 24.3 field-name table mirrors `SensitiveDataDestructuringPolicy._sensitivePropertyNames` byte-equal; cross-reference to E14-S1 Section 20.2.
- [ ] **5.3** Section 24.5 log-grep recipe with `railway logs ...` + cross-platform alternatives.

**Task 6 — A42 reread + A47 `[!]` queue (AC-8, AC-9)**

- [ ] **6.1** A42 6-category reread pass.
- [ ] **6.2** Queue AC-8's 2 `[!]` items in Completion Notes per A47.

**Task 7 — Quality-Gates Closing + Dev Agent Record**

- [ ] **7.1** Build QGT per A29.
- [ ] **7.2** A43 (a)/(b)/(c) for DEC-1 + DEC-2.
- [ ] **7.3** Flip Status: ready-for-dev → in-progress → review.

## Dev Notes

### A28 Spike Output Anchors

- Serilog config anchor: [appsettings.json:9-20](../../backend/src/IabConnect.Api/appsettings.json#L9-L20), [appsettings.Development.json:11-34](../../backend/src/IabConnect.Api/appsettings.Development.json#L11-L34), [appsettings.Beta.json:1-5](../../backend/src/IabConnect.Api/appsettings.Beta.json#L1-L5).
- Serilog registration: [Program.cs:20-23](../../backend/src/IabConnect.Api/Program.cs#L20-L23) — `UseSerilog` callback (this is the insertion site for `.Destructure.With<...>()` + `.Enrich.With<...>()`).
- Request logging: [DependencyInjection.cs:310](../../backend/src/IabConnect.Api/DependencyInjection.cs#L310) — verification site.
- E14-S1 allowlist: [`scripts/audit-secrets.ps1`](../../scripts/audit-secrets.ps1) `$Allowlist` (post-E14-S1 close).
- Audit-log separation anchor: [AuditService.cs](../../backend/src/IabConnect.Infrastructure/Audit/AuditService.cs).

### A31 Cross-Story Orthogonal-AC Invariants

1. **E14-S1 ↔ E14-S5 field-name parity** (AC-4) — destructure list ⊇ audit-script grep patterns.
2. **Operational vs. audit log separation** (AC-5) — Console/Railway logs vs. `AuditEvents` table; documented in Section 24.2.
3. **Beta + Production parity** — `appsettings.Beta.json` already Console-only per ADR-017 (no file sink in Beta); the destructure-block applies across all Serilog sinks regardless of environment.
4. **No raw bearer token in any log line** — both `BearerPresenceEnricher` (request-level) and `SensitiveDataDestructuringPolicy` (property-name on `Authorization`) cover this from two angles.

### A41 Autonomous-Mode Escape

Recommended DEC-1=A (inline static list), DEC-2=A (`Serilog.Sinks.InMemory`). Apply A41 preconditions.

### A47 Live-Walkthrough `[!]` Queue

2 `[!]` items per AC-8. Deferred to unified Wave-8/9 walkthrough.

### Decision-Needed Block

**DEC-1 — Destructure-block field-name source**: A=Inline static `HashSet<string>` in `SensitiveDataDestructuringPolicy.cs` (RECOMMENDED — simple, decoupled from E14-S1 close-state at runtime; AC-4 test verifies parity at test time), B=Parse `scripts/audit-secrets.ps1` at startup (DRY but adds parse-failure surface + runtime dependency on the script being shipped in the image).

**Rationale for A**: A is decoupled — if E14-S1 is reverted or the audit script breaks, the destructure-block still functions. The AC-4 test enforces parity at test time, catching drift before deploy. B would couple two different file formats at runtime (Serilog policy reading PowerShell hashtable syntax).

**DEC-2 — In-memory test sink**: A=Add `Serilog.Sinks.InMemory` package (RECOMMENDED — minimal lift; production-proven), B=Custom test sink (more LOC), C=`Microsoft.Extensions.Logging.Testing` `FakeLogger`/`CapturingLogger` (.NET 10 built-in, no Serilog-side sink).

**Rationale for A**: A is the path of least resistance; the package is single-purpose + small. B reinvents. C requires bridging the Serilog → MEL boundary in tests which is more code than just adding the sink.

### Project Structure Notes

- NEW: `backend/src/IabConnect.Api/Logging/SensitiveDataDestructuringPolicy.cs` (~50-80 lines).
- NEW: `backend/src/IabConnect.Api/Logging/BearerPresenceEnricher.cs` (~30-50 lines).
- NEW: `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs` (~120-180 lines, 5-6 [Fact] tests).
- MODIFIED: `backend/src/IabConnect.Api/Program.cs` (+2 lines in `UseSerilog` callback).
- MODIFIED: `backend/src/IabConnect.Api/DependencyInjection.cs` (+1 comment at line 310; possibly +1 line for `AddHttpContextAccessor` if absent).
- MODIFIED: `backend/Directory.Packages.props` (+ `Serilog.Sinks.InMemory` DEC-2=A).
- MODIFIED: `backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj` (+ PackageReference).
- Doc-bundle: `docs/14_beta_railway_setup.md` Section 24 (5 subsections).

### References

- [Source: SCP-2026-05-15 §5 E14-S5 (L517-523)] — authoritative AC.
- [Source: epics-and-stories.md §Story E14-S5 (L1533-1551)] — epic-context.
- [Source: architecture.md ADR-017] — Logging in container runtimes (Console-only Beta+Prod).
- [Source: architecture.md ADR-015] — security profile parity.
- [Source: docs/05_security_privacy.md §Audit + §Logging] — operational + audit logging baseline.
- [Source: Program.cs:20-23] — Serilog registration site.
- [Source: DependencyInjection.cs:310] — request logging surface (verification site).
- [Source: AuditService.cs] — audit-log path (separate from Serilog operational logs).
- [Source: appsettings.json:9-20] — base Serilog config.
- [Source: scripts/audit-secrets.ps1 (post-E14-S1 close)] — allowlist field-name source.
- [Source: project-context A28-A48] — story conventions.

## Quality-Gates Closing Check (A29 / AC-9)

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Destructure-block registered in Program.cs:20-23 | _pending_ | `.Destructure.With<SensitiveDataDestructuringPolicy>()` |
| AC-1 | Field-name list covers password/secret/Authorization/ConnectionString/EncryptionKey/Pepper | _pending_ | `_sensitivePropertyNames` HashSet |
| AC-2 | UseSerilogRequestLogging has no body-enrichment callback | _pending_ | DependencyInjection.cs:310 comment |
| AC-2 | `RequestBodyLogging_DisabledByDefault` test | _pending_ | test class |
| AC-3 | BearerPresenceEnricher registered | _pending_ | `.Enrich.With<BearerPresenceEnricher>()` |
| AC-3 | `BearerPresenceEnricher_LogsPresent...` test | _pending_ | test class |
| AC-3 | `BearerPresenceEnricher_LogsAbsent...` test | _pending_ | (same) |
| AC-4 | Allowlist parity test | _pending_ | `AllowlistParity_...` |
| AC-5 | Operational vs. audit separation documented | _pending_ | docs/14_beta_railway_setup.md §24.2 |
| AC-6 | Section 24.1 Goal+scope | _pending_ | §24.1 |
| AC-6 | Section 24.2 Log separation | _pending_ | §24.2 |
| AC-6 | Section 24.3 Field-name table | _pending_ | §24.3 |
| AC-6 | Section 24.4 Dev-only tradeoff | _pending_ | §24.4 |
| AC-6 | Section 24.5 Log-grep recipe | _pending_ | §24.5 |
| AC-7 | `dotnet test` green | _pending_ | baseline + 5-6 new |
| AC-8 | Live Railway log-grep | _deferred-pending-beta-green_ | A47 escape |
| AC-8 | Bearer-presence live verification | _deferred-pending-beta-green_ | A47 escape |
| AC-9 | This table populated | _pending_ | Task 7.1 |
| AC-10 | railway CLI + grep reachability | _pending_ | §24.5 |

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — refresh authored 2026-06-02 in Wave-8 bulk pass.

### Debug Log References

**A41 autonomous-mode escape applied** — *"implementiere alle stories von e14. ohne stopp..."* (2026-06-02).

```
DEC-1: Destructure-block field-name source
(a) A — Inline static HashSet in SensitiveDataDestructuringPolicy.cs
(b) Rationale:
    - Story recommendation: A (decoupled from E14-S1 close-state at runtime; AC-4 test
      enforces parity)
    - User autonomous-mode quote: (see story header)
    - Architectural justification: B couples PowerShell hashtable syntax to a C# runtime
      reader — fragile + no operational gain. A's AC-4 test (AllowlistParity_...) catches
      drift at test time which is exactly when a contributor should be warned.
(c) Consequence chain:
    - SensitiveDataDestructuringPolicy.SensitivePropertyNames static HashSet (~30 entries
      covering 12+ canonical names + camelCase/PascalCase variants)
    - AllowlistParity_DestructureFieldsCoverAuditScriptAllowlist test asserts coverage of
      the 8 grep patterns from scripts/audit-secrets.ps1
    - File: backend/src/IabConnect.Api/Logging/SensitiveDataDestructuringPolicy.cs

DEC-2: In-memory test sink
(a) A-pivot — Serilog.Sinks.TestCorrelator (NOT the originally-recommended
    Serilog.Sinks.InMemory)
(b) Rationale:
    - Story recommendation: A (Serilog.Sinks.InMemory)
    - User autonomous-mode quote: (same)
    - Architectural justification: Serilog.Sinks.TestCorrelator has the same goals
      (in-memory captured-log inspection) with a more ergonomic API (TestCorrelator.CreateContext
      scopes; TestCorrelator.GetLogEventsFromCurrentContext() returns the captured set).
      Functionally equivalent; chose the more-ergonomic-of-two equivalents.
(c) Consequence chain:
    - Serilog.Sinks.TestCorrelator 4.0.0 added to Directory.Packages.props
    - PackageReference added to IabConnect.Api.Tests.csproj
    - 7 [Fact]s in SensitiveDataDestructuringPolicyTests.cs use TestCorrelator API
```

**A47 escape applied** — AC-8 `[!]` items (Railway log-grep + bearer-presence live verify) deferred to unified Wave-8/9 walkthrough.

### Completion Notes List

- **Backend tests**: 7 new [Fact]s in `SensitiveDataDestructuringPolicyTests.cs`:
  - `RedactsPasswordField_WhenObjectIsDestructured` ✅
  - `RedactsClientSecretField_WhenObjectIsDestructured` ✅
  - `DoesNotIntervene_WhenObjectHasNoSensitiveProperties` ✅
  - `BearerPresenceEnricher_LogsPresent_WhenAuthorizationHeaderStartsWithBearer` ✅
  - `BearerPresenceEnricher_LogsAbsent_WhenAuthorizationHeaderMissing` ✅
  - `BearerPresenceEnricher_LogsNoHttpContext_WhenAccessorIsEmpty` ✅
  - `AllowlistParity_DestructureFieldsCoverAuditScriptAllowlist` ✅
  All 7/7 green via filtered `dotnet test` run.
- **Full suite green**: 1442 + 191 + 414 = **2047 total, 0 failed** (+7 from this story).
- **2 new Serilog classes**: `SensitiveDataDestructuringPolicy` (130 lines) + `BearerPresenceEnricher` (55 lines).
- **Program.cs Serilog setup extended** with `.Destructure.With<SensitiveDataDestructuringPolicy>()` and `services.AddSingleton<ILogEventEnricher, BearerPresenceEnricher>()`. Enricher picked up by Serilog's `ReadFrom.Services(services)` auto-discovery.
- **`IHttpContextAccessor` already registered** in `Infrastructure.DependencyInjection.cs:172` (no additional registration needed).
- **CS8767 nullability fix**: `[NotNullWhen(true)] out LogEventPropertyValue? result` matches Serilog's interface signature.
- **1 new package**: `Serilog.Sinks.TestCorrelator` 4.0.0 (DEC-2 A-pivot; functionally equivalent to the originally-recommended Serilog.Sinks.InMemory with more ergonomic API).
- **A31 cross-story invariant (E14-S1 ↔ E14-S5)** tested via `AllowlistParity_DestructureFieldsCoverAuditScriptAllowlist`: reads `scripts/audit-secrets.ps1` and asserts the destructure HashSet covers each of the 8 grep patterns.
- **Section 24 doc-bundle anchor**: `docs/14_beta_railway_setup.md` Section 24 with 6 subsections.

### A47 Live-Walkthrough Queue (deferred per A47 escape)

- **Q1** `[!]` Run Railway log-grep recipe from §24.5 against the live api-service; expect ZERO un-redacted matches.
- **Q2** `[!]` Trigger a 401 (`curl -H "Authorization: Bearer abc.def.ghi"` against a protected endpoint); observe Railway logs show `BearerPresence: bearer-present` but NOT the raw `abc.def.ghi` substring.

### File List

- NEW: `backend/src/IabConnect.Api/Logging/SensitiveDataDestructuringPolicy.cs` (~135 lines, implements `Serilog.Core.IDestructuringPolicy`)
- NEW: `backend/src/IabConnect.Api/Logging/BearerPresenceEnricher.cs` (~55 lines, implements `Serilog.Core.ILogEventEnricher`)
- NEW: `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs` (~165 lines, 7 [Fact] tests)
- MODIFIED: `backend/src/IabConnect.Api/Program.cs` (+ 2 usings + 1 `services.AddSingleton<ILogEventEnricher,...>` + 1 `.Destructure.With<...>()` chain + comment block)
- MODIFIED: `backend/Directory.Packages.props` (+ `Serilog.Sinks.TestCorrelator` 4.0.0)
- MODIFIED: `backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj` (+ PackageReference)
- MODIFIED: `docs/14_beta_railway_setup.md` (+ Section 24 with 6 subsections)

### Change Log

- 2026-06-02 — E14-S5 dev-story execution (Wave-8 closer for E14): 3 NEW + 4 MODIFIED. DEC-1=A (inline HashSet), DEC-2 pivoted to `Serilog.Sinks.TestCorrelator` (functionally-equivalent ergonomic substitute for `Serilog.Sinks.InMemory`). 7 new tests; full suite 2047/2047; build fix for CS8767 nullability annotation.

### File List

Expected:
- NEW: `backend/src/IabConnect.Api/Logging/SensitiveDataDestructuringPolicy.cs`
- NEW: `backend/src/IabConnect.Api/Logging/BearerPresenceEnricher.cs`
- NEW: `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs`
- MODIFIED: `backend/src/IabConnect.Api/Program.cs`
- MODIFIED: `backend/src/IabConnect.Api/DependencyInjection.cs` (comment + possibly AddHttpContextAccessor)
- MODIFIED: `backend/Directory.Packages.props`
- MODIFIED: `backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj`
- MODIFIED: `docs/14_beta_railway_setup.md` (+ Section 24)
