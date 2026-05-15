# Story 20.1: Add LICENSE, NOTICE, CONTRIBUTING, and DCO Enforcement

Status: ready

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a contributor or self-hoster of IAB Connect**,
I want **clear license terms, dependency notices, contribution rules, and machine-enforced DCO sign-off**,
so that **I understand my legal obligations before submitting code and the project preserves a clean audit trail of contributions**.

**Requirement:** REQ-089 AC-1, AC-2, AC-3. Epic E20 (Open Source Foundation), Story 1 of 5 — the **legal foundation** of E20. E20-S2 (SPDX-policy in CONTRIBUTING), E20-S3 (`/about` endpoint), E20-S4 (license footer), and E20-S5 (GHCR publishing) reference the artifacts created here.

## Acceptance Criteria

1. **`LICENSE` file.** A new file at the repository root contains the verbatim AGPL-3.0 license text as published by the FSF at https://www.gnu.org/licenses/agpl-3.0.txt. The file MUST be byte-identical with that canonical text — no project-specific edits, no copyright-holder substitutions inside the license body itself.
2. **Copyright notice.** A `COPYRIGHT` file or a leading section in `NOTICE.md` records the project copyright in the form `Copyright (C) 2026  IAB Connect contributors. Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE for terms.` The wording must include the exact phrase "or later" so the SPDX identifier `AGPL-3.0-or-later` is unambiguous.
3. **`NOTICE.md` dependency listing.** A new `NOTICE.md` at the repository root lists every direct production dependency of `backend/` and `frontend/` with its declared license. The list is generated reproducibly by the commands documented in the same file (`dotnet list package` for backend, `npm ls --omit=dev --depth=0` for frontend). Transitive deps are out of scope for this story but a follow-up may extend.
4. **`CONTRIBUTING.md`.** A new `CONTRIBUTING.md` at the repository root covers: (a) project license and what it implies for contributors, (b) the DCO sign-off requirement with a literal `Signed-off-by: Name <email>` example, (c) `git commit -s` mention, (d) the development workflow pointer to `docs/06_dev_workflow.md`, (e) how to file an issue / discuss before large changes, (f) how to run tests locally.
5. **README badge.** `README.md` carries an AGPL-3.0-or-later badge inside the existing header section (above the table of contents or under the project name). The badge image is served from `https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg` and links to the local `LICENSE` file (relative link, no external dependency on shields.io for clicks).
6. **DCO GitHub Action.** A new `.github/workflows/dco.yml` runs on pull requests targeting `main` or `beta`. The action validates that every commit in the PR carries a `Signed-off-by:` trailer whose email matches the commit author's email. The action exit code is non-zero on missing or mismatched sign-off; that failure is the GitHub status check used in branch protection.
7. **Branch protection.** `main` and `beta` require the `DCO` status check (and existing required checks) to pass before merge. This is configured in the GitHub UI (a one-line note in `CONTRIBUTING.md` mentions the protection rule for transparency).
8. **No regression to existing CI.** Adding the DCO workflow does not break any existing GitHub Actions workflow (today there are none under `.github/workflows/`, so this is trivially satisfied — but the story explicitly verifies the absence/no-conflict).

## Tasks / Subtasks

