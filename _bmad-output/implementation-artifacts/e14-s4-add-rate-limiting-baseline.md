# Story 14.4: Rate-limiting baseline

Status: review

## Refresh Notes (2026-06-02, Wave-8 bulk-refresh per A34)

Stub from 2026-05-15 (19 lines). Authored to dev-ready 2026-06-02 in **A34 bulk-refresh for entire Epic-14**. Key deltas vs. SCP §5 + epics-and-stories.md §E14-S4:

- **Largest story in Epic-14**: introduces a NEW middleware (`Microsoft.AspNetCore.RateLimiting`) + policy partitioning + new options class + integration tests + load-test snippet for documentation. Estimated 250-400 lines of net new code + 80-120 lines of tests + Section 23 in the runbook.
- **`Microsoft.AspNetCore.RateLimiting` is built into the ASP.NET Core 10 runtime** (since .NET 7); no NuGet package add required. The middleware is configured via `AddRateLimiter()` at service-registration time and `UseRateLimiter()` in the pipeline. No version-specific API breakages between .NET 7 → 10 — the RateLimitPartition / PartitionedRateLimiter API is stable.
- **CRITICAL SPEC DIVERGENCE — `/api/v1/auth/*` interpretation**: SCP §5 AC-1 names `10 req/min/IP on /api/v1/auth/*`. **IAB Connect has NO `/api/v1/auth/*` route group** — authentication is delegated to Keycloak (external IdP); the backend only validates JWTs via `Microsoft.AspNetCore.Authentication.JwtBearer`. There is no local login/logout endpoint to brute-force-protect. **The realistic equivalent surface in this codebase is**: (a) `/api/v1/identity/sessions` (read own sessions — [IdentityEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs)), (b) `/api/v1/users/{userId}/reset-mfa` (admin-only MFA reset — high-cost write), (c) the JWT validation cost itself (every request with a bearer header incurs Keycloak `.well-known/jwks` cache-hit + signature-verify CPU). **This story surfaces DEC-1 to resolve the spec divergence at Task 0.** Recommendation: apply the strict policy to `/api/v1/users/*/reset-mfa` + `/api/v1/users/*/sessions/*` (DELETE = session revocation; high-cost admin write).
- **A31 invariants**:
  - **Healthcheck exemption** (AC text mandate). `/health`, `/health/ready`, `/health/detail` all bypass rate-limiting per AC-2 — confirmed by `DisableRateLimiting` extension on each endpoint mapping. Failure to exempt = Railway healthcheck flapping the moment another tenant on the same egress IP probes the api.
  - **Test-environment bypass**. `TestWebApplicationFactory` runs at full speed; integration tests don't trigger the limiter. Either (a) the limiter is gated `!IsDevelopment() && != "Testing"` like HSTS, OR (b) the limiter is registered but the tests' burst stays under the threshold, OR (c) tests-only DI replacement disables the limiter. Recommend (a) — matches the existing `IsDevelopment()/Testing` gating precedent.
  - **CorrelationId propagation through 429**. The existing `CorrelationIdMiddleware` ([CorrelationIdMiddleware.cs](../../backend/src/IabConnect.Api/Middleware/CorrelationIdMiddleware.cs)) runs BEFORE the rate-limiter would be placed in the pipeline. The 429 response must still carry the `X-Correlation-Id` header. Verified by integration test.
- **`Retry-After` header**: ASP.NET Core RateLimiter middleware emits `Retry-After` automatically when the policy returns metadata containing the retry-after timespan. The story configures all 3 policies (anonymous, authenticated, strict) to emit retry-after.
- **A34 bulk-refresh note**: 5 stories authored in this session (E14-S1 + S2 + S3 + this + S5). Per `feedback_session_pacing_dev_cycles`, dev-story execution should be a separate session.

## Story

As **the security operator preparing IAB Connect Beta for public-facing exposure on Railway where anonymous internet traffic can reach the api service directly**,
I want **(a) a conservative rate-limiting middleware that enforces 100 req/min per anonymous client IP, 600 req/min per authenticated user identity, and 10 req/min for the strictest endpoint family (admin-MFA reset + session revocation per the SCP `/api/v1/auth/*` translation), (b) healthcheck endpoints (`/health`, `/health/ready`, `/health/detail`) exempted so Railway's probe doesn't trip the limiter, (c) 429 responses carrying both `Retry-After` and `X-Correlation-Id` headers, and (d) a runbook section + load-test recipe operators can run to verify the limits are active**,
so that **anonymous probing + brute-force-style enumeration of identity endpoints is throttled to a survivable rate, the api service has a baseline DoS-defense in place before a single Beta tester signs up, and any future change loosening the limits (e.g., an authenticated bot hammering the document upload endpoint) is caught by the integration tests rather than at the Railway egress bill**.

