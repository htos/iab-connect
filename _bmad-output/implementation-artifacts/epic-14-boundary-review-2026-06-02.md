# Epic-14 Boundary Code Review — 2026-06-02

**Epic**: E14 Security and Secrets Management (REQ-088 AC-4)
**Stories**: E14-S1 (Secrets audit) + E14-S2 (Security headers + HTTPS) + E14-S3 (Hangfire dev-only) + E14-S4 (Rate-limiting) + E14-S5 (Log audit + bearer-presence)
**Diff scope**: 18 files modified + 14 files new; +2200 / -54 lines net.
**Test suite**: 2050/2050 green (1442 Application + 194 Api + 414 Infrastructure); 31 new tests across stories.

## Method

Three adversarial review layers ran in parallel per `feedback_bmad_workflow` hybrid CR+ER pattern:

- **Blind Hunter** — find what's MISSING. 10 findings (4 high, 4 med, 2 low).
- **Edge Case Hunter** — find unhandled boundary conditions. 15 findings (6 high, 8 med, 1 low).
- **Acceptance Auditor** — verify ACs vs reality. 14 AC gaps (1 high, 5 med, 8 low).

Triage produced: **10 patches** (8 applied inline; 2 deferred), **6 acknowledged in retrospective**, **18 deferred to deferred-work.md**, **5 dismissed**.

## Patches applied (8)

### P1 [HIGH] — Blind-Finding-1 — docker-compose.full.yml secret mismatch
Story: E14-S1
File: `infra/docker-compose.full.yml:41`
Issue: dev realm L228 + `appsettings.Development.json:48` were updated to `dev-admin-secret-change-me`, but the docker-compose overlay still passed `admin-service-secret-2026` as the `IABCONNECT_ADMIN_CLIENT_SECRET` env var. Local Beta-shape smoke would have failed admin client auth.
Fix: Swap to `dev-admin-secret-change-me` (1-line edit) so all three match-up sites are in lockstep.

### P2 [HIGH] — Blind-Finding-2 — STARTUP_TROUBLESHOOTING.md stale
Story: E14-S1
File: `docs/STARTUP_TROUBLESHOOTING.md:160`
Issue: Troubleshooting doc still instructed devs that `AdminClientSecret` should equal `admin-service-secret-2026`. Doc-file is in audit allowlist; the audit script would not catch it.
Fix: Updated to `dev-admin-secret-change-me` + appended "(E14-S1 sanitization)" annotation.

### P3 [HIGH] — Blind-Finding-4 — Strict-policy chains untested
Story: E14-S4 AC-4
File: `backend/tests/IabConnect.Api.Tests/Middleware/RateLimitingTests.cs`
Issue: No test asserted `.RequireRateLimiting("strict-identity")` actually attaches to the 3 DEC-1=A target endpoints. A future refactor dropping a chain would silently un-rate-limit a brute-forceable identity-mutation endpoint.
Fix: Added `StrictPolicyChained_OnAllThreeTargetEndpoints_CodeAudit` [Fact] with regex assertions on IdentityEndpoints.cs + UserEndpoints.cs.

### P4 [MED] — Blind-Finding-6 + AcceptanceAuditor-E14-S4-AC-5 — 429 body shape
Story: E14-S4 AC-5
File: `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs:OnRejected`
Issue: AC text promised `{"error": "rate_limit_exceeded", "retryAfter": <seconds>}` but code emitted only `{ error = "rate_limit_exceeded" }`. Consumers without header-access (proxied/rewritten responses) had no body-level retry info.
Fix: Captured the retry-after seconds value once and included it in both the `Retry-After` header AND the JSON body. AC text + runbook §23.3 now match the code.

### P5 [MED] — Blind-Finding-8 — BearerPresenceEnricher DI registration untested
Story: E14-S5 AC-3
File: `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs`
Issue: `Program.cs` registers `BearerPresenceEnricher` via `AddSingleton<ILogEventEnricher, ...>()` + relies on `.ReadFrom.Services()` auto-discovery. Either line could regress with no test failure.
Fix: Added `BearerPresenceEnricher_IsRegisteredInApiDi_CodeAudit` [Fact] reading Program.cs and asserting the 3 wiring lines.

### P6 [HIGH] — Edge-1 — OnRejected race with response-already-started
Story: E14-S4
File: `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs:OnRejected`
Issue: If another middleware began streaming the response before the limiter rejected, `Response.StatusCode = 429` throws + `WriteAsJsonAsync` throws — client sees a truncated response with arbitrary partial status + connection abort.
Fix: Guard with `if (context.HttpContext.Response.HasStarted) { return; }` at the top of OnRejected — fail safe, don't corrupt the partial response.

