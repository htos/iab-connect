# Story E18-S1: Author RUNBOOK-beta.md

Status: ready-for-dev

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

- [ ] 0.1 Confirm `RUNBOOK-beta.md` still absent (`git ls-files` + Glob).
- [ ] 0.2 Re-read docs/14 section anchors to be cross-linked (§7, §8.4, §9, §10, §11.2, §11.4, §14.3.1, §15, §16, §25, §26) and record their exact current heading slugs (E17 inserted §25/§26/§27 — confirm numbering did not shift the earlier anchors).
- [ ] 0.3 Confirm [backend/Dockerfile](../../backend/Dockerfile) still installs `postgresql-client-17` (A45 reachability for the restore playbook).
- [ ] 0.4 Resolve DEC-1 + DEC-2 (A41 autonomous-mode escape per A43 (a)/(b)/(c) if the user pre-declared; otherwise AskUserQuestion per `feedback_decisions_via_ask_tool`).
- [ ] 0.5 Record spike outcome in Dev Agent Record.

### Task 1: Author the RUNBOOK skeleton + preface + TOC (AC-1, AC-8)

- [ ] 1.1 Create `RUNBOOK-beta.md` with H1 title, "How to use this runbook" preface, and a linked TOC.
- [ ] 1.2 Lay down all section headers including the two E19 stub sections (AC-8) clearly marked "authored by E19-S1 / E19-S3 — placeholder".

### Task 2: Author Deploy / Rollback / Logs sections (AC-2, AC-3, AC-5)

- [ ] 2.1 `## Deploy` — routine deploy summary + docs/14 §10 cross-link; `:beta` vs `:sha-` tag note.
- [ ] 2.2 `## Rollback` — `:sha-<commit>` redeploy steps + `:beta`-is-not-a-rollback-target warning + `/about` commit cross-check; docs/14 §11.4 + ADR-014 cross-links.
- [ ] 2.3 `## Logs` — Railway Logs tab + `railway logs --service`; Console-only/no-file-sink note; docs/14 §25/§26 cross-links.

### Task 3: Author Database-restore section (AC-4)

- [ ] 3.1 `## Database restore` — locate object → C# `BackupEncryption` decrypt (NOT OpenSSL) → gunzip → `pg_restore --clean --if-exists` into throwaway → row-count validation; docs/14 §15.5 cross-link.
- [ ] 3.2 State ADR-019 single-RustFS blast-radius caveat + `Backup__EncryptionKey` archival requirement.
- [ ] 3.3 A40: confirm every restore command is present-and-verified in docs/14 §15.5 OR mark `[!] verify before executing`.

### Task 4: Author incident playbooks (AC-6) + bootstrap pointer (AC-7)

- [ ] 4.1 Incident (a) Keycloak crash-loop — S/D/F/V; `kc.sh bootstrap-admin user --password:env` recovery via docs/14 §11.2.
- [ ] 4.2 Incident (b) API unhealthy — S/D/F/V; five-anchor `Keycloak__Authority` parity via docs/14 §6.3.
- [ ] 4.3 Incident (c) `redirect_uri` mismatch — S/D/F/V; `IABCONNECT_BETA_HOST` scheme via docs/14 §5.3.
- [ ] 4.4 Incident (d) DB connection refused / migration fail — S/D/F/V; `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` checks via docs/14 §14.3.1.
- [ ] 4.5 Incident (e) RustFS unreachable / upload fail — S/D/F/V; `rustfs.railway.internal:9000` via docs/14 §8.4.
- [ ] 4.6 (DEC-2=A) Incident (f) healthcheck timeout on deploy — S/D/F/V; docs/14 §9.1 60s timeout rationale.
- [ ] 4.7 (DEC-2=A) Incident (g) backup-key rotated, old backups unrecoverable — S/D/F/V; docs/14 §15.7 key-archival.
- [ ] 4.8 `## Bootstrap` first-Beta-Admin pointer + anti-patterns; docs/14 §16 cross-link (AC-7).

### Task 5: A42 reread-as-a-stranger pass + Quality-Gates closing (AC-9, AC-10)

