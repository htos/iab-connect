# Story 15.1: Verify two-Postgres separation in Beta

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Refresh Notes (2026-06-01, post-E13-close)

This story file was authored 2026-05-15 (pre-E13) and refreshed 2026-06-01 as part of the **A34 bulk create-story pass for the entire Epic-15** (alongside e15-s2, e15-s3, e15-s4). The 2026-06-01 refresh validated:

- All `docs/14_beta_railway_setup.md` section anchors cited below are stable in the post-E13-close doc (commit `fc085e2`): Section 3.2 (two managed Postgres services), Section 3.4 (Keycloak JDBC seed), Section 5.1 (api service), Section 8.2 (private services), Section 8.3 (external reachability verification). The doc currently ends at Section 13 (Reference tables) followed by an Appendix (secrets-in-repo guard). Section 14 inserts **between** Section 13 and the Appendix — Appendix MUST remain the final section.
- Cross-story sequence with Epic-15 siblings: **Section 14** (this story) → **Section 15** (E15-S3 daily backup + restore) → **Section 16** (E15-S4 seeding strategy — A32 Decision-Needed surfaced in that story's Task 0; recommended Option A is the same doc, NOT a new RUNBOOK-beta.md). The three sections form a coherent "Beta validation & operations" cluster appended after Section 13.
- E13 is now `done` (sprint-status confirms; epic-13 status flipped to done 2026-06-01 per `epic-13-retro-2026-06-01.md`). The Task 0 `[!]` prerequisite (Beta deploy green) is therefore the only remaining external dependency.

No AC or Task numbering changed during refresh. The story remains 11 ACs + 12 Tasks.

## Story

As **the security operator**,
I want **the API and Keycloak to use distinct managed-Postgres instances on Railway with distinct auto-generated credentials, distinct schemas, and the documented migration-blast-radius isolation invariant verified end-to-end against the live Beta deployment**,
so that **a misbehaving EF Core migration on the application database cannot corrupt the Keycloak schema, a leaked App-DB credential cannot read Keycloak's user store, and ADR-012's "separated for ownership clarity and migration safety" promise is provably true rather than just architecturally intended**.

**Requirement:** REQ-088 AC-3 (Beta Deployment Readiness — two-Postgres topology). Epic E15 (Database, Persistence, and Migrations), Story 1 of 4 — the **opening story** of E15 and the **first Wave-7 deliverable**.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13 (Railway Beta Deployment) all stories `done`** — `postgres-app` and `postgres-kc` are documented in [docs/14_beta_railway_setup.md Section 3.2](../../docs/14_beta_railway_setup.md#32-the-two-managed-postgres-services-postgres-app-postgres-kc) but the actual Railway services + auto-generated credentials only exist after Harry executes the ~60 `[!] needs-human-verify` items from the E13 checklist. The verification this story performs (connection-string spot-check, schema inspection, credential distinctness) operates against **live Railway-internal services**, not against a hypothetical pre-deploy state.
- **Beta deploy is GREEN** — Section 10.4 browser smoke + `/health/detail` returning `database: Healthy` + `keycloak: Healthy` is the proof that both DBs are reachable from their consumers. Without this, Tasks 1-4 cannot run.

**Downstream:**
- **E15-S2** (Database__AutoMigrate toggle) — assumes the two-Postgres skeleton this story verifies. Wave 7.
- **E15-S3** (Daily backup to RustFS) — backs up `postgres-app` only (Keycloak's realm + clients are reproducible from `infra/keycloak/realms-beta/iabconnect-realm.json`); the backup pipeline depends on the connection-string contract this story confirms. Wave 7. **Note**: E15-S3 carries E13-FT-6 (PostgresBackupService `docker exec` refactor) as a Task 0 prerequisite.
- **E15-S4** (Beta seeding strategy) — the Admin-Console bootstrap path documented in [docs/14_beta_railway_setup.md Section 10.4 + Section 11.3](../../docs/14_beta_railway_setup.md#104-browser-smoke-mandatory--only-way-to-catch-corsissuercookie-domain-bugs) consumes `postgres-kc`; E15-S4 makes that path canonical for non-Harry testers. Wave 7.
- **E14** (security audit) — E14-S1 (secrets audit) verifies the auto-generated PG credentials don't leak; E14-S5 (audit logs for sensitive data) verifies migration logs don't leak schema state across the boundary.

**Wave context:** Wave 7 opener. **NO source-code artifacts**: this story is a verification + documentation update. The "code" deliverable is an appendix section in [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) that captures the verification commands and expected outputs, so a future operator (or fork's first deployer) can re-prove the invariant without rediscovering the procedure.

## Acceptance Criteria

1. **Two distinct Railway services exist** — `postgres-app` and `postgres-kc`, each provisioned via Railway's official PostgreSQL template (not a self-deployed `postgres:17` image). Verified by reading the Railway dashboard service list AND by `railway service list` from a CLI authenticated to the `iab-connect-beta` project. Both services report PostgreSQL major version 17.

2. **Distinct auto-generated credentials** — the `PGUSER` / `PGPASSWORD` / `PGDATABASE` variables on `postgres-app` are **byte-different** from those on `postgres-kc`. Verified by:
   - `PGUSER` values differ (Railway-managed PG generates per-service random usernames).
   - `PGPASSWORD` values differ (per-service random; never equal even by coincidence).
   - `PGDATABASE` values may differ (Railway generates `railway` as the database name by default for both — this is acceptable; the discriminator is the per-service credentials, not the database name).
   - Verification reads the resolved values from `railway variables --service postgres-app` and `railway variables --service postgres-kc` (Sealed values are visible to the deploying user via the CLI).

3. **Application connection string targets `postgres-app.railway.internal`** — verified by:
   - `railway variables --service api` shows `ConnectionStrings__DefaultConnection` containing the literal string `postgres-app.railway.internal` (resolved from the `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` reference per [docs/14_beta_railway_setup.md Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service)).
   - `api` deploy logs on boot include a successful Npgsql `Connection opened` line targeting `postgres-app.railway.internal:5432`.

4. **Keycloak connection string targets `postgres-kc.railway.internal`** — verified by:
   - `railway variables --service keycloak` shows `KC_DB_URL` containing the literal substring `postgres-kc.railway.internal` (resolved from `${{postgres-kc.RAILWAY_PRIVATE_DOMAIN}}` per [docs/14_beta_railway_setup.md Section 3.4](../../docs/14_beta_railway_setup.md#34-seed-the-keycloak-service-with-the-jdbc-env-block)).
   - `keycloak` deploy logs on boot include `KC-SERVICES0009` ("Added user 'admin' to realm 'master'") AND `Keycloak ... started in N.NNs` — the second proves the JDBC handshake against `postgres-kc` succeeded.

5. **Schema isolation — `postgres-app` holds the application schema only** — verified by `railway run --service postgres-app psql` then `\dt` reporting tables matching the application's EF Core migration set (`AspNetUsers`-style identity tables NOT present because the project uses Keycloak; presence of `Members`, `Events`, `EmailCampaigns`, `EmailTemplates`, `AuditLogs`, `__EFMigrationsHistory`, etc.). **NO Keycloak tables** (`USER_ENTITY`, `REALM`, `CLIENT`, `KEYCLOAK_ROLE`, etc.) present in `postgres-app`.

6. **Schema isolation — `postgres-kc` holds the Keycloak schema only** — verified by `railway run --service postgres-kc psql` then `\dt` reporting Keycloak's internal tables (canonical Keycloak 26 schema includes `USER_ENTITY`, `REALM`, `CLIENT`, `RESOURCE_SERVER`, `KEYCLOAK_ROLE`, `COMPONENT`, `MIGRATION_MODEL`, etc. — ~80 tables; full list captured in `\dt` output and attached to the story Quality-Gates table). **NO application tables** (`Members`, `Events`, etc.) present in `postgres-kc`.

7. **Cross-credential rejection — `postgres-app`'s credentials cannot authenticate against `postgres-kc`** — verified by:
   - `PGPASSWORD=<postgres-app's PGPASSWORD> railway run --service api psql -h postgres-kc.railway.internal -U <postgres-app's PGUSER> -d railway -c '\dt'` returns `FATAL: password authentication failed` (Postgres rejects the cross-service credential).
   - Reverse direction (postgres-kc creds vs postgres-app) also rejected.
   - This is the **practical verification of migration-blast-radius isolation**: a compromised application-DB credential cannot pivot to read Keycloak's user store.

8. **Datastore networking remains private (re-asserts E13-S3 AC-2 + AC-3)** — neither `postgres-app` nor `postgres-kc` has Public Domain enabled or TCP Proxy enabled. Verified by:
   - `railway service show postgres-app --json | jq '.networking'` reports no public hostname.
   - `dig +short <postgres-app-private-domain>` from outside Railway returns empty AND exit code != 0 (DNS resolution fails, matching the [docs/14_beta_railway_setup.md Section 8.3 negative test](../../docs/14_beta_railway_setup.md#83-external-reachability-verification-run-from-outside-railway)).
   - Same checks for `postgres-kc`.

9. **Documentation update** — [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) acquires a new section **"## 14. Two-Postgres separation verification (E15-S1)"** appended after Section 13 with:
   - The exact `railway` CLI + `psql` commands from Tasks 1-7 below.
   - Expected output snippets (`\dt` table counts, credential-distinctness `diff` output, cross-credential rejection error string).
   - A short rationale paragraph citing ADR-012 explaining **why** the verification matters (migration-blast-radius isolation; leaked-credential containment).
   - SPDX header line 1 already in place from E13-S1 — append-only edit, no header change.

10. **Cross-story orthogonal-AC verification** (per A31):
    - **Connection-string parity (3 anchors)**: `api.ConnectionStrings__DefaultConnection` runtime ≡ documented Section 5.1 row ≡ ADR-012 graphic (`api → postgres-app`). Same triad for `keycloak.KC_DB_URL` ≡ Section 3.4 row ≡ ADR-012 (`keycloak → postgres-kc`).
    - **Credential-distinctness invariant**: postgres-app `PGPASSWORD` ≠ postgres-kc `PGPASSWORD` (Railway auto-gens per-service; verify the inequality is preserved through any future rotation by re-running Task 3).
    - **Networking parity (re-assert E13-S3)**: both datastores' Public Domain OFF + TCP Proxy OFF matches [doc Section 8.2](../../docs/14_beta_railway_setup.md#82-private-services-public-domain-off-tcp-proxy-off) state.

11. **No secrets committed to the repo** in service of this story: the new doc Section 14 records the **commands** and **placeholder output shapes** ({PGUSER}, {PGPASSWORD-HASH}, "redacted-N-chars") — never the resolved PG passwords. Verified by `git grep -inE 'PGPASSWORD\s*=|password authentication' -- 'docs/*'` returning only the documented expected-error string + Sealed-placeholder annotations.

## Tasks / Subtasks

- [x] **Task 0 — SPIKE: confirm E13 done + Beta deploy green** (AC-1..AC-11)
  - [x] 0.1 Verified all 4 E13 stories are status `done` in sprint-status.yaml (e13-s1/s2/s3/s4 + epic-13 done; epic-13-retrospective done; confirmed via Read of sprint-status.yaml lines 590-595).
  - [!] 0.2 Harry confirms the ~60 `[!] needs-human-verify` items from `docs/14_beta_railway_setup.md` are executed and the Section 10.4 browser smoke is green. **Dev-agent cannot execute** — Railway dashboard interaction + browser smoke are non-scriptable. Tasks 1-8 below remain `[!]` pending Harry's live-Beta session.
  - [!] 0.3 Railway CLI authentication scope — dev-agent has no Railway CLI in this sandbox; verification deferred to Harry's session.
  - [x] 0.4 Read ADR-012 references in story file + the canonical Keycloak 26 schema inventory (~80 tables under realm management) — documented as expected-output shapes in Section 14.4.
  - [x] 0.5 Spike output: **`Sprint-status confirms E13 done; ADR-012 + Section 14 doc-skeleton structure understood. Tasks 1-8 require Harry's live-Railway session (CLI auth + dashboard read); doc Section 14 authored as runnable template under Task 9. Proceed with doc-skeleton authoring + queue Tasks 1-8 as [!] for Harry-verify.`**

- [!] **Task 1 — Verify two distinct Railway services exist** (AC-1) — _Harry-only: requires `railway service list` against live Beta project_
  - [!] 1.1 `railway service list --json | jq '.[] | {name, plugin}'` — dev-agent cannot reach Railway API; commands recorded verbatim in Section 14.1 for Harry's runnable use.
  - [!] 1.2 `railway run --service postgres-app psql -c 'SELECT version();'` + same for `postgres-kc` — recorded in Section 14.1.
  - [!] 1.3 Quality-Gates evidence column populated after Harry's run.

- [!] **Task 2 — Verify distinct auto-generated credentials** (AC-2, AC-7) — _Harry-only: requires `railway variables` against live Beta Postgres services_
  - [!] 2.1 `railway variables --service postgres-app/postgres-kc --json` — commands + redaction guidance recorded in Section 14.2.
  - [!] 2.2 PGUSER/PGPASSWORD/PGDATABASE/RAILWAY_PRIVATE_DOMAIN diff — populated after Harry's run.
  - [!] 2.3 Sealed-value redaction guidance documented in Section 14.2 prose ("paste only shape (length + hash prefix) — never the resolved values").

- [!] **Task 3 — Verify application connection string targets `postgres-app.railway.internal`** (AC-3) — _Harry-only: requires `railway variables --service api` + `railway logs --service api`_
  - [!] 3.1 `railway variables --service api --json | jq -r '.ConnectionStrings__DefaultConnection'` — recorded in Section 14.3.1.
  - [!] 3.2 `railway logs --service api --tail 200 | grep -E 'Npgsql|Connection opened|Database migrations'` — recorded in Section 14.3.1.
  - [!] 3.3 Failure-mode breadcrumbs (connection refused / host not found / password auth failed) documented in Section 14.3.1.

- [!] **Task 4 — Verify Keycloak connection string targets `postgres-kc.railway.internal`** (AC-4) — _Harry-only: requires `railway variables --service keycloak` + `railway logs --service keycloak`_
  - [!] 4.1 `railway variables --service keycloak --json | jq -r '.KC_DB_URL'` — recorded in Section 14.3.2.
  - [!] 4.2 `railway logs --service keycloak --tail 200 | grep -E 'KC-SERVICES000[19]|Keycloak.*started in'` — recorded in Section 14.3.2.
  - [!] 4.3 Failure-mode breadcrumb (Failed to obtain JDBC connection) documented in Section 14.3.2.

- [!] **Task 5 — Verify schema isolation on `postgres-app`** (AC-5) — _Harry-only: requires `railway run --service postgres-app psql`_
  - [!] 5.1 `railway run --service postgres-app psql -c '\dt'` — recorded in Section 14.4.1.
  - [!] 5.2 Expected application-table list (`Members`, `Events`, `EmailCampaigns`, ..., `__EFMigrationsHistory`) documented in Section 14.4.1.
  - [!] 5.3 Negative grep `grep -iE 'USER_ENTITY|REALM|CLIENT|...'` — recorded in Section 14.4.1; expected zero matches.

- [!] **Task 6 — Verify schema isolation on `postgres-kc`** (AC-6) — _Harry-only_
  - [!] 6.1 `railway run --service postgres-kc psql -c '\dt'` — recorded in Section 14.4.2.
  - [!] 6.2 Expected ~80 Keycloak tables (canonical 26.5.2 schema) — documented as expected-shape in Section 14.4.2.
  - [!] 6.3 Negative grep `grep -iE 'Members|Events|EmailCampaigns|...'` — recorded in Section 14.4.2; expected zero matches.

- [!] **Task 7 — Cross-credential rejection (the real migration-blast-radius proof)** (AC-7) — _Harry-only: requires `railway run --service api/keycloak bash -c`_
  - [!] 7.1 api → postgres-kc cross-credential probe — full shell snippet recorded in Section 14.5.1; expected `FATAL: password authentication failed for user "<api-PGUSER>"`.
  - [!] 7.2 keycloak → postgres-app reverse cross-credential probe — full shell snippet recorded in Section 14.5.2; expected same shape with swapped user/host.
  - [!] 7.3 Both rejection error strings populate Section 14.5 after Harry's run (redact PGUSER to `<api-PGUSER>` / `<kc-PGUSER>` placeholders).

- [!] **Task 8 — Re-assert datastore networking is private** (AC-8) — _Harry-only: requires external-network `dig` + `railway service show` against live project_
  - [!] 8.1 External `dig +short postgres-{app,kc}.railway.internal` — recorded in Section 14.6 (expected empty + non-zero exit code per Section 8.3 baseline).
  - [!] 8.2 `railway service show postgres-app/postgres-kc --json | jq '.serviceInstances[0].domains'` — recorded in Section 14.6.
  - [!] 8.3 Re-assertion of E13-S3 AC-2 + AC-3 documented in Section 14.6 prose; closes the audit loop.

- [x] **Task 9 — Update `docs/14_beta_railway_setup.md` with Section 14** (AC-9)
  - [x] 9.1 Section 14 inserted at correct position: between Section 13.3 (Cross-references) and the `Appendix: secrets-in-repo guard`. Appendix remains the final section (verified by file structure: Section 14 ends at line ~1306, Appendix begins at line ~1308). The 6 subsections (14.1 Service inventory, 14.2 Credential distinctness, 14.3 Connection-string targets [14.3.1 api → postgres-app, 14.3.2 keycloak → postgres-kc], 14.4 Schema isolation [14.4.1 postgres-app, 14.4.2 postgres-kc], 14.5 Cross-credential rejection [14.5.1 + 14.5.2], 14.6 Private-networking re-assertion) authored with runnable shell commands + expected-output shapes + redaction guidance.
  - [!] 9.2 Populated 14.1-14.6 with **runnable templates** (commands + expected-shape tables + failure-mode breadcrumbs); actual captured output from Tasks 1-8 will be appended by Harry's live-Beta session as a story-close follow-up.
  - [x] 9.3 Table of Contents at line ~38 of the doc gained `14. Two-Postgres separation verification (E15-S1)` entry pointing at `#14-two-postgres-separation-verification-e15-s1` anchor.
  - [x] 9.4 A42 fresh-eyes re-read pass: (1) Section 14 service names (`postgres-app`, `postgres-kc`) byte-match Section 13.2 canonical list; (2) zero leaked credential material in any of 14.1-14.6 (only placeholder shapes `u_<16-hash-chars>`, `<32-char-Sealed-random>`); (3) no sprint-tracking commentary in operator-facing prose (verified by reading every block); (4) every command is non-destructive (verified — no DROP, no DELETE, only SELECT/`\dt`/`dig`/probe-then-fail).

- [x] **Task 10 — Cross-story orthogonal-AC verification** (AC-10, per A31)
  - [!] 10.1 Connection-string parity 3-anchor — Section 14.3.1/14.3.2 documents the runtime-vs-Section-5.1 comparison shape; dev-agent verified the **doc anchor parity** by reading Section 5.1 line 415 (`Host=${{postgres-app.RAILWAY_PRIVATE_DOMAIN}};...`) and Section 14.3.1 expected resolved string — they describe the same string (one unresolved, one resolved). ADR-012 graphic citation in Section 14.1 + Section 14 prose closes the third anchor. Runtime-vs-doc inequality verification = [!] Harry-verify (requires live `railway variables --service api`).
  - [!] 10.2 Credential-distinctness invariant — re-runnable instructions documented in Section 14.2; actual diff = [!] Harry-verify.
  - [x] 10.3 Networking parity re-assertion documented in Section 14.6 prose; Section 8.2 baseline cited verbatim. Re-assertion is a documentation deliverable (this story's contribution is the cross-reference, not a new state-check) — `[x]` for doc work; `[!]` 10.3 sub-bullet for live `railway service show` is Harry-verify (queued under Task 8.2).

- [x] **Task 11 — Secrets-in-repo guard** (AC-11)
  - [x] 11.1 `git grep -inE 'PGPASSWORD\s*=|password authentication failed' -- 'docs/*' '_bmad-output/*' ':(exclude)*.md'` — dev-agent inspection of the populated Section 14 confirms only the expected Postgres-error-format literal `FATAL: password authentication failed for user "<...>"` appears (Section 14.5.1 + 14.5.2). The error-format text is public Postgres documentation, not credentials — allowed by AC-11. No real `PGPASSWORD=<value>` literal was authored anywhere.
  - [x] 11.2 Section 14.1-14.6 audit: all credential references use `<redacted>` placeholders, `u_<16-hash-chars>` / `<different-16-hash-chars>` / `<32-char-Sealed-random>` shape annotations; no Sealed values pasted. Verified by re-reading the populated section.

- [x] **Task 12 — Quality-Gates Closing Check (per A29)** — Quality-Gates table below populated with per-row status (`covered` / `[!] needs-human-verify` / `N/A`) per A29. Section 14 doc-skeleton work is `covered`; live-Railway verification (Tasks 1-8) is `[!] needs-human-verify`.

## Dev Notes

### Why this story exists separately from E13-S3

E13-S3 (networking) verified the **transport-layer** isolation: from outside Railway, `dig postgres-app.railway.internal` fails; the public hostname doesn't route. **This story verifies the data-layer isolation**: even from inside Railway with valid credentials for one DB, the other DB's user store / migration history / row data are unreachable. ADR-012 calls the latter "migration safety" — the verifiable promise that an EF Core migration in the application's bounded context cannot accidentally touch Keycloak's realm tables.

These are distinct security properties. E13-S3 covers attacker-from-internet; E15-S1 covers attacker-with-one-leaked-credential.

### Why the doc lives in `docs/14_beta_railway_setup.md` as Section 14 instead of a separate runbook

Per A38 (doc-bundle pattern, surfaced in E13 retro), the Beta deployment surface ships as a single coherent operator-facing document. The verification commands in this story are part of that surface — a fork's first deployer following the doc to set up Beta should be able to re-run Section 14 to prove the separation rather than discovering it as a separate runbook entry. The verification is **re-runnable** by design (after every PG credential rotation, after every Railway-side schema reset, after every infrastructure change that could break the invariant), so docs-bundle proximity helps.

The story's relationship to the canonical operator runbook (E18-S1) is: E18-S1 produces a higher-level incident-response runbook citing Section 14 as the "how do I prove the separation isn't broken?" reference.

### Why credentials are auto-generated by Railway, not specified

Railway managed Postgres generates per-service random `PGUSER` + `PGPASSWORD` at service-create time and exposes them as variables consumed by `${{<service>.PGUSER}}` references. This is intentional architecture (not an accident the maintainer should override):

- **Zero shared-credential risk** — no chance of accidentally copy-pasting one service's creds into the other's env var.
- **Rotation-friendly** — Railway exposes a "Reset Credentials" action per managed PG service; the auto-rotation cascades through `${{...}}` references on next-deploy of consumer services.
- **Audit-friendly** — `railway variables` per-service reveals the exact resolved values to the deployer; no manual record-keeping.

The story's AC-2 verifies the distinctness without prescribing the credential format (it's whatever Railway generates).

### Why the negative checks in Tasks 5 + 6 + 7 matter more than the positive checks

If `\dt` against `postgres-app` shows only application tables (Task 5 positive check), that's good — but it doesn't *prove* Keycloak tables aren't elsewhere in the same database (different schema?). The negative check (grep for `USER_ENTITY`, `REALM`, etc. AND finding zero hits across all schemas via `\dt *.*`) is the proof. Same for postgres-kc.

The cross-credential rejection in Task 7 is the highest-confidence check: even if both schemas were somehow visible to both services, the credential-level rejection makes the data unreachable across the boundary.

### Anti-patterns the dev-agent should avoid

- **Do NOT** run a destructive `DROP DATABASE` or `DROP SCHEMA` to "prove" the separation. The verification must be non-destructive — every check is read-only (`SELECT version()`, `\dt`, attempted-but-failing `psql -c 'SELECT 1'`).
- **Do NOT** paste resolved PG passwords into the populated Section 14 of the doc. Sealed values exist only in Railway + Harry's password manager; the doc records placeholders.
- **Do NOT** propose enabling TCP Proxy on either Postgres for "easier verification". E13-S3 §8.7 explicitly forbids this; the verification works via `railway run --service` shell tunneling without any exposure change.
- **Do NOT** scope-creep into E15-S2 (AutoMigrate toggle) or E15-S3 (daily backup). They have their own ACs; this story's scope is verification + documentation only.
- **DO** capture full `\dt` output as evidence in the Quality-Gates table (redacted of any sensitive content, but the table list itself is non-sensitive structural metadata).
- **DO** re-run Section 14's checks after any future PG credential rotation to keep the documented evidence current.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#adr-012-service-topology-on-railway] — service topology + migration-blast-radius rationale.
- [Source: _bmad-output/planning-artifacts/prd.md#L466-L472] — REQ-088 AC-3 (two-Postgres separation).
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1559-L1576] — Story E15-S1 source ACs.
- [Source: docs/14_beta_railway_setup.md#3-service-by-service-provisioning] — postgres-app + postgres-kc provisioning steps (E13-S1).
- [Source: docs/14_beta_railway_setup.md#34-seed-the-keycloak-service-with-the-jdbc-env-block] — `KC_DB_URL` referencing `postgres-kc.railway.internal`.
- [Source: docs/14_beta_railway_setup.md#51-api-service] — `ConnectionStrings__DefaultConnection` referencing `postgres-app.railway.internal`.
- [Source: docs/14_beta_railway_setup.md#82-private-services-public-domain-off-tcp-proxy-off] — networking-state baseline this story re-asserts.

## Quality Gates — Closing Check (A29)

Complete one row per AC sub-item at story-close. Status: `covered` · `[!] needs-human-verify` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | `postgres-app` exists as Railway managed PostgreSQL service | `[!] needs-human-verify` | Section 14.1 `railway service list` command runnable by Harry |
| 1 | `postgres-kc` exists as Railway managed PostgreSQL service | `[!] needs-human-verify` | Section 14.1 `railway service list` command runnable by Harry |
| 1 | Both report PostgreSQL major version 17 | `[!] needs-human-verify` | Section 14.1 `SELECT version()` probe |
| 2 | `PGUSER` differs across services | `[!] needs-human-verify` | Section 14.2 `railway variables` extraction + diff |
| 2 | `PGPASSWORD` differs across services (byte-distinct random) | `[!] needs-human-verify` | Section 14.2 diff (redacted output only) |
| 2 | `RAILWAY_PRIVATE_DOMAIN` resolves to expected hostname per service | `[!] needs-human-verify` | Section 14.2 invariant table column |
| 3 | `api.ConnectionStrings__DefaultConnection` contains `postgres-app.railway.internal` | `[!] needs-human-verify` | Section 14.3.1 `railway variables --service api` |
| 3 | `api` deploy log shows successful Npgsql connection | `[!] needs-human-verify` | Section 14.3.1 `railway logs --service api` grep |
| 4 | `keycloak.KC_DB_URL` contains `postgres-kc.railway.internal` | `[!] needs-human-verify` | Section 14.3.2 `railway variables --service keycloak` |
| 4 | `keycloak` deploy log shows `KC-SERVICES0009` + `started in` | `[!] needs-human-verify` | Section 14.3.2 `railway logs --service keycloak` grep |
| 5 | `postgres-app` `\dt` shows application tables only | `[!] needs-human-verify` | Section 14.4.1 `\dt` capture |
| 5 | `postgres-app` `\dt` negative-check: zero Keycloak tables | `[!] needs-human-verify` | Section 14.4.1 negative grep |
| 6 | `postgres-kc` `\dt` shows Keycloak schema (~80 tables) | `[!] needs-human-verify` | Section 14.4.2 `\dt` capture |
| 6 | `postgres-kc` `\dt` negative-check: zero application tables | `[!] needs-human-verify` | Section 14.4.2 negative grep |
| 7 | api credentials → postgres-kc → `password authentication failed` | `[!] needs-human-verify` | Section 14.5.1 cross-credential probe |
| 7 | keycloak credentials → postgres-app → `password authentication failed` | `[!] needs-human-verify` | Section 14.5.2 reverse cross-credential probe |
| 8 | `dig +short postgres-app.railway.internal` from outside Railway: empty + non-zero exit | `[!] needs-human-verify` | Section 14.6 external `dig` |
| 8 | `dig +short postgres-kc.railway.internal` from outside Railway: empty + non-zero exit | `[!] needs-human-verify` | Section 14.6 external `dig` |
| 8 | Neither Postgres has Public Domain or TCP Proxy enabled | `[!] needs-human-verify` | Section 14.6 `railway service show` JSON probe |
| 9 | docs/14_beta_railway_setup.md Section 14 appended with 6 subsections populated | `covered` (skeleton) / `[!]` (populated capture) | `docs/14_beta_railway_setup.md` Section 14 (skeleton authored end-to-end with runnable commands + expected-shape tables; live captures appended by Harry's session) |
| 9 | Section 14 TOC entry added | `covered` | `docs/14_beta_railway_setup.md` line ~38 TOC entry `14. Two-Postgres separation verification (E15-S1)` |
| 10 | Connection-string parity 3-anchor verified for both api and keycloak | `covered` (doc anchor parity) / `[!]` (runtime resolution) | Section 14.3.1 docs the api → postgres-app anchor; Section 14.3.2 keycloak → postgres-kc; ADR-012 citation in Section 14 intro |
| 10 | Credential-distinctness invariant documented as re-runnable | `covered` | Section 14.2 prose ("Re-run whenever a PG credential rotates...") + invariant table |
| 10 | Networking parity re-asserted (E13-S3 AC-2) | `covered` (doc) / `[!]` (live state) | Section 14.6 cites Section 8.2/8.3 as the baseline this section re-asserts |
| 11 | `git grep` for PGPASSWORD / password-auth-failed returns no real-credential leaks | `covered` | Dev-agent inspection of Section 14 — only the public Postgres error-format string appears, no `PGPASSWORD=<value>` literals authored |
| 11 | Section 14 redactions verified — placeholders only | `covered` | All credential references use `<redacted>` / `<32-char-Sealed-random>` / `u_<hash-chars>` shapes |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Railway CLI authentication scope.** Harry's local `railway` CLI must be authenticated to the `iab-connect-beta` project AND have read-scope on PG service variables (Railway CLI exposes Sealed values to the deploying user; if Harry's account differs from the project owner, scope may be insufficient). Resolve at Task 0.3.
- **Q2 — PGDATABASE name collision.** Railway's managed PostgreSQL template defaults `PGDATABASE=railway` for every instance. Both `postgres-app` and `postgres-kc` will likely have `PGDATABASE=railway`. This is acceptable per AC-2 (the credential is the discriminator) but should be noted in Section 14.2 so a reader doesn't assume database-name distinctness.
- **Q3 — Keycloak schema table count drift.** Keycloak 26.5.2 imports ~80 tables on first realm-import boot. Exact count may differ slightly across Keycloak patch versions (26.5.0 vs 26.5.2 vs 26.5.5). AC-6 says "~80 tables" not an exact number — the verifiable claim is "Keycloak's canonical schema present, zero application tables". Confirm at Task 6.2.
- **Q4 — Cross-credential rejection test side-effects.** Task 7's failed `psql` attempts will generate audit-log entries on the target Postgres (Postgres logs failed-authn). This is intentional + useful for E14-S5 (audit logs audit), but if the audit-log volume is rate-sensitive, capture timestamps so the failed attempts can be correlated and explained. Defer to E14-S5 if it scopes audit-log review.
- **Q5 — Coherence of Sections 14 + 15 + 16 as a cluster.** The 2026-06-01 bulk-refresh of Epic-15 designates Section 14 (this story), Section 15 (E15-S3), and Section 16 (E15-S4, IFF that story's A32 Decision resolves to Option A) as a contiguous "Beta validation & operations" block in `docs/14_beta_railway_setup.md`. If the dev-agent for this story discovers the cluster name should differ (e.g., Section 14 reads naturally as the start of a "Validation" sub-cluster while 15+16 are "Operations"), surface to the user before committing the Section 14 heading text. Default heading is `## 14. Two-Postgres separation verification (E15-S1)`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

**Autonomous-mode posture (A41 escape applied):** User issued explicit autonomous-mode directive at session start — verbatim quote: *"alle stories nacheinander ohne stop. erst ganz am schluss wird ein review und retro gemacht. wichtig es handelt sich nicht mehr um einen mvp"*. No Decision-Needed block surfaces in this story (only Q1-Q5 advisory questions answered inline). No `AskUserQuestion` invocation required.

**Story-vs-reality posture:** E15-S1 is a **verification + documentation** story whose Tasks 1-8 require live-Railway access (`railway service list`, `railway variables`, `railway run --service ... psql`, external `dig`). Dev-agent operates in a non-Railway-authenticated sandbox; therefore:

- Tasks 1-8 are marked `[!] needs-human-verify` per A30 convention and queued for Harry's live-Beta session.
- Task 9 (doc Section 14 authoring) is the dev-agent-shippable deliverable and is marked `[x]` with full skeleton authored — Section 14.1-14.6 contains runnable shell commands + expected-output shapes + redaction guidance + failure-mode breadcrumbs. Harry's session pastes the captured (redacted) outputs into the same subsections.
- Tasks 10.3 (networking parity doc re-assertion) + 11 (secrets-in-repo guard inspection of authored content) + 12 (Quality-Gates) are dev-agent-completable and marked `[x]`.

**Tasks 9.2 dual-state convention:** The doc skeleton is `[x]` (runnable template + expected shapes); the post-Harry-run population of actual captured outputs is `[!]`. This split satisfies AC-9 in its skeleton form and queues the live-evidence append as a single follow-up Harry-task.

### Completion Notes List

- **Section 14 authored** in `docs/14_beta_railway_setup.md` between Section 13.3 (Cross-references) and the existing Appendix. Appendix preserved as the final section. 6 subsections: 14.1 Service inventory, 14.2 Credential distinctness, 14.3 Connection-string targets (14.3.1 api → postgres-app + 14.3.2 keycloak → postgres-kc), 14.4 Schema isolation (14.4.1 + 14.4.2), 14.5 Cross-credential rejection (14.5.1 + 14.5.2), 14.6 Private-networking re-assertion.
- **TOC entry added** at the Table of Contents block (line ~38 of the doc) pointing at the new `#14-two-postgres-separation-verification-e15-s1` anchor.
- **Section 14 introduces a new "why this is separate from Section 8" framing block** clarifying transport-layer (Section 8 covered) vs. data-layer (Section 14 covers) isolation — addresses Q5 of the story file (the cluster-coherence question).
- **No source-code changes.** This story's deliverable is verification + documentation; per Dev Notes "Anti-patterns the dev-agent should avoid", all verification is non-destructive (no DROP, no DELETE, only SELECT/`\dt`/`dig`/probe-then-fail). Verified by re-reading every shell snippet in Section 14.
- **A42 fresh-eyes pass executed** on Section 14 before story-close. Findings: (1) Section 14 service names byte-match Section 13.2 canonical list; (2) zero credential material in any subsection (only shape placeholders); (3) no sprint-tracking commentary in operator prose; (4) every command non-destructive; (5) no stale anchors carried — all Section-N cross-references checked against the live doc.
- **Cross-story orthogonal-AC parity (A31):** Connection-string parity 3-anchor — Section 14.3.1/14.3.2 documents the api → postgres-app + keycloak → postgres-kc mappings; Section 5.1 (line 415) carries the resolvable reference; Section 14 intro cites ADR-012. Runtime-vs-doc inequality check = `[!]` Harry-verify. Credential-distinctness invariant documented as re-runnable in Section 14.2 prose. Networking parity re-assertion documented in Section 14.6 prose with Section 8.2/8.3 baseline citations.
- **No Beta Postgres credentials touched.** All references in Section 14 are command templates; no Sealed value was queried, captured, or pasted by the dev-agent in this story.

### File List

- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — EDIT
  - TOC block: added line "14. [Two-Postgres separation verification (E15-S1)](#14-two-postgres-separation-verification-e15-s1)"
  - New Section 14 inserted between Section 13.3 (Cross-references) and the Appendix; ~290 lines covering 6 subsections (14.1 Service inventory, 14.2 Credential distinctness, 14.3.1 api → postgres-app, 14.3.2 keycloak → postgres-kc, 14.4.1 postgres-app `\dt`, 14.4.2 postgres-kc `\dt`, 14.5.1 + 14.5.2 cross-credential rejection probes, 14.6 Private-networking re-assertion)
  - Appendix preserved as final section
- No source-code changes; no test changes; no Dockerfile or env.example changes.
- [_bmad-output/implementation-artifacts/sprint-status.yaml](../sprint-status.yaml) — EDIT (e15-s1 status flipped ready-for-dev → in-progress; will flip → review at story-close).

### Change Log

- 2026-06-02: E15-S1 dev-story executed. Section 14 authored as runnable doc-skeleton in `docs/14_beta_railway_setup.md`. Tasks 1-8 marked `[!] needs-human-verify` (live-Railway access required); Tasks 0, 9, 10.3, 11, 12 marked `[x]` (dev-agent shippable). Sprint-status: e15-s1 → review (skeleton ready; Harry populates evidence outputs in same subsections during live-Beta session).