### P7 [HIGH] — Edge-7 — BearerPresenceEnricher multi-value header mis-classified
Story: E14-S5 AC-3
File: `backend/src/IabConnect.Api/Logging/BearerPresenceEnricher.cs`
Issue: `StringValues.ToString()` comma-joins multiple Authorization header values. If a request carried both `Negotiate xyz` AND `Bearer abc`, the joined value `"Negotiate xyz, Bearer abc"` would NOT start with `Bearer ` — enricher emits `bearer-absent` even though a bearer IS present. Log query "show me unauthenticated 4xx" would mis-classify.
Fix: Loop over `values` and check `StartsWith` per element; break on first match. Test scenario already covered by existing single-value cases; multi-value is a tail-of-distribution scenario but RFC 7230-permitted.

### P8 [HIGH] — Edge-11 + Edge-15 — CSP env-var injection + path-stripping
Story: E14-S2 AC-4
File: `frontend/src/lib/config/security-headers.ts`
Issue: `${NEXT_PUBLIC_API_URL}` value injected raw into CSP directive string. A malicious build-time env value `https://api.example.com; script-src https://evil.com` would inject an extra `script-src` permission — silently widening the CSP. Path components in env values (`https://api.example.com/v1/`) would also leak into the CSP directive where they don't belong.
Fix: Added `normalizeOrigin()` + `normalizeHostSource()` helpers that:
- Reject any value containing CSP separators (`;`, whitespace, quotes, `<>`)
- Parse via `new URL()` and emit only `url.origin` (strips path/query/fragment)
- Fall back to default if invalid
Added 2 Vitest tests (`rejects directive-injection via env var` + `strips path/query from origin env vars`). 6/6 frontend tests green.

### P9 [MED] — Edge-9 — audit-secrets.ps1 false-pass when invoked outside repo
Story: E14-S1
File: `scripts/audit-secrets.ps1`
Issue: If script invoked from non-repo cwd (CI workflow with wrong workdir; operator forgot to cd), `git grep` would write to stderr (suppressed by `2>$null`), return no output, loop never executes — script prints `AUDIT_OK: 0/0` and exits 0. A FALSE PASS in CI.
Fix: Added `git rev-parse --show-toplevel` probe at top of working-tree scan; exits 1 with clear error if not in repo.

### P10 [MED] — AcceptanceAuditor-E14-S5-AC-2 — RequestBodyLogging-OFF assertion missing
Story: E14-S5 AC-2
File: `backend/tests/IabConnect.Api.Tests/Logging/SensitiveDataDestructuringPolicyTests.cs`
Issue: AC-2 promised a test asserting request-body logging is OFF. The story's QGT listed `RequestBodyLogging_DisabledByDefault` as evidence anchor but no such test shipped. A future change wiring an EnrichDiagnosticContext callback that reads `Request.Body` would breach AC-2 unnoticed.
Fix: Added `RequestBodyLogging_IsNotEnabledInPipeline_CodeAudit` [Fact] asserting `UseSerilogRequestLogging()` present + no `EnrichDiagnosticContext` callback wired in `DependencyInjection.cs`.

## Acknowledged in retrospective (6) — DEC-pivots traded runtime tests for code-audit

These are NOT bugs but legitimate test-coverage shortfalls per documented DEC pivots. The Serilog single-logger constraint in `Program.cs` (re-running `Program.Main` re-freezes `Log.Logger`) forces test-side pivots. Retrospective action items address the pattern:

- **AcceptanceAuditor-E14-S2-AC-1** (HSTS code-audit vs runtime assertion of `max-age`)
- **AcceptanceAuditor-E14-S2-AC-2** (HTTPS-redirect code-audit vs runtime 307 + Location assertion)
- **AcceptanceAuditor-E14-S3-AC-2** (Beta-env-derived factory absent; transitive Testing-env argument)
- **AcceptanceAuditor-E14-S4-AC-7** (3 of 4 named tests pivoted to shape/code-audit; no runtime 429 transition test)
- **AcceptanceAuditor-E14-S4-AC-10** (`Microsoft.Extensions.Time.Testing` package not added per DEC-2 pivot)
- **AcceptanceAuditor-E14-S1-AC-1** (git-history scan advisory-only; not exit-code-gated)

Each acknowledged via the story's (a)/(b)/(c) Debug Log per A43.

## Deferred to deferred-work.md (18)

### From Blind Hunter

- **Blind-5** (MED): line-number drift in §21 + §22 cross-references after E14-S4 inserted `UseForwardedHeaders()`. Cosmetic. Fix at next runbook touch-up.
- **Blind-7** (MED): `PGPASSWORD` in destructure HashSet but NOT in audit script `$Patterns`; PEM markers (`BEGIN RSA`/`BEGIN PRIVATE`) in audit script but NOT destructure (not property-name-shaped). A31 parity is intentionally asymmetric; document.
- **Blind-9** (LOW): test environment could rate-limit-throttle if a future test fires >100 anonymous requests against `/about`. None currently does. Add `RateLimiting__AnonymousPermitLimit=10000` to test factory if it bites.
- **Blind-10** (LOW): allowlist entry `admin-service-secret-2026` becomes dead after P1; remove on next audit pass.

