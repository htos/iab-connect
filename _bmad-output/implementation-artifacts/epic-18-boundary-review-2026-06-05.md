# Epic-18 Boundary Code Review — Beta Test Preparation and Operations Documentation

**Date:** 2026-06-05
**Reviewer:** dev-agent (claude-opus-4-8[1m]), 3-layer adversarial per `feedback_bmad_workflow` hybrid CR+ER policy
**Scope:** the full Epic-18 diff (E18-S1/S2/S3/S4), all stories in status `review`
**Method:** Blind Hunter (find defects without assuming correctness) · Edge Case Hunter (boundaries / reachability) · Acceptance Auditor (AC-claim vs. evidence)

## Diff surface

| Artifact | Kind | Story |
|---|---|---|
| `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` | NEW doc (~210 lines) | E18-S1 |
| `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md` | NEW doc (German, 579 words) | E18-S2 |
| `.github/ISSUE_TEMPLATE/beta-feedback.md` | NEW classic issue template | E18-S4 |
| `.github/ISSUE_TEMPLATE/config.yml` | NEW chooser config | E18-S4 |
| `frontend/src/components/navigation/BetaBanner.test.tsx` | +1 test (orange-bg) | E18-S3 |
| `frontend/src/components/navigation/BetaBanner.i18n.test.ts` | NEW (4 pure-Node tests) | E18-S3 |
| `frontend/src/components/navigation/feedback-template.test.ts` | NEW (3 pure-Node tests) | E18-S4 |
| 4 story files + `sprint-status.yaml` | tracking | — |

**Epic summary:** the entire epic is documentation + regression-test coverage + one missing GitHub template. **Zero production code change** (E18-S3/S4 verified the already-shipped banner + feedback link without touching them; E18-S1/S2 are docs). +8 frontend tests (166 → 174).

## Findings → 1 patch APPLIED

### P1 (APPLIED) — RUNBOOK incident 6.2 piped to `jq`, which is not in the `api` image (A45 binary reachability)

- **Layer:** Edge Case Hunter.
- **Finding:** RUNBOOK §6.2 Diagnose prescribed `curl -s http://localhost:8080/health/detail | jq .` to be run *inside* the `api` container (`railway shell --service api`). The backend runtime image ([backend/Dockerfile:51–73](../../backend/Dockerfile)) installs only `tzdata`, `curl`, `ca-certificates`, `gnupg`, `postgresql-client-17` — **`jq` is absent**. An in-container `| jq` fails. Same class as the Epic-15 boundary P2 (`aws s3` against a container without the AWS CLI).
- **Patch:** reworded to `curl -s …/health/detail` with an explicit note that `jq` is not in the image — read the raw JSON or pipe to `jq` on the workstation. The `railway shell` form remains `[!] verify` (CLI-version-dependent).

## Dismissed / acknowledged (no patch)

- **Anchor slugs in the RUNBOOK TOC + Quick reference** (Blind Hunter): verified each `#…` link against GitHub's heading-slug algorithm — e.g. `### 6.2 API won't go healthy (Keycloak / DB health-check failing)` → `#62-api-wont-go-healthy-keycloak--db-health-check-failing` (double hyphen from the ` / `), `### 6.3 … redirect_uri` keeps the underscore. All TOC/quick-ref links match their headings. No patch.
- **docs/14 cross-links by section number, not anchor** (Acceptance Auditor): intentional per E18-S1 DEC-1=A — robust against future heading-text edits. The one real Markdown link to docs/14 (intro) resolves. Acknowledged, by design.
- **BETA-TESTER-GUIDE Beta-URL placeholder** (Blind Hunter): `https://…` is an operator-filled value, clearly marked — not a stale/pre-filled-status A42 violation. No patch.
- **`feedback-template.test.ts` repo-root path** (Edge Case Hunter): reads `.github/ISSUE_TEMPLATE/…` via `resolve(cwd, "..", …)` relying on vitest cwd=frontend/ — same assumption as the existing `dockerfile-public-vars.test.ts`, which is CI-proven. No patch.
- **`config.yml` `blank_issues_enabled: true`** (Acceptance Auditor): keeps testers unblocked if the template doesn't fit; valid GitHub chooser config. Acknowledged.

## Acceptance audit (per-AC, A29/A54)

- **E18-S1:** AC-1..AC-9 covered (7 incident rows, not aggregate — A54 satisfied); AC-10 (peer read-through + live-fire) correctly `deferred-pending-beta-green` per A47, not claimed covered.
- **E18-S2:** AC-1..AC-7 covered; the load-bearing Mailtrap caveat (AC-2/AC-7) is stated truthfully in §1/§3/§5 — no false "check your inbox" promise (the highest-risk A42 category-4 surface). AC-8 deferred per A47.
- **E18-S3:** AC-1..AC-7 covered; the 3 coverage gaps (orange-bg, de.json byte-equal parity, layout integration) are closed; DEC-1=A correctly did NOT regress the shipped i18n/path/colour. AC-8 deferred per A47.
- **E18-S4:** AC-1..AC-6 covered; the real gap (`.github/ISSUE_TEMPLATE/beta-feedback.md`) is filled + locked by a filename-parity test; banner unchanged. AC-7 deferred per A47.

## Quality gates (post-patch)

- **Frontend:** `npx vitest run` → **174 passed / 25 files** (was 166 pre-epic; +8 for E18). Typecheck clean; eslint+prettier clean on all changed files.
- **Backend:** unaffected — zero backend files in the epic diff (suite remains at the E17-close baseline of 2075).
- **P1 patch** re-verified: Markdown-only change; suite re-run still 174 green.

## Deferred to deferred-work.md

None. (The 4 A47 live-walkthrough items — E18-S1 Q1/Q2, E18-S2 Q1, E18-S3 Q1, E18-S4 Q1 — are tracked as the unified Wave-9 walkthrough queue in each story's Completion Notes, requiring a green Beta deploy.)

## Conclusion

**APPROVE.** 1 patch applied (P1, A45 binary reachability). The epic is documentation + regression coverage + one GitHub template, with zero production-code change and no regressions. All `[!]` live-Beta items are correctly deferred (A47), not falsely claimed. Proceed to retrospective and flip E18 + its 4 stories to `done`.
