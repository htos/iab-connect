# Story 20.1: Add LICENSE, NOTICE, CONTRIBUTING, and DCO Enforcement

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a contributor or self-hoster of IAB Connect**,
I want **clear license terms, a dependency notice, contribution rules, and machine-enforced DCO sign-off**,
so that **I understand my legal obligations before submitting a PR and the project preserves a clean audit trail of contributions**.

**Requirement:** REQ-089 AC-1, AC-2, AC-3. Epic E20 (Open Source Foundation), Story 1 of 5 — the **legal foundation** of E20. E20-S2 (SPDX policy in CONTRIBUTING), E20-S3 (`/about` endpoint), E20-S4 (license footer), and E20-S5 (GHCR publishing) reference the artifacts created here.

## Acceptance Criteria

1. **`LICENSE` file at repo root.** Contains the verbatim AGPL-3.0 text exactly as published by the FSF at `https://www.gnu.org/licenses/agpl-3.0.txt`. The file MUST be byte-identical with the canonical text — no project-specific edits and no copyright-holder substitutions inside the license body. The copyright statement lives in a separate `COPYRIGHT` notice (AC-2), not inside `LICENSE`.
2. **`COPYRIGHT` notice at repo root.** A short `COPYRIGHT` file with the exact wording: `Copyright (C) 2026  IAB Connect contributors. Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE for terms.` The phrase "or later" must appear literally so the SPDX identifier `AGPL-3.0-or-later` (used in E20-S2 SPDX headers, E20-S3 `/about` endpoint, and E20-S5 OCI labels) is unambiguous. Mirror this section as the first heading of `NOTICE.md` (AC-3).
3. **`NOTICE.md` dependency listing at repo root.** Lists every direct production dependency of `backend/` and `frontend/` with its declared license. The list is generated reproducibly by the commands documented at the bottom of `NOTICE.md`: `dotnet list package` from `backend/` and `npm ls --omit=dev --depth=0` from `frontend/`. Transitive dependencies are out of scope for this story. NOTICE.md sections in order: (a) Copyright (mirror of `COPYRIGHT`), (b) Backend dependencies, (c) Frontend dependencies, (d) How this list is regenerated.
4. **`CONTRIBUTING.md` at repo root.** Sections in order: (1) Project license (one paragraph: "by contributing you license your patch under AGPL-3.0-or-later"); (2) DCO sign-off (paragraph including a literal `Signed-off-by: Your Name <your.email@example.com>` example, the phrase "use `git commit -s`", and the one-line note "Branch protection on `main` and `beta` requires this check"); (3) Workflow (branch → commit signed → open PR → address review); (4) Local development (link to `docs/06_dev_workflow.md` and the README quickstart); (5) Tests (`dotnet test` from `backend/`, `npm test` and Playwright from `frontend/`); (6) Filing issues. The CONTRIBUTING flow uses Conventional Commits style per existing repo convention.
5. **README license badge updated, not added.** `README.md` currently shows `License-Private-red` at line 25 (`<img src="https://img.shields.io/badge/License-Private-red?style=flat-square" alt="License" />`). Replace that line with an AGPL-3.0-or-later badge: `<a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square" alt="License: AGPL-3.0-or-later" /></a>`. The badge image links to the repo-local `LICENSE` file (relative link, no clicks rely on shields.io availability). Do not add additional shields; only swap this one.
6. **DCO GitHub Action.** A new `.github/workflows/dco.yml` runs on `pull_request` events targeting branches `main` and `beta`. The action validates that every commit in the PR carries a `Signed-off-by:` trailer whose email matches the commit author email. The status check name must be stable (e.g., `DCO`) because branch protection (AC-7) pins to that name. Pin the third-party action by full 40-character commit SHA (not by tag) for supply-chain safety. Recommended action: `dcoapp/action` (no SaaS dependency, runs as a normal GitHub Action).
7. **Branch protection note documented.** A one-line note in CONTRIBUTING.md Section "DCO sign-off" states: "Branch protection on `main` and `beta` requires this check." The actual branch protection rule must be configured manually in the GitHub UI ("Require status checks to pass before merging" → add the `DCO` check); this story's deliverable is the documentation reference. Manual configuration is a documented follow-up step in the story Completion Notes (no code artifact).
8. **No regression to existing CI.** `.github/workflows/` is empty today (only `.github/agents/Hive.agent.md` and `.github/java-upgrade/` exist there). Adding `dco.yml` must not affect those non-workflow files. After this story, `.github/workflows/` contains exactly one file: `dco.yml`. Future Epic-20 stories (E20-S5) and Epic-12 stories add more workflows.

