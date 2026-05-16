# Story 20.2: Add SPDX Headers Policy for New Files Going Forward

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a maintainer**,
I want **SPDX identifiers on newly created source files**,
so that **license provenance is machine-introspectable at minimal REUSE-Compliance scope without paying the cost of a mass-sweep over existing files**.

**Requirement:** REQ-089 AC-6. Epic E20 (Open Source Foundation), Story 2 of 5. Depends on E20-S1 (must run after `CONTRIBUTING.md` exists so this story can append a section). No code is changed; this is a policy story.

## Acceptance Criteria

1. **CONTRIBUTING.md SPDX section.** `CONTRIBUTING.md` (created in E20-S1) gains a new top-level section titled `SPDX license headers`. The section is inserted at the placeholder marked `<!-- SPDX policy: see E20-S2 -->` from E20-S1 Task 4.7. The section content is:
   - **Rule line (verbatim):** "New source files committed after 2026-05-15 must begin with `// SPDX-License-Identifier: AGPL-3.0-or-later` (or the equivalent comment syntax for the file type — see table below)."
   - **Scope clarification:** "Existing files are NOT retroactively swept. A future story may add a sweep if `reuse lint` becomes a release gate."
   - **Comment-syntax table** covering the file types in this repository — see AC-2.
   - **Editor configuration pointer** — see AC-3.
2. **Comment-syntax table in CONTRIBUTING.md.** A short table listing every file type the policy applies to, with the exact header comment to use. The table covers, at minimum, the following types (drawn from the actual repository file extensions):

   | File type | Extensions | Header |
   |---|---|---|
   | C# | `.cs` | `// SPDX-License-Identifier: AGPL-3.0-or-later` |
   | TypeScript / JavaScript / TSX / JSX | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` | `// SPDX-License-Identifier: AGPL-3.0-or-later` |
   | CSS / SCSS | `.css`, `.scss` | `/* SPDX-License-Identifier: AGPL-3.0-or-later */` |
   | YAML | `.yml`, `.yaml` | `# SPDX-License-Identifier: AGPL-3.0-or-later` |
   | Dockerfile | `Dockerfile`, `*.dockerfile` | `# SPDX-License-Identifier: AGPL-3.0-or-later` |
   | Shell | `.sh`, `.bash` | `# SPDX-License-Identifier: AGPL-3.0-or-later` (after the shebang) |
   | PowerShell / Batch | `.ps1`, `.bat`, `.cmd` | `# SPDX-License-Identifier: AGPL-3.0-or-later` (PowerShell) / `REM SPDX-License-Identifier: AGPL-3.0-or-later` (batch) |
   | Java (Keycloak SPI) | `.java` | `// SPDX-License-Identifier: AGPL-3.0-or-later` |
   | Markdown | `.md` | Not required (license context is implicit; documentation, not source). If desired, a YAML front-matter `license: AGPL-3.0-or-later` is acceptable. |
   | JSON | `.json` | **Not required.** JSON has no native comment syntax; SPDX header policy explicitly exempts JSON files. (Translation-key files like `frontend/messages/de.json`, `frontend/messages/en.json` are exempt.) |

   The table is the source of truth — if a file extension is not in the table, the rule does not apply and the contributor should ask in their PR.
3. **Editor configuration pointer.** A short paragraph in the new SPDX section pointing contributors at two optional tools (NOT enforced automatically per the architecture decision):
   - VS Code: extension `psioniq.psi-header` with a template snippet for AGPL-3.0-or-later.
   - JetBrains Rider / IntelliJ: File and Code Templates configured per file type.
   - Pre-commit hook hint: a `husky` + `lint-staged` pre-commit hook that fails the commit if a staged source file in the table types lacks an SPDX header is mentioned as a future enhancement, not required now.
   The paragraph closes with: "Automatic enforcement is out of scope; PR review enforces this policy."