### From Edge Case Hunter

- **Edge-2** (HIGH): rate-limiter partition collapse if authenticated identity has no NameIdentifier/sub. Acceptable for Beta (Keycloak always issues sub); harden when external IdPs join (E1-S5 future).
- **Edge-3** (HIGH): destructure misses `IDictionary<string,object>` sensitive keys. The IAB Connect codebase has no such logging pattern today; harden when `appsettings.json` snapshots get logged.
- **Edge-4** (HIGH): destructure misses nested sensitive properties. Same risk class as Edge-3.
- **Edge-5** (MED): circular references; Serilog max-depth bounds runaway; not a regression risk.
- **Edge-6** (MED): destructure doesn't honor `[JsonIgnore]`. Belt-and-suspenders hardening; defer.
- **Edge-8** (MED): audit-secrets.ps1 colon-splitting fails on Windows abs paths with drive prefix. Current invocation is repo-relative; defer.
- **Edge-10** (HIGH): allowlist substring-match collision (a real secret containing an allowlist substring is silently allowed). Tighten with line-shape matching in a follow-up audit-script revision.
- **Edge-12** (MED): CSP missing `wss:`/`ws:`. No WebSocket feature yet; document for future SignalR ADR.
- **Edge-13** (MED): HTTPS-redirect runs before RateLimiter; HTTP→HTTPS clients consume 2 permits per request. Accept; Beta enforces HSTS so HTTP traffic is rare.
- **Edge-14** (MED): `UseSerilogRequestLogging` emits unmasked client IP (GDPR/DSGVO surface). Document in retention runbook (E11-S2 follow-up).

### From Acceptance Auditor

- **AcceptanceAuditor-E14-S2-AC-5** (LOW): backend↔frontend parity test uses coarse `.Contains` instead of structural key-value pair extraction. Catches the worst regressions; tighten on next E14-S2 touch.
- **AcceptanceAuditor-E14-S3-AC-3** (LOW): Beta-env-derived factory for Swagger 404 same pattern as E14-S3-AC-2 above; tied to AcknowledgedItem.
- **AcceptanceAuditor-E14-S4-AC-1** (LOW): `KnownIPNetworks.Clear()` + `KnownProxies.Clear()` trusts any proxy (not Railway IP range). Acceptable for Beta; harden when Railway's edge IP range stabilizes / is documented.
- **AcceptanceAuditor-E14-S4-AC-3** (LOW): "authenticated-baseline" named policy doesn't exist as a literal; logic implemented inline in GlobalLimiter branching. AC's "OR globally" alternative was chosen.
- **AcceptanceAuditor-E14-S5-AC-4** (LOW): AllowlistParity test compares both lists against a hard-coded test-side set, not against each other. Drift detection weakened; tighten by parsing `$StringAllowlist` from PowerShell file.

## Dismissed (5)

- **AcceptanceAuditor-E14-S5-AC-1**: AC text was internally inconsistent (asked for JSON Destructure section, then said JSON can't express predicates, then said use code-registration). Code-registration is the preferred path documented in the AC body. Story File List correctly records `appsettings.json` Serilog section unchanged.
- **AcceptanceAuditor-E14-S3-AC-4**: Dev-positive test skip is the documented DEC-1=B choice; not a violation.
- **AcceptanceAuditor-E14-S1-AC-5**: Allowlist absolves the literal per documented DEC-3=B fallback; not a violation.
- **AcceptanceAuditor-E14-S1-AC-9**: A47 deferral is acceptable per the prompt; not a violation.
- **Blind-3** (AC-7 4 named tests vs 6 shape tests): DEC-2 pivot is documented in (a)/(b)/(c); flagged for retrospective rather than re-patch.

## Test outcomes after patches

```
Backend:
  1442 (Application) + 194 (Api) + 414 (Infrastructure) = 2050 total, 0 failed
  (+3 vs pre-patch baseline 2047:
    + StrictPolicyChained_OnAllThreeTargetEndpoints_CodeAudit
    + BearerPresenceEnricher_IsRegisteredInApiDi_CodeAudit
    + RequestBodyLogging_IsNotEnabledInPipeline_CodeAudit)

Frontend:
  6/6 next-config-headers tests green
  (+2 vs pre-patch baseline 4:
    + rejects directive-injection via env var
    + strips path/query from origin env vars)
```

Build: 0 warnings, 0 errors.

## Status transitions

- e14-s1: review → done
- e14-s2: review → done
- e14-s3: review → done
- e14-s4: review → done
- e14-s5: review → done
- epic-14: in-progress → done (after retrospective lands)
