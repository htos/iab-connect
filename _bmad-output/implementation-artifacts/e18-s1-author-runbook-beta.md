# Story E18-S1: Author RUNBOOK-beta.md

Status: review

## Story

As **an on-call operator**, I want **a complete, incident-first Beta runbook (deploy, rollback, database restore, log access, and at least five incident playbooks)**, so that **a deploy, rollback, restore, or incident response can be executed under pressure without reading source code or reverse-engineering the provisioning walkthrough**.

**Requirement:** REQ-088 AC-10. Epic E18, Story 1. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E18 Story E18-S1 (lines 1791–1808)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E18 — Story E18-S1 (lines 625–630)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-014 Container Image Distribution — GHCR (lines 317–327)](../planning-artifacts/architecture.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-019 Backup Destination — Same RustFS (lines 376–384)](../planning-artifacts/architecture.md)
- [docs/14_beta_railway_setup.md (the existing 1900+ line provisioning walkthrough this RUNBOOK cross-links)](../../docs/14_beta_railway_setup.md)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-18)

This story was authored from the 19-line 2026-05-15 stub against post-Epic-17 reality. Findings:

- **`RUNBOOK-beta.md` genuinely does not exist yet** — a repo grep for `RUNBOOK` returns only forward-references (docs/14 calls it a "future E18-S1 deliverable"; architecture.md:270 names it; e15-s4 + e17-s4 stories point at it). This is **real net-new authoring**, not a verification story (contrast E18-S3 below).
- **Target path is `_bmad-output/implementation-artifacts/RUNBOOK-beta.md`** per the SCP (line 134 + line 629) and the epics file (line 1799) — NOT `docs/`. The earlier E15-S4 DEC-1 weighed `docs/14 Section 16` vs. a new `docs/RUNBOOK-beta.md`; it resolved to Option A (put seeding content in docs/14 §16 and **cross-link** from the future RUNBOOK). This story honours that: the RUNBOOK is the operator-facing incident-response index that **cross-links** docs/14's detailed procedures, it does not duplicate them.
- **Almost every procedure this RUNBOOK references already exists in [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md)** (deploy §10, rollback §11.4, restore §15.5, health probes §9, first-admin §16, secret rotation §7, Keycloak recovery §11.2, log access §25 from E17-S1). The A38 doc-bundle precedent says: write the operator index **once**, point its evidence at the existing section anchors, never re-paste the commands (re-pasting creates N drift surfaces). The RUNBOOK adds the **incident-response layer** docs/14 lacks: Symptoms / Diagnose / Fix / Verify playbooks an operator can run top-to-bottom during an outage.
- **A38 doc-bundle anchor:** this RUNBOOK is the shared artifact for THREE stories. E19-S1 (custom-domain migration) and E19-S3 (NFR production-gate checklist) both append sections to it (epics lines 660 + 672). Per A38, E18-S1 writes the **complete skeleton now** including explicitly-marked stub sections (`## 8. Custom-domain migration (E19-S1)` / `## 9. Production-gate NFR checklist (E19-S3)`) so those stories point their evidence here without renumbering.
- **A40 shell-command verification:** the RUNBOOK prescribes `railway` CLI, `pg_restore`, and `kc.sh bootstrap-admin user` — tools the dev-agent does not exercise in-session. docs/14 §11.2 + §15.5 already carry the **corrected** forms (the Keycloak 26 `bootstrap-admin user --password:env` subcommand fix from E13-S4's A40 patch; the `pg_restore --clean --if-exists` invocation). The RUNBOOK MUST reuse those verbatim by cross-link, and any command NOT already in docs/14 gets an explicit `[!] verify against <tool> docs before executing` marker.
- **A45 documented-binary reachability:** the restore playbook invokes `pg_restore`/`pg_dump`; [backend/Dockerfile:51–73](../../backend/Dockerfile) installs `postgresql-client-17` in the runtime image, so these are reachable inside `railway shell --service api`. The decrypt step uses the C# `BackupEncryption` helper (NOT OpenSSL) — the RUNBOOK must say so, because the image does not ship an `openssl enc -aes-256-gcm` equivalent for the GCM nonce/tag framing used by [PostgresBackupService](../../backend/src/IabConnect.Infrastructure/Backup).
- **A42 reread-as-a-stranger** is mandatory at story close (documentation deliverable).

## Acceptance Criteria

1. **AC-1 (file exists at the spec'd path).** [`_bmad-output/implementation-artifacts/RUNBOOK-beta.md`](./RUNBOOK-beta.md) exists and opens with a one-paragraph "How to use this runbook" preface plus a clickable table of contents.
2. **AC-2 (deployment section).** A `## Deploy` section documents the routine Beta deploy: push to `beta` → GHA `build-images.yml` rebuilds the three images → Railway pulls the new `:beta` digest → three image services redeploy. Cross-links [docs/14 §10 First end-to-end deploy](../../docs/14_beta_railway_setup.md) rather than re-pasting the pre-flight checklist. Names the `:beta` moving tag vs. `:sha-<commit>` immutable tag distinction.
3. **AC-3 (rollback section).** A `## Rollback` section documents redeploying the previous good `:sha-<commit>` immutable tag (Railway dashboard → service → Settings → Source → edit image to `ghcr.io/htos/iabc-<service>:sha-<previous-commit>` → Redeploy). States explicitly that the `:beta` moving tag is overwritten every push and is **not** a rollback target, and that the running commit is cross-checkable at the API `/about` endpoint (E20-S3). Consistent with [ADR-014](../planning-artifacts/architecture.md) + [docs/14 §11.4](../../docs/14_beta_railway_setup.md).
4. **AC-4 (database restore section).** A `## Database restore` section documents restoring an encrypted daily backup: locate the `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` object on RustFS → decrypt via the C# `BackupEncryption` helper (NOT OpenSSL — note the AES-256-GCM `[12-byte nonce][16-byte tag][ciphertext]` framing) → gunzip → `pg_restore --clean --if-exists` into a throwaway target → validate row counts before cutting traffic. Cross-links [docs/14 §15 Daily PostgreSQL backup + restore](../../docs/14_beta_railway_setup.md). States the [ADR-019](../planning-artifacts/architecture.md) single-RustFS blast-radius caveat (a Railway-volume loss takes down primary docs AND backups — accepted Beta risk) and the encryption-key-archival requirement.
5. **AC-5 (log access section).** A `## Logs` section documents accessing Beta logs: Railway dashboard service Logs tab (streamed, CorrelationId-enriched) and `railway logs --service <name>`. States that Serilog is Console-only in containers per E17-S1 + [ADR-017](../planning-artifacts/architecture.md), there is no file sink to `tail`, and long-term aggregation (Seq/Loki) is out of Beta scope. Cross-links docs/14 §25 (E17-S1) + §26 (E17-S2 CorrelationId).
6. **AC-6 (≥5 incident playbooks, Symptoms/Diagnose/Fix/Verify).** A `## Incident playbooks` section contains **at least five** incidents, each with the exact four-part structure **Symptoms → Diagnose → Fix → Verify**. The five mandatory incidents (drawn from documented failure modes — see Dev Notes incident table):
   - **(a)** Keycloak won't go healthy (crash-loop) — incl. the `kc.sh bootstrap-admin user --password:env` master-realm recovery per [docs/14 §11.2](../../docs/14_beta_railway_setup.md).
   - **(b)** API won't go healthy (Keycloak/DB health-check failing) — incl. the five-anchor `Keycloak__Authority` parity invariant per docs/14 §6.3.
   - **(c)** Login fails with `Invalid parameter: redirect_uri` — incl. the `IABCONNECT_BETA_HOST` scheme requirement per docs/14 §5.3.
   - **(d)** Database connection refused / migration failure on boot — incl. the `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` reference checks per docs/14 §14.3.1.
   - **(e)** Document upload fails / RustFS unreachable — incl. the `rustfs.railway.internal:9000` endpoint check per docs/14 §8.4.
   Each incident's Fix either cross-links a docs/14 section OR carries an `[!] verify before executing` marker if it prescribes a command not already verified in docs/14 (A40).
7. **AC-7 (first-Beta-Admin pointer).** The runbook's `## Bootstrap` (or incident-adjacent) section documents that the first Beta-Admin is created manually via the Keycloak Admin Console and **cross-links [docs/14 §16 First Beta-Admin seeding](../../docs/14_beta_railway_setup.md)** (the 7 realm roles + the Add-user + Set-password + Role-mapping steps) rather than restating them. States the anti-patterns (no SQL insert into postgres-kc; do not run `DevelopmentDataSeeder` against Beta; do not delete the postgres-kc volume).
8. **AC-8 (A38 doc-bundle stub sections for E19).** The runbook includes two explicitly-marked placeholder sections — `## Custom-domain migration` (noting "authored by E19-S1") and `## Production-gate NFR checklist` (noting "authored by E19-S3") — each a one-line stub so the downstream stories append without renumbering. Marked clearly as not-yet-authored so a reader is not misled (A42 pre-filled-placeholder check).
9. **AC-9 (no contradiction with docs/14).** Every command, tag scheme, env-var name, hostname, and path the RUNBOOK states matches [docs/14](../../docs/14_beta_railway_setup.md) and the actual code/config byte-for-byte (e.g., `:sha-<commit>` not `:latest`; `postgres-app.railway.internal`; `Backup__EncryptionKey`; `/health/ready`). Verified by the A42 reread pass; any divergence is a defect, not an alternative.
10. **AC-10 (peer read-through evidence — deferred per A47).** A peer (someone unfamiliar with the current operational details) reads the runbook and confirms each procedure is executable as written. Marked `[!]` — requires a human reader and, for the live-fire steps (an actual rollback / restore drill), a green Beta deploy. Deferred to the unified Wave-9 walkthrough; surfaced as Q-items in Completion Notes.

## Decision-Needed (per A32 / A41)

### DEC-1: RUNBOOK depth vs. docs/14 cross-linking

**Scope:** AC-2..AC-7 each describe a procedure that already lives in docs/14. How self-contained should the RUNBOOK be?

**Options:**

- **(A) Incident-first index that cross-links docs/14 for detailed procedures; self-contained only for the Symptoms/Diagnose/Fix/Verify incident playbooks (the layer docs/14 lacks).** (RECOMMENDED) Honours the E15-S4 DEC-1=A cross-link resolution and the A38 doc-bundle "write once, point back" rule. The RUNBOOK's net-new value is the incident-response framing; routine procedures (deploy/rollback/restore) get a 2–3 line summary + a docs/14 anchor. Zero duplication → zero drift surface. An operator mid-incident gets a scannable index; the depth is one click away.
- **(B) Fully self-contained runbook that re-pastes every command so it reads standalone with no docs/14 dependency.** Reads well offline but creates N command-duplication surfaces that drift the moment docs/14 changes (exactly the failure A38 was coined to prevent). Rejected unless the user explicitly wants an air-gapped runbook.
- **(C) Merge the runbook into docs/14 as new sections rather than a separate file.** Contradicts the SCP's explicit `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` path + the epics-file AC. Rejected.

**Recommendation:** **A.** Cross-link routine procedures; own the incident playbooks.

### DEC-2: Incident count — exactly five vs. the full seven documented

**Scope:** AC-6 mandates ≥5. The Dev Notes incident table lists seven documented failure modes.

**Options:**

- **(A) Author all seven** (the five mandatory + healthcheck-timeout + backup-key-rotation-unrecoverable). (RECOMMENDED, post-MVP) The user's standing directive is "kein MVP" — a richer incident catalogue is strictly more useful and all seven are already root-caused in docs/14 / the E17 deferred-work notes, so the marginal cost is low.
- **(B) Author exactly the five mandatory** to satisfy the literal AC and defer the rest to deferred-work. Minimum surface; leaves two known incidents undocumented.

**Recommendation:** **A** (seven), given the post-MVP directive.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm sources + resolve DECs (A28 spike-first; A41 escape if pre-declared)

- [x] 0.1 Confirmed `RUNBOOK-beta.md` absent before authoring (grep `RUNBOOK` returned only forward-references).
- [x] 0.2 Re-read docs/14 section list at refresh: §7 Secret rotation, §8 Networking, §9 Health probes, §10 First deploy, §11 Recovery, §14 Two-Postgres, §15 Backup+restore, §16 First-admin, §25 Serilog Console-only, §26 CorrelationId. E17 appended §25/§26/§27 at the END (after §24), so the earlier §7–§16 numbering did NOT shift — cross-links resolve. RUNBOOK cross-links by section NUMBER (+ subsection in prose) for robustness against future anchor-slug drift.
- [x] 0.3 Confirmed [backend/Dockerfile](../../backend/Dockerfile) installs `postgresql-client-17` (A45 — `pg_restore` reachable in the `api` container).
- [x] 0.4 DEC-1=A (cross-link index) + DEC-2=A (all 7 incidents) resolved via A41 autonomous-mode escape — see Debug Log References.
- [x] 0.5 Spike outcome recorded in Dev Agent Record.

### Task 1: Author the RUNBOOK skeleton + preface + TOC (AC-1, AC-8)

- [x] 1.1 Created `RUNBOOK-beta.md` with SPDX header, H1, "How to use this runbook" preface, and a linked TOC.
- [x] 1.2 Laid down all section headers incl. the two E19 stub sections §8 (E19-S1) + §9 (E19-S3), each blockquote-marked "Placeholder — authored by E19-Sx … Not yet authored" (AC-8).

### Task 2: Author Deploy / Rollback / Logs sections (AC-2, AC-3, AC-5)

- [x] 2.1 §1 Deploy — push-to-deploy summary + setup-guide §10 cross-link; `:beta` (moving) vs `:sha-<commit>` (immutable, no `:latest`) note + `/about` commitSha.
- [x] 2.2 §2 Rollback — `:sha-<commit>` redeploy steps + `:beta`-is-not-a-rollback-target warning + `/about` cross-check; setup-guide §11 + ADR-014.
- [x] 2.3 §4 Logs — Railway Logs tab + `railway logs --service` (`[!]` marked) + Console-only/no-file-sink note + CorrelationId; setup-guide §25/§26.

### Task 3: Author Database-restore section (AC-4)

- [x] 3.1 §3 Database restore — locate object → C# `BackupEncryption` decrypt (explicitly NOT OpenSSL; `[12-byte nonce][16-byte tag][ciphertext]` AES-256-GCM) → gunzip → `pg_restore --clean --if-exists` into throwaway → row-count validation; setup-guide §15.
- [x] 3.2 Stated ADR-019 single-RustFS blast-radius caveat + `Backup__EncryptionKey` single-key archival requirement.
- [x] 3.3 A40: `pg_restore`/`railway shell`/decrypt-invocation marked `[!] verify before executing`; `pg_restore` form matches setup-guide §15.

### Task 4: Author incident playbooks (AC-6) + bootstrap pointer (AC-7)

- [x] 4.1 §6.1 Keycloak crash-loop — S/D/F/V; `kc.sh bootstrap-admin user --password:env` recovery via setup-guide §11.2.
- [x] 4.2 §6.2 API unhealthy — S/D/F/V; five-anchor `Keycloak__Authority` parity.
- [x] 4.3 §6.3 `redirect_uri` mismatch — S/D/F/V; `IABCONNECT_BETA_HOST` `https://` scheme via setup-guide §5.
- [x] 4.4 §6.4 DB connection refused / migration fail — S/D/F/V; `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` checks via setup-guide §14.
- [x] 4.5 §6.5 RustFS unreachable / upload fail — S/D/F/V; `rustfs.railway.internal:9000` via setup-guide §8.
- [x] 4.6 (DEC-2=A) §6.6 healthcheck timeout on deploy — S/D/F/V; setup-guide §9 60s timeout rationale.
- [x] 4.7 (DEC-2=A) §6.7 backup-key rotated, old backups undecryptable — S/D/F/V; setup-guide §15/§7 key-archival.
- [x] 4.8 §5 Bootstrap first-Beta-Admin pointer + 4 anti-patterns; setup-guide §16 cross-link (AC-7).

### Task 5: A42 reread-as-a-stranger pass + Quality-Gates closing (AC-9, AC-10)

- [x] 5.1 A42 six-category reread complete: (1) no cross-section contradictions; (2) the two E19 stubs read clearly as not-yet-authored placeholders; (3) cross-links use section NUMBERS (robust to slug drift) — verified §7–§16/§25/§26 numbering stable; (4) every command/tag/host/env-var matches code+docs/14 (`:sha-`, `postgres-app.railway.internal`, `Backup__EncryptionKey`, `/health/ready`, `rustfs.railway.internal:9000`); (5) no sprint-tracking leakage in operator prose; (6) A45 — `pg_restore` in image, `BackupEncryption` is C# (not openssl), `railway`/`kc.sh` operator-provided + `[!]`-marked.
- [x] 5.2 AC-9 no-contradiction check: tags/hostnames/env-vars/paths cross-checked against docs/14 + architecture.md — consistent.
- [x] 5.3 AC-Subitem Completion Check (A29) — Quality-Gates table has one row per incident (6.1–6.7).
- [!] 5.4 AC-10 peer read-through + live-fire rollback/restore drill deferred per A47 → Completion Notes Q1/Q2 (needs a human reader + green Beta deploy).
- [x] 5.5 Status flipped to `review`.

## Dev Notes

### Documented incident catalogue (source material for AC-6)

| # | Incident | Symptoms (start point) | Root cause(s) | Documented Fix anchor |
|---|---|---|---|---|
| a | Keycloak crash-loop | `keycloak` Deploys tab restart loop; `KC-SERVICES` errors | `KC_DB_URL` unresolved / `KEYCLOAK_ADMIN(_PASSWORD)` missing / master admin lost | [docs/14 §11.2](../../docs/14_beta_railway_setup.md) (`kc.sh bootstrap-admin user --password:env`) |
| b | API unhealthy | `/health/ready` 503; `/health/detail` shows `keycloak: Unhealthy` | `Keycloak__Authority` ≠ real issuer / discovery unreachable / CORS `Frontend__BaseUrl` mismatch | [docs/14 §11.1 + §6.3 five-anchor parity](../../docs/14_beta_railway_setup.md) |
| c | `redirect_uri` 400 | Keycloak login → "Invalid parameter: redirect_uri" | `IABCONNECT_BETA_HOST` unset or bare-hostname (no `https://`) | [docs/14 §5.3](../../docs/14_beta_railway_setup.md) |
| d | DB connection refused | `api` boot: "connection refused" / "host not found" | `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` unresolved / service renamed / wrong PGPASSWORD ref | [docs/14 §14.3.1](../../docs/14_beta_railway_setup.md) |
| e | RustFS unreachable | Upload fails: S3 timeout / 403 | `DocumentStorage__ServiceUrl` wrong host / `__AccessKey`/`__SecretKey` drift | [docs/14 §8.4](../../docs/14_beta_railway_setup.md) |
| f | Healthcheck timeout | Railway deploy aborts ~60s: "Healthcheck failed" | First-run EF migrations / Keycloak realm import / cold start exceed 60s | [docs/14 §9.1](../../docs/14_beta_railway_setup.md) (60s timeout rationale) |
| g | Backup unrecoverable | Restore from old backup → decryption error | `Backup__EncryptionKey` rotated without archiving old key | [docs/14 §15.7](../../docs/14_beta_railway_setup.md) (single-key-at-a-time contract) |

### Restore mechanics (verified facts for AC-4)

- Backup object key: `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC, nested by year/month) on the RustFS `backups` bucket ([ADR-019](../planning-artifacts/architecture.md)).
- On-disk encrypted format: `[12-byte nonce][16-byte tag][ciphertext]`, AES-256-GCM via `BackupEncryption.cs`. **Decrypt with the C# helper, not `openssl`** — the GCM nonce/tag framing is custom; the runtime image does not ship an `openssl` recipe that matches it.
- `pg_dump --format=custom` produces the dump; restore is `pg_restore --clean --if-exists --no-password --host <target> --port 5432 --username <u> --dbname railway <file>` with `PGPASSWORD` in the env (per [docs/14 §15.5](../../docs/14_beta_railway_setup.md) / [PostgresBackupService](../../backend/src/IabConnect.Infrastructure/Backup)).
- `postgresql-client-17` IS in [backend/Dockerfile:51–73](../../backend/Dockerfile), so `pg_restore` is reachable from `railway shell --service api` (A45 satisfied).
- Cron context: `daily-pg-backup` at `0 3 * * *` UTC; `prune-old-backups` at `0 4 * * *` UTC (30-day retention) — for the Logs/monitoring cross-reference.

### Tag scheme (verified facts for AC-2/AC-3)

- Two tags per push (from [.github/workflows/build-images.yml](../../.github/workflows/build-images.yml)): `:beta` (moving, overwritten each `beta`-branch build) and `:sha-<40-char-commit>` (immutable rollback artifact). **No `:latest`.** Rollback = redeploy a prior `:sha-` tag. Running commit is cross-checkable at `/about` (E20-S3).

### What this story does NOT do

- It does NOT re-paste docs/14 procedures (DEC-1=A). Routine procedures get a summary + anchor.
- It does NOT author the E19 sections — only their marked stubs (AC-8). E19-S1/E19-S3 fill them.
- It does NOT perform a live rollback/restore drill — that is AC-10 / E19-S2's backup-restore drill, deferred per A47.
- It does NOT change any production code or config. Pure documentation deliverable.

### A31 cross-story orthogonal-AC invariants in scope

1. **RUNBOOK ↔ docs/14 command parity.** Every command/tag/host/env-var/path the RUNBOOK states must match docs/14 + code (AC-9; enforced by the A42 reread, not an automated test — this is a Markdown doc).
2. **A38 doc-bundle anchor integrity.** The two E19 stub section headers must be present and stably-named so E19-S1/E19-S3 append without renumbering (AC-8).

## Quality-Gates Closing

| AC | Evidence | Status |
|---|---|---|
| AC-1 file + preface + TOC | RUNBOOK-beta.md created: SPDX + H1 + "How to use" preface + linked TOC | covered |
| AC-2 Deploy | §1 Deploy + setup-guide §10 cross-link + `:beta`/`:sha-` note | covered |
| AC-3 Rollback | §2 Rollback + `:sha-<commit>` steps + `:beta`-not-a-target + ADR-014/§11 | covered |
| AC-4 Restore | §3 Database restore + BackupEncryption(not-openssl) + pg_restore + §15 + ADR-019 caveat | covered |
| AC-5 Logs | §4 Logs + §25/§26 + Console-only/no-file-sink + CorrelationId | covered |
| AC-6 (6.1) Keycloak crash-loop | S/D/F/V playbook + kc.sh recovery via §11.2 | covered |
| AC-6 (6.2) API unhealthy | S/D/F/V playbook + five-anchor parity | covered |
| AC-6 (6.3) redirect_uri | S/D/F/V playbook + IABCONNECT_BETA_HOST scheme via §5 | covered |
| AC-6 (6.4) DB refused | S/D/F/V playbook + RAILWAY_PRIVATE_DOMAIN checks via §14 | covered |
| AC-6 (6.5) RustFS | S/D/F/V playbook + rustfs.railway.internal:9000 via §8 | covered |
| AC-6 (6.6) healthcheck timeout (DEC-2=A) | S/D/F/V playbook + §9 60s rationale | covered |
| AC-6 (6.7) backup-key (DEC-2=A) | S/D/F/V playbook + §15/§7 key-archival | covered |
| AC-7 first-admin pointer | §5 Bootstrap + §16 cross-link + 4 anti-patterns | covered |
| AC-8 E19 stub sections | §8 (E19-S1) + §9 (E19-S3) marked placeholder | covered |
| AC-9 no contradiction | A42 reread + tag/host/env-var/path diff vs docs/14 + architecture.md | covered |
| AC-10 peer read-through + live-fire drill | live walkthrough (Q1/Q2) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **Primary deliverable:** `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` (net-new Markdown).
- **No automated tests** — this is a documentation artifact; correctness is enforced by the A42 reread pass (AC-9) + the peer read-through (AC-10, deferred).
- **Live-fire evidence** (actual rollback / restore drill) deferred to Wave-9 unified walkthrough + E19-S2 backup-restore drill per A47.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

**DEC-1 (RUNBOOK depth vs. docs/14 cross-linking) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (incident-first index that cross-links docs/14 for routine procedures; self-contained only for the Symptoms/Diagnose/Fix/Verify incident playbooks).
- (b) **Rationale:** story recommendation = A; user autonomous-mode verbatim quote = "das ganze epic umsetzen ohne unterbrechung und ohne stop bis alle stories implementiert sind. danach gemäss plan eine retro durchführen." (2026-06-05); architectural justification = honours E15-S4 DEC-1=A cross-link resolution + the A38 doc-bundle write-once rule (re-pasting docs/14 commands would create N drift surfaces).
- (c) **Consequence chain:** §1/§2/§3/§4/§5 are summaries + setup-guide cross-links; §6 incident playbooks are self-contained S/D/F/V; zero command duplication with docs/14.

**DEC-2 (incident count — five vs. seven) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (author all seven documented incidents, not just the five mandatory).
- (b) **Rationale:** story recommendation = A (post-MVP); user autonomous-mode verbatim quote = same as DEC-1 + the standing "es handelt sich nicht mehr um ein mvp" posture; architectural justification = all seven are already root-caused in docs/14, so the marginal cost is low and the catalogue is strictly more useful at incident time.
- (c) **Consequence chain:** §6 contains 6.1–6.7 (the 5 mandatory + 6.6 healthcheck-timeout + 6.7 backup-key-rotation); AC-6 Quality-Gates table has 7 rows.

### Spike outcome (Task 0.5)

`RUNBOOK-beta.md` was genuinely absent. docs/14 sections to cross-link were confirmed stable (E17 appended §25–§27 at the end, so §7–§16 numbering is unchanged). `postgresql-client-17` confirmed in backend/Dockerfile (restore reachability). The RUNBOOK cross-links docs/14 by section NUMBER (with subsection in prose) rather than by anchor-slug, so future heading-text edits don't break the links. Pure documentation deliverable — zero production code, zero automated tests.

### Completion Notes List

- **What was implemented:** `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` (~210 lines) — an incident-first operator runbook: §1 Deploy, §2 Rollback, §3 Database restore, §4 Logs, §5 Bootstrap (first Beta-Admin), §6 seven incident playbooks (S/D/F/V), §7 Quick reference, §8/§9 marked E19 placeholder sections.
- **DEC-1=A + DEC-2=A** auto-resolved via A41 (user pre-declared full-epic autonomous mode); (a)/(b)/(c) Debug Log above.
- **A38 doc-bundle:** this RUNBOOK is the anchor; §8 (E19-S1 custom-domain) + §9 (E19-S3 NFR gate) are stub sections so those stories append without renumbering.
- **Zero production code / zero tests** — documentation artifact; correctness enforced by the A42 reread (AC-9, clean).

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-10 peer read-through):** during the Wave-9 unified walkthrough, a peer unfamiliar with the operational details reads the runbook and confirms each procedure is executable as written.
- **Q2 (AC-10 live-fire):** on a green Beta deploy, validate at least the rollback (`:sha-` redeploy) + a restore-into-throwaway drill (the latter overlaps E19-S2's backup-restore drill).

### File List

**NEW:**
- `_bmad-output/implementation-artifacts/RUNBOOK-beta.md`

**MODIFIED:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (e18-s1: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/e18-s1-author-runbook-beta.md` (this story file: tasks/record/status)

### Change Log

- 2026-06-05 — E18-S1 dev-story: authored `RUNBOOK-beta.md` (incident-first operator runbook, 7 S/D/F/V playbooks, cross-links docs/14 by section number, A38 anchor with E19 stub sections). DEC-1=A + DEC-2=A auto-resolved via A41. AC-1..AC-9 covered; AC-10 (peer read-through + live-fire) deferred-pending-beta-green per A47 → Q1/Q2. Zero production code, zero tests.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A38** doc-bundle pattern (this RUNBOOK is the anchor for E19-S1 + E19-S3)
- **A40** verify/`[!]`-mark shell commands for tools not exercised in-session (railway, pg_restore, kc.sh)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** + **A45** reread-as-a-stranger pass (six categories incl. binary reachability)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-10)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-05)

RUNBOOK-beta.md authored as an incident-first operator index cross-linking docs/14, with 7 self-contained S/D/F/V incident playbooks and the A38 E19 stub sections. AC-1..AC-9 covered; AC-10 (peer read-through + live-fire drill) deferred-pending-beta-green per A47 → unified Wave-9 walkthrough Q1/Q2.
