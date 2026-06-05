# Story E19-S2: Backup restore drill

Status: ready-for-dev

## Story

As **an operator preparing the Production-Go-Live evidence pack**, I want **a repeatable backup-restore drill procedure plus a captured drill-log artifact in the RUNBOOK** — restore yesterday's encrypted daily backup into a throwaway Postgres, point a throwaway API at it, run smoke tests, and record the backup timestamp / restore duration / smoke outcome — so that **the Production-Go-Live decision has hard evidence that the daily backup actually restores and the application comes up clean on it, not just that the backup file exists**.

**Requirement:** REQ-088 AC-6. Epic E19, Story 2. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E19 Story E19-S2 (lines 1890–1906)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E19 — Story E19-S2 (lines 662–666)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-019 Backup Destination — Same RustFS (lines 376–384)](../planning-artifacts/architecture.md)
- [RUNBOOK-beta.md §3 Database restore (the existing restore procedure this drill rehearses)](./RUNBOOK-beta.md)
- [docs/14_beta_railway_setup.md §15 Daily PostgreSQL backup + restore (the full step-by-step)](../../docs/14_beta_railway_setup.md)
- [backend/src/IabConnect.Infrastructure/Backup (PostgresBackupService + BackupEncryption — the dump/encrypt mechanics)](../../backend/src/IabConnect.Infrastructure/Backup)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-19)

This story was authored from the 19-line 2026-05-15 stub against post-Epic-18 reality. Findings (A56 existing-implementation spike):

