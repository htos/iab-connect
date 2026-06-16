# Story 16.1: Verify frontend public URLs

Status: review

## Refresh Notes (2026-06-02, post-E15-close — Wave-8 opener bulk pass)

This story file was a 19-line stub from 2026-05-15. Authored to a dev-ready story 2026-06-02 as part of the **A34 bulk create-story pass for the entire Epic-16** (alongside e16-s2 and e16-s3, all three in one session), in line with the user-declared post-MVP stance (`alle stories nacheinander ohne stop ... wichtig es handelt sich nicht mehr um einen mvp`). The author pass surfaced the following deltas vs. the original stub + the SCP-2026-05-15 §5 text:

- **The epics-and-stories.md AC text says `.next/static/`, but the actual chunks live under `.next/static/chunks/` AND additionally under `.next/standalone/.next/static/chunks/`** because the E12-S2 Dockerfile uses `output: "standalone"` per [frontend/next.config.ts:16](../../frontend/next.config.ts#L16). The runtime image carries the standalone shape, and `next/server.js` reads from `.next/static/`. Grep targets in this story refer to the in-image filesystem after build, not the host `.next/`.
- **Five (not three) `NEXT_PUBLIC_*` build-args are REQUIRED**, enforced by the fail-fast guard at [frontend/Dockerfile:76-81](../../frontend/Dockerfile#L76-L81): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, `NEXT_PUBLIC_KEYCLOAK_ISSUER`. Four others are optional with defaults (`NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`, `NEXT_PUBLIC_FEEDBACK_URL`).
- **GHA repo variables drive the bake.** [.github/workflows/build-images.yml](../../.github/workflows/build-images.yml) reads `NEXT_PUBLIC_API_URL_BETA`, `NEXT_PUBLIC_KEYCLOAK_URL_BETA`, etc., as the source of build-args for the `:beta` tag. The verification surface for this story is *that the GHA repo variables match the live Railway deploy*.
- **Keycloak realm-import redirect URIs use placeholders, not the literal Railway domain.** [infra/keycloak/realms-beta/iabconnect-realm.json:256-263](../../infra/keycloak/realms-beta/iabconnect-realm.json#L256-L263) declares `redirectUris` = `["${IABCONNECT_BETA_HOST}/*", "${FRONTEND_PUBLIC_URL}/*"]` and `webOrigins` = `["${IABCONNECT_BETA_HOST}", "${FRONTEND_PUBLIC_URL}"]`. The verification is that the Keycloak service has the substitution env vars set such that the runtime client config materializes the live `web` Railway domain.
- **A38 doc-bundle continues.** Sections 14 (E15-S1) + 15 (E15-S3) + 16 (E15-S4) are already in `docs/14_beta_railway_setup.md`. This story adds **Section 17 — "Frontend public URLs: bake verification + redirect-URI verification (E16-S1)"** inserted between Section 16 and the Appendix.
- **A31 cross-story orthogonal parity invariants** (these are the cross-cutting dimensions this story closes for the Beta surface):
  1. **5-anchor `NEXT_PUBLIC_API_URL` parity** — `frontend/.env.example:19` (placeholder) ≡ GHA repo variable `NEXT_PUBLIC_API_URL_BETA` ≡ `frontend/Dockerfile:49` ARG ≡ baked chunk content in published `:beta` image ≡ backend `Frontend__BaseUrl` Railway env on the `api` service (the **inverse** — the CORS strict-allowlist origin must equal the `web` Railway public domain that the `web` image's bake points back to).
  2. **3-anchor `NEXT_PUBLIC_KEYCLOAK_ISSUER` parity** (this story; deeper runtime verification in E16-S2) — `frontend/.env.example:51` ≡ GHA repo variable `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` ≡ baked chunk content. Lives parallel to the realm-issuer triangle in [docs Section 6.3](../../docs/14_beta_railway_setup.md#63-the-keycloak_issuer-parity-invariant).
  3. **2-anchor `iabconnect-frontend` Keycloak redirect URIs** — realm-import placeholder + materialized client config on the deployed Keycloak. The materialized config is read via the Keycloak Admin Console (live) or via `kcadm.sh get clients` (CLI).
  4. **localhost-absence invariant** — the published `:beta` image's baked chunks contain `https://<web>.up.railway.app` / `https://<api>.up.railway.app` etc. and contain **no occurrence** of `localhost:` in the OIDC / API / image-host triple (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_KEYCLOAK_URL/ISSUER, NEXT_PUBLIC_DOCUMENT_HOST).

## Story

As **the maintainer of the Beta Railway deployment**,
I want **a deterministic, re-runnable procedure that proves the published `web:beta` container image bakes the correct Beta-deployment URLs (API, Keycloak, document storage, env-label) into its static client bundle AND that the Keycloak realm's `iabconnect-frontend` client redirect URIs materialize to the deployed `web` Railway domain**,
so that **the browser-side OIDC discovery, API call, password-reset deep-link, and document thumbnail rendering all hit Beta endpoints (not `localhost`) on first browser smoke, and the Keycloak login round-trip is approved at the realm level rather than rejected with `Invalid parameter: redirect_uri` (the #1 silent-failure mode for a misconfigured frontend OIDC client)**.

**Requirement:** REQ-088 AC-7 (Beta Deployment Readiness — frontend image carries correct Beta public URLs). Epic E16 (Frontend ↔ Backend Integration on Railway), Story 1 of 3 — **Wave-8 opener**. ADR-015 (Configuration and Environment Strategy) is the architecture anchor.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**

- **E13 (Railway Beta Deployment) done** — `web` + `api` + `keycloak` services exist on Railway with public domains; Section 4 GHA repo variables populated. ✅ confirmed in sprint-status 2026-06-01.
- **E20-S5 (GHCR publishing) done** — `ghcr.io/htos/iabc-web:beta` is published with the build-args from the GHA repo variables. ✅ confirmed.
- **E12-S2 (Frontend Dockerfile) done** — multi-stage standalone image with the 9 NEXT_PUBLIC_* ARG/ENV bridge and the fail-fast guard. ✅ confirmed.
- **Beta deploy GREEN** — the first end-to-end deploy per [docs/14_beta_railway_setup.md Section 10](../../docs/14_beta_railway_setup.md#10-first-end-to-end-deploy) has run successfully; `web` is reachable at its assigned public hostname. **`[!]` needs-human-verify by Harry before Task 0.2 proceeds** (cannot be executed from the dev-agent sandbox).

**Downstream:**

- **E16-S2 (end-to-end OIDC in Beta)** — consumes the verified `NEXT_PUBLIC_KEYCLOAK_*` parity established here; turns the static bake parity into a live login round-trip.
- **E16-S3 (document upload/download against RustFS)** — consumes the verified `NEXT_PUBLIC_DOCUMENT_HOST` parity; turns the static bake parity into `next/image` thumbnail rendering.
- **E17-S4 (external uptime monitoring)** — once URLs are confirmed correct, the `/health/ready` poll target on the `api` service is the verified Railway domain.

**Wave context:** Wave-8 opener. **NO source-code artifacts**; **two new tests** (one purely static, one shelling out to `docker run --entrypoint cat`); **one doc section** (Section 17 in `docs/14_beta_railway_setup.md`). The "code" deliverable is operator-facing documentation + a parity test that catches GHA-variable drift at CI time.

## Acceptance Criteria

**AC-1** [REQ-088 AC-7 / ADR-015]: The published `ghcr.io/htos/iabc-web:beta` image's standalone-mode static chunks contain the live Beta `api` Railway domain as a baked literal (i.e. `https://<api>.up.railway.app` or whatever value `NEXT_PUBLIC_API_URL_BETA` GHA repo variable holds, verbatim) in **at least one** of `.next/static/chunks/*.js` files OR `.next/standalone/.next/static/chunks/*.js` files. Verification command:

```sh
docker pull ghcr.io/htos/iabc-web:beta
CID=$(docker create ghcr.io/htos/iabc-web:beta)
docker cp "$CID:/app/.next/static" /tmp/iabc-web-static
docker rm "$CID" >/dev/null
grep -rl "$(gh variable get NEXT_PUBLIC_API_URL_BETA --json name,value --jq .value)" /tmp/iabc-web-static
```

**AC-2** [REQ-088 AC-7 / ADR-015]: The same image's baked chunks contain **zero** occurrence of the literal substring `localhost:` across the entire `.next/static/` tree. (Beta-image localhost-baking would mean a missing GHA repo variable at build time. The fail-fast guard at [Dockerfile:76-81](../../frontend/Dockerfile#L76-L81) catches the 5 required vars, but the 4 optional vars — `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_SOURCE_URL`, `NEXT_PUBLIC_FEEDBACK_URL` — silently fall back to their Dockerfile defaults, and `NEXT_PUBLIC_DOCUMENT_HOST` defaults to `localhost:9000` per [Dockerfile:55](../../frontend/Dockerfile#L55) — which would bake `localhost:9000` into the next/image config and break thumbnail rendering on Beta. This AC catches that.)

**AC-3** [REQ-088 AC-7 / ADR-015]: The same image's baked chunks contain the live Beta `keycloak` Railway domain in at least one `.next/static/chunks/*.js` file (proving `NEXT_PUBLIC_KEYCLOAK_URL_BETA` + `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` GHA variables were present at build time and reached `next build`).

**AC-4** [REQ-088 AC-7 / ADR-015]: The same image's baked chunks contain the **active `NEXT_PUBLIC_ENV_LABEL`** literal `"beta"` (case as-built, currently `beta`) in at least one chunk; this is the BetaBanner activation signal per [BetaBanner.tsx:48-54](../../frontend/src/components/navigation/BetaBanner.tsx#L48-L54). Image-side verification (browser smoke is E16-S2 + the BetaBanner already has component tests via [BetaBanner.test.tsx](../../frontend/src/components/navigation/BetaBanner.test.tsx)).

**AC-5** [REQ-088 AC-7 / ADR-015]: A new automated test asserts the contract that `frontend/Dockerfile` declares every `NEXT_PUBLIC_*` var as **BOTH** `ARG <name>` AND `ENV <name>=$<name>` (the bridge that makes `process.env.NEXT_PUBLIC_*` reach `next build`). Test reads the Dockerfile content and asserts the bridge for all 9 listed NEXT_PUBLIC_*. This prevents a future Dockerfile edit from dropping the ENV bridge silently (which produces a successful build with empty strings inlined into the static bundle — the symptom appears only on first browser smoke).

**AC-6** [REQ-088 AC-7 / ADR-015]: The deployed Keycloak service's runtime `iabconnect-frontend` client redirect URIs contain `https://<web>.up.railway.app/*` (the live Beta `web` Railway public domain) — verified via Keycloak Admin Console **OR** `kcadm.sh get clients/iabconnect-frontend -r iabconnect --fields redirectUris,webOrigins`. `[!]` needs-human-verify on live Beta (the dev-agent cannot reach a deployed Keycloak Admin Console interactively).

**AC-7** [REQ-088 AC-7 / ADR-015]: The Keycloak service has both substitution env vars set: `IABCONNECT_BETA_HOST` (equal to `https://<web>.up.railway.app`) AND `FRONTEND_PUBLIC_URL` (equal to the same). Verified via Railway dashboard for the `keycloak` service. `[!]` needs-human-verify on live Beta.

**AC-8** [A31 cross-story orthogonal — 5-anchor `NEXT_PUBLIC_API_URL` parity]: All five anchors agree on a single live value of the `api` Railway public domain:
1. `frontend/.env.example:19` — placeholder pattern (`http://localhost:5000` in repo; documentation, not source of truth);
2. GHA repo variable `NEXT_PUBLIC_API_URL_BETA` — set in GitHub Repo → Settings → Secrets and variables → Actions;
3. `frontend/Dockerfile:49` `ARG NEXT_PUBLIC_API_URL` (no default — strict);
4. The build-args passed to `docker buildx build` in `.github/workflows/build-images.yml` for the `:beta` tag;
5. The grep result from AC-1 (in-image baked literal).
6. **Inverse anchor**: backend `api` service Railway env var `Frontend__BaseUrl` is set to the live `web` Railway public domain (NOT api domain) — this is the CORS strict-allowlist origin per [DependencyInjection.cs:106-132](../../backend/src/IabConnect.Api/DependencyInjection.cs#L106-L132).
   The verification produces a per-anchor table; the test of AC-5 + a `[!]` step that Harry pastes the live values produces the comparison.

**AC-9** [A29 / A42 — operator-facing doc deliverable]: A new **Section 17** of [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) is added between Section 16 ("First Beta-Admin seeding (E15-S4)") and the Appendix, containing 5 subsections:
- 17.1 **Goal + commitments** — what this verification proves + what it does not (no live OIDC round-trip — that's E16-S2; no document upload — that's E16-S3).
- 17.2 **Prerequisites** — Beta deploy GREEN + `gh` CLI authed + `docker` available locally.
- 17.3 **Image-side bake verification** — the `docker pull` + `docker cp` + `grep` procedure for AC-1..AC-5. Includes the actual GHA repo variable names + the expected grep results.
- 17.4 **Keycloak redirect-URI verification** — the Admin-Console UI path + the `kcadm.sh` CLI alternative for AC-6 + AC-7.
- 17.5 **5-anchor parity table** — operator copy/pastes the 5 anchor values; a documented mismatch resolution procedure (which one is the source of truth: GHA repo variable wins for the *image*, Railway service var wins for the *runtime*).

**AC-10** [A42 reread-as-a-stranger pass]: Section 17 passes the 6-category reread audit (cross-section contradictions, pre-filled placeholders left empty for operator fill, stale anchors, imprecise claims, no sprint-tracking leakage, documented-binary reachability — see A45 — verify `docker`, `gh`, `kcadm.sh` are operator-provided locally rather than baked into the api image).

**AC-11** [test suite + quality gates]: `cd frontend && npm test` green; if AC-5 / AC-8 add a backend test surface (e.g., to assert that `Frontend__BaseUrl` is non-empty when `ASPNETCORE_ENVIRONMENT=Beta`), `cd backend && dotnet test` green. The test count baseline post-E15-close is 2010 (backend) + 135 (frontend); this story's new tests bring the totals to ≥2010 (backend untouched expected) + ≥135 (frontend +1..2 expected).

## Tasks / Subtasks

**Task 0 — Spike (A28: spike-first for "low-risk verification" specs)**

- [!] **0.1** Confirm Beta deploy is GREEN — manual `[!]` Harry must paste here the current `web` + `api` + `keycloak` public Railway domain triple. Without these, Tasks 1-7 cannot resolve. **Deferred-pending-beta-green per autonomous-mode directive 2026-06-02.**
- [!] **0.2** Confirm `gh auth status` is authed against `htos/iab-connect`. The `gh variable get NEXT_PUBLIC_API_URL_BETA --json value --jq .value` command must return a non-empty string. **Deferred-pending-beta-green.**
- [!] **0.3** Confirm `docker pull ghcr.io/htos/iabc-web:beta` succeeds. **Deferred-pending-beta-green.**
- [x] **0.4** Spike output: "Image-side bake + Keycloak realm verification are live-Beta-only — defer to end-of-epic Harry session. Static deliverables (Vitest ARG/ENV bridge test + Section 17 doc skeleton with operator-paste-blanks) implementable now → proceed."

**Task 1 — Image-side bake verification (AC-1, AC-2, AC-3, AC-4)**

- [!] **1.1-1.6** All grep + `docker cp` steps require a running `:beta` image extraction. **Deferred-pending-beta-green.** Section 17.3 of the doc carries the operator-runnable commands + paste-blanks for each grep result.

**Task 2 — Dockerfile ARG/ENV bridge test (AC-5)** ✅

- [x] **2.1** Created `frontend/src/lib/config/dockerfile-public-vars.test.ts` (95 LOC). Reads `frontend/Dockerfile` via `node:fs.readFileSync` from `process.cwd()`. Parses 9 NEXT_PUBLIC_* names into two arrays (5 required + 4 optional). For each: asserts `ARG <name>(=.*)?` line AND `ENV <name>=$<name>` bridge. Two additional contract tests: (a) fail-fast guard contains all 5 required names; (b) fail-fast guard contains NONE of the 4 optional names (preserves dev/fork build ergonomics).
- [x] **2.2** Project Vitest convention check: `document-host.test.ts` precedent uses plain Vitest imports without `@testing-library/react cleanup` (the file does no `render()`). Followed precedent. Note: A35 requires `afterEach(cleanup)` only for tests that call `render()`; this file does not. **Refined A35 interpretation: cleanup is for Testing Library `render()`, not a blanket convention.**
- [x] **2.3** `npx vitest run src/lib/config/dockerfile-public-vars.test.ts` → 20 tests passed.
- [x] **2.4** `npm test` from `frontend/` → 157 tests passed across 21 files (baseline 137 + 20 new from this file).

**Task 3 — Keycloak realm redirect-URI verification (AC-6, AC-7)**

- [!] **3.1-3.4** All Admin-Console / Railway-dashboard steps require live Beta deploy. **Deferred-pending-beta-green.** Section 17.4 of the doc carries the operator procedure for both Path A (GUI) and Path B (kcadm.sh, local + in-container variants) + the substitution-env-var verification.

**Task 4 — Doc Section 17 authoring (AC-9, AC-10)** ✅

- [x] **4.1** Located the boundary between Section 16.7 (Anti-patterns + recovery, ending at the "locked out of admin realm role" paragraph at original line 1735) and the `## Appendix: secrets-in-repo guard` block (originally at line 1739). Section 17 inserted between them.
- [x] **4.2** Authored Section 17 with 5 subsections per A38 doc-bundle (17.1 Goal + commitments, 17.2 Prerequisites, 17.3 Image-side bake verification, 17.4 Keycloak realm redirect-URI verification, 17.5 5-anchor parity table). Story-alignment quote at top mirrors Sections 14-16. Forward cross-link to Section 18 + 19 (E16-S2/S3, landing in subsequent stories of this epic); backward cross-links to Section 6.1, 6.3, 8.4, 8.5.
- [x] **4.3** Extended [Section 13.3 Cross-references](../../docs/14_beta_railway_setup.md#133-cross-references) with a new bullet pointing at Section 17 + E16-S1 story file. (The doc uses a bullet list, not a table — followed existing shape rather than introducing a new table format.)
- [x] **4.4** Extended the Table of Contents at lines 25-43 with the Section 17 entry (anchor `#17-frontend-public-urls-bake--redirect-uri-verification-e16-s1`). The doc's ToC is a numbered Markdown list, NOT a numbered section called "Section 25" — the prior story file's claim was a naming slip; the ToC is at line 25 of the doc.
- [x] **4.5** A42 reread-as-a-stranger pass (6 categories):
  - [x] Cross-section contradictions: Section 6.1 ("build-time baked") + Section 6.3 (issuer parity) + Section 8.5 (CORS) + Section 17 read sequentially; no contradictions on baking semantics, issuer anchor count, or CORS allowlist direction.
  - [x] Pre-filled placeholders: 17.3 grep result blocks (×5) all blank with `<operator fills>`; 17.4 Path A redirect-URI paste block + Path B JSON paste + substitution-env-var paste all blank; 17.5 5-anchor table rows 2 + 4 + 5 + 6 all blank.
  - [x] Stale file:line anchors: `frontend/Dockerfile:49` (ARG block start) — verified against current 127-line Dockerfile; `frontend/Dockerfile:55` (NEXT_PUBLIC_DOCUMENT_HOST default) verified; `DependencyInjection.cs:106-132` (CORS strict-allowlist branch) — anchor preserved as documented in [Section 8.5](../../docs/14_beta_railway_setup.md#85-cors-allowlist-verification-beta-strict-allowlist-branch).
  - [x] Imprecise claims: "5-anchor parity" + 1 inverse anchor → table has 6 rows; "9 NEXT_PUBLIC_*" → enumerated; "5 required" + "4 optional" → enumerated; no "approximately" / "about" language.
  - [x] Sprint-tracking leakage: zero "this story" / "E16-S1 task" / "Harry" / "dev-agent" prose in 17.1-17.5; only the story-alignment header quote (which matches the convention used by Sections 14-16) carries the E16-S1 attribution.
  - [x] Documented-binary-surface reachability (A45): 17.2 Prerequisites explicitly names `docker`, `gh`, `grep`, `kcadm.sh` as operator-side; `kcadm.sh` carries the in-container path `/opt/keycloak/bin/kcadm.sh` as the always-available fallback (Keycloak 26.x ships kcadm.sh in `/opt/keycloak/bin/` per the official image layout). Windows operator caveat: `findstr` is NOT substitutable for `grep -r` — documented explicitly.

**Task 5 — Run full test suite (AC-11)** ✅

- [x] **5.1** `cd frontend && npm test` → 157/157 green (baseline 137 + 20 new from Task 2).
- [x] **5.2** `cd frontend && npm run typecheck` → exit 0, no errors.
- [x] **5.3** `cd frontend && npm run lint` → 2 baseline errors + 1 warning at `frontend/src/app/members/segments/page.tsx` (pre-existing per project-context, last documented at E20 close 2026-06-01); 0 new from this story.
- [x] **5.4** `cd backend && dotnet build -c Debug` → Build succeeded, 0 Warning(s), 0 Error(s), Time Elapsed 00:00:13.83.
- [x] **5.5** `cd backend && dotnet test` — **Deferred to E16-S3 close** because (a) E16-S1 made zero backend file changes (verified by `git status`), so regression is impossible at the source level; (b) E16-S3 adds 7 new backend tests that re-baseline the count to 2020, at which point the suite runs once and exercises everything. The hybrid skip is consistent with the workflow's "Run all existing tests to ensure no regressions" intent — the regression surface is empty.

**Task 6 — Quality-Gates Closing Check (A29)** ✅

- [x] **6.1** Quality-Gates table below filled. 6 rows `covered` + 6 rows `deferred-pending-beta-green` (the live-walkthrough rows).
- [x] **6.2** Human-verify queue surfaced in Dev Agent Record → Completion Notes below with explicit verification commands operator runs.

## Dev Notes

### Architecture-context references

- **ADR-015 (Configuration and Environment Strategy)** — `NEXT_PUBLIC_*` is build-time-constant. Any URL change requires a rebuild. The Beta-target verification is *that the build-time bake matches the live Railway runtime*.
- **Section 5.2** — `web` service Railway runtime envs (lives at the operator-facing doc; this story's verification is build-time + Keycloak-realm-side).
- **Section 6.1 + 6.2** — build-time vs runtime classification. All 9 NEXT_PUBLIC_* are build-time-baked into the image, regardless of whether they're set as Railway service env vars (Railway env vars on the `web` service do nothing for NEXT_PUBLIC_* — they're already baked).
- **Section 6.3** — KEYCLOAK_ISSUER parity invariant (5-anchor). This story closes the bake-time half (anchors 1-3); E16-S2 closes the runtime half (anchors 4-5 — live login).
- **Section 8.5** — CORS allowlist verification. Adjacent to this story but distinct: CORS is enforced at `api` runtime against `Frontend__BaseUrl`; this story verifies the inverse — that the `web` image bakes the right `api` URL. Both must agree on the same Railway-domain triple.

### Project-context rules that apply

- **A28 (spike-first):** Task 0 captures the live Railway-domain triple before any subsequent step runs.
- **A29 (AC-subitem completion check):** the Quality-Gates Closing Check table below has one row per AC sub-item.
- **A30 (three-state checkbox):** `[!]` markers for Harry's manual browser/Railway-dashboard verification steps; `[x]` for dev-agent automatable.
- **A31 (cross-story orthogonal-AC inventory):** AC-8 explicitly enumerates the 5-anchor + inverse-anchor parity.
- **A34 (bulk spec-refresh at epic start):** this story was authored alongside e16-s2 + e16-s3 in one front-loaded session.
- **A38 (doc-bundle pattern):** Section 17 extends [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) rather than creating a new doc.
- **A40 (verify shell-command syntax):** `kcadm.sh get clients/iabconnect-frontend -r iabconnect --fields redirectUris,webOrigins` syntax verified against [Keycloak 26.x kcadm reference](https://www.keycloak.org/docs/26.0.0/server_admin/#_kcadm-cli). Alternative path: Admin Console GUI is the falsifiable path for non-CLI operators.
- **A42 (reread-as-a-stranger pass for docs)** + **A45 (documented-binary-surface reachability)**: Task 4.5 explicitly checks both.

### LLM-Dev-Agent guardrails

- This story is **verification + documentation + 1 test**, NOT new feature code. The Vitest test in Task 2 is a parity guard against future Dockerfile drift, not feature behavior.
- The `[!]` Harry-only tasks (Task 0.1, 0.3 partially, 3.1-3.4) are gates the dev-agent surfaces but cannot execute. The dev-agent should produce the doc + the test + the procedure; Harry's pasted-in evidence closes the live verification.
- Do not introduce backend code changes. The CORS allowlist (`Frontend__BaseUrl`) is already enforced and covered by existing tests — this story's AC-8 inverse-anchor row is observational, not modifying.
- Do not create a separate `frontend/scripts/verify-bake.sh` — the operator-facing verification commands live in Section 17.3 of the doc, not as a checked-in script. (Scripts proliferate; doc-anchored commands age better.)

### Code-reuse opportunities

- The Vitest test in Task 2 should pattern-match [frontend/src/lib/config/document-host.test.ts](../../frontend/src/lib/config/document-host.test.ts) for file-read setup (uses `node:fs` `readFileSync`) and assertion style.
- The 9 `NEXT_PUBLIC_*` ARG/ENV pairs at [Dockerfile:49-66](../../frontend/Dockerfile#L49-L66) are the parsing target — keep the regex tight (`^ARG NEXT_PUBLIC_\w+(=.*)?$` + `^ENV NEXT_PUBLIC_\w+=\$NEXT_PUBLIC_\w+`).

### Pitfalls to avoid

- **`.next/static/` vs `.next/standalone/.next/static/`**: the published image carries BOTH locations because `output: "standalone"` flattens the build but the static chunks are duplicated for the Next.js standalone runtime. Grep both paths or use a broad `grep -r "$pattern" /tmp/iabc-web-static`.
- **`gh variable get` returns JSON when invoked with `--json`** — make sure to use `--jq .value` to extract the bare string for the grep target.
- **kcadm.sh authenticates per session** — if running from a local install, run `kcadm.sh config credentials --server https://<keycloak>.up.railway.app --realm master --user <admin>` first. If running from inside the keycloak container via `railway shell -s keycloak`, kcadm uses the bootstrap admin context.
- **Empty-string baking**: if a NEXT_PUBLIC_* is set to `""` in GHA repo variables (instead of being unset), the fail-fast guard at Dockerfile:76-81 does NOT trigger because `test -n "$VAR"` treats `""` as empty BUT the variable IS set. Both result in empty-string bake. Section 17.3 should call this out.

### Cross-Story Orthogonal-AC Inventory (per A31)

| Dimension | E16-S1 closes | Other stories | Verification anchor |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` 5-anchor parity | AC-1, AC-8 | n/a (this is the closure story) | Section 17.5 table + AC-1 grep |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER` 3-anchor (bake) | AC-3 | E16-S2 turns into live `iss`-claim check | Section 17.3 grep |
| `iabconnect-frontend` realm redirect URIs | AC-6, AC-7 | E16-S2 verifies redirect lands at NextAuth callback | Section 17.4 Admin Console |
| localhost-absence in `:beta` image | AC-2 | E16-S3 verifies `NEXT_PUBLIC_DOCUMENT_HOST` non-`localhost` end-to-end | Section 17.3 grep |
| Dockerfile ARG/ENV bridge | AC-5 | E12-S2 introduced; this story regression-guards | dockerfile-public-vars.test.ts |
| `Frontend__BaseUrl` inverse-CORS parity | AC-8 row 6 | E16-S2 verifies CORS preflight passes for live origin | Railway dashboard + DependencyInjection.cs anchor |

## Quality-Gates Closing Check (A29)

| # | AC sub-item | Status | Evidence anchor |
|---|---|---|---|
| 1 | AC-1: `:beta` image bakes live api domain | **deferred-pending-beta-green** `[!]` | Section 17.3 grep command + operator-fills block; image not yet published from a GREEN Beta deploy |
| 2 | AC-2: zero `localhost:` in `:beta` chunks | **deferred-pending-beta-green** `[!]` | Same |
| 3 | AC-3: `:beta` image bakes live keycloak domain | **deferred-pending-beta-green** `[!]` | Same |
| 4 | AC-4: `NEXT_PUBLIC_ENV_LABEL=beta` baked | **deferred-pending-beta-green** `[!]` | Same |
| 5 | AC-5: Dockerfile ARG/ENV bridge for 9 NEXT_PUBLIC_* | **covered** | [`frontend/src/lib/config/dockerfile-public-vars.test.ts`](../../frontend/src/lib/config/dockerfile-public-vars.test.ts) — 20/20 green; Vitest output: `Test Files 1 passed (1), Tests 20 passed (20)` |
| 6 | AC-6: realm redirect URIs match live web | **deferred-pending-beta-green** `[!]` | Section 17.4 Path A/B procedures pre-staged |
| 7 | AC-7: keycloak service has both substitution env vars | **deferred-pending-beta-green** `[!]` | Section 17.4 substitution-env-var paste block pre-staged |
| 8 | AC-8: 5-anchor parity (+ inverse) table populated | **deferred-pending-beta-green** `[!]` | Section 17.5 6-row table pre-staged with paste-blanks |
| 9 | AC-9: Section 17 authored (5 subsections + cross-refs) | **covered** | [docs/14_beta_railway_setup.md §17](../../docs/14_beta_railway_setup.md#17-frontend-public-urls-bake--redirect-uri-verification-e16-s1) — 5 subsections + Section 13.3 bullet added + ToC entry added |
| 10 | AC-10: A42 reread audit 6 categories | **covered** | Task 4.5 checklist above, all 6 categories `[x]` |
| 11 | AC-11: frontend test count ≥136 | **covered** | `npm test` → 157/157 (baseline 137 + 20 new); `npm run typecheck` → 0 errors; `npm run lint` → 2 baseline errors at `members/segments/page.tsx` unchanged, 0 new |
| 12 | AC-11: backend test count stable (no regression) | **covered (via build verification)** | Zero backend file changes from this story (`git status`); `dotnet build -c Debug` → 0 warnings 0 errors; full `dotnet test` run executes once at E16-S3 close when 7 new backend tests land — the count re-baselines to 2020 then. |

Story `Status: review` per autonomous-mode directive. The 6 `deferred-pending-beta-green` rows are surfaced in the Dev Agent Record → Completion Notes "Human-verify queue" block below.

## Test Plan

- **New tests:** 1 frontend Vitest test at `frontend/src/lib/config/dockerfile-public-vars.test.ts` (~95 LOC, 20 sub-tests).
- **Existing tests must still pass:**
  - `cd frontend && npm test` (baseline 137 → 157 actual, +20 new).
  - `cd backend && dotnet test` (baseline 2010 → 2010 expected; full run deferred to E16-S3 close — zero backend changes in this story make regression impossible).
- **Manual verification deferred:** 11 `[!]` items in Tasks 0, 1, 3 (live-Beta-only); listed in Dev Agent Record → Human-verify queue.

## Dev Agent Record

### Debug Log References

**(a)/(b)/(c) Autonomous-mode resolution per A41 / A43**

- **(a) Option chosen** — Implement all 3 E16 stories serially in autonomous mode without DEC-Needed surface; all live-walkthrough ACs flip from `covered` to `deferred-pending-beta-green` in the Quality-Gates closing table; static deliverables (Vitest tests, doc Section 17 skeleton with operator-paste-blanks) land as `covered`. Story `Status: review` at static-deliverable completion.
- **(b) Rationale** — Three concurrent justifications:
  1. **User autonomous-mode directive verbatim (2026-06-02)**: "do /bmad-dev-story for every story in the epic. do not stopp until every story in this epic is finished. once its done do the retro" + "es handelt sich nicht mehr um einen mvp" + (prior message) "i wont do the hard prerequisits yet. i will do everthing at the end once im finished with all epic. then i need your support."
  2. **Story recommendation alignment** — story file's Refresh Notes already flagged the Beta-GREEN prerequisite as a Task 0.1 `[!]` blocker; the story design anticipated this two-mode (static now / live-with-Harry later) split.
  3. **Downstream architectural justification** — every live-Beta verification step requires Harry's GitHub UI + Railway dashboard + Keycloak Admin Console access that the dev-agent cannot reach interactively per [project-context "LLM-Dev-Agent guardrails"](../../_bmad-output/project-context.md). Without the autonomous-mode escape clause, dev-story would stall at Task 0.1 for ~3-4 weeks (until Harry's end-of-epic-set live session).
- **(c) Consequence chain** — Quality-Gates rows 1-4 (image-bake AC-1..AC-4), 6-8 (realm/parity AC-6..AC-8) flip to `deferred-pending-beta-green`; rows 5 (Dockerfile ARG/ENV bridge), 9 (Section 17 doc), 10 (A42 reread), 11 (frontend tests + typecheck + lint), 12 (backend build) flip to `covered`. Story `Status: review` matches the static-deliverable definition of done; the deferred rows queue behind Harry's end-of-epic-set live-Beta session and produce the inline paste-blanks fills in Section 17.

**Implementation plan summary**

1. Implemented Task 2 (Vitest ARG/ENV bridge test) first — fast, deterministic, no external dependencies.
2. Authored Task 4 (Section 17) — operator-paste-blank pattern matching Sections 14-16 of the same doc.
3. Ran Task 5 quality gates (npm test + typecheck + lint + dotnet build) — all green except pre-existing baseline lint errors.
4. Filled Quality-Gates Closing Check with explicit covered / deferred per row.

### Completion Notes

**What landed (static deliverables):**

- **1 new test file** — `frontend/src/lib/config/dockerfile-public-vars.test.ts` (95 LOC, 20 sub-tests) regression-guards the `frontend/Dockerfile` ARG↔ENV bridge for all 9 NEXT_PUBLIC_* + the fail-fast guard's 5-name requirement + the optional-vars exclusion contract.
- **1 doc section** — `docs/14_beta_railway_setup.md` §17 (5 subsections) extended with: 17.1 Goal + commitments; 17.2 Prerequisites; 17.3 Image-side bake verification (5 grep procedures with operator-paste-blanks); 17.4 Keycloak realm redirect-URI verification (Path A Admin Console + Path B kcadm.sh local + in-container); 17.5 5-anchor parity table (6-row table with operator-paste-blanks).
- **2 doc-bundle housekeeping changes** — ToC entry at line 43; Section 13.3 Cross-references bullet added.

**Test deltas:**

- Frontend Vitest: 137 → 157 (+20 from `dockerfile-public-vars.test.ts`).
- Frontend typecheck: 0 errors.
- Frontend lint: 2 baseline errors + 1 baseline warning at `frontend/src/app/members/segments/page.tsx` (pre-existing per project-context E20-close note 2026-06-01); 0 new.
- Backend build: 0 warnings, 0 errors (no backend files touched).
- Backend tests: full run deferred to E16-S3 close (zero backend changes here makes the regression surface empty).

**Spec-vs-reality drift surfaced & corrected during implementation:**

- ToC at line 25 of `docs/14_beta_railway_setup.md` is a numbered Markdown list, NOT a numbered section "Section 25". The story file's Task 4.4 had a wording slip ("Table of Contents at Section 25") — corrected at implementation time.
- Section 13.3 Cross-references is a bullet list, NOT a table. Followed the existing shape rather than introducing a new format.
- A35 (`afterEach(cleanup)`) does NOT apply to tests that don't call Testing Library `render()`. The new test reads a file from disk and asserts string patterns; no DOM rendering, no cleanup needed. Refined-A35 interpretation recorded for future stories.

**Human-verify queue (deferred-pending-beta-green):**

These 11 `[!]` items execute together at the end-of-epic-set Harry session. Each line is the verification step + the command/UI path:

| # | Step | Command / UI path |
|---|---|---|
| Q1 | Beta deploy GREEN | Section 10 sign-off + `railway service list` for the `iab-connect-beta` project |
| Q2 | Verify `:beta` image bakes `api` Railway URL | Section 17.3 — `docker pull` + `grep -rl "$API_URL"` |
| Q3 | Verify `:beta` image has zero `localhost:` strings | Section 17.3 — `grep -r "localhost:" /tmp/iabc-web-static \| head` |
| Q4 | Verify `:beta` image bakes `keycloak` URL + issuer | Section 17.3 — two `grep -rl` commands |
| Q5 | Verify `:beta` image bakes `"beta"` env-label | Section 17.3 — `grep -rl '"beta"' /tmp/iabc-web-static` |
| Q6 | Verify `iabconnect-frontend` realm `redirectUris` lists live `web` URL | Section 17.4 Path A (Admin Console) — Clients → iabconnect-frontend → Settings |
| Q7 | Verify `iabconnect-frontend` realm `webOrigins` lists live `web` URL (no `/*`) | Same as Q6 |
| Q8 | Verify `keycloak` service has `IABCONNECT_BETA_HOST` AND `FRONTEND_PUBLIC_URL` env vars set | Railway dashboard → `keycloak` service → Variables |
| Q9 | 5-anchor parity table rows 2 + 4 + 5 + 6 filled and byte-identical | Section 17.5 |
| Q10 | Inverse anchor `Frontend__BaseUrl` on api service equals live web URL | Railway dashboard → `api` service → Variables |
| Q11 | (Optional) backend full test suite re-run for cross-check | `cd backend && dotnet test` — expect 2010 green |

### File List

**New files:**
- `frontend/src/lib/config/dockerfile-public-vars.test.ts` — Vitest contract test (95 LOC, 20 sub-tests).

**Modified files:**
- `docs/14_beta_railway_setup.md` — ToC entry added (line 43); Section 13.3 cross-references bullet added; Section 17 inserted (~190 lines) between Section 16.7 and the Appendix.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `epic-16` `backlog → in-progress`; `e16-s1-verify-frontend-public-urls` `backlog → ready-for-dev → in-progress → review`; `last_updated` field updated.
- `_bmad-output/implementation-artifacts/e16-s1-verify-frontend-public-urls.md` — Status updated; Tasks/Subtasks checkboxes filled; Quality-Gates table filled; Dev Agent Record + Completion Notes + File List + Change Log added; `Status: review`.

**Deleted files:** none.

### Change Log

| Date | Change | By |
|---|---|---|
| 2026-06-02 | Bulk-authored E16 stub (s1/s2/s3) per A34 in bmad-create-story session | dev-agent |
| 2026-06-02 | Implemented E16-S1 static deliverables (Vitest test + Section 17 doc); live-Beta ACs deferred per autonomous-mode A41 escape | dev-agent |

## References

- Source: [_bmad-output/planning-artifacts/epics-and-stories.md L1643-L1660](../../_bmad-output/planning-artifacts/epics-and-stories.md#L1643-L1660) (Story E16-S1).
- Source: [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md L565-L571](../../_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#L565-L571) (SCP §5 E16-S1 AC text).
- Architecture: [_bmad-output/planning-artifacts/architecture.md L329-L341](../../_bmad-output/planning-artifacts/architecture.md#L329-L341) (ADR-015).
- Sibling stories: [e16-s2-validate-end-to-end-oidc-in-beta.md](e16-s2-validate-end-to-end-oidc-in-beta.md), [e16-s3-validate-document-upload-against-rustfs.md](e16-s3-validate-document-upload-against-rustfs.md).
- Adjacent: [e15-s4-document-beta-seeding-strategy.md](e15-s4-document-beta-seeding-strategy.md) (previous story; Section 16 doc-bundle precedent).
- Project context: [_bmad-output/project-context.md](../../_bmad-output/project-context.md) (Story Authoring & Dev-Story Execution Rules A28-A45).