## Tasks / Subtasks

- [ ] **Task 1 — `LICENSE` (AC: 1)** — Fetch the canonical AGPL-3.0 text from `https://www.gnu.org/licenses/agpl-3.0.txt` and commit it to repo root verbatim. Do NOT edit the boilerplate-substitution placeholders inside the license body; the copyright lives in `COPYRIGHT` (per FSF guidance).
  - [ ] 1.1 Download with `curl https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE` (or equivalent). Verify byte length and SHA-256 against a known reference if possible.
  - [ ] 1.2 Verify no trailing whitespace or CRLF mangling (the repo uses LF per `.editorconfig`).
- [ ] **Task 2 — `COPYRIGHT` notice (AC: 2)** — Author the file with the exact wording shown in AC-2. Use 2026 as the copyright year.
  - [ ] 2.1 The exact string must include the literal substring "or later" so `AGPL-3.0-or-later` SPDX identifier resolution is unambiguous.
- [ ] **Task 3 — `NOTICE.md` dep list (AC: 3)** — Author with four sections in order.
  - [ ] 3.1 Section 1 — Copyright (mirror of `COPYRIGHT`).
  - [ ] 3.2 Section 2 — Backend dependencies. Run `dotnet list package` from `backend/`. Copy the per-project table. Annotate each direct dependency with its declared license (`MIT`, `Apache-2.0`, `BSD-3-Clause`, `PostgreSQL`, `LGPL-2.1-only`, etc.) read from the package's nuget.org page or `.nuspec`.
  - [ ] 3.3 Section 3 — Frontend dependencies. Run `npm ls --omit=dev --depth=0` from `frontend/`. Copy the tree. Annotate each direct dependency with the license from its `package.json` `license` field.
  - [ ] 3.4 Section 4 — "How this list is regenerated". Copy the two commands verbatim. Add a sentence: "Re-run these whenever a direct dependency is added, removed, or version-bumped."
  - [ ] 3.5 Confirm against ADR-009 that every direct dependency's license is AGPL-3.0-or-later-compatible (MIT, Apache-2.0, BSD, ISC, LGPL — all compatible; if a new GPL-incompatible license appears, flag in Completion Notes).
