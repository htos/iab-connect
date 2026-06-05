# Epic-19 boundary code review — Production Readiness Preparation

**Date:** 2026-06-05
**Reviewer:** dev-agent (3-layer adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor), per `feedback_bmad_workflow` hybrid CR+ER policy (bundle review + retro at epic boundary).
**Scope:** the 4 E19 deliverables — all documentation, zero production code:
- `RUNBOOK-beta.md` §8 (E19-S1 custom-domain), §3.1 (E19-S2 restore drill), §9 (E19-S3 production gate)
- `SMTP-MIGRATION-POSTAL.md` (E19-S4, net-new)

**Method:** doc-vs-source parity (A42/A45/A57 reachability), cross-section contradiction, anchor integrity, AC coverage, A31 invariants, A42 pre-filled-status discipline. The "tests" for documentation deliverables are the reread + parity checks (no automated suite — consistent with E18).

---

## Findings → 4 patches APPLIED

### P1 (HIGH) — §8 missing `web.NEXTAUTH_URL`

**Layer:** Edge Case Hunter. **Surface:** E19-S1 §8.
The custom-domain section covered the Keycloak + api host-dependent vars but **omitted `web.NEXTAUTH_URL`** entirely. Per docs/14 §5.2, `NEXTAUTH_URL = https://${{web.RAILWAY_PUBLIC_DOMAIN}}` is the NextAuth callback canonical URL; a web custom-domain change that leaves it stale **silently breaks login** (callbacks resolve to the old domain). **Patch:** added `NEXTAUTH_URL` (web, runtime) to the §8.1 "what changes" table + §8.3 step 5 with the "stale value breaks login" warning.

### P2 (HIGH) — §8 `web.KEYCLOAK_ISSUER` not in the actionable checklist

**Layer:** Acceptance Auditor. **Surface:** E19-S1 §8.
`web.KEYCLOAK_ISSUER` (runtime) was present as anchor #2 in the §8.2 five-anchor parity table but **absent from the §8.1 "what changes" table and the §8.3 ordered checklist** — an operator following the steps would rebuild `web` with the new `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` bake yet leave the runtime `web.KEYCLOAK_ISSUER` pointing at the old keycloak domain → the parity invariant breaks → the §6.2 "API won't go healthy" incident. **Patch:** added `web.KEYCLOAK_ISSUER` (web, runtime) to §8.1 + §8.3 step 5 (the "web carries both kinds" callout makes the runtime-vs-build split explicit).

### P3 (MED) — §8 missing `keycloak.FRONTEND_PUBLIC_URL`

**Layer:** Edge Case Hunter. **Surface:** E19-S1 §8.
Step 3 updated `keycloak.IABCONNECT_BETA_HOST` (→ `redirectUris[0]`/`webOrigins[0]`) but not `keycloak.FRONTEND_PUBLIC_URL` (→ `redirectUris[1]`/`webOrigins[1]`). docs/14 §5.3 line 499 explicitly names `FRONTEND_PUBLIC_URL` as "the canonical custom domain only diverges in Production via **E19-S1**" — i.e. this exact story is the one that's supposed to handle it. Leaving the second redirect URI on the old domain leaves a stale allowed-callback. **Patch:** added `FRONTEND_PUBLIC_URL` to §8.1 + §8.3 step 3 with the realm-binding explanation + the line-499 cross-reference.

### P4 (MED) — SMTP doc offered port 465 against a STARTTLS-only client

**Layer:** Blind Hunter (doc-vs-code accuracy, A42 imprecise-claim category). **Surface:** E19-S4 §2.
The config table offered `Smtp__Port` "587 (STARTTLS) — or 465 (implicit TLS)". The app's transport is `System.Net.Mail.SmtpClient` with `EnableSsl`, which performs **STARTTLS** and does **not** reliably support implicit-TLS/SMTPS on 465 — offering 465 would strand an operator who picked it. **Patch:** changed the guidance to **587/STARTTLS only** with an explicit note on the client's STARTTLS-only behaviour.

---

## Dismissed / no-action

- **§3.1 drill log columns + blank row** — Acceptance Auditor confirmed the table ships blank with the "fill during the live drill" marker (A42 pre-filled-status clean); no invented numbers. No action.
- **§9 status columns** — confirmed all three columns (measured-value / pass-fail / done) blank + the "snapshot per decision, don't tick the master" instruction present. No action.
- **Anchor integrity** — `#31-restore-drill-rehearsal--captured-log`, `#8-custom-domain-migration`, `#9-production-gate-nfr-checklist`, and the `#62`/`#63` incident anchors all verified against GitHub slug rules + the file's existing quick-ref. No broken links.
- **A51 `Smtp__*` parity** — keys in the SMTP doc byte-match `SmtpSettings.cs` + `backend/.env.example`. No action.
- **§3.1 reuse-by-cross-link** — confirmed §3.1 cross-links the §3 `pg_restore`/decrypt commands rather than re-pasting (A38 write-once); no command drift. No action.

---

## Quality gates after patches

- **No production code touched** across the epic — the patches are all documentation edits to `RUNBOOK-beta.md` (§8) and `SMTP-MIGRATION-POSTAL.md` (§2). Backend test suite unaffected (stays 2075); frontend unaffected (174).
- **A42 reread re-run** on the patched §8 + SMTP §2 — clean (no new contradictions introduced; the §8.1 table, §8.2 parity table, and §8.3 checklist are now mutually consistent across all host-dependent vars).
- **A57 binary reachability** — re-confirmed: all `dig`/`railway`/`mc`/Postal/DNS commands are operator-workstation/VPS-side + `[!]`-marked; none assume a binary in the api/web/keycloak runtime images.

## Status transitions

- e19-s1/s2/s3/s4: review (unchanged — patches applied within review state).
- Recommend: epic-19 → done; e19-s1..s4 → done after this review + the retro.