4. **README pointer.** A one-line addition to `README.md` Contributing section (or wherever CONTRIBUTING is linked) noting "New source files require an SPDX header — see [CONTRIBUTING.md](CONTRIBUTING.md#spdx-license-headers)." Place this next to the existing CONTRIBUTING.md link; do NOT create a new section.
5. **Anchor stability.** The CONTRIBUTING.md heading text `## SPDX license headers` (or equivalent slug `spdx-license-headers`) is the anchor target. The slug must match the link in AC-4. If the dev agent chooses a different heading, AC-4's link must update to match exactly.
6. **No code changes.** This story modifies only `CONTRIBUTING.md` and `README.md`. Zero changes to `backend/src/`, `frontend/src/`, `infra/`, or `.github/workflows/`. No tests are added; this is a documentation-only deliverable. The "test" is a peer review of the policy text and the comment-syntax table.
7. **No new file creation.** This story does NOT add `.editorconfig`, pre-commit hooks, linter configs, or CI checks. Those are explicitly mentioned in the policy as future enhancements only.

## Tasks / Subtasks

- [ ] **Task 1 — Locate placeholder (AC: 1)** — Open `CONTRIBUTING.md` from E20-S1. Find the line `<!-- SPDX policy: see E20-S2 -->`. If absent (E20-S1 not yet merged), pause and surface a blocker in the story Completion Notes.
- [ ] **Task 2 — Author the section (AC: 1, 2, 3)** — Replace the placeholder with the new top-level section.
  - [ ] 2.1 Heading: `## SPDX license headers` (Markdown H2, slug `spdx-license-headers`).
  - [ ] 2.2 Paragraph 1: the rule line from AC-1 verbatim.
  - [ ] 2.3 Paragraph 2: the scope clarification from AC-1.
  - [ ] 2.4 Comment-syntax table per AC-2. Use GitHub-flavored Markdown table syntax.
  - [ ] 2.5 Paragraph 3: editor configuration pointer per AC-3.
- [ ] **Task 3 — README cross-link (AC: 4)** — Open `README.md`. Find the existing Contributing section or the link to CONTRIBUTING.md. Add the one-line pointer next to it. Do NOT touch unrelated lines.
- [ ] **Task 4 — Verify anchor (AC: 5)** — Confirm the GitHub-flavored Markdown slug of the new heading is `spdx-license-headers`. Test by rendering `CONTRIBUTING.md` (any Markdown viewer) and confirming `CONTRIBUTING.md#spdx-license-headers` scrolls to the section.
- [ ] **Task 5 — Verify no code/CI changes (AC: 6, 7)** — Run `git diff --stat`; the only changed files must be `CONTRIBUTING.md` and `README.md`. No new files, no deletions, no changes anywhere else.
- [ ] **Task 6 — Peer review checklist** — The story's "test" is a peer review confirming:
  - [ ] 6.1 The rule line is unambiguous.
  - [ ] 6.2 The comment-syntax table covers C#, TypeScript, JavaScript, JSON exemption, YAML, Dockerfile, Java SPI.
  - [ ] 6.3 The scope clarification ("existing files NOT swept") is clear so reviewers do not block PRs over missing headers on legacy files.
  - [ ] 6.4 The editor-config paragraph explicitly says automation is out of scope.

## Dev Notes

### Files to edit (only)

- `CONTRIBUTING.md` — append a new `## SPDX license headers` section at the placeholder created by E20-S1 Task 4.7.
- `README.md` — add a one-line link next to the existing CONTRIBUTING reference.

### Files that must NOT change

- `backend/**` — no source-file SPDX retrofits. The policy is **forward-only**.
- `frontend/**` — same.
- `infra/**` — same.
- `.github/workflows/**` — no SPDX linter, no `reuse lint` action.
- `.editorconfig` — no SPDX-injection directives.

### Why minimal scope (no mass sweep, no automation)?

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later`]
[Source: `_bmad-output/planning-artifacts/prd.md#REQ-089 Open Source License Surface` — AC-6]

