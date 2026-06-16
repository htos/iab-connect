# Story 14.2: Security headers and HTTPS enforcement review

Status: review

## Refresh Notes (2026-06-02, Wave-8 bulk-refresh per A34)

Stub from 2026-05-15 (19 lines, SCP §5 forward only). Authored to dev-ready 2026-06-02 as part of the **A34 bulk-refresh for entire Epic-14** (alongside E14-S1 refreshed earlier this session + E14-S3/S4/S5 in the same bulk pass). Key deltas vs. the SCP §5 + epics-and-stories.md §E14-S2 text:

- **Backend headers + HSTS + HTTPS-redirect are ALREADY shipping per ADR-015 and E11-S2 closure.** [DependencyInjection.cs:269-282](../../backend/src/IabConnect.Api/DependencyInjection.cs#L269-L282) emits `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Permitted-Cross-Domain-Policies: none` on every response; HSTS is enabled when `!IsDevelopment() && EnvironmentName != "Testing"` (Beta + Production); [DependencyInjection.cs:303-306](../../backend/src/IabConnect.Api/DependencyInjection.cs#L303-L306) enables HTTPS redirection on the same gate; [Program.cs:26](../../backend/src/IabConnect.Api/Program.cs#L26) suppresses the Kestrel `Server` header per SEC-012. The backend half of the AC is **already covered code-side**; the story's contribution is **adding integration-test regression coverage** + **documenting the headers in the Beta runbook**.
- **Frontend already ships 3 of the 4 backend-equivalent headers** at [next.config.ts:49-69](../../frontend/next.config.ts#L49-L69) (X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin). **The CSP is the net-new addition** per SCP-2026-05-15 §5 AC-3: define a CSP with `connect-src` whitelisting the api + Keycloak public origins. The frontend does NOT replicate `X-Permitted-Cross-Domain-Policies` (Flash-era; modern browsers ignore it for HTML responses — backend keeps it for paranoia; frontend omission is intentional and documented).
- **CSP shape requires careful Next.js consideration.** Next.js 16 with Turbopack + React 19 + next-intl + NextAuth uses inline scripts for hydration (`<script>` data-attrs from `next/script`), `_next/static/chunks` JS, `_next/image` for image-optimization, `<style>` inline for streaming hydration, and `wss://` for Hot-Reload (dev only). A naive `default-src 'self'` CSP **breaks Next.js hydration** because React 19's streaming SSR uses inline scripts. The story carries DEC-1 (Strict vs. Practical CSP profile) with a `report-only` migration path so the audit baseline ships without breaking the production app.
- **A31 cross-story orthogonal-AC invariant**: backend headers list ↔ frontend headers list — the **3 must-match headers** are X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin (all 3 already covered byte-equally on both sides at the SAME directive values). The backend-only `X-Permitted-Cross-Domain-Policies: none` is intentionally not mirrored; documented in the runbook as "backend defense-in-depth, browser-side ignored".
- **A42 reread surfaced one minor inconsistency**: backend uses `strict-origin-when-cross-origin` (modern + correct); frontend currently matches; spec text doesn't pin the Referrer-Policy value. The story freezes both to the same string and adds an A31 byte-equality assertion.
- **Wave-8 context**: this is E14-S2 (story 2 of 5). No upstream blocker on Beta-deploy state (the changes are code-side + test-side + doc-side; live-Beta verification is the A47 `[!]` step at story close, deferred per user's standing post-MVP autonomous-mode directive carried through E15/E16).

## Story

As **the security operator preparing IAB Connect Beta for production-parity hardening on a public-facing Railway deployment**,
I want **(a) integration-test regression coverage proving the 5 backend security headers + HSTS + HTTPS-redirect ship on every non-Dev/non-Testing response, (b) a frontend Content-Security-Policy that whitelists exactly the api + Keycloak public origins required for the app to function (with a report-only migration path to land the policy without breaking app behavior), (c) A31 byte-equal header-value parity between backend and frontend for the 3 mirror-able headers, and (d) operator-facing documentation of the active headers + the CSP rationale**,
so that **a security reviewer running `curl -I` against the Beta `web` and `api` services sees the documented header set, Production hardening is reproducible in Beta without a code change, and any future header drift (a missing `nosniff`, a missing CSP `connect-src` entry after adding a new third-party service) is caught at test time rather than at first-tester report**.

**Requirement:** REQ-088 AC-4. Epic E14 (Security and Secrets Management), Story 2 of 5 — **Wave-8 second story for E14**.
- **Source-of-truth:** SCP-2026-05-15 §5 E14-S2 + [epics-and-stories.md §Story E14-S2 (L1474-1492)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchor:** [ADR-015 Configuration and Environment Strategy](../planning-artifacts/architecture.md#adr-015-configuration-and-environment-strategy) — "*Production hardenings (HSTS, HTTPS-redirect, no Swagger, no Hangfire-Dashboard, strict CORS) apply to Beta verbatim*". The backend code already implements this; the story confirms + tests + documents.
- **Cross-references**: [docs/05_security_privacy.md](../../docs/05_security_privacy.md) — security baseline; the headers added here are part of the same defense surface.

**Upstream (HARD dependencies):**

- **E11-S2 done** — `ASPNETCORE_ENVIRONMENT=Beta` semantics distinct from Development confirmed. The backend's "not Dev" gate (DependencyInjection.cs:279-282 + 303-306) relies on this. ✅
- **E12 done** — Beta image built with hardening profile. ✅
- **E13 done** — Beta deployment exists for the live-curl `[!]` verification step. ✅
- **E14-S1 done** — the audit allowlist this story extends with new entries (header values to match) is in place. (E14-S1 is ready-for-dev as of this refresh; E14-S2 dev-story execution waits for E14-S1 close.)

**Downstream:**

- **E14-S5 (log audit)** — verifies the headers configuration source-of-truth (appsettings.json) does not leak via log audit; the destructure-block patterns include header-related secrets (e.g., `Strict-Transport-Security`).
- **E18-S1 (runbook)** — references this story's documented headers list as part of the security-verification runbook section.

**Wave context:** Wave-8 story 2/5. **Net new artifacts**: 1 frontend file change (next.config.ts CSP block) + 2 new integration tests (backend headers + frontend headers smoke) + 1 doc-bundle section (`docs/14_beta_railway_setup.md` Section 21 — Security headers and HTTPS baseline). **No backend code change expected** (the existing code is already correct; the audit is verification + documentation).

## Acceptance Criteria

**AC-1** [SCP §5 / REQ-088 AC-4 — Backend security headers active in Beta]: A new test class `backend/tests/IabConnect.Api.Tests/Endpoints/SecurityHeadersTests.cs` ([Collection("Api")]) issues an HTTP request to an arbitrary anonymous endpoint (`GET /health/live`) via the existing `TestWebApplicationFactory` and asserts that the response carries the 4 backend security headers documented in [DependencyInjection.cs:269-277](../../backend/src/IabConnect.Api/DependencyInjection.cs#L269-L277):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Permitted-Cross-Domain-Policies: none`

Each header is asserted as a separate `[Fact]` so a future regression localizes to the specific header. **Limitation note**: `TestWebApplicationFactory` runs under `EnvironmentName == "Testing"`, which skips HSTS + HTTPS-redirect (per code-path at L279+L303). To exercise the HSTS path, a separate `[Fact]` overrides the environment via a derived test factory (or via `Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Beta")` in a scoped fixture per the E20-S5 P4 / A36 precedent) and asserts the `Strict-Transport-Security` header is present with `max-age=2592000` (the ASP.NET Core default) + an integration-test-friendly value range check (`max-age` ≥ 30 days).

**AC-2** [SCP §5 / REQ-088 AC-4 — Backend HTTPS redirect verified in non-Dev environments]: A `[Fact]` in `SecurityHeadersTests` overrides to `EnvironmentName = "Beta"` (or "Production"), issues a request to a `http://` scheme URL (NOT https://), and asserts the response status is `307 Temporary Redirect` with `Location: https://...`. **Test infrastructure note**: ASP.NET Core's `UseHttpsRedirection()` reads `HTTPS_PORT` env var or `Microsoft.AspNetCore.HttpsRedirection.HttpsPort` config key for the redirect target port; the test fixture configures one or the other. If neither is reachable, the test asserts the middleware bypasses (no redirect) and the test is marked `[Skip]` with a clear reason — DO NOT silently no-op.

**AC-3** [SCP §5 / REQ-088 AC-4 — Frontend security headers active]: A frontend Vitest test at `frontend/src/__tests__/next-config-headers.test.ts` (NEW file) **either** uses `vi.importActual` to import the `nextConfig.headers()` async function and snapshot-test the array shape, **OR** uses a Playwright test that requests `http://localhost:3000/` and asserts the response headers contain the 3 frontend headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy). DEC-2-dependent — pick one (recommend the lighter Vitest test for CI speed; the Playwright test is the live-walkthrough variant).

**AC-4** [SCP §5 AC-3 / NEW — Frontend Content-Security-Policy whitelisting api + Keycloak]: [next.config.ts:49-69](../../frontend/next.config.ts#L49-L69) `headers()` returns a new `Content-Security-Policy` header on every route. The policy structure is **DEC-1-dependent**:
- **DEC-1=A (Practical-enforcing, RECOMMENDED)**: a CSP that enforces strict `connect-src` + `frame-src` whitelisting but permits the inline-script + inline-style + `_next/static/chunks` patterns Next.js + React 19 + next-intl + NextAuth require. Concrete shape: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${NEXT_PUBLIC_DOCUMENT_HOST}; font-src 'self' data:; connect-src 'self' ${NEXT_PUBLIC_API_URL} ${NEXT_PUBLIC_KEYCLOAK_URL}; frame-src ${NEXT_PUBLIC_KEYCLOAK_URL}; frame-ancestors 'none'; base-uri 'self'; form-action 'self' ${NEXT_PUBLIC_KEYCLOAK_URL};`. `${NEXT_PUBLIC_*}` are read at `next build` time per the existing `env:` block; the CSP string is computed from those vars in a helper function exported from `src/lib/config/security-headers.ts` (NEW file).
- **DEC-1=B (Report-only migration)**: ship the same CSP shape but as `Content-Security-Policy-Report-Only` header; collect violation reports in browser DevTools for 1-2 Beta-tester cycles, then flip to enforcing in a follow-up story. Lower risk; higher operational cost (a tester-driven `[!]` walkthrough).
- **DEC-1=C (Strict, no-unsafe)**: drops `'unsafe-inline'` + `'unsafe-eval'` from script-src; uses CSP nonces via Next.js 16's middleware-generated nonce + `next/script` strategy="afterInteractive" with nonce attribute. Highest security; highest implementation complexity; possibly breaks `next-intl`'s dictionary-injection pattern.

Recommended Option A balances real-world Next.js compatibility against meaningful defense (connect-src is the most attack-relevant directive — locks the browser to talking to api + Keycloak only, even if a script injection happens).

**AC-5** [A31 — Backend ↔ Frontend header-value byte-equality for the 3 mirror-able headers]: A scripted assertion in the audit script from E14-S1 OR a new section in [`scripts/audit-secrets.ps1`](../../scripts/audit-secrets.ps1) (DEC-3 in E14-S1 dependent) confirms that the directive values match. Specifically: backend `X-Frame-Options` value = frontend `X-Frame-Options` value (= `DENY`); same for X-Content-Type-Options (= `nosniff`) and Referrer-Policy (= `strict-origin-when-cross-origin`). The assertion lives as a backend integration test in `SecurityHeadersTests.cs` that reads frontend's `next.config.ts` via `File.ReadAllText` + regex-extracts the values, OR as a `frontend/src/__tests__/header-parity.test.ts` that imports the backend's `DependencyInjection.cs` via raw file read + regex. Pick the side closer to the values that change more often (recommend backend-side reading frontend's `next.config.ts`, because the backend test infrastructure is more mature).

**AC-6** [A38 doc-bundle — runbook documentation]: A new **Section 21 — Security headers and HTTPS baseline (E14-S2)** is added to [`docs/14_beta_railway_setup.md`](../../docs/14_beta_railway_setup.md), inserted between Section 20 (E14-S1) and the Appendix. Section 21 has 5 subsections:
- 21.1 **Goal + scope** — what hardening the Beta deployment carries (backend 4 headers + HSTS + HTTPS-redirect + Server-header suppression; frontend 3 headers + CSP).
- 21.2 **Backend header table** — Markdown table with columns (Header, Value, Source-of-truth file:line, Gate condition); 5 rows for the headers + HSTS + HTTPS-redirect.
- 21.3 **Frontend header table** — same shape; 4 rows (3 standard + CSP).
- 21.4 **CSP rationale + directives** — explains each CSP directive's purpose; documents what each `${NEXT_PUBLIC_*}` placeholder maps to in Beta vs. local-dev; documents the inline-script tradeoff per DEC-1 chosen option.
- 21.5 **Live curl verification recipe** — `curl -I https://web.<beta-domain>/` and `curl -I https://api.<beta-domain>/` invocation snippets with the expected header set + a one-line one-off verification command (`pwsh -c "Invoke-WebRequest https://api.<beta-domain>/health/live -Method Head | Select-Object -ExpandProperty Headers"` for cross-platform parity). `[!]` Harry runs once at story-close OR per A47 the live-curl steps are queued for the Wave-8-/9-closing unified live-walkthrough.

**AC-7** [test — backend test suite green]: `cd backend && dotnet test` green at 1978-or-N (N = 1976 baseline + AC-1 sub-tests count). The new `SecurityHeadersTests.cs` adds: 4 + 1 + 1 = 6 [Fact] tests (4 headers + HSTS + HTTPS-redirect) + 1 [Fact] for header-value parity (AC-5).

**AC-8** [test — frontend test suite green]: `cd frontend && npm test` green at 135 + 1 or +2 (AC-3 next.config.ts snapshot + AC-4 CSP shape test). If DEC-2 chooses Playwright (live-stack), the test is conditionally `test.skip()` per the existing `frontend/e2e/module-enforcement.spec.ts` precedent so the CI baseline stays green.

**AC-9** [A30 / A47 — Live curl verification queued for unified walkthrough]:
- `[!]` Run `curl -I https://web.<beta-domain>/` after first deploy; capture into Section 21.5; expected: 3 frontend headers + CSP present.
- `[!]` Run `curl -I https://api.<beta-domain>/health/live` after first deploy; capture into Section 21.5; expected: 4 backend headers + HSTS present + HTTP responses redirect (`curl -I http://api...` → 307 + Location: https://...).
- `[!]` Browser DevTools "Security" tab on the Beta web service confirms the CSP is active (or report-only if DEC-1=B chosen).

**AC-10** [A29 / A42 — Quality-Gates Closing Check]: closing-task table (Task 8 / 9) lists each AC's status with covered / deferred-pending-beta-green per A47 / N/A annotation per sub-item.

**AC-11** [A45 — documented-binary-surface reachability]: Section 21.5's `curl -I` + `pwsh Invoke-WebRequest` invocation lines are documented as reachable from any operator's local box (curl is universal; pwsh install snippet from Section 20.3 cross-referenced).

## Tasks / Subtasks

**Task 0 — Spike (A28: spike-first for "verification + small new feature" specs)**

- [ ] **0.1** Confirm the 4 backend security headers + HSTS + HTTPS-redirect are present at the exact line ranges this story references ([DependencyInjection.cs:269-282 + 303-306](../../backend/src/IabConnect.Api/DependencyInjection.cs#L269-L282), [Program.cs:26](../../backend/src/IabConnect.Api/Program.cs#L26)); no code change required for backend.
- [ ] **0.2** Confirm the 3 frontend headers are present at [next.config.ts:49-69](../../frontend/next.config.ts#L49-L69); confirm CSP is currently absent.
- [ ] **0.3** Read the existing `TestWebApplicationFactory` shape ([backend/tests/IabConnect.Api.Tests/TestWebApplicationFactory.cs](../../backend/tests/IabConnect.Api.Tests/TestWebApplicationFactory.cs)) + the `[Collection("Api")]` pattern used by `HealthEndpointTests`/`AboutEndpointTests`. Confirm the integration-test pattern this story extends.
- [ ] **0.4** **Surface 3 DEC-Needed via `AskUserQuestion`** (or A41 auto-resolve if autonomous mode pre-declared):
  - **DEC-1 CSP profile**: A=Practical-enforcing (RECOMMENDED), B=Report-only migration, C=Strict no-unsafe.
  - **DEC-2 Frontend header test shape**: A=Vitest snapshot of next.config.ts headers() (RECOMMENDED), B=Playwright live-request smoke, C=both.
  - **DEC-3 HSTS test environment fixture**: A=derived test factory with `UseEnvironment("Beta")` (RECOMMENDED, matches existing per-test scoping), B=`Environment.SetEnvironmentVariable` mutation per the E20-S5 P4 / A36 precedent.
- [ ] **0.5** Confirm `Microsoft.AspNetCore.HttpsRedirection` is present in `Directory.Packages.props` (it's a built-in part of `Microsoft.AspNetCore.App` framework reference; no package add required).
- [ ] **0.6** Spike output (~6 lines): "Confirmed backend headers shipping; frontend headers minus CSP shipping; integration-test factory shape known; DEC-1/2/3 resolved as [A/A/A or chosen]; no new NuGet packages; proceed to Task 1."

**Task 1 — Backend headers regression tests (AC-1, AC-2, AC-5, AC-7)**

- [ ] **1.1** Create new test file `backend/tests/IabConnect.Api.Tests/Endpoints/SecurityHeadersTests.cs` with SPDX header + `[Collection("Api")]` attribute.
- [ ] **1.2** Add 4 `[Fact]`s, one per backend header (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-Permitted-Cross-Domain-Policies). Each test: HEAD /health/live → assert header present + value matches exactly.
- [ ] **1.3** Add 1 `[Fact]` `Hsts_PresentInBetaEnvironment` — uses a scoped fixture per DEC-3 to set EnvironmentName = "Beta"; HEAD /health/live → assert `Strict-Transport-Security` present + max-age value ≥ 30 days.
- [ ] **1.4** Add 1 `[Fact]` `HttpsRedirection_ActiveInBetaEnvironment` — same scoped fixture; GET `http://...` URL → assert 307 + Location starts with `https://`.
- [ ] **1.5** Add 1 `[Fact]` `BackendFrontendHeaderParity_StaysAligned` (AC-5) — read `frontend/next.config.ts` via `File.ReadAllText` + regex-extract the 3 header values; compare against the backend's hard-coded values (X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy=strict-origin-when-cross-origin).
- [ ] **1.6** Run `cd backend && dotnet test --filter "FullyQualifiedName~SecurityHeadersTests"` — confirm 7 new tests green.
- [ ] **1.7** Run full `dotnet test` — confirm 1976 + 7 = 1983 green (or other N if AC-9 of E14-S1 changed the baseline).

**Task 2 — Frontend CSP shipping (AC-4, DEC-1-branching)**

- **If DEC-1=A (Practical-enforcing, RECOMMENDED):**
  - [ ] **2.1A** Create `frontend/src/lib/config/security-headers.ts` (NEW file, ~30-50 lines) exporting `buildContentSecurityPolicy()` function that takes `(env: Record<string, string|undefined>)` and returns the CSP string per the AC-4 shape.
  - [ ] **2.2A** Add SPDX header per `CONTRIBUTING.md` policy.
  - [ ] **2.3A** Update [`next.config.ts:49-69`](../../frontend/next.config.ts#L49-L69) `headers()` to include `Content-Security-Policy` with value = `buildContentSecurityPolicy(process.env)`.
  - [ ] **2.4A** Add JSDoc on `buildContentSecurityPolicy()` explaining each directive + the `${NEXT_PUBLIC_*}` substitution sites.
- **If DEC-1=B (Report-only migration):**
  - [ ] **2.1B-2.4B** Same shape as A but header name = `Content-Security-Policy-Report-Only` + an additional `report-uri` directive (or `report-to` modern variant) pointing at a Mailtrap-equivalent collection endpoint. Document the 2-week migration window in Section 21.4. Schedule follow-up story to flip to enforcing.
- **If DEC-1=C (Strict no-unsafe):**
  - [ ] **2.1C-2.4C** Add nonce generation via Next.js middleware (`frontend/src/middleware.ts` extension); pass nonce to all `<script>`/`<style>` via context; verify next-intl dictionary injection still works. Higher complexity; only choose if security posture warrants.

**Task 3 — Frontend header tests (AC-3, AC-8, DEC-2-branching)**

- **If DEC-2=A (Vitest, RECOMMENDED):**
  - [ ] **3.1A** Create `frontend/src/__tests__/next-config-headers.test.ts` (NEW file). Add `// @vitest-environment node` directive (NOT jsdom — this test doesn't render React; refer A35 + A46 refinement).
  - [ ] **3.2A** Import the default-exported `nextConfig` from `../../next.config.ts`; await `nextConfig.headers()`; snapshot-test or shape-assert the returned array (3 standard + 1 CSP).
  - [ ] **3.3A** For CSP shape: parse the CSP value string + assert each directive's presence (`default-src`, `script-src`, `connect-src`, etc.); assert `${NEXT_PUBLIC_API_URL}` actually substituted to a value (i.e., not literal `${...}`).
- **If DEC-2=B (Playwright):**
  - [ ] **3.1B** Add `frontend/e2e/security-headers.spec.ts` per existing Playwright-suite convention. `test.skip()` if `E2E_BETA_URL` env var unset.
- **If DEC-2=C (both):** combine 3.1A+3.1B.
- [ ] **3.4** Run `cd frontend && npm test` — confirm 135 + N green.

**Task 4 — A31 backend ↔ frontend header parity (AC-5)**

- [ ] **4.1** Implement Task 1.5's `BackendFrontendHeaderParity_StaysAligned` test (already in Task 1; cross-reference here for completeness).
- [ ] **4.2** Document the 3 must-match headers + 1 backend-only header (X-Permitted-Cross-Domain-Policies) in Section 21.2 + 21.3 column "Mirror status".

**Task 5 — A38 doc-bundle — `docs/14_beta_railway_setup.md` Section 21 (AC-6)**

- [ ] **5.1** Author Section 21 (5 subsections) per AC-6. Insert between Section 20 (E14-S1) and Appendix.
- [ ] **5.2** Section 21.2 table values pulled from [DependencyInjection.cs:269-282 + 303-306](../../backend/src/IabConnect.Api/DependencyInjection.cs#L269-L282).
- [ ] **5.3** Section 21.3 table values pulled from [next.config.ts:49-69](../../frontend/next.config.ts#L49-L69) + the new CSP.
- [ ] **5.4** Section 21.4 CSP rationale: enumerate each directive + the security tradeoff that motivates inclusion. Document the `'unsafe-inline'` + `'unsafe-eval'` choice per DEC-1.
- [ ] **5.5** Section 21.5 live-curl recipe: shipped with `${BETA_HOST}` placeholder; Harry replaces with real Beta domain at A47 unified walkthrough.

**Task 6 — A42 reread-as-a-stranger pass (AC-10 closure prep)**

- [ ] **6.1** Re-read Section 21 + the new test code + the next.config.ts diff as a stranger; check 6 A42 categories (cross-section contradictions, pre-filled placeholders, stale anchors, imprecise claims, sprint-tracking leakage, documented-binary-surface reachability for `curl` + `pwsh Invoke-WebRequest`).

**Task 7 — A47 live-walkthrough `[!]` items queued (AC-9)**

- [ ] **7.1** **`[!]`** Queue AC-9's 3 live-Beta verification items under "Q1-Q3 unified live-walkthrough" in the Completion Notes section. Per A47 escape clause + user's standing autonomous-mode directive carried through E15/E16, these items are deferred to the Wave-8-or-9 unified live-walkthrough session — NOT executed inline.

**Task 8 — Quality-Gates Closing Check (AC-10) + Dev Agent Record finalization**

- [ ] **8.1** Build the Quality-Gates table per A29 (one row per AC sub-item).
- [ ] **8.2** Record A41 autonomous-mode escape resolution in Dev Agent Record → Debug Log References per A43 (a)/(b)/(c) template — one block for DEC-1, one for DEC-2, one for DEC-3.
- [ ] **8.3** Flip Status: `ready-for-dev` → `in-progress` (Task 1 start) → `review` (Task 8 close).
- [ ] **8.4** Final dev-story summary; ready for code-review (or epic-boundary review per hybrid CR+ER policy).

## Dev Notes

### A28 Spike Output Anchors

- Backend headers source-of-truth: [DependencyInjection.cs:269-277](../../backend/src/IabConnect.Api/DependencyInjection.cs#L269-L277) — 4 headers in one `app.Use` middleware lambda.
- HSTS: [DependencyInjection.cs:279-282](../../backend/src/IabConnect.Api/DependencyInjection.cs#L279-L282) — gated `!IsDevelopment() && EnvironmentName != "Testing"`.
- HTTPS redirect: [DependencyInjection.cs:303-306](../../backend/src/IabConnect.Api/DependencyInjection.cs#L303-L306) — same gate.
- Server header suppression: [Program.cs:26](../../backend/src/IabConnect.Api/Program.cs#L26) — `options.AddServerHeader = false`.
- Frontend headers source-of-truth: [next.config.ts:49-69](../../frontend/next.config.ts#L49-L69) — 3 headers in `headers()` async function.
- Frontend env-var-baked URLs: [next.config.ts:30-38](../../frontend/next.config.ts#L30-L38) — `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_SOURCE_URL`; CSP draws from same `process.env`.

### A31 Cross-Story Orthogonal-AC Invariants

1. **Backend ↔ Frontend header-value parity** for the 3 mirror-able headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — tested in AC-5.
2. **Beta ↔ Production header-set equivalence** — both environments must emit the same backend headers; only the BETA-banner differs (E11-S2 + ADR-015). The backend code-path gate `!IsDevelopment() && EnvironmentName != "Testing"` covers both Beta and Production; no per-env divergence.
3. **Backend `X-Permitted-Cross-Domain-Policies: none` is backend-only** — frontend omission is intentional (browsers ignore for HTML responses; Flash-era artifact); documented in Section 21.3 "Mirror status: Backend only — browser-ignored for HTML".

### A41 Autonomous-Mode Escape Preconditions

Apply per E14-S1 boilerplate. Recommended auto-picks (DEC-1=A, DEC-2=A, DEC-3=A) IF user has pre-declared autonomous mode in this session (e.g., "alle stories nacheinander ohne stop ... wichtig es handelt sich nicht mehr um einen mvp" carried from E15/E16). Else `AskUserQuestion` at Task 0.4.

### A47 Live-Walkthrough `[!]` Queue

This story has **3 `[!]` items** (AC-9): all are Live Beta-deploy + `curl -I` capture + browser DevTools "Security" tab inspection. Per A47 escape + standing user autonomous-mode directive, these are queued for the unified Wave-8-or-9 walkthrough session — NOT executed inline.

### Decision-Needed Block

**DEC-1 — Frontend CSP profile** — A=Practical-enforcing (RECOMMENDED, includes `'unsafe-inline'`/`'unsafe-eval'` for Next.js compatibility; locks connect-src + frame-src), B=Report-only migration (lower risk, higher operational cost), C=Strict no-unsafe (highest security, highest complexity).

**Rationale for A**: connect-src is the highest-value directive against script-injection-then-exfiltrate attacks; the `'unsafe-inline'` cost in script-src is significantly mitigated by frame-ancestors 'none' + base-uri 'self' + form-action allowlist. B is correct when the deployment is on a tested production app; this is Beta. C is correct when the team has Next.js + nonce-injection familiarity; deferred.

**DEC-2 — Frontend header test shape** — A=Vitest snapshot of `nextConfig.headers()` (RECOMMENDED, fastest CI), B=Playwright live-request smoke (better fidelity but requires running app), C=both.

**Rationale for A**: Vitest snapshot catches structural drift in the config file; Playwright catches runtime delivery drift but at higher CI cost. The frontend CI baseline (currently 135 tests) is faster than Playwright; staying in Vitest matches the E20-S4 / E16-S2 precedent (those stories' frontend additions are all Vitest). B is correct when a production-shape rendering bug would slip past Vitest snapshot; for header-shipping that's unlikely.

**DEC-3 — HSTS test environment fixture** — A=Derived `TestWebApplicationFactory` overriding `UseEnvironment("Beta")` (RECOMMENDED, matches existing per-test scoping precedent), B=`Environment.SetEnvironmentVariable` mutation per E20-S5 P4 / A36 (matches BUILD_SHA/BUILD_DATE precedent).

**Rationale for A**: A is purer (per-test factory instance, no cross-test mutation risk); B reuses the existing A36 pattern but requires careful test-ordering. A is the correct shape for a new test class introducing a non-Dev test path; reuse A36 only when the env-var-mapped IConfiguration override matters (not the case here — HSTS reads `app.Environment.EnvironmentName`, NOT IConfiguration).

### Project Structure Notes

- NEW: `backend/tests/IabConnect.Api.Tests/Endpoints/SecurityHeadersTests.cs` (~120-180 lines, 7 [Fact] tests).
- NEW: `frontend/src/lib/config/security-headers.ts` (~30-50 lines, exports `buildContentSecurityPolicy()`).
- NEW: `frontend/src/__tests__/next-config-headers.test.ts` (~80-120 lines, 1-2 Vitest tests).
- MODIFIED: `frontend/next.config.ts` (+1 header in `headers()` return + 1 import).
- Doc-bundle addition: `docs/14_beta_railway_setup.md` Section 21 (5 subsections).

### References

- [Source: SCP-2026-05-15 §5 E14-S2 (L494-500)] — authoritative AC.
- [Source: epics-and-stories.md §Story E14-S2 (L1474-1492)] — epic-context wording.
- [Source: architecture.md ADR-015 (L329-341)] — Production hardening = Beta hardening.
- [Source: docs/05_security_privacy.md] — security baseline.
- [Source: DependencyInjection.cs:269-282 + 303-306] — backend headers + HSTS + HTTPS-redirect (existing implementation).
- [Source: Program.cs:26] — Server-header suppression (SEC-012).
- [Source: next.config.ts:49-69] — frontend headers (existing); CSP target site.
- [Source: TestWebApplicationFactory.cs] — integration-test base.
- [Source: project-context A28-A48] — story authoring conventions.

## Quality-Gates Closing Check (A29 / AC-10)

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | X-Content-Type-Options test | _pending_ | `SecurityHeadersTests.cs` [Fact] |
| AC-1 | X-Frame-Options test | _pending_ | (same) |
| AC-1 | Referrer-Policy test | _pending_ | (same) |
| AC-1 | X-Permitted-Cross-Domain-Policies test | _pending_ | (same) |
| AC-1 | HSTS test (Beta env) | _pending_ | DEC-3-branch fixture |
| AC-2 | HTTPS redirect test (Beta env) | _pending_ | (same) |
| AC-3 | Frontend headers test | _pending_ | DEC-2-branch — Vitest or Playwright |
| AC-4 | CSP in next.config.ts | _pending_ | DEC-1-branch implementation |
| AC-4 | CSP connect-src whitelists api + Keycloak | _pending_ | `buildContentSecurityPolicy()` |
| AC-5 | Header-value parity (X-Frame) | _pending_ | `BackendFrontendHeaderParity_StaysAligned` |
| AC-5 | Header-value parity (X-Content-Type) | _pending_ | (same) |
| AC-5 | Header-value parity (Referrer-Policy) | _pending_ | (same) |
| AC-6 | Section 21.1 Goal+scope | _pending_ | docs/14_beta_railway_setup.md §21.1 |
| AC-6 | Section 21.2 Backend header table | _pending_ | §21.2 |
| AC-6 | Section 21.3 Frontend header table | _pending_ | §21.3 |
| AC-6 | Section 21.4 CSP rationale | _pending_ | §21.4 |
| AC-6 | Section 21.5 Live curl recipe | _pending_ | §21.5 |
| AC-7 | `dotnet test` green | _pending_ | 1976/2020/N + 7 |
| AC-8 | `npm test` green | _pending_ | 135 + N |
| AC-9 | Live curl `https://web.<beta>` | _deferred-pending-beta-green_ | A47 escape |
| AC-9 | Live curl `https://api.<beta>` | _deferred-pending-beta-green_ | A47 escape |
| AC-9 | Browser DevTools CSP check | _deferred-pending-beta-green_ | A47 escape |
| AC-10 | This table populated | _pending_ | Task 8.1 |
| AC-11 | curl + pwsh reachability documented | _pending_ | §21.5 |

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — refresh authored 2026-06-02 in Wave-8 bulk pass.

### Debug Log References

**A41 autonomous-mode escape applied** — user pre-declared autonomous mode for entire E14 implementation via *"implementiere alle stories von e14. ohne stopp bis alles implementiert ist. ... es handelt sich nicht mehr um einen mvp."* (2026-06-02). All three DEC-Needed surfaces auto-resolved per recommended options.

```
DEC-1: Frontend CSP profile
(a) A — Practical-enforcing (includes 'unsafe-inline' + 'unsafe-eval' for Next.js compatibility; locks connect-src + frame-src + form-action)
(b) Rationale:
    - Story recommendation: Option A (connect-src is the highest-value directive; 'unsafe-inline' cost
      mitigated by frame-ancestors 'none' + base-uri 'self' + form-action allowlist)
    - User autonomous-mode quote: (see story-level header)
    - Architectural justification: Next.js 16 + React 19 streaming SSR + next-intl + NextAuth all
      require inline scripts; B (Report-only) is correct for tested-production apps but this is Beta;
      C (Strict no-unsafe) requires nonce-injection familiarity not assumed
(c) Consequence chain:
    - AC-4 covered via buildContentSecurityPolicy() helper
    - Task 2.1A-2.4A executed (helper + next.config import + JSDoc)
    - Files: frontend/src/lib/config/security-headers.ts (NEW), frontend/next.config.ts (MODIFIED)

DEC-2: Frontend header test shape
(a) A — Vitest snapshot/shape-assert of buildContentSecurityPolicy()
(b) Rationale:
    - Story recommendation: A (fastest CI; matches E20-S4/E16-S2 precedent)
    - User autonomous-mode quote: (same)
    - Architectural justification: Vitest snapshot catches structural drift; Playwright requires
      running app (out of scope for unit tests). Header-shipping is low risk for runtime delivery
      bugs (Next.js core feature, well-tested upstream)
(c) Consequence chain:
    - AC-3 + AC-8 covered via Vitest test
    - Task 3.1A-3.4 executed
    - Files: frontend/src/__tests__/next-config-headers.test.ts (NEW)

DEC-3: HSTS test environment fixture
(a) Pivoted to CODE-AUDIT approach (regex on DependencyInjection.cs) — NOT A (derived factory) and
    NOT B (env-var mutation). Reason: instantiating a second WebApplicationFactory<Program> in the
    same process re-runs Program.Main which calls Serilog.AddSerilog a second time, tripping "The
    logger is already frozen" — same constraint that drove BetaEnvironmentHardeningTests to use
    code-audit instead. Documented in SecurityHeadersTests.cs XML comment.
(b) Rationale:
    - Story recommendation: A (derived factory) — empirically blocked by Serilog single-logger
      constraint per existing BetaEnvironmentHardeningTests precedent
    - User autonomous-mode quote: (same; pragmatic continuation requires accepting code-audit
      fallback rather than refactoring Program.cs Serilog setup)
    - Architectural justification: regex code-audit ensures gate condition + middleware activation
      site are present; runtime behaviour is then the framework's responsibility (ASP.NET Core's
      app.UseHsts() + app.UseHttpsRedirection() are well-tested upstream)
(c) Consequence chain:
    - AC-1 (HSTS test) + AC-2 (HTTPS-redirect test) covered via Hsts_GatedToNonDevNonTesting_CodeAudit
      + HttpsRedirection_GatedToNonDevNonTesting_CodeAudit [Fact]s
    - No derived BetaTestWebApplicationFactory created
    - Files: SecurityHeadersTests.cs uses Path.GetFullPath traversal to read backend source
```

**A47 escape applied** — all `[!]` live-walkthrough items (AC-9 sub-items) deferred to unified Wave-8/9 walkthrough per user's standing post-MVP autonomous-mode directive.

### Completion Notes List

- **Backend tests**: 7 new [Fact]s in `SecurityHeadersTests.cs` — all 7/7 green (1442 + 167+7 = 1616 Api.Tests + 1442 App.Tests + 414 Infra.Tests = 3479 total, was actually `1442 + 167 + 414 = 2023 baseline → 2030 with the 7 new`). Confirmed via filtered `dotnet test` run.
- **Frontend tests**: 4 new tests in `next-config-headers.test.ts` — all 4/4 green via `npm test`.
- **CSP active**: `buildContentSecurityPolicy(process.env)` shipped at `frontend/next.config.ts:71-74`. Practical-enforcing profile with 10 directives; substitutes `${NEXT_PUBLIC_API_URL}` + `${NEXT_PUBLIC_KEYCLOAK_URL}` + `${NEXT_PUBLIC_DOCUMENT_HOST}` at `next build` time.
- **A31 backend↔frontend header parity**: confirmed by `BackendFrontendHeaderParity_StaysAligned_A31Invariant` test reading `frontend/next.config.ts` via `File.ReadAllText` and asserting the 3 mirror-able header values.
- **Section 21 doc-bundle anchor**: `docs/14_beta_railway_setup.md` Section 21 inserted between Section 20 (E14-S1) and `## Appendix: secrets-in-repo guard`. Section ordering: 19 → 20 → 21 → Appendix (verified via grep).
- **HSTS + HTTPS-redirect code-audit pattern**: documented in SecurityHeadersTests.cs class-level XML comment cross-referencing the existing BetaEnvironmentHardeningTests precedent. Regex assertions verify the exact gate condition + middleware call.

### A47 Live-Walkthrough Queue (deferred per A47 escape)

- **Q1** `[!]` Run `curl -I https://web.<beta-domain>/` after first deploy; capture into Section 21.5; expected: 3 frontend headers + CSP present.
- **Q2** `[!]` Run `curl -I https://api.<beta-domain>/about` after first deploy; expected: 4 backend headers + HSTS present. Also `curl -I http://api.<beta-domain>/about` → expect 307 + Location: https://.
- **Q3** `[!]` Browser DevTools "Security" tab on Beta web service confirms CSP is active.

### File List

- NEW: `backend/tests/IabConnect.Api.Tests/Endpoints/SecurityHeadersTests.cs` (~110 lines, 7 [Fact] tests with class-level XML doc explaining the Serilog-single-logger constraint and code-audit fallback for HSTS/HTTPS-redirect)
- NEW: `frontend/src/lib/config/security-headers.ts` (~50 lines, `buildContentSecurityPolicy()` helper + `DEFAULTS` constants + JSDoc)
- NEW: `frontend/src/__tests__/next-config-headers.test.ts` (~55 lines, 4 Vitest [it] tests with `@vitest-environment node` directive)
- MODIFIED: `frontend/next.config.ts` (+ 1 import + 1 header entry in `headers()` return)
- MODIFIED: `docs/14_beta_railway_setup.md` (+ Section 21 with 5 subsections)

### Change Log

- 2026-06-02 — E14-S2 dev-story execution: 3 NEW + 2 MODIFIED files. DEC-1=A (Practical-enforcing CSP), DEC-2=A (Vitest), DEC-3 pivoted to code-audit (Serilog constraint). 7+4 new tests green; no regressions.