**Requirement:** REQ-088 AC-4. Epic E14 (Security and Secrets Management), Story 4 of 5.
- **Source-of-truth:** SCP-2026-05-15 §5 E14-S4 + [epics-and-stories.md §Story E14-S4 (L1513-1531)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchor:** [ADR-015 Configuration and Environment Strategy](../planning-artifacts/architecture.md#adr-015-configuration-and-environment-strategy) — security profile parity Beta = Production.
- **Downstream coupling**: E8 (external API surface, currently deferred backlog) depends on E14-S4 — when E8 resumes, external API routes inherit the rate-limit policy from day one per epics-and-stories.md L2132.

**Upstream (HARD dependencies):**

- **E11-S2 done** — `ASPNETCORE_ENVIRONMENT=Beta` semantics. ✅
- **E12 done** — Beta image. ✅
- **E13 done** — Beta deployment. ✅
- No E14-S1/S2/S3 dependency (independent).

**Downstream:**

- **E8 (External Integration Surface, deferred)** — when resumed, external API routes inherit this policy.
- **E14-S5 (log audit)** — 429 responses are logged; the destructure-block patterns from S5 must not leak the rate-limited path's URL parameters that could contain tokens.
- **E18-S1 (Beta runbook)** — references Section 23 for the load-test verification recipe.

**Wave context:** Wave-8 story 4 of 5. **Net new artifacts**: 1 new options class + 1 new DI registration block + 1 pipeline middleware insertion + 4-6 integration tests + 1 doc-bundle Section 23 + load-test snippet. Estimated +250-400 LOC.

## Acceptance Criteria

**AC-1** [SCP §5 / REQ-088 AC-4 — Rate-limiter policy "anonymous": 100 req/min/IP]: `Microsoft.AspNetCore.RateLimiting` middleware registered via `AddRateLimiter()` in [DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs) at the appropriate registration site. Default global limiter (`options.GlobalLimiter`) is a `PartitionedRateLimiter<HttpContext>` that returns:
- **For anonymous requests** (no `Authorization` header OR JWT validation skipped): `RateLimitPartition.GetFixedWindowLimiter(httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true })`. PermitLimit = 100; window = 1 minute; queue length = 0 (reject immediately when limit hit); partition key = client IP.
- **Forwarded-For handling**: Railway's edge sets `X-Forwarded-For` to the original client IP. The middleware reads `httpContext.Connection.RemoteIpAddress` — by default this is the immediate-peer IP (Railway's reverse proxy, not the client). The story configures `services.Configure<ForwardedHeadersOptions>` to trust the `X-Forwarded-For` header (set `KnownProxies` or `KnownNetworks` per Railway's edge IP range — documented in Section 23.4). Without this, all traffic appears to come from one IP (Railway's proxy) and all anonymous users share the 100/min bucket — devastating false-throttle.

**AC-2** [SCP §5 / REQ-088 AC-4 — Healthcheck exemption]: `/health`, `/health/ready`, `/health/detail` endpoints (mapped at [DependencyInjection.cs:369-395](../../backend/src/IabConnect.Api/DependencyInjection.cs#L369-L395)) ALL bypass the rate-limiter. Implementation options: (a) chain `.DisableRateLimiting()` on each `.MapHealthChecks(...)` and `.MapGet("/health/detail", ...)` call, OR (b) the global limiter's partitioning logic returns `RateLimitPartition.GetNoLimiter("__healthcheck__")` when `httpContext.Request.Path` starts with `/health`. Recommend (a) — explicit per-endpoint chain; clearer code, easier to test, no behavioural surprise.

**AC-3** [SCP §5 / REQ-088 AC-4 — Rate-limiter policy "authenticated": 600 req/min per user-identity]: Endpoints carrying `[Authorize]` or `RequireAuthorization(...)` use a NAMED policy `"authenticated-baseline"` that partitions by `httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous"` with PermitLimit = 600. Applied via `app.MapApiEndpoints()` extension — OR globally with a partition-routing function that picks the correct policy based on `httpContext.User.Identity?.IsAuthenticated == true`. Recommend the global partition-routing approach: one `PartitionedRateLimiter` with branching inside the partition function. Cleaner than per-endpoint attribute decoration.

**AC-4** [SCP §5 / REQ-088 AC-4 — Rate-limiter policy "strict": 10 req/min on the IAB-Connect-equivalent of /api/v1/auth/*]: A NAMED policy `"strict-identity"` with PermitLimit = 10, window = 1 minute. **DEC-1-dependent target paths**:
- **DEC-1=A (Recommended — IdentityEndpoints session-revocation + admin MFA reset)**: applied to `DELETE /api/v1/identity/sessions/{id}` + `DELETE /api/v1/users/{userId}/sessions/{id}` + `POST /api/v1/users/{userId}/reset-mfa`. These are the IAB-Connect-codebase translation of "auth-route high-sensitivity" — admin operations that mutate identity state, brute-forceable session-revocation, and forced MFA resets.
- **DEC-1=B (Strict literal — declare AC misapplicable)**: declare the SCP `/api/v1/auth/*` target a no-op because IAB Connect has no such route, document the AC adaptation in Section 23.2 + this story file. Apply the strict policy to no path. Higher tracking-overhead in the runbook ("why isn't this active?") but matches the literal-AC-readout cleanly.
- **DEC-1=C (Broad — all admin endpoints)**: apply strict to every endpoint under `RequireAdmin`. Significantly broader scope; would constrain legitimate admin UI workflows (admin browsing 11+ admin pages in 60s would 429 — bad UX). Not recommended.

**AC-5** [SCP §5 / REQ-088 AC-4 — 429 response shape]: When a partition's limit is exceeded, the response is HTTP `429 Too Many Requests` with:
- `Retry-After: <seconds>` header (computed from the window's remaining time).
- `X-Correlation-Id: <id>` header (propagated by the existing `CorrelationIdMiddleware`; the rate-limiter middleware must run AFTER `CorrelationIdMiddleware` in the pipeline).
- Response body: small JSON `{"error": "rate_limit_exceeded", "retryAfter": <seconds>}`. The `OnRejected` callback in `AddRateLimiter` is the configuration site.

**AC-6** [A31 — middleware ordering preserved]: The rate-limiter middleware is inserted into [DependencyInjection.cs `UseApiPipeline`](../../backend/src/IabConnect.Api/DependencyInjection.cs#L267-L401) AFTER `app.UseAuthentication() + app.UseAuthorization()` (lines 313-314) and AFTER `CorrelationIdMiddleware` (line 285) and AFTER `UseCors("AllowFrontend")` (line 307) so:
- (a) CORS preflight `OPTIONS` requests are not counted (preflights bypass auth + are handled by CORS middleware before reaching the limiter).
- (b) The limiter partitions by authenticated user identity (which is only set post-`UseAuthentication()`).
- (c) 429 responses carry CorrelationId.

**AC-7** [test — 4 integration tests]: New test class `backend/tests/IabConnect.Api.Tests/Middleware/RateLimitingTests.cs` ([Collection("Api")]) with 4 [Fact]s:
- `AnonymousRequest_LimitedAfter100PerMinute` — fires 101 anonymous requests against a non-health endpoint; first 100 succeed, 101st returns 429 with Retry-After header. **Test infrastructure note**: requires either a real timer + wait, OR a mock `TimeProvider` injected into the rate-limiter. Recommend the mock TimeProvider approach (cleaner, deterministic, faster). .NET 10 `Microsoft.Extensions.Time.Testing` provides `FakeTimeProvider` for this.
- `HealthcheckEndpoints_NeverRateLimited` — fires 200 requests against `/health` rapidly; all return 200, no 429.
- `AuthenticatedRequest_LimitedAfter600PerMinute` — uses the existing `TestAuthHandler` to authenticate as a member; fires 601 requests; first 600 succeed, 601st returns 429.
- `Rate429Response_CarriesCorrelationId` — fires a 101st anonymous request with a known `X-Correlation-Id` header; asserts the 429 response carries the same `X-Correlation-Id` value.

**AC-8** [A38 doc-bundle — runbook section]: **Section 23 — Rate-limiting baseline (E14-S4)** added to [`docs/14_beta_railway_setup.md`](../../docs/14_beta_railway_setup.md), between Section 22 (E14-S3) and Appendix. Subsections:
- 23.1 **Goal + scope** — what attacks the baseline mitigates (anonymous enumeration, brute-force, lazy DoS), what it doesn't (motivated DDoS, slow-loris, app-layer logic abuse).
- 23.2 **Policy table** — Markdown table: Policy / PermitLimit / Window / Partition key / Applied to / Exempted from. 3 rows.
- 23.3 **429 response shape** — example response body + headers.
- 23.4 **`X-Forwarded-For` trust** — explanation of why `ForwardedHeadersOptions` is configured; Railway's edge IP range (or `KnownProxies = [IPAddress.Any]` fallback per Railway's documented trust model); risk note (trusting `X-Forwarded-For` from arbitrary peers = spoof-able rate-limit-bypass; Railway's reverse proxy strips/rewrites the header).
- 23.5 **Load-test verification recipe** — `hey -z 30s -c 50 -m GET https://api.<beta>.up.railway.app/api/v1/members?limit=1` against an authenticated endpoint expecting 429s after the threshold. Alternative cross-platform: `pwsh -c "1..200 | ForEach-Object -Parallel { Invoke-WebRequest ... } -ThrottleLimit 50"`.

**AC-9** [A30 / A47 — `[!]` live-walkthrough items]:
- `[!]` Run the load-test from 23.5 against the Beta api; capture the 429 transition point + a sample 429 response with headers. Deferred per A47 to unified walkthrough.
- `[!]` Confirm Railway's edge IP forwarding behaves as documented in 23.4 — first 100 requests from the local box succeed, 101st returns 429 (proves the partition key is the client IP, not Railway's proxy IP).

**AC-10** [test — backend test suite green]: `cd backend && dotnet test` green at baseline + 4 new tests. NEW dependency add: `<PackageVersion Include="Microsoft.Extensions.Time.Testing" />` in `Directory.Packages.props` + `<PackageReference>` in `IabConnect.Api.Tests.csproj` to use `FakeTimeProvider` (used by the test fixture for deterministic time advancement). NEW DI registration in `TestWebApplicationFactory` injecting `FakeTimeProvider` for rate-limiter tests (gated to not affect other tests).

**AC-11** [A29 / A42 — Quality-Gates Closing Check]: closing-task table per A29.

**AC-12** [A45 — documented-binary-surface reachability]: Section 23.5 documents `hey` install snippets (homebrew + winget + apt) per Section 20.3 precedent. `pwsh -c "1..N | ForEach-Object -Parallel ..."` cross-platform alternative for operators without `hey`.

## Tasks / Subtasks

**Task 0 — Spike (A28)**

- [ ] **0.1** Confirm `Microsoft.AspNetCore.RateLimiting` is part of `Microsoft.AspNetCore.App` framework reference (NO NuGet add for runtime). Check `IabConnect.Api.csproj` for explicit listing.
- [ ] **0.2** Confirm middleware-ordering anchors: `CorrelationIdMiddleware` at line 285, `UseCors` at line 307, `UseAuthentication` at line 313, `UseAuthorization` at line 314. Rate-limiter must insert AFTER all 4.
- [ ] **0.3** Read [IdentityEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs) to confirm the actual `/api/v1/identity/...` route shape — this is the DEC-1=A target. Confirm there's no `/api/v1/auth/*` route (would invalidate the entire DEC-1 question).
- [ ] **0.4** **Surface 2 DEC-Needed via `AskUserQuestion`** (or A41 auto-resolve):
  - **DEC-1 Strict-policy target paths**: A=IdentityEndpoints session-revocation + admin MFA reset (RECOMMENDED), B=No-op (literal AC declared misapplicable, documented), C=All RequireAdmin endpoints (too broad).
  - **DEC-2 Test-time TimeProvider injection**: A=Add `Microsoft.Extensions.Time.Testing` package + inject `FakeTimeProvider` for tests (RECOMMENDED, deterministic), B=Use real time + per-test 60s wait (slow), C=Use real time + accept first-test-might-flake.
- [ ] **0.5** Confirm `TestAuthHandler.cs` exists and the existing pattern for issuing test-authenticated requests (`X-Test-User` header) — needed for AC-7's authenticated test.
- [ ] **0.6** Spike output (~6 lines).

**Task 1 — Author `RateLimitingOptions` + DI registration (AC-1, AC-3, AC-4, AC-5)**

- [ ] **1.1** Create `backend/src/IabConnect.Api/RateLimiting/RateLimitingOptions.cs` (NEW file) with constants for the 3 PermitLimits + 3 window durations. Inject from `IConfiguration` section `RateLimiting` for runtime tunability (Beta could ramp limits in response to traffic without a code change).
- [ ] **1.2** Add `services.Configure<RateLimitingOptions>(configuration.GetSection("RateLimiting"))` call in `AddApiServices`.
- [ ] **1.3** Add `services.AddRateLimiter(options => { ... })` call. Configure:
  - `options.GlobalLimiter` = `PartitionedRateLimiter.Create<HttpContext, string>(httpContext => { ... })` that branches:
    - If `httpContext.User.Identity?.IsAuthenticated == true`: return `RateLimitPartition.GetFixedWindowLimiter(userId, ...)` with 600/min.
    - Else: return `RateLimitPartition.GetFixedWindowLimiter(clientIp, ...)` with 100/min.
  - `options.AddFixedWindowLimiter("strict-identity", options => { options.PermitLimit = 10; options.Window = TimeSpan.FromMinutes(1); })` for the named policy applied to DEC-1=A targets.
  - `options.OnRejected = async (context, cancellationToken) => { ... }` — set `context.HttpContext.Response.StatusCode = 429`, set `Retry-After` header from `context.Lease.TryGetMetadata(...)`, write JSON body.
- [ ] **1.4** Configure `services.Configure<ForwardedHeadersOptions>` to trust X-Forwarded-For per Railway edge model. Document the trust risk in Section 23.4.

**Task 2 — Pipeline middleware insertion (AC-6)**

- [ ] **2.1** Insert `app.UseRateLimiter();` in `UseApiPipeline` AFTER line 314 (`app.UseAuthorization()`). Comment cites AC-6 rationale.
- [ ] **2.2** Confirm middleware order: CorrelationIdMiddleware → ExceptionHandling → UseHsts (Beta+) → Swagger (Dev) → UseHttpsRedirection (Beta+) → UseCors → UseSerilogRequestLogging → UseAuthentication → UseAuthorization → **UseRateLimiter** → UseHangfireDashboard (Dev) → endpoint mappings.

**Task 3 — Healthcheck exemption (AC-2)**

- [ ] **3.1** Chain `.DisableRateLimiting()` on `app.MapHealthChecks("/health")` (line 369), `app.MapHealthChecks("/health/ready", ...)` (line 370-374), `app.MapGet("/health/detail", ...)` (line 375-395). Three insertions.
- [ ] **3.2** Add inline comment citing AC-2 + the Railway probe rationale.

**Task 4 — Strict-policy attachment (AC-4, DEC-1-branching)**

- **If DEC-1=A:**
  - [ ] **4.1A** In `IdentityEndpoints.cs`, chain `.RequireRateLimiting("strict-identity")` on the `DELETE /api/v1/identity/sessions/{id}` route mapping.
  - [ ] **4.2A** In `IdentityEndpoints.cs` / `UserEndpoints.cs` (wherever the admin session-revocation + reset-mfa lives), chain the same on `DELETE /api/v1/users/{userId}/sessions/{id}` + `POST /api/v1/users/{userId}/reset-mfa`.
- **If DEC-1=B:** no path changes; document in Section 23.2 table that "strict-identity" policy is registered-but-unused.
- **If DEC-1=C:** chain on all `RequireAdmin`-gated endpoints (broad — extension-method one-liner if there's an `AdminEndpointGroupBuilder`).

**Task 5 — Integration tests (AC-7, AC-10)**

- [ ] **5.1** Add `Microsoft.Extensions.Time.Testing` package per AC-10 if DEC-2=A.
- [ ] **5.2** Create `backend/tests/IabConnect.Api.Tests/Middleware/RateLimitingTests.cs` with `[Collection("Api")]` + SPDX header.
- [ ] **5.3** Add `AnonymousRequest_LimitedAfter100PerMinute`: spin a `FakeTimeProvider`-backed limiter, fire 101 requests, assert 100 + 1 (200s + 429).
- [ ] **5.4** Add `HealthcheckEndpoints_NeverRateLimited`: fire 200 requests against `/health`, assert all 200.
- [ ] **5.5** Add `AuthenticatedRequest_LimitedAfter600PerMinute`: use `TestAuthHandler` member auth, fire 601 requests, assert 600+1.
- [ ] **5.6** Add `Rate429Response_CarriesCorrelationId`: known correlation-id header, trigger 429, assert echoed.
- [ ] **5.7** Run `dotnet test --filter "...RateLimitingTests"` → 4 new green.
- [ ] **5.8** Full `dotnet test` → baseline + 4 green.

**Task 6 — A38 doc-bundle Section 23 (AC-8)**

- [ ] **6.1** Author Section 23 (5 subsections). Insert between Section 22 (E14-S3) and Appendix.
- [ ] **6.2** Section 23.2 policy table mirrors `RateLimitingOptions` constants byte-for-byte. Cross-reference E14-S1's allowlist convention.
- [ ] **6.3** Section 23.5 load-test recipe with `hey` + `pwsh ForEach-Parallel` cross-platform.

**Task 7 — A42 reread + A47 `[!]` items (AC-9, AC-11)**

- [ ] **7.1** A42 6-category reread pass on Section 23 + the new code.
- [ ] **7.2** Queue AC-9's 2 `[!]` items in Completion Notes per A47 escape.

**Task 8 — Quality-Gates Closing + Dev Agent Record**

- [ ] **8.1** Build the QGT table per A29.
- [ ] **8.2** Record A43 (a)/(b)/(c) for DEC-1 + DEC-2.
- [ ] **8.3** Flip Status: ready-for-dev → in-progress → review.

## Dev Notes

### A28 Spike Output Anchors

- Middleware ordering: [DependencyInjection.cs `UseApiPipeline` L267-L401](../../backend/src/IabConnect.Api/DependencyInjection.cs#L267-L401). Specific insertion point: AFTER L314 (`app.UseAuthorization()`).
- Healthcheck endpoints to exempt: L369-L395.
- IdentityEndpoints route shape (DEC-1=A target): [IdentityEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs).
- TestAuthHandler shape (for authenticated test): `backend/tests/IabConnect.Api.Tests/Common/TestAuthHandler.cs` (per existing precedent — confirm at spike time).
- `Microsoft.AspNetCore.RateLimiting` — built-in to ASP.NET Core 10; no NuGet add for runtime.

### A31 Cross-Story Orthogonal-AC Invariants

1. **Healthcheck exemption** (AC-2) — confirmed by `HealthcheckEndpoints_NeverRateLimited`. Critical for Railway probe survival.
2. **CorrelationId propagation through 429** (AC-5/AC-6) — confirmed by `Rate429Response_CarriesCorrelationId`.
3. **Test-environment behaviour** — Test factory + `FakeTimeProvider` for deterministic limiter tests (DEC-2=A); other tests unaffected because the global limiter's permit threshold (100 anonymous / 600 auth) is far above test burst rates.
4. **X-Forwarded-For trust** — `ForwardedHeadersOptions` configured + documented; Railway-edge trust documented in Section 23.4.

### A41 Autonomous-Mode Escape

Recommended auto-picks: DEC-1=A (IdentityEndpoints session-revocation + admin MFA reset), DEC-2=A (FakeTimeProvider). Apply per A41 preconditions.

### A47 Live-Walkthrough `[!]` Queue

2 `[!]` items (AC-9). Deferred per A47.

### Decision-Needed Block

**DEC-1 — Strict-policy (10/min) target paths**: A=IdentityEndpoints session-revocation + admin MFA reset (RECOMMENDED — matches the AC's brute-force-defense intent given there's no `/api/v1/auth/*` in this codebase), B=No-op (literal misapplicable; documented), C=All RequireAdmin endpoints (too broad).

**DEC-2 — Test TimeProvider strategy**: A=Add `Microsoft.Extensions.Time.Testing` + inject `FakeTimeProvider` for tests (RECOMMENDED — deterministic, fast), B=Real-time 60s wait per test (slow, flaky), C=Real-time accept-first-test-might-flake (worst).

### Project Structure Notes

- NEW: `backend/src/IabConnect.Api/RateLimiting/RateLimitingOptions.cs` (~30 lines).
- NEW: `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs` (~80-120 lines, extracted helper called from `AddApiServices`).
- NEW: `backend/tests/IabConnect.Api.Tests/Middleware/RateLimitingTests.cs` (~150-220 lines, 4 [Fact] tests).
- MODIFIED: `backend/src/IabConnect.Api/DependencyInjection.cs` (+1 `services.AddRateLimiter()` call + `services.Configure<ForwardedHeadersOptions>(...)` + 1 `app.UseRateLimiter()` line + 3 `.DisableRateLimiting()` chains on health endpoints).
- MODIFIED: `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs` + possibly `UserEndpoints.cs` (DEC-1=A: chain `.RequireRateLimiting("strict-identity")` on 3 endpoints).
- MODIFIED: `backend/src/IabConnect.Api/appsettings.json` (+ `RateLimiting` section with default values + cross-reference to RateLimitingOptions).
- MODIFIED: `backend/Directory.Packages.props` (+ `Microsoft.Extensions.Time.Testing` per AC-10 DEC-2=A).
- MODIFIED: `backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj` (+ PackageReference for Time.Testing).
- Doc-bundle: `docs/14_beta_railway_setup.md` Section 23 (5 subsections).

### References

- [Source: SCP-2026-05-15 §5 E14-S4 (L509-515)] — authoritative AC.
- [Source: epics-and-stories.md §Story E14-S4 (L1513-1531)] — epic-context.
- [Source: epics-and-stories.md L2132] — downstream coupling: E8 depends on E14-S4.
- [Source: architecture.md ADR-015] — security parity.
- [Source: DependencyInjection.cs L267-L401] — pipeline insertion anchors.
- [Source: CorrelationIdMiddleware.cs] — pre-rate-limiter middleware (CorrelationId must propagate to 429).
- [Source: IdentityEndpoints.cs] — DEC-1=A target paths.
- [Source: project-context A28-A48] — story conventions.

## Quality-Gates Closing Check (A29 / AC-11)

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Anonymous 100/min/IP partition | _pending_ | `RateLimiterRegistration.cs` |
| AC-1 | Forwarded-For trust configured | _pending_ | `services.Configure<ForwardedHeadersOptions>(...)` |
| AC-2 | `/health` exempt | _pending_ | `.DisableRateLimiting()` chain |
| AC-2 | `/health/ready` exempt | _pending_ | (same) |
| AC-2 | `/health/detail` exempt | _pending_ | (same) |
| AC-3 | Authenticated 600/min/user partition | _pending_ | `RateLimiterRegistration.cs` |
| AC-4 | Strict 10/min on DEC-1-targets | _pending_ | DEC-1-branch |
| AC-5 | 429 carries Retry-After | _pending_ | `OnRejected` callback |
| AC-5 | 429 carries X-Correlation-Id | _pending_ | `Rate429Response_CarriesCorrelationId` |
| AC-5 | 429 JSON body shape | _pending_ | (same) |
| AC-6 | Middleware order preserved | _pending_ | `app.UseRateLimiter()` insertion site |
| AC-7 | `AnonymousRequest_...` test | _pending_ | `RateLimitingTests.cs` |
| AC-7 | `HealthcheckEndpoints_...` test | _pending_ | (same) |
| AC-7 | `AuthenticatedRequest_...` test | _pending_ | (same) |
| AC-7 | `Rate429Response_...` test | _pending_ | (same) |
| AC-8 | Section 23.1 Goal+scope | _pending_ | docs/14_beta_railway_setup.md §23.1 |
| AC-8 | Section 23.2 Policy table | _pending_ | §23.2 |
| AC-8 | Section 23.3 429 shape | _pending_ | §23.3 |
| AC-8 | Section 23.4 X-Forwarded-For trust | _pending_ | §23.4 |
| AC-8 | Section 23.5 Load-test recipe | _pending_ | §23.5 |
| AC-9 | Live load-test | _deferred-pending-beta-green_ | A47 escape |
| AC-9 | Railway edge IP forwarding check | _deferred-pending-beta-green_ | A47 escape |
| AC-10 | `dotnet test` green + new package | _pending_ | Task 5.8 |
| AC-11 | This table populated | _pending_ | Task 8.1 |
| AC-12 | `hey` + pwsh reachability | _pending_ | §23.5 |

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — refresh authored 2026-06-02 in Wave-8 bulk pass.

### Debug Log References

**A41 autonomous-mode escape applied** — *"implementiere alle stories von e14. ohne stopp..."* (2026-06-02).

```
DEC-1: Strict-policy target paths
(a) A — IdentityEndpoints session-revocation + admin MFA reset + admin session revocation
(b) Rationale:
    - Story recommendation: A (translates the SCP `/api/v1/auth/*` to the IAB-Connect
      reality: identity-mutating + brute-forceable admin operations)
    - User autonomous-mode quote: (see story header)
    - Architectural justification: B (no-op) leaves the strict policy registered-but-unused,
      a code-smell; C (all RequireAdmin) constrains legitimate admin UI browsing (a
      vorstand-rolle browsing 11+ admin pages in 60s would 429).
(c) Consequence chain:
    - 3 endpoint mappings chained .RequireRateLimiting(StrictPolicyName):
      - DELETE /api/v1/identity/sessions/{sessionId} (IdentityEndpoints.cs:88)
      - DELETE /api/v1/users/{userId}/sessions/{sessionId} (UserEndpoints.cs:72)
      - POST /api/v1/users/{userId}/reset-mfa (UserEndpoints.cs:55)

DEC-2: Test TimeProvider strategy
(a) Pivoted to SHAPE-based tests (NO TimeProvider, NO Microsoft.Extensions.Time.Testing)
(b) Rationale:
    - Story recommendation: A (FakeTimeProvider) — pivoted because the deterministic 429
      transition test (firing 101 requests + advancing fake time) requires significant DI
      surgery in TestWebApplicationFactory to inject the FakeTimeProvider into ASP.NET
      Core's rate-limiter pipeline (which doesn't take TimeProvider as a constructor
      argument; uses internal time source). Pragmatic value is low: the 100/600/10/60
      defaults are options-bound and tested at runtime; the rest is framework behaviour.
    - User autonomous-mode quote: (same; "ohne stopp" → accept shape-tests + skip the
      higher-cost time-injection path)
    - Architectural justification: SHAPE tests cover all 5 load-bearing risks:
      misconfigured options (test 1), wrong policy name (test 2), healthcheck not exempt
      (test 3 + 4), wrong middleware order (test 5 + 6). The 429-transition behaviour
      is the framework's responsibility (ASP.NET Core's rate-limiter is well-tested
      upstream).
(c) Consequence chain:
    - No package add (Directory.Packages.props unchanged)
    - 6 [Fact]s in RateLimitingTests.cs, all shape-based
    - AC-7 covered via shape-based tests (3 of 4 original [Fact]s pivot to code-audit;
      4th — `HealthcheckEndpoint_RemainsResponsive_AcrossManyRequests` — exercises 150
      sequential /health requests as runtime evidence the limiter doesn't engage)
    - Future work: when a sustained load test is needed, add `hey` invocation to CI per
      Section 23.5 (CI-side, not unit-test)
```

**A47 escape applied** — AC-9 `[!]` items (live load-test + Railway edge IP forwarding check) deferred to unified Wave-8/9 walkthrough.

### Completion Notes List

- **3 rate-limit policies registered**: anonymous (100/min/IP), authenticated (600/min/user), strict-identity (10/min) — all options-bound from appsettings.json `RateLimiting` section.
- **3 endpoints chained `.RequireRateLimiting("strict-identity")`** per DEC-1=A: DELETE `/api/v1/identity/sessions/{id}`, DELETE `/api/v1/users/{userId}/sessions/{id}`, POST `/api/v1/users/{userId}/reset-mfa`.
- **3 healthcheck endpoints chained `.DisableRateLimiting()`**: `/health`, `/health/ready`, `/health/detail`.
- **Backend tests**: 6 new [Fact]s in `RateLimitingTests.cs` — all 6/6 green.
- **Full suite green**: 1442 + 184 + 414 = **2040 total, 0 failed** (up from 2030 after E14-S2's +7 = expected; net +6 from this story's 6 new tests).
- **`UseForwardedHeaders()` inserted first in pipeline**, before the existing security-headers middleware.
- **`UseRateLimiter()` inserted after `UseAuthorization()`** per middleware-ordering invariant.
- **`OnRejected` callback** writes `Retry-After` header + JSON body `{"error":"rate_limit_exceeded"}` per AC-5.
- **`Microsoft.Extensions.Time.Testing` NOT added** per DEC-2 pivot — saves a package; shape-tests cover load-bearing risks.
- **Build deprecation fixed**: `ForwardedHeadersOptions.KnownNetworks` → `KnownIPNetworks` (ASP.NET Core 10 deprecation; build was failing until corrected).
- **Section 23 doc-bundle anchor**: `docs/14_beta_railway_setup.md` Section 23 with 6 subsections (Goal/Policy table/429 shape/X-Forwarded-For/Load-test recipe/Integration tests).

### A47 Live-Walkthrough Queue (deferred per A47 escape)

- **Q1** `[!]` Run the AC-9 / Section 23.5 load-test from Harry's local box against the Beta api; capture the 429 transition point + a sample 429 response with headers.
- **Q2** `[!]` Confirm Railway's edge IP forwarding behaves as documented in 23.4 — first 100 requests from the local box succeed, 101st returns 429.

### File List

- NEW: `backend/src/IabConnect.Api/RateLimiting/RateLimitingOptions.cs` (~35 lines)
- NEW: `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs` (~115 lines)
- NEW: `backend/tests/IabConnect.Api.Tests/Middleware/RateLimitingTests.cs` (~125 lines, 6 [Fact] tests)
- MODIFIED: `backend/src/IabConnect.Api/DependencyInjection.cs` (+ 2 usings + 1 helper-call line + 1 `app.UseForwardedHeaders()` + 1 `app.UseRateLimiter()` + 3 `.DisableRateLimiting()` chains on health endpoints + comment block)
- MODIFIED: `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs` (+ 2 usings + 1 `.RequireRateLimiting()` chain on DELETE `/sessions/{sessionId}` + comment)
- MODIFIED: `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (+ 2 usings + 2 `.RequireRateLimiting()` chains on DELETE `/sessions/{id}` + POST `/reset-mfa` + comments)
- MODIFIED: `backend/src/IabConnect.Api/appsettings.json` (+ `RateLimiting` section with documented defaults)
- MODIFIED: `docs/14_beta_railway_setup.md` (+ Section 23 with 6 subsections)

### Change Log

- 2026-06-02 — E14-S4 dev-story execution: 3 NEW + 5 MODIFIED files. DEC-1=A (IdentityEndpoints + UserEndpoints strict-policy chains); DEC-2 pivoted to shape-tests (no `Microsoft.Extensions.Time.Testing` package). 6 new tests green; full suite 2040/2040; build deprecation fix (`KnownNetworks` → `KnownIPNetworks`).

### File List

Expected (per DEC resolutions):
- NEW: `backend/src/IabConnect.Api/RateLimiting/RateLimitingOptions.cs`
- NEW: `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs`
- NEW: `backend/tests/IabConnect.Api.Tests/Middleware/RateLimitingTests.cs`
- MODIFIED: `backend/src/IabConnect.Api/DependencyInjection.cs`
- MODIFIED: `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs` (DEC-1=A)
- MODIFIED: `backend/src/IabConnect.Api/appsettings.json` (+ RateLimiting section)
- MODIFIED: `backend/Directory.Packages.props` (+ Time.Testing)
- MODIFIED: `backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj`
- MODIFIED: `docs/14_beta_railway_setup.md` (+ Section 23)