- [ ] **Task 4 — `CONTRIBUTING.md` (AC: 4)** — Six numbered sections per the structure in AC-4.
  - [ ] 4.1 Section 1 (License). One paragraph. Link to `LICENSE`. Closing sentence: "By contributing a patch you agree to license it under AGPL-3.0-or-later."
  - [ ] 4.2 Section 2 (DCO sign-off). Paragraph including: literal example `Signed-off-by: Your Name <your.email@example.com>`, instruction `git commit -s -m "..."`, and the branch-protection note from AC-7. Link to `https://developercertificate.org/` for DCO v1.1 full text.
  - [ ] 4.3 Section 3 (Workflow). Four-step list: branch from `main` or `beta` → commit signed → open PR → address review. Mention Conventional Commits style (existing repo convention from README).
  - [ ] 4.4 Section 4 (Local development). Link to `docs/06_dev_workflow.md` (if it exists; if not, link to the README's "Getting Started" section).
  - [ ] 4.5 Section 5 (Tests). Three bullets: `dotnet test` from `backend/`, `npm test` from `frontend/`, Playwright `npm run e2e` from `frontend/`.
  - [ ] 4.6 Section 6 (Filing issues). Reserve one paragraph; if no issue templates exist yet, say "Use the issue tracker at `https://github.com/htos/iab-connect/issues`. Search for duplicates before opening a new issue."
  - [ ] 4.7 Add an SPDX header policy placeholder section at the bottom — left empty in this story; **Story E20-S2 fills it in.** A short comment `<!-- SPDX policy: see E20-S2 -->` marks the location.
- [ ] **Task 5 — README badge swap (AC: 5)** — Edit `README.md` line 25.
  - [ ] 5.1 Replace `<img src="https://img.shields.io/badge/License-Private-red?style=flat-square" alt="License" />` with `<a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square" alt="License: AGPL-3.0-or-later" /></a>`.
  - [ ] 5.2 Do not touch the other five badges (`.NET`, `Next.js`, `PostgreSQL`, `Keycloak`, `Docker`). Do not add new badges.
  - [ ] 5.3 Render preview locally if possible (any Markdown viewer); confirm the linked `LICENSE` resolves to the new file from Task 1.
- [ ] **Task 6 — DCO GitHub Action (AC: 6)** — Create `.github/workflows/dco.yml`.
  - [ ] 6.1 Trigger: `pull_request` events with `branches: [main, beta]`. Permissions: minimal (`pull-requests: read`, `contents: read`).
  - [ ] 6.2 Single job named `dco` with a single step using `dcoapp/action@<full-40-char-SHA>` (resolve the SHA at implementation time from `https://github.com/dcoapp/action/commits/main`). Add a YAML comment above the `uses:` line documenting the source action and the SHA tag.
  - [ ] 6.3 Status check name: the action publishes the check as `DCO` by default — confirm and record the exact name in the story Completion Notes (branch protection in AC-7 must match this name verbatim).
  - [ ] 6.4 Add a top-of-file YAML comment: "Enforces the DCO sign-off policy documented in CONTRIBUTING.md Section 2. See ADR-010 for rationale."
- [ ] **Task 7 — Branch protection note (AC: 7)** — Manual configuration is a follow-up step, not a code artifact in this story.
  - [ ] 7.1 In CONTRIBUTING.md Section 2 (DCO sign-off), add the literal sentence: "Branch protection on `main` and `beta` requires the `DCO` status check to pass before merge."
  - [ ] 7.2 In the story's Completion Notes, document the manual GitHub UI steps the maintainer must perform after merge: Settings → Branches → `main` → "Require status checks to pass before merging" → search for `DCO` → require. Repeat for `beta`.
  - [ ] 7.3 Do NOT block merge of this story on the manual UI step — the DCO workflow file itself is the deliverable; the protection rule is a one-time admin action documented for the maintainer.
- [ ] **Task 8 — Verify no CI conflict (AC: 8)** — After all files are committed, list `.github/workflows/`. Expected output: exactly `dco.yml`.
  - [ ] 8.1 Confirm `.github/agents/Hive.agent.md` and `.github/java-upgrade/` are untouched (they are not workflows; they live in sibling directories under `.github/`).
  - [ ] 8.2 Open the PR for this story with a small Conventional Commit message (e.g., `chore(oss): add LICENSE, NOTICE, CONTRIBUTING and DCO workflow`). Verify the new DCO check itself passes against this PR (it should — every commit in this PR must be sign-off-trailed by the dev agent or human author).

## Dev Notes

### Files to create

- `LICENSE` — verbatim FSF AGPL-3.0 text from `https://www.gnu.org/licenses/agpl-3.0.txt`.
- `COPYRIGHT` — single-paragraph copyright + license-grant statement (exact wording in AC-2).
- `NOTICE.md` — four sections: copyright, backend deps, frontend deps, regeneration commands.
- `CONTRIBUTING.md` — six numbered sections per AC-4 (plus SPDX policy placeholder for E20-S2).
- `.github/workflows/dco.yml` — DCO check workflow (pinned action SHA).

### Files to edit

- `README.md` — swap the existing `License-Private-red` badge at line 25 for an AGPL-3.0-or-later badge linked to `LICENSE`. Do not modify any other line.

### Why AGPL-3.0-or-later (and not -only)?

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later`]

- The `-or-later` variant retains flexibility to accept future FSF AGPL versions without per-contributor consent.
- All current direct dependencies (.NET MIT, Next.js MIT, Hangfire LGPL, Keycloak Apache-2.0, RustFS Apache-2.0, NuGet/npm deps Apache/MIT/ISC/PostgreSQL/LGPL) are AGPL-compatible — see the dependency audit in ADR-009.
- Closed-source SaaS forks must publish modifications, which aligns with author intent. Some corporate contributors may decline to participate — accepted tradeoff.
- The maintainer retains the option to dual-license commercially in the future, subject to DCO compliance and an explicit CLA addition for that purpose (ADR-010 notes DCO alone does not grant re-licensing rights).

### Why DCO and not a CLA?

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-010: Contributor Identity — DCO`]

- DCO is the lowest-friction OSS-standard contributor mechanism (used by Linux, Docker, Kubernetes, Hangfire).
- Drive-by contributors need only `git commit -s` — no out-of-band CLA acceptance.
- A future commercial dual-license would require explicit per-contributor agreement (DCO does not by itself authorize re-licensing).

### DCO Action pinning rationale

Third-party action pinning by SHA (not tag) prevents a maintainer of the upstream action from silently swapping the action body. From the workflow:

```yaml
- name: DCO check
  # dcoapp/action — full 40-char SHA pinned at story implementation time.
  # See https://github.com/dcoapp/action for source.
  uses: dcoapp/action@<resolve-at-impl-time>
```

Resolve the SHA at the moment of writing the YAML; do not commit `@main` or `@v3` aliases.

