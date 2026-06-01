# Story 15.1: Verify two-Postgres separation in Beta

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

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

- [ ] **Task 0 — SPIKE: confirm E13 done + Beta deploy green** (AC-1..AC-11)
  - [ ] 0.1 Verify all 4 E13 stories are status `done` in sprint-status.yaml.
  - [ ] 0.2 [!] Harry confirms the ~60 `[!] needs-human-verify` items from `docs/14_beta_railway_setup.md` are executed and the Section 10.4 browser smoke is green (login round-trip works; `/health/detail` reports `database: Healthy` + `keycloak: Healthy`). Without this, Tasks 1-7 cannot run.
  - [ ] 0.3 Verify Railway CLI is installed locally and authenticated to the `iab-connect-beta` project: `railway whoami` returns the maintainer's email; `railway environment` shows the Beta environment as current.
  - [ ] 0.4 Read [ADR-012](../planning-artifacts/architecture.md#adr-012-service-topology-on-railway) (`postgres-app` + `postgres-kc` rationale) and the canonical Keycloak 26 schema inventory (~80 tables under realm management).
  - [ ] 0.5 Spike output: `Confirmed prerequisites + ADR-012 understood → proceed` OR `Blocker: Beta not green / Railway CLI not auth'd → escalate`.

- [ ] **Task 1 — Verify two distinct Railway services exist** (AC-1)
  - [ ] 1.1 `railway service list --json | jq '.[] | {name, plugin}'` from project root with the Beta environment selected. Expect `postgres-app` and `postgres-kc` both with `plugin: "PostgreSQL"`.
  - [ ] 1.2 Verify PostgreSQL major version on each: `railway run --service postgres-app psql -c 'SELECT version();'` and the same for `postgres-kc`. Expect both return `PostgreSQL 17.x`.
  - [ ] 1.3 Capture the output in the Quality-Gates evidence column.

- [ ] **Task 2 — Verify distinct auto-generated credentials** (AC-2, AC-7)
  - [ ] 2.1 Capture each service's PG vars: `railway variables --service postgres-app --json` and the same for `postgres-kc`. Extract `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `RAILWAY_PRIVATE_DOMAIN`.
  - [ ] 2.2 Diff `PGUSER`: must be unequal. Diff `PGPASSWORD`: must be unequal. Diff `PGDATABASE`: typically both `railway` (Railway default) — acceptable since the credential is the discriminator. Diff `RAILWAY_PRIVATE_DOMAIN`: must equal `postgres-app.railway.internal` for the first and `postgres-kc.railway.internal` for the second.
  - [ ] 2.3 **Important**: redact the captured Sealed values before pasting into the Quality-Gates table or doc — record only that the values differ (e.g., "PGUSER-app=`u_<16-hash-chars>` vs PGUSER-kc=`u_<different-16-hash-chars>`, distinct; PGPASSWORD-app + PGPASSWORD-kc are byte-distinct random 32-char Sealed values").

- [ ] **Task 3 — Verify application connection string targets `postgres-app.railway.internal`** (AC-3)
  - [ ] 3.1 `railway variables --service api --json | jq '.ConnectionStrings__DefaultConnection'`. Expect the resolved string contains `Host=postgres-app.railway.internal` (NOT the unresolved `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` syntax — Railway resolves at variable-read time).
  - [ ] 3.2 `railway logs --service api --tail 200` and grep for the Npgsql connection success line: typical pattern is `Npgsql.NpgsqlConnection ... Opening connection` followed by `Connection opened`. Expect this within ~5 seconds of the most recent deploy.
  - [ ] 3.3 If the log shows `connection refused` OR `host not found` OR `password authentication failed`, E13-S2's `ConnectionStrings__DefaultConnection` reference is wrong — escalate to a doc patch + redeploy before continuing.

- [ ] **Task 4 — Verify Keycloak connection string targets `postgres-kc.railway.internal`** (AC-4)
  - [ ] 4.1 `railway variables --service keycloak --json | jq '.KC_DB_URL'`. Expect the resolved JDBC URL `jdbc:postgresql://postgres-kc.railway.internal:5432/railway` (or whatever `PGDATABASE` resolved to).
  - [ ] 4.2 `railway logs --service keycloak --tail 200` and grep for both `KC-SERVICES0009` (admin user creation) AND `Keycloak ... started in` (boot completion). Both within the first ~30 seconds of deploy.
  - [ ] 4.3 If `keycloak` logs `Failed to obtain JDBC connection`, the env vars from E13-S1 Section 3.4 + E13-S2 Section 5.3 drift — escalate.

- [ ] **Task 5 — Verify schema isolation on `postgres-app`** (AC-5)
  - [ ] 5.1 `railway run --service postgres-app psql -c '\dt'` from a shell with the postgres-app service vars injected.
  - [ ] 5.2 Capture the table list. Expected: application tables matching the EF Core migration set — `Members`, `Events`, `EmailCampaigns`, `EmailTemplates`, `EmailRecipients`, `AuditLogs`, `__EFMigrationsHistory`, `Documents`, `Invoices`, plus any other migration-produced tables.
  - [ ] 5.3 **Negative check**: grep the captured table list for Keycloak tables — `USER_ENTITY`, `REALM`, `CLIENT`, `RESOURCE_SERVER`, `KEYCLOAK_ROLE`, `COMPONENT`, `MIGRATION_MODEL`, `RESOURCE_ATTRIBUTE`, `SCOPE_MAPPING`. Expect **zero matches**. If any Keycloak table is present in `postgres-app`, the two-Postgres separation is broken at the schema layer — critical defect.

- [ ] **Task 6 — Verify schema isolation on `postgres-kc`** (AC-6)
  - [ ] 6.1 `railway run --service postgres-kc psql -c '\dt'`.
  - [ ] 6.2 Capture the table list. Expected: ~80 Keycloak 26 internal tables — the full canonical schema as imported by `kc.sh start --optimized` against an empty PG.
  - [ ] 6.3 **Negative check**: grep the captured table list for application tables (`Members`, `Events`, `EmailCampaigns`, `EmailTemplates`, `Invoices`). Expect **zero matches**. If any application table is present in `postgres-kc`, escalate.

- [ ] **Task 7 — Cross-credential rejection (the real migration-blast-radius proof)** (AC-7)
  - [ ] 7.1 Run from an authenticated Railway shell with the api service vars injected:
    ```sh
    railway run --service api bash -c '
      # Try to use api's connection-string credentials against postgres-kc's host.
      # PGPASSWORD here is the api's resolved password from ConnectionStrings__DefaultConnection.
      PGPASSWORD="$(echo "$ConnectionStrings__DefaultConnection" | sed -n "s/.*Password=\([^;]*\).*/\1/p")"
      PGUSER="$(echo "$ConnectionStrings__DefaultConnection" | sed -n "s/.*Username=\([^;]*\).*/\1/p")"
      psql -h postgres-kc.railway.internal -p 5432 -U "$PGUSER" -d railway -w -c "SELECT 1;"
    '
    ```
    Expect output: `psql: error: connection to server ... failed: FATAL: password authentication failed for user "<api-PGUSER>"`.
  - [ ] 7.2 Reverse direction — keycloak credentials against postgres-app:
    ```sh
    railway run --service keycloak bash -c '
      KC_USER="$KC_DB_USERNAME"
      KC_PASS="$KC_DB_PASSWORD"
      PGPASSWORD="$KC_PASS" psql -h postgres-app.railway.internal -p 5432 -U "$KC_USER" -d railway -w -c "SELECT 1;"
    '
    ```
    Same expected error.
  - [ ] 7.3 Both rejections together establish the cross-credential isolation invariant. Capture both error strings (redacting the actual PGUSER values to `<api-PGUSER>` / `<kc-PGUSER>` placeholders) in the Quality-Gates table.

- [ ] **Task 8 — Re-assert datastore networking is private** (AC-8)
  - [ ] 8.1 From a workstation outside Railway: `dig +short postgres-app.railway.internal` and `dig +short postgres-kc.railway.internal`. Both expected to return empty AND non-zero exit code (matches doc Section 8.3 expected behavior).
  - [ ] 8.2 `railway service show postgres-app --json | jq '.serviceInstances[0].domains'` — expect empty / null. Same for `postgres-kc`.
  - [ ] 8.3 Document the verification at story-close. This is a re-assertion of E13-S3 AC-2 + AC-3, not a new verification, but it closes the audit loop.

- [ ] **Task 9 — Update `docs/14_beta_railway_setup.md` with Section 14** (AC-9)
  - [ ] 9.1 Append a new top-level section after current Section 13 (Reference tables):
    ```markdown
    ## 14. Two-Postgres separation verification (E15-S1)

    > Story alignment: **E15-S1** — REQ-088 AC-3. Validates the ADR-012 migration-blast-radius
    > isolation invariant against the live Beta project. Re-run whenever a PG credential rotates
    > or whenever either Postgres service is rebuilt (e.g., after a Railway-side schema reset).

    ### 14.1 Service inventory
    [populate after Task 1 — railway service list output redacted to service names + plugin]

    ### 14.2 Credential distinctness
    [populate after Task 2 — placeholder shape, NEVER real values]

    ### 14.3 Connection-string targets
    [populate after Task 3 + 4 — show the resolved hostname portions only, redact credentials]

    ### 14.4 Schema isolation
    [populate after Task 5 + 6 — table-count summary + negative-check confirmation]

    ### 14.5 Cross-credential rejection
    [populate after Task 7 — both expected-error strings with redacted PGUSER]

    ### 14.6 Private-networking re-assertion
    [populate after Task 8 — `dig` output + Railway dashboard state]
    ```
  - [ ] 9.2 Populate Sections 14.1–14.6 with the captured (redacted) outputs from Tasks 1-8.
  - [ ] 9.3 Update the Table of Contents at the top of the doc to include Section 14.
  - [ ] 9.4 Apply A42 — fresh-eyes re-read pass for: cross-section consistency (Section 14's service names match Section 13.2 canonical list), no leaked credential material in the populated outputs, no scope-leak into operator-facing content.

- [ ] **Task 10 — Cross-story orthogonal-AC verification** (AC-10, per A31)
  - [ ] 10.1 Connection-string parity (3 anchors): `api.ConnectionStrings__DefaultConnection` runtime ≡ doc Section 5.1 row ≡ ADR-012 graphic. Same triad for `keycloak.KC_DB_URL`. Diff and document.
  - [ ] 10.2 Credential-distinctness invariant: capture the diff between postgres-app's `PGPASSWORD` and postgres-kc's `PGPASSWORD` length + first-N-hash chars (NOT the actual values). Re-runnable check.
  - [ ] 10.3 Networking parity (re-assertion of E13-S3 AC-2): both datastores Public Domain OFF + TCP Proxy OFF — matches doc Section 8.2 state.

- [ ] **Task 11 — Secrets-in-repo guard** (AC-11)
  - [ ] 11.1 `git grep -inE 'PGPASSWORD\s*=|password authentication failed' -- 'docs/*' '_bmad-output/*' ':(exclude)*.md'` — expect zero hits for real-looking PG passwords. Documented expected-error strings ARE allowed (they're public Postgres error format, not credentials).
  - [ ] 11.2 Audit the populated Sections 14.1-14.6 — only redacted placeholders for credentials; only hostname / table-count / error-string content for verifiable claims.

- [ ] **Task 12 — Quality-Gates Closing Check (per A29)**
  - [ ] 12.1 Complete the Quality-Gates table at the bottom of this file with one row per AC sub-item: `covered` / `[!] needs-human-verify` / `N/A`. Aggregate claims are NOT acceptable.

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
| 1 | `postgres-app` exists as Railway managed PostgreSQL service | | |
| 1 | `postgres-kc` exists as Railway managed PostgreSQL service | | |
| 1 | Both report PostgreSQL major version 17 | | |
| 2 | `PGUSER` differs across services | | |
| 2 | `PGPASSWORD` differs across services (byte-distinct random) | | |
| 2 | `RAILWAY_PRIVATE_DOMAIN` resolves to expected hostname per service | | |
| 3 | `api.ConnectionStrings__DefaultConnection` contains `postgres-app.railway.internal` | | |
| 3 | `api` deploy log shows successful Npgsql connection | | |
| 4 | `keycloak.KC_DB_URL` contains `postgres-kc.railway.internal` | | |
| 4 | `keycloak` deploy log shows `KC-SERVICES0009` + `started in` | | |
| 5 | `postgres-app` `\dt` shows application tables only | | |
| 5 | `postgres-app` `\dt` negative-check: zero Keycloak tables | | |
| 6 | `postgres-kc` `\dt` shows Keycloak schema (~80 tables) | | |
| 6 | `postgres-kc` `\dt` negative-check: zero application tables | | |
| 7 | api credentials → postgres-kc → `password authentication failed` | | |
| 7 | keycloak credentials → postgres-app → `password authentication failed` | | |
| 8 | `dig +short postgres-app.railway.internal` from outside Railway: empty + non-zero exit | | |
| 8 | `dig +short postgres-kc.railway.internal` from outside Railway: empty + non-zero exit | | |
| 8 | Neither Postgres has Public Domain or TCP Proxy enabled | | |
| 9 | docs/14_beta_railway_setup.md Section 14 appended with 6 subsections populated | | |
| 9 | Section 14 TOC entry added | | |
| 10 | Connection-string parity 3-anchor verified for both api and keycloak | | |
| 10 | Credential-distinctness invariant documented as re-runnable | | |
| 10 | Networking parity re-asserted (E13-S3 AC-2) | | |
| 11 | `git grep` for PGPASSWORD / password-auth-failed returns no real-credential leaks | | |
| 11 | Section 14 redactions verified — placeholders only | | |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Railway CLI authentication scope.** Harry's local `railway` CLI must be authenticated to the `iab-connect-beta` project AND have read-scope on PG service variables (Railway CLI exposes Sealed values to the deploying user; if Harry's account differs from the project owner, scope may be insufficient). Resolve at Task 0.3.
- **Q2 — PGDATABASE name collision.** Railway's managed PostgreSQL template defaults `PGDATABASE=railway` for every instance. Both `postgres-app` and `postgres-kc` will likely have `PGDATABASE=railway`. This is acceptable per AC-2 (the credential is the discriminator) but should be noted in Section 14.2 so a reader doesn't assume database-name distinctness.
- **Q3 — Keycloak schema table count drift.** Keycloak 26.5.2 imports ~80 tables on first realm-import boot. Exact count may differ slightly across Keycloak patch versions (26.5.0 vs 26.5.2 vs 26.5.5). AC-6 says "~80 tables" not an exact number — the verifiable claim is "Keycloak's canonical schema present, zero application tables". Confirm at Task 6.2.
- **Q4 — Cross-credential rejection test side-effects.** Task 7's failed `psql` attempts will generate audit-log entries on the target Postgres (Postgres logs failed-authn). This is intentional + useful for E14-S5 (audit logs audit), but if the audit-log volume is rate-sensitive, capture timestamps so the failed attempts can be correlated and explained. Defer to E14-S5 if it scopes audit-log review.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

### Completion Notes List

### File List

- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — EDIT (append Section 14 "Two-Postgres separation verification" + 6 subsections + TOC entry; AC-9).
- No source code changes (verification + documentation only; per A28 spike confirms read-only operations against live Railway PG services).