- REUSE-Compliance has tiered conformance. The project adopts the lowest tier ("minimal") for Beta: new files only.
- A mass sweep over existing files would: (a) inflate the diff for this story by thousands of lines, (b) require a re-review of every touched file, (c) provide negligible legal protection over the existing `LICENSE` file at repo root.
- Automated enforcement (pre-commit hook, `reuse lint` CI gate) would slow PRs from drive-by contributors who forget. PR review is sufficient at this scale.
- A follow-up story (not yet planned) may upgrade the policy when the repository reaches >50 external contributors per quarter.

### What "new source file" means in practice

- "New" = added in a commit dated after the merge date of this story (recorded in the section as `committed after 2026-05-15`).
- Edits to an existing file do NOT trigger header addition; the file remains unheadered until a future explicit sweep.
- File renames that preserve `git log --follow` history are edits, not "new" files.
- A copy-paste of significant content into a new file IS new — the dev agent should add an SPDX header to such copies.

### JSON exemption rationale

JSON has no native comment syntax. Adding a JavaScript-style `// SPDX-…` header makes the file unparseable. Translation-key files (`frontend/messages/de.json`, `frontend/messages/en.json`) and config JSON (`package.json`, `tsconfig.json`, `appsettings.json`) are explicitly exempt. The repo-root `LICENSE` file plus the JSON-format `package.json`'s `license` field are sufficient for these.

### Editor configuration — recommended but not required

The section names two editors because they cover the project's two main file types (Rider for C#, VS Code for TypeScript). Including instructions inline is out of scope; the section just names the tools so contributors know where to look. The dev agent should NOT write step-by-step setup guides for any editor.

### Forward references to downstream E20 stories

- **E20-S3 (`/about` endpoint):** New backend source files (`AboutEndpoints.cs`, `AboutResponse.cs`, `BrandingOptions.cs`) must begin with the C# SPDX header from the table.
- **E20-S4 (frontend footer):** New frontend source files (`Footer.tsx`, `Footer.test.tsx`, possibly `frontend/src/app/public/license/page.tsx`) must begin with the TypeScript SPDX header from the table.
- **E20-S5 (GHCR pipeline):** New workflow file `.github/workflows/build-images.yml` must begin with the YAML SPDX header from the table.

The dev-story workflow for E20-S3, E20-S4, and E20-S5 should reference this policy at file-creation time.

### Architecture constraints

- No automated enforcement is part of this story.
- No tooling dependency is introduced. `reuse-tool`, `licensecheck`, and similar utilities are NOT installed.
- The CONTRIBUTING.md change is English-only — no `next-intl` impact.
- `.editorconfig` indentation rules still apply to CONTRIBUTING.md (LF endings, 2-space indent for Markdown).

### Test plan and evidence

- **AC-1, 2, 3:** Peer review confirms the section is present, the table is complete for repo file types, and the editor-config paragraph is unambiguous about "out of scope."
- **AC-4:** Render README; confirm the SPDX link is visible next to the CONTRIBUTING link.
- **AC-5:** Click `CONTRIBUTING.md#spdx-license-headers` — confirm it scrolls correctly.
- **AC-6, 7:** `git diff --stat` shows exactly two changed files (`CONTRIBUTING.md`, `README.md`); no new files added.
- **No automated tests** — peer review only, per ADR-009 minimal scope.

### Project Structure Notes

- EDIT files: `CONTRIBUTING.md`, `README.md`.
- No new files.
- No code changes.
- No tests.
- No translations.
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e20-s2-add-spdx-headers-policy-for-new-files.md`.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later`]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E20-S2: Add SPDX headers to new files going forward`]
- [Source: `_bmad-output/planning-artifacts/prd.md#REQ-089 Open Source License Surface` — AC-6]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E20 Story E20-S2`]
- [Source: `https://reuse.software/spec/` — REUSE Specification 3.2 (informational reference)]
- [Source: E20-S1 — `e20-s1-add-license-dco-and-contributing.md` — creates the CONTRIBUTING.md placeholder this story fills]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List