- [ ] 5.1 A42 six-category reread: (1) cross-section contradictions; (2) pre-filled placeholders (the two E19 stubs must read as not-yet-authored); (3) stale anchors (verify every docs/14 §N link resolves post-E17 renumber); (4) imprecise claims vs. actual code/config; (5) sprint-tracking leakage into operator-facing prose; (6) A45 binary reachability (`pg_restore` in image; `BackupEncryption` is C# not OpenSSL; `railway` CLI is operator-provided — say so).
- [ ] 5.2 AC-9 no-contradiction check: grep the RUNBOOK for every tag/hostname/env-var/path and diff against docs/14 + code.
- [ ] 5.3 AC-Subitem Completion Check (A29) — per-AC evidence in the Quality-Gates table; AC-6 produces one row per incident (a..g).
- [ ] 5.4 AC-10 + live-fire incident verification deferred per A47 → Completion Notes Q-items.
- [ ] 5.5 Flip status to `review`.

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

| AC | Planned evidence | Status |
|---|---|---|
| AC-1 file + preface + TOC | RUNBOOK-beta.md created | _pending dev-story_ |
| AC-2 Deploy | `## Deploy` + docs/14 §10 cross-link | _pending_ |
| AC-3 Rollback | `## Rollback` + `:sha-` steps + ADR-014/§11.4 | _pending_ |
| AC-4 Restore | `## Database restore` + §15.5 + ADR-019 caveat | _pending_ |
| AC-5 Logs | `## Logs` + §25/§26 + Console-only note | _pending_ |
| AC-6 (a) Keycloak crash-loop | incident playbook S/D/F/V | _pending_ |
| AC-6 (b) API unhealthy | incident playbook S/D/F/V | _pending_ |
| AC-6 (c) redirect_uri | incident playbook S/D/F/V | _pending_ |
| AC-6 (d) DB refused | incident playbook S/D/F/V | _pending_ |
| AC-6 (e) RustFS | incident playbook S/D/F/V | _pending_ |
| AC-6 (f) healthcheck timeout (DEC-2=A) | incident playbook S/D/F/V | _pending_ |
| AC-6 (g) backup-key (DEC-2=A) | incident playbook S/D/F/V | _pending_ |
| AC-7 first-admin pointer | `## Bootstrap` + §16 cross-link + anti-patterns | _pending_ |
| AC-8 E19 stub sections | two marked placeholder sections | _pending_ |
| AC-9 no contradiction | A42 reread + grep diff vs docs/14 | _pending_ |
| AC-10 peer read-through | live walkthrough (Q-item) | _deferred-pending-beta-green (A47)_ |

## Tests / Evidence

- **Primary deliverable:** `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` (net-new Markdown).
- **No automated tests** — this is a documentation artifact; correctness is enforced by the A42 reread pass (AC-9) + the peer read-through (AC-10, deferred).
- **Live-fire evidence** (actual rollback / restore drill) deferred to Wave-9 unified walkthrough + E19-S2 backup-restore drill per A47.

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

_(DEC-1 + DEC-2 resolution per A43 (a)/(b)/(c) template to be recorded here)_

### Completion Notes List

_(to be filled by dev-story — include the A47 unified-walkthrough Q-items for AC-10 peer read-through + live-fire drills)_

### File List

_(to be filled by dev-story — expected NEW: `_bmad-output/implementation-artifacts/RUNBOOK-beta.md`; MODIFIED: `sprint-status.yaml`)_

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A38** doc-bundle pattern (this RUNBOOK is the anchor for E19-S1 + E19-S3)
- **A40** verify/`[!]`-mark shell commands for tools not exercised in-session (railway, pg_restore, kc.sh)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** + **A45** reread-as-a-stranger pass (six categories incl. binary reachability)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-10)

## Story Completion Status

Status: ready-for-dev

Ultimate context engine analysis completed — comprehensive developer guide created. The dev-agent's job is to AUTHOR the RUNBOOK as an incident-first operator index that cross-links docs/14, owning the Symptoms/Diagnose/Fix/Verify incident playbooks (the layer docs/14 lacks), and to lay the A38 stub sections for E19.