### What goes in NOTICE.md vs. LICENSE

- `LICENSE` is the FSF text only. Never edit. Never add the project's copyright inside it.
- `COPYRIGHT` is the project's own copyright/license-grant statement (one paragraph).
- `NOTICE.md` is the customary OSS location for (a) the project copyright (mirror of `COPYRIGHT`), (b) the third-party-deps-and-licenses list. NOTICE is consumed by `/about` (E20-S3) only indirectly — it is not surfaced by the application; tools like `reuse lint` consume it.

### Reproducibility of the deps list

The commands documented in `NOTICE.md` Section 4:

```
# Backend (run from backend/):
dotnet list package

# Frontend (run from frontend/):
npm ls --omit=dev --depth=0
```

Per-PR cost is ~1 minute. Re-running keeps `NOTICE.md` current without ceremony. A follow-up story (out of scope) may automate this regeneration via a GitHub Action.

### Per-file SPDX headers — out of scope for this story

Story E20-S2 introduces a CONTRIBUTING-policy that **new** files must begin with `// SPDX-License-Identifier: AGPL-3.0-or-later`. A mass-sweep over existing files is explicitly out of scope per architecture ADR-009 (REUSE-Compliance minimal scope). This story leaves a placeholder section at the bottom of CONTRIBUTING.md (Task 4.7) for E20-S2 to fill.

### Forward references to downstream E20 stories

- **E20-S2 (SPDX policy):** Appends an SPDX-headers policy section to CONTRIBUTING.md authored here. The placeholder in Task 4.7 marks the insertion point.
- **E20-S3 (`/about` endpoint):** Emits `license: "AGPL-3.0-or-later"` — must match the SPDX identifier produced by AC-2/AC-3 exactly. Any drift causes /about consumers to display a mismatched license name.
- **E20-S4 (frontend footer):** Renders the license name string read from `/about`. Source link goes to `/about`.
- **E20-S5 (GHCR images):** OCI label `org.opencontainers.image.licenses` must equal `AGPL-3.0-or-later` — same string as `/about` and as the SPDX identifier here.

### Architecture and project constraints

- The repository becomes a public OSS project at merge of this story. Subsequent commits must avoid committed secrets — Story E14-S1 (secrets audit) is the explicit remediation if any are found post-publication.
- The CONTRIBUTING flow assumes GitHub-based contributions. If the project later mirrors to a non-GitHub forge, the DCO action will not run there; an alternative enforcement must be considered.
- `.editorconfig` enforces LF endings and final newline — make sure the `LICENSE` file you fetch from FSF has LF endings (it does upstream; Windows `curl` may add CRLF — strip if needed).
- The DCO check name `DCO` is stable and used by branch protection (AC-7). If the action publishes a different check name, document the actual name in Completion Notes and update CONTRIBUTING.md accordingly.

### Test plan and evidence

- **AC-1 (LICENSE byte-identical):** `sha256sum LICENSE` matches the SHA-256 of the canonical text. Record both in Completion Notes.
- **AC-3 (NOTICE.md reproducibility):** Re-running the documented commands twice produces identical output (small modulo ordering — note any ordering caveats).
- **AC-6 (DCO action triggers):** Open a draft PR with a single non-signed-off commit; the DCO check fails. Amend to add `Signed-off-by:`; the check passes. Capture screenshots or check log links in Completion Notes.
- **AC-8 (no CI conflict):** `find .github/workflows -type f` returns only `dco.yml`.

### Project Structure Notes

- NEW files: `LICENSE`, `COPYRIGHT`, `NOTICE.md`, `CONTRIBUTING.md`, `.github/workflows/dco.yml`.
- EDIT files: `README.md` (single-line badge swap at line 25).
- No code changes to `backend/src/`, `frontend/src/`, or `infra/` in this story.
- No EF migrations.
- No translation key additions (CONTRIBUTING.md is English-only by OSS convention; no `next-intl` impact).
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e20-s1-add-license-dco-and-contributing.md`.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-010: Contributor Identity — DCO`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)` — downstream consumer of license identifier]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E20-S1: Add LICENSE, NOTICE, CONTRIBUTING and DCO enforcement`]
- [Source: `_bmad-output/planning-artifacts/prd.md#REQ-089 Open Source License Surface`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 2 — License row, Section 4 — ADR-009/010, Section 5 — Epic E20`]
- [Source: `https://www.gnu.org/licenses/agpl-3.0.txt` — canonical license text]
- [Source: `https://developercertificate.org/` — DCO v1.1 text]
- [Source: `https://github.com/dcoapp/action` — DCO action source]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List