- **The restore *procedure* already exists** — [RUNBOOK §3 Database restore](./RUNBOOK-beta.md) (authored by E18-S1) already documents locate → decrypt (C# `BackupEncryption`, **not** openssl) → gunzip → `pg_restore --clean --if-exists` into a throwaway → validate. [docs/14 §15](../../docs/14_beta_railway_setup.md) carries the full step-by-step incl. a manual restore drill. **E19-S2 is NOT a re-author of the restore steps.** Its net-new contribution is two things: (1) a **repeatable drill procedure** (a named, ordered rehearsal that ends in pointing a *throwaway API* at the restored DB and running *smoke tests* — the restore §3 stops at row-count validation) and (2) a **captured drill-log artifact** (a filled-in table: backup object timestamp, restore duration, smoke-test outcome) added to the RUNBOOK as evidence.
- **No pre-laid §-stub exists for E19-S2** (only §8/§9 were stubbed by E18-S1 for E19-S1/E19-S3). So this story adds a **new subsection `### 3.1 Restore drill (rehearsal + captured log)`** under the existing §3, plus a blank drill-log table, and updates the TOC reference + §7 Quick-reference. It must NOT disturb §3's existing restore prose, §8, or §9.
- **The drill EXECUTION is intrinsically live and is deferred per A47.** A real drill needs: a green Beta that has produced at least one real `daily-pg-backup` object on RustFS, RustFS access to fetch it, the `Backup__EncryptionKey` to decrypt, a throwaway Postgres, and a throwaway API instance. The dev-agent cannot do any of this from its sandbox (Beta is not yet deployed green — it is on Harry's live-Beta prerequisite list). **Therefore: the dev-agent authors the complete drill procedure + the blank log template NOW; the actual drill run is an `[!]` item deferred to the unified Wave-10 walkthrough, and the captured-log table ships blank with a clear "fill during the live drill" marker** (A42 pre-filled-placeholder discipline — the log must NOT ship with invented numbers).
- **Binary reachability (A45/A57):** `pg_restore`/`pg_dump` ARE in the `api` runtime image (`postgresql-client-17` per [backend/Dockerfile](../../backend/Dockerfile)) → the restore is runnable from `railway shell --service api`. Decrypt is the C# `BackupEncryption` (AES-256-GCM `[12-byte nonce][16-byte tag][ciphertext]`) — **NOT** openssl; the image ships no matching openssl recipe. `jq`/`aws`/`mc` are **not** in the `api` image — locating the RustFS object uses the RustFS web console or `mc` **on the operator's workstation** (say so explicitly). Every drill command that targets a non-in-session tool (`railway shell`, `mc`, the decrypt invocation) carries `[!] verify before executing` (A40).
- **Smoke-test definition** is the design choice (DEC-2). The epics AC says "smoke tests pass"; post-MVP, the smoke set should be meaningful: `/health/ready` 200 + `/health/detail` all-dependencies-Healthy + `/about` reachable + a browser login round-trip + spot-check row counts on critical tables (members / finance / events) so the drill proves *data* came back, not just that the schema restored.
- **ADR-019 blast-radius caveat** (backups share the RustFS volume with primary docs) and the **single-key-at-a-time `Backup__EncryptionKey`** caveat are both already in [RUNBOOK §3](./RUNBOOK-beta.md) + [Incident 6.7](./RUNBOOK-beta.md); the drill section cross-links them rather than restating.
- **A42 reread-as-a-stranger** mandatory at close. **Zero production code, zero config** — pure documentation (a procedure + a blank log template).

## Acceptance Criteria

1. **AC-1 (drill subsection authored under §3).** [RUNBOOK-beta.md](./RUNBOOK-beta.md) gains `### 3.1 Restore drill (rehearsal + captured log)` under the existing §3 Database restore, without disturbing §3's existing restore prose, §8, or §9. The §3 TOC reference and §7 Quick-reference gain a drill pointer.
2. **AC-2 (locate-yesterday's-backup step).** §3.1 documents locating the previous day's backup object — key pattern `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC, nested by year/month; written by `daily-pg-backup` at `0 3 * * *` UTC) — via the RustFS web console or `mc ls` **on the operator's workstation** (`mc` is not in the `api` image; stated explicitly, A57). Cross-links [ADR-019](../planning-artifacts/architecture.md) + [docs/14 §15](../../docs/14_beta_railway_setup.md).
3. **AC-3 (decrypt → gunzip → restore-into-throwaway step).** §3.1 documents decrypt via the C# `BackupEncryption` helper (explicitly **not** openssl; AES-256-GCM `[12-byte nonce][16-byte tag][ciphertext]` framing) → gunzip → `pg_restore --clean --if-exists` into a **throwaway** Postgres (never the live DB). Reuses the exact `pg_restore` invocation from [RUNBOOK §3](./RUNBOOK-beta.md) / [docs/14 §15](../../docs/14_beta_railway_setup.md) by cross-link (no command drift, A38). `railway shell --service api` + the decrypt invocation + `mc` carry `[!] verify before executing` (A40).
4. **AC-4 (point a throwaway API at the restored DB).** §3.1 documents standing up a **throwaway** API instance whose `ConnectionStrings__DefaultConnection` points at the restored throwaway Postgres (a separate Railway Postgres + a throwaway `api` deploy, or local Compose) — explicitly **never** re-pointing the live `api` at the restored DB on the first pass. Notes that `Database__AutoMigrate` should be **off** for the drill API so the restore is validated as-is, not silently migrated over.
5. **AC-5 (smoke-test set — DEC-2).** §3.1 enumerates the smoke tests the drill must pass against the throwaway API: (a) `/health/ready` → 200; (b) `/health/detail` → all dependencies `Healthy` (DB check green proves the restored DB is reachable + schema-valid); (c) `/about` reachable; (d) a browser login round-trip (or, if the throwaway has no Keycloak, an authenticated API call with a token from the live Keycloak); (e) spot-check row counts on critical tables (members / finance / events) to prove data restored, not just schema. Each sub-item is a discrete checklist line (A29).
6. **AC-6 (captured drill-log template — ships BLANK).** §3.1 includes a drill-log table with columns: **Drill date · Backup object key (timestamp) · Backup age · Restore duration · Throwaway target · Smoke result (per sub-item a–e) · Operator · Notes**. The table ships with **one blank/example row clearly marked "fill during the live drill"** — it does **NOT** ship with invented numbers (A42 pre-filled-status discipline). A short instruction line says the operator appends one filled row per drill run as the Production-readiness evidence.
7. **AC-7 (caveats cross-linked, not restated).** §3.1 cross-links (does not restate) the [ADR-019](../planning-artifacts/architecture.md) single-RustFS blast-radius caveat and the single-key-at-a-time `Backup__EncryptionKey` caveat ([RUNBOOK §3 + Incident 6.7](./RUNBOOK-beta.md)) — a key rotated without archiving the old key makes pre-rotation backups undecryptable, which a drill would surface. States that off-site backup replication is the E19 Production durability follow-up (not this story).
8. **AC-8 (no contradiction; A42 reread).** Every object-key pattern, cron time, env-var name, binary claim (`pg_restore` in image; `mc`/`openssl`/`jq` NOT in image), and `pg_restore` flag in §3.1 matches §3, docs/14 §15, ADR-019, and the actual `PostgresBackupService`/`BackupEncryption` code byte-for-byte. Verified by the A42 six-category reread (incl. A57 binary reachability).
9. **AC-9 (the actual drill run — deferred per A47).** A real drill is executed against a green Beta: yesterday's backup restored into a throwaway, the throwaway API smoke-tested, and **one filled row appended to the §3.1 drill-log** (backup timestamp, restore duration, smoke outcome). Marked `[!]` — requires a green Beta deploy with ≥1 real backup + a throwaway target. Deferred to the unified Wave-10 walkthrough; surfaced as Q-items in Completion Notes. This AC is the epics "captured drill log" evidence line and is the load-bearing live item of the story.

## Decision-Needed (per A32 / A41)

### DEC-1: Throwaway restore target — ephemeral Railway Postgres vs. local Compose Postgres

**Scope:** The drill restores "into a throwaway Postgres instance". Which target does §3.1 prescribe as the primary path?

**Options:**

- **(A) Ephemeral Railway Postgres (a temporary `postgres-app-restore-test` service in the same Railway project) as the primary path, with local Docker Compose Postgres as a documented offline fallback.** (RECOMMENDED) Closest to Production parity — same managed-Postgres engine, same private-networking model, the throwaway `api` can reach it over `*.railway.internal`, and the backup object is already reachable from inside the Railway project (no egress of the encrypted dump to a workstation). The local-Compose fallback covers an operator who wants a zero-cost offline rehearsal.
- **(B) Local Docker Compose Postgres as the primary path.** Zero Railway cost and fully offline, but requires egressing the encrypted dump + the encryption key to a workstation (wider key-exposure surface) and tests against a different Postgres deployment than Production. Better as the documented fallback than the primary.

**Recommendation:** **A** (ephemeral Railway Postgres primary; local Compose fallback).

### DEC-2: Smoke-test depth — health-only vs. full (health + login + row-count spot-check)

**Scope:** The epics AC says "smoke tests pass" without enumerating them. How deep is the drill's smoke set?

**Options:**

- **(A) Full set: `/health/ready` + `/health/detail` all-Healthy + `/about` + a login round-trip + critical-table row-count spot-checks (members/finance/events).** (RECOMMENDED, post-MVP) A restore drill whose only check is `/health/ready` proves the schema restored and the DB is reachable, but NOT that the *data* came back intact. The post-MVP directive favours proving data integrity — row-count spot-checks are the cheap, decisive signal that the dump carried real rows, and a login round-trip exercises the auth + DB path end-to-end.
- **(B) Health-only (`/health/ready` 200).** Minimal, fast, satisfies the literal "smoke tests pass" wording, but a green `/health/ready` on an empty-but-schema-valid restore would falsely pass — it does not prove data integrity.

**Recommendation:** **A** (full set), given the post-MVP directive and that data-integrity is the whole point of a restore drill.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm anchors + binary surface + resolve DECs (A28; A41 escape if pre-declared)

- [ ] 0.1 Confirm [RUNBOOK §3](./RUNBOOK-beta.md) restore prose + the `pg_restore --clean --if-exists` invocation + the BackupEncryption-not-openssl note are unchanged since E18-S1 close (the drill reuses them by cross-link).
- [ ] 0.2 Re-confirm the backup object-key pattern + cron from `PostgresBackupService` / [ADR-019](../planning-artifacts/architecture.md): `backups/yyyy/MM/dd-HHmmss.dump.gz.enc`, `0 3 * * *` UTC, 30-day retention.
- [ ] 0.3 Re-confirm `postgresql-client-17` in [backend/Dockerfile](../../backend/Dockerfile) (A45 — `pg_restore` reachable in `api`) and that `mc`/`openssl`/`jq` are NOT in the image (A57 — workstation-side for object location).
- [ ] 0.4 Confirm `/health/ready` + `/health/detail` + `/about` endpoint paths (the smoke targets) against the API (E17-S4 + E20-S3 + [RUNBOOK §6.2](./RUNBOOK-beta.md)).
- [ ] 0.5 Resolve DEC-1 + DEC-2 (A41 escape if pre-declared, else AskUserQuestion per A32 step d) — record (a)/(b)/(c) per A43.
- [ ] 0.6 Spike outcome recorded in Dev Agent Record.

### Task 1: Author §3.1 drill procedure — locate + decrypt + restore-into-throwaway (AC-1, AC-2, AC-3)

- [ ] 1.1 Add `### 3.1 Restore drill (rehearsal + captured log)` under §3; intent paragraph (this rehearses §3 end-to-end + proves data integrity; the live run is deferred to a green Beta).
- [ ] 1.2 Locate-yesterday's-backup step (RustFS console / workstation `mc ls`, `[!]`-marked; object-key pattern + cron).
- [ ] 1.3 Decrypt (C# BackupEncryption, not openssl) → gunzip → `pg_restore --clean --if-exists` into throwaway, reusing §3 / docs/14 §15 by cross-link; `[!] verify` on `railway shell` + decrypt + `mc`.

### Task 2: Author the throwaway-API + smoke-test steps (AC-4, AC-5)

- [ ] 2.1 (DEC-1) Throwaway-target step: ephemeral Railway Postgres primary + local Compose fallback; throwaway `api` `ConnectionStrings__DefaultConnection` → restored DB; `Database__AutoMigrate` OFF for the drill.
- [ ] 2.2 (DEC-2) Smoke-test checklist (a)–(e): `/health/ready` 200 · `/health/detail` all-Healthy · `/about` · login round-trip · critical-table row-count spot-checks — each a discrete line (A29).

### Task 3: Author the captured drill-log template + caveats (AC-6, AC-7)

- [ ] 3.1 Drill-log table (Drill date · Backup key/timestamp · Backup age · Restore duration · Throwaway target · Smoke result a–e · Operator · Notes), one BLANK row marked "fill during the live drill" (A42 — no invented numbers).
- [ ] 3.2 Cross-link ADR-019 blast-radius caveat + single-key `Backup__EncryptionKey` caveat ([RUNBOOK §3 / 6.7](./RUNBOOK-beta.md)); note off-site replication is the E19 Production follow-up.
- [ ] 3.3 Update the §3 TOC reference + §7 Quick-reference with a drill pointer.

### Task 4: A42 reread + Quality-Gates closing (AC-8, AC-9)

- [ ] 4.1 A42 six-category reread: (1) no contradiction with §3 / Incident 6.7; (2) the drill-log reads clearly as a blank template, not a one-drill snapshot; (3) cross-links use §-numbers; (4) object-key/cron/env-var/`pg_restore`-flags/binary-claims match code+docs/14+ADR-019; (5) no sprint leakage; (6) A57 — `pg_restore` in image, `mc`/`openssl`/`jq` workstation-side + `[!]`-marked.
- [ ] 4.2 AC-Subitem Completion Check (A29 / A54) — Quality-Gates table has one row per AC + per smoke sub-item (a–e); AC-9 deferred row split per A54 if multi-sub-item.
- [ ] 4.3 (A47) AC-9 live drill → Completion Notes Q-items (needs green Beta + ≥1 real backup + throwaway target).
- [ ] 4.4 Flip status to `review`.

## Dev Notes

### What this story does (and does NOT) do

- **Does:** add `### 3.1` to RUNBOOK §3 — a repeatable drill procedure that restores yesterday's backup into a throwaway, points a throwaway API at it, runs a defined smoke set, and records a captured-log row; ships the log template blank.
- **Does NOT:** re-author the §3 restore steps (reuses by cross-link); run the actual drill (deferred per A47); restore into the live DB; change any production code/config; ship invented log numbers.

### Verified facts (grounding for the ACs)

- **Backup object:** `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC, nested year/month) on the RustFS `backups` bucket; `daily-pg-backup` `0 3 * * *` UTC; `prune-old-backups` `0 4 * * *` UTC; 30-day retention ([ADR-019](../planning-artifacts/architecture.md), [RUNBOOK §3](./RUNBOOK-beta.md)).
- **Encrypted format:** AES-256-GCM `[12-byte nonce][16-byte tag][ciphertext]` via `BackupEncryption`. **Decrypt with the C# helper, not openssl** — the GCM nonce/tag framing is custom; the `api` image ships no matching openssl recipe.
- **Restore command:** `pg_restore --clean --if-exists --no-password --host <target> --port 5432 --username <u> --dbname railway <file>` with `PGPASSWORD` in env (per [RUNBOOK §3](./RUNBOOK-beta.md) / [docs/14 §15](../../docs/14_beta_railway_setup.md)).
- **Binary surface:** `pg_restore`/`pg_dump`/`psql` IN the `api` image (`postgresql-client-17`, [backend/Dockerfile](../../backend/Dockerfile)); `mc`/`aws`/`openssl`/`jq` NOT in the image → workstation-side for object location (A57).
- **Smoke endpoints:** `/health/ready` (E17-S4, rate-limit-exempt, unauthenticated), `/health/detail` (per-dependency), `/about` (E20-S3, unauthenticated) — all confirmed in [RUNBOOK §6.2](./RUNBOOK-beta.md).
- **`Database__AutoMigrate`** (E15-S2 toggle): keep OFF on the drill API so the restore is validated as-restored, not silently migrated.

### A31 cross-story orthogonal-AC invariants in scope

1. **§3.1 ↔ §3 ↔ docs/14 §15 command parity** (AC-3, AC-8) — the drill must reuse the §3/docs-15 `pg_restore` invocation + decrypt note verbatim by cross-link, never a divergent copy (A38 write-once).
2. **Binary-reachability invariant** (AC-2/AC-3/AC-8, A45/A57) — `pg_restore` in image; `mc`/`openssl` workstation-side. §3.1 must not prescribe an in-container `mc`/`openssl`.
3. **Encryption-key single-version invariant** (AC-7) — restate nowhere; cross-link Incident 6.7. A drill is exactly when a not-archived rotated key is discovered.
4. **A38 doc-bundle anchor integrity** — §3.1 nests under §3 without disturbing §8/§9; no renumber.

### Anti-patterns (do NOT)

- Do **not** ship the drill-log table pre-filled with example numbers — it must be a blank template (A42 pre-filled-status). A captured row appears only after a real drill (AC-9).
- Do **not** re-paste the §3 `pg_restore`/decrypt commands — cross-link them (A38; avoids drift).
- Do **not** prescribe an in-container `mc`/`openssl` — they are not in the `api` image (A57).
- Do **not** restore into the live DB on the first pass — the whole point is a throwaway target (AC-4).
- Do **not** mark AC-9 `[x]` — the live drill needs a green Beta + a real backup; it is `[!]` deferred (A47).

## Quality-Gates Closing

| AC | Evidence (planned) | Status |
|---|---|---|
| AC-1 §3.1 authored under §3 + TOC/QuickRef | new subsection; no disturbance to §3/§8/§9 | pending |
| AC-2 locate-backup | object-key pattern + RustFS console / workstation `mc` `[!]` | pending |
| AC-3 decrypt→gunzip→restore-throwaway | BackupEncryption(not-openssl) + `pg_restore` cross-link + `[!]` | pending |
| AC-4 throwaway API | restored-DB connection string + AutoMigrate OFF + never-live | pending |
| AC-5 (a) `/health/ready` 200 | smoke checklist line | pending |
| AC-5 (b) `/health/detail` all-Healthy | smoke checklist line | pending |
| AC-5 (c) `/about` reachable | smoke checklist line | pending |
| AC-5 (d) login round-trip | smoke checklist line | pending |
| AC-5 (e) critical-table row-count spot-check | smoke checklist line | pending |
| AC-6 captured drill-log template (blank) | table + "fill during live drill" marker | pending |
| AC-7 caveats cross-linked | ADR-019 blast-radius + key-archival via §3/6.7 | pending |
| AC-8 no contradiction / A42 reread | six-category reread + diff vs §3/docs-15/ADR-019/code | pending |
| AC-9 actual drill run + filled log row | live drill (Q1..Qn) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **Primary deliverable:** edits to `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` (new §3.1 + drill-log template + TOC/§7 pointers).
- **No automated tests** — documentation artifact; correctness enforced by the A42 reread (AC-8).
- **Live-fire evidence** (the actual restore drill + the filled drill-log row) deferred to the unified Wave-10 walkthrough per A47 — this is the epics "captured drill log" evidence and the load-bearing live item.

## Dev Agent Record

### Agent Model Used

_(populated by dev-story)_

### Debug Log References

_(DEC-1 + DEC-2 resolution recorded here at dev-story time per A43 (a)/(b)/(c))_

### Completion Notes List

_(populated by dev-story; AC-9 Q-items surfaced in the unified human-verify queue)_

### File List

_(populated by dev-story)_

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A38** doc-bundle pattern (reuse §3 / docs-15 commands by cross-link; nest §3.1 without renumber)
- **A40** verify/`[!]`-mark shell commands for tools not exercised in-session (`railway shell`, `mc`, decrypt invocation)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** + **A45** + **A57** reread-as-a-stranger (six categories incl. binary reachability — `pg_restore` in image; `mc`/`openssl`/`jq` not)
- **A47** uniform autonomous-mode escape for the `[!]` live-drill queue (AC-9)
- **A54** per-sub-item rows for deferred multi-sub-item ACs (the smoke set + AC-9)
- **A56** existing-implementation spike (restore procedure already exists in §3 → drill is additive, not a re-author)

## Story Completion Status

Status: ready-for-dev

Comprehensive context engine analysis completed — comprehensive developer guide created. A repeatable restore-drill procedure + a blank captured-log template to be added as RUNBOOK `### 3.1`, reusing the existing §3 restore commands by cross-link and adding the throwaway-API + smoke-test + data-integrity layer. DEC-1 (ephemeral Railway Postgres) + DEC-2 (full smoke set) carry recommendations for dev-story resolution. The actual drill run + the filled drill-log row (AC-9) are the load-bearing `[!]` live item, deferred-pending-beta-green per A47.