- [ ] **Task 1 — `LICENSE` (AC: 1)** — download the canonical AGPL-3.0 text from https://www.gnu.org/licenses/agpl-3.0.txt and commit it to the repo root verbatim. **Do not** edit the boilerplate-substitution placeholders inside the license body (the FSF discourages this — the copyright lives in `COPYRIGHT`/`NOTICE.md` and in per-file SPDX headers, not inside the license file).
- [ ] **Task 2 — `COPYRIGHT` notice (AC: 2)** — author a short top-level `COPYRIGHT` file with the exact wording shown in AC-2. Mirror the same wording into the top of `NOTICE.md` so a reader of either file sees the copyright/license-statement.
- [ ] **Task 3 — `NOTICE.md` dep list (AC: 3)** — author `NOTICE.md` with the following structure: (a) Copyright section (mirrors `COPYRIGHT`), (b) "Backend dependencies" section, (c) "Frontend dependencies" section, (d) "How this list is regenerated" section with the two commands. **Decision:** for the Backend list, run `dotnet list package` from `backend/` and copy the resulting table; manually annotate each line with the declared license read from each package's `nuget.org` page (most are MIT/Apache-2.0/BSD/PostgreSQL — see ADR-009 dependency audit). For the Frontend list, run `npm ls --omit=dev --depth=0` from `frontend/` and copy the resulting tree, annotating each direct dep with the license from its `package.json` `license` field.
- [ ] **Task 4 — `CONTRIBUTING.md` (AC: 4)** — sections in order: (1) License (one paragraph pointing at LICENSE and explaining "by contributing you license your patch under AGPL-3.0-or-later"); (2) DCO sign-off (paragraph with example trailer + `git commit -s` mention); (3) Workflow (`branch from main or beta`, `commit signed`, `open PR`, `address review`); (4) Local dev pointer (link to `docs/06_dev_workflow.md` and `README.md` quickstart); (5) Tests (`dotnet test` from `backend/`, `npm test` and `npm run e2e` from `frontend/`); (6) Issue templates and labels.
- [ ] **Task 5 — README badge (AC: 5)** — open `README.md`; locate the title section (line 1–10 area); insert the badge image+link immediately under the H1. Verify the rendered Markdown shows the badge in GitHub UI after push.
- [ ] **Task 6 — DCO GitHub Action (AC: 6)** — create `.github/workflows/dco.yml` using a minimal pinned-version setup. **Decision:** use the open-source [`dcoapp/action`](https://github.com/dcoapp/action) (no third-party SaaS required, runs as a normal action) pinned by SHA. Trigger: `pull_request` events on `main` and `beta`. Configure the action to fail the check when any commit lacks `Signed-off-by:`. Use a comment in the YAML explaining that this matches the policy documented in `CONTRIBUTING.md` Section "DCO sign-off".
- [ ] **Task 7 — Branch protection note (AC: 7)** — manually configure GitHub branch protection on `main` and `beta`: "Require status checks to pass before merging" → add the `DCO` check from the new workflow. Add a one-line note in `CONTRIBUTING.md` Section DCO: "Branch protection on `main` and `beta` requires this check."
- [ ] **Task 8 — Verify no CI conflict (AC: 8)** — confirm `.github/workflows/` contains only the new `dco.yml` after this story. (Future stories E20-S5, E12-S* will add more workflows.)

## Dev Notes

### Files to create

- `LICENSE` — verbatim FSF AGPL-3.0 text.
- `COPYRIGHT` — single-line copyright + license-grant statement.
- `NOTICE.md` — copyright section + backend deps + frontend deps + regeneration commands.
- `CONTRIBUTING.md` — six numbered sections per Task 4.
- `.github/workflows/dco.yml` — DCO check workflow.

### Files to edit

- `README.md` — insert AGPL badge under the H1 title.

### Why AGPL-3.0-or-later (and not -only)?

[Source: architecture.md ADR-009 (planned, in SCP 2026-05-15 Section 4)]
- The `-or-later` variant lets future maintainers accept any later FSF AGPL version without per-contributor consent.
- Project decision is locked-in: see Sprint Change Proposal 2026-05-15 Section 2 "License" row.
- Dependency audit confirms compatibility — see SCP Section 4 ADR-009.

### Why DCO and not a CLA?

[Source: architecture.md ADR-010 (planned)]
- DCO is the lowest-friction OSS-standard contributor mechanism (Linux, Docker, Kubernetes, Hangfire all use it).
- It does not grant the maintainer rights to re-license without consent — by intent. Future commercial dual-license would require explicit per-contributor agreement; this story does not foreclose that possibility.
- SCP Section 2 "Contributor identity" row records the decision.

### DCO Action pinning

Pin the third-party action by full commit SHA (not by tag) to avoid supply-chain surprises:

```yaml
- uses: dcoapp/action@<full-40-char-sha>  # v3.x
```

The SHA at time of writing is on the action's main branch — fetch the latest at story implementation time and record it in the YAML.

### What goes in NOTICE.md vs. LICENSE

- `LICENSE` is the FSF text only. Never edit it.
- `NOTICE.md` is the project's own statement of (a) its copyright, (b) its license declaration in human terms, (c) the third-party-deps-and-their-licenses list. NOTICE is the customary location for these per OSS convention.
- Per-file SPDX headers come in Story E20-S2 (CONTRIBUTING-policy for new files only); a mass-sweep over the existing tree is out-of-scope and deferred per the REUSE-compliance "minimal" decision in SCP Section 2.

### Reproducibility of the deps list

The commands documented in `NOTICE.md` Section "How this list is regenerated":

```
# Backend (run from backend/):
dotnet list package

# Frontend (run from frontend/):
npm ls --omit=dev --depth=0
```

Re-run these whenever a direct dependency is added/removed/version-bumped — the per-PR cost is ~1 minute and keeps `NOTICE.md` current.

### Architecture and project constraints

- The repository is a public OSS project after this story; treat any subsequent commits accordingly (no committed secrets — see Story E14-S1 for the audit).
- The CONTRIBUTING.md flow assumes GitHub-based contributions; if the project later mirrors to a non-GitHub forge, the DCO action will not run there and an alternative enforcement must be considered.

### Project Structure Notes

NEW files: `LICENSE`, `COPYRIGHT`, `NOTICE.md`, `CONTRIBUTING.md`, `.github/workflows/dco.yml`.
EDIT files: `README.md` (add badge).
No code changes to `backend/src/`, `frontend/src/`, or `infra/` in this story.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 2 — License row]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 4 — ADR-009, ADR-010]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E20, Story E20-S1]
- [Source: https://www.gnu.org/licenses/agpl-3.0.txt — canonical license text]
- [Source: https://developercertificate.org/ — DCO v1.1 text]
