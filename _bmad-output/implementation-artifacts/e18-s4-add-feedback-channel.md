# Story E18-S4: Feedback channel

Status: review

## Story

As **a Beta tester**, I want **a clear feedback link in the banner that lands me on a pre-structured bug/suggestion report**, so that **I can report issues without leaving the app for long and the maintainer receives actionable feedback**.

**Requirement:** REQ-088 AC-10 (AC-7 in SCP §5). Epic E18, Story 4. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E18 Story E18-S4 (lines 1847–1864)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E18 — Story E18-S4 (lines 645–650)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-021 Source-Disclosure Mechanism — AGPL §13 (lines 396–407)](../planning-artifacts/architecture.md)
- [frontend/src/components/navigation/BetaBanner.tsx (already constructs the feedback URL)](../../frontend/src/components/navigation/BetaBanner.tsx)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-18)

**Critical finding: the feedback LINK already ships; only the GitHub issue-template FILE is missing.** Material drift vs. the SCP-2026-05-15 §5 text:

- **The banner already contains a clickable, correctly-wired feedback link.** [`BetaBanner.tsx:75–77`](../../frontend/src/components/navigation/BetaBanner.tsx) computes `feedbackUrl = NEXT_PUBLIC_FEEDBACK_URL || `${sourceUrl}/issues/new?template=beta-feedback.md`` and renders it as an `<a target="_blank" rel="noopener noreferrer">`. So the AC's "the banner contains a clickable feedback link" is already met.
- **The GitHub-issue path is already the chosen path** (the banner's fallback URL points at `/issues/new?template=beta-feedback.md`). The `mailto:` alternative in the AC is therefore moot — the implementation committed to GitHub Issues.
- **`NEXT_PUBLIC_FEEDBACK_URL` + `NEXT_PUBLIC_SOURCE_URL` are fully wired** — `ARG`+`ENV` in [frontend/Dockerfile:56–57,65–66](../../frontend/Dockerfile), documented in [frontend/.env.example:64–70](../../frontend/.env.example), defaulted in [build-images.yml:193](../../.github/workflows/build-images.yml). Forks redirect to their own repo with zero extra config (the `NEXT_PUBLIC_SOURCE_URL` fallback).
- **The genuine gap: [`.github/ISSUE_TEMPLATE/beta-feedback.md`](../../.github/ISSUE_TEMPLATE/) does NOT exist.** The `.github/` directory has `workflows/` (build-images.yml, dco.yml) + `agents/` but no `ISSUE_TEMPLATE/` directory at all. So today the banner link lands on GitHub's "new issue" page with a dead `?template=beta-feedback.md` query (GitHub silently falls back to a blank issue body). **Creating this template file is the real, and essentially only, deliverable of this story.**
- **A31 filename invariant:** the banner hard-codes the template filename `beta-feedback.md` in the URL. The actual file MUST be named exactly `.github/ISSUE_TEMPLATE/beta-feedback.md` or the `?template=` parameter won't resolve. This is a cross-artifact parity that a direct-artifact-read test should lock (read both the template filename and the `BetaBanner.tsx` URL string, assert they agree).
- **The feedback-URL construction is already tested** by E18-S3's `BetaBanner.test.tsx` (env-override + GitHub-fallback + fork-fallback assertions, lines 65–123). This story does NOT re-test URL construction; it owns the template file + the filename-parity invariant + the template's frontmatter.

**Therefore this is a small, well-scoped story:** create the GitHub issue-template file with proper classic-template frontmatter, lock the filename-parity invariant with a test, and verify the end-to-end click flow (deferred to live walkthrough since it needs the public repo + a browser).

## Acceptance Criteria

1. **AC-1 (banner has a clickable feedback link).** The BETA banner renders a clickable feedback link (`<a>`, opens in a new tab with `rel="noopener noreferrer"`). Already shipped at [BetaBanner.tsx:92–99](../../frontend/src/components/navigation/BetaBanner.tsx); covered by E18-S3's `BetaBanner.test.tsx`. Verified, not re-built.
2. **AC-2 (GitHub issue template file exists).** [`.github/ISSUE_TEMPLATE/beta-feedback.md`](../../.github/ISSUE_TEMPLATE/) exists as a GitHub **classic** issue template (Markdown with YAML frontmatter) — chosen because the shipped banner URL uses the classic `?template=beta-feedback.md` parameter, which resolves to a file of that exact name. Frontmatter includes at minimum `name`, `about`, `title` (a `[Beta-Feedback]` prefix), and `labels` (e.g. `beta-feedback`). The body provides a structured form: environment (Beta), what-I-did / what-I-expected / what-happened, screenshots, and a severity hint.
3. **AC-3 (filename parity with the banner URL — A31).** The template filename `beta-feedback.md` matches the `template=beta-feedback.md` value the banner constructs in [BetaBanner.tsx:77](../../frontend/src/components/navigation/BetaBanner.tsx). A direct-artifact-read regression test (A51) reads both the `.github/ISSUE_TEMPLATE/` directory (or the file) and the `BetaBanner.tsx` URL string and asserts the filename agrees — so renaming either side without the other fails at test time.
4. **AC-4 (German-friendly + tester-aligned).** The template body is intelligible to the German-speaking Beta testers (per ADR-018 audience). It may be bilingual or German; it MUST align with what [E18-S2's BETA-TESTER-GUIDE.md](./e18-s2-author-beta-tester-onboarding-guide.md) tells testers the feedback flow is. (Soft cross-story consistency, verified by the A42 reread, not an automated test.)
5. **AC-5 (optional issue-template chooser config).** OPTIONAL per DEC-2: a `.github/ISSUE_TEMPLATE/config.yml` that sets `blank_issues_enabled` and/or a `contact_links` entry. Included only if DEC-2=A; otherwise explicitly out of scope and documented as such.
6. **AC-6 (no production code change; gates clean).** The story adds the template file (+ test). It does NOT modify `BetaBanner.tsx` (the link already works). `npm run typecheck`/`lint`/`format:check` + Vitest stay green; the new parity test follows A35/A46 (pure-Node read → NO jsdom/cleanup).
7. **AC-7 (end-to-end click flow — deferred per A47).** A tester clicks the banner feedback link, lands on the pre-filled `beta-feedback` issue template on the public GitHub repo, and submits an issue. Marked `[!]` — requires the public `htos/iab-connect` repo + a logged-in GitHub user + a Beta deploy. Deferred to the unified Wave-9 walkthrough.

## Decision-Needed (per A32 / A41)

### DEC-1: Feedback transport — GitHub Issues (already chosen) vs. mailto

**Scope:** AC text offers "GitHub issue template OR a `mailto:` address".

**Options:**

- **(A) GitHub Issues classic template — confirm the already-shipped choice; create `.github/ISSUE_TEMPLATE/beta-feedback.md`.** (RECOMMENDED) The banner URL already commits to `/issues/new?template=beta-feedback.md`; the repo is the AGPL public source repo (`htos/iab-connect`); GitHub Issues gives threaded triage, labels, and dedup that `mailto:` cannot. Forks inherit it via `NEXT_PUBLIC_SOURCE_URL`. This is the lowest-friction, already-half-built path.
- **(B) Switch to `mailto:`.** Would require changing `BetaBanner.tsx` (regressing the shipped + tested URL construction), forces the maintainer's address into a build-time public env var (scrape risk), and loses structured triage. Rejected.

**Recommendation:** **A.** Confirm GitHub Issues; ship the template file.

### DEC-2: Issue-template form format — classic `.md` vs. modern `.yml` form, and whether to add `config.yml`

**Scope:** GitHub supports classic Markdown templates (`?template=name.md`) and modern YAML issue forms (`?template=name.yml`).

**Options:**

- **(A) Classic `.md` template (matches the shipped URL) + a minimal `config.yml` (`blank_issues_enabled: true`).** (RECOMMENDED) The banner URL says `beta-feedback.md` — a `.yml` form would need the URL changed (and the `.yml` chooser uses a different query). Classic `.md` is the zero-friction match. The `config.yml` keeps blank issues enabled so testers are never blocked, and is a natural home for a future `contact_links` entry.
- **(B) Classic `.md` template only, no `config.yml`.** Simplest; AC-5 declared out of scope. Acceptable minimum.
- **(C) Modern `.yml` issue form.** Better field validation, but requires editing `BetaBanner.tsx`'s URL (regression of shipped/tested code) — and a `.yml` form changes the `?template=` resolution semantics. Rejected unless the user wants form-field validation enough to also touch the banner.

**Recommendation:** **A** (classic `.md` + minimal `config.yml`), or **B** if the user prefers the smallest surface. Either keeps `BetaBanner.tsx` untouched.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (live GitHub + browser) · `[ ]` = pending.

### Task 0: Spike — confirm gap + resolve DECs (A28 spike-first)

- [x] 0.1 Confirmed `.github/ISSUE_TEMPLATE/` did not exist before this story (`.github/` had only `workflows/` + `agents/` + others).
- [x] 0.2 Confirmed the banner URL string `template=beta-feedback.md` in [BetaBanner.tsx:77](../../frontend/src/components/navigation/BetaBanner.tsx) — the filename the template must match.
- [x] 0.3 Confirmed the GitHub slug `htos/iab-connect` (banner fallback + .env.example default).
- [x] 0.4 DEC-1=A (GitHub Issues) + DEC-2=A (classic `.md` + `config.yml`) resolved via A41 — see Debug Log References.
- [x] 0.5 Spike outcome recorded in Dev Agent Record.

### Task 1: Author the issue template (AC-2, AC-4)

- [x] 1.1 Created `.github/ISSUE_TEMPLATE/beta-feedback.md` with classic frontmatter (`name: Beta-Feedback`, `about`, `title: "[Beta-Feedback] "`, `labels: beta-feedback`, `assignees: ""`).
- [x] 1.2 Body: bilingual DE/EN structured form — Umgebung/Environment (area + browser + Correlation-ID), Was ich getan habe / What I did, Erwartet / Expected, Tatsächlich / Actual, Screenshots/Logs (with "no secrets" note), Schweregrad / Severity (Blocker/Hoch/Mittel/Niedrig). Closing note mirrors the Mailtrap + data-reset caveat the E18-S2 guide explains (AC-4).
- [x] 1.3 (DEC-2=A) Created `.github/ISSUE_TEMPLATE/config.yml` (`blank_issues_enabled: true`) (AC-5).

### Task 2: Lock the filename-parity invariant (AC-3)

- [x] 2.1 Added pure-Node `frontend/src/components/navigation/feedback-template.test.ts` (no jsdom/cleanup per A46): reads `BetaBanner.tsx`, extracts the `template=<name>.md` filename (asserts `beta-feedback.md`), and asserts the file exists at repo-root `.github/ISSUE_TEMPLATE/<name>` (A51 — note cwd=frontend/, template is one level up via `resolve(cwd, "..", ...)`). A third test asserts the template's classic frontmatter (name/about/labels=beta-feedback/title prefix).
- [x] 2.2 Confirmed the parity test is load-bearing: it captures the filename from the banner and asserts existence — renaming either side breaks it. 3 tests green.

### Task 3: Quality gates (AC-6) + close (AC-7 deferred)

- [x] 3.1 Confirmed `BetaBanner.tsx` is NOT modified (the link already works; `git status` shows it unchanged).
- [x] 3.2 `typecheck` clean; `eslint`+`prettier` clean on the new test file; full frontend Vitest **171 → 174** green (+3 this story). Zero new deps.
- [x] 3.3 A42 reread of the template: no sprint-tracking leakage; bilingual DE/EN intelligible to German testers; severity guidance + "no secrets" + Mailtrap/data-reset caveat present.
- [x] 3.4 AC-Subitem Completion Check (A29) — Quality-Gates table filled.
- [!] 3.5 AC-7 end-to-end click flow deferred per A47 → Completion Notes Q1 (needs public repo + logged-in GitHub user + Beta deploy).
- [x] 3.6 Status flipped to `review`.

## Dev Notes

### The one real gap

`.github/` today: `workflows/{build-images.yml,dco.yml}`, `agents/`, `java-upgrade/`, `modernize/`. **No `ISSUE_TEMPLATE/`.** The banner link therefore resolves to a blank GitHub issue (the `?template=` param is dead). Creating `.github/ISSUE_TEMPLATE/beta-feedback.md` is the deliverable.

### Shipped feedback-link facts (do NOT modify the banner)

- URL: `NEXT_PUBLIC_FEEDBACK_URL` (build-time override) `||` `${NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect"}/issues/new?template=beta-feedback.md` ([BetaBanner.tsx:73–77](../../frontend/src/components/navigation/BetaBanner.tsx)).
- Rendered as `<a target="_blank" rel="noopener noreferrer">` with `t("feedbackLink")` text ([:92–99](../../frontend/src/components/navigation/BetaBanner.tsx); de.json `beta.feedbackLink` = "Feedback geben").
- Already tested (E18-S3 `BetaBanner.test.tsx` lines 65–123). This story does not re-test URL construction.

### Classic vs. form template — why classic

GitHub resolves `?template=beta-feedback.md` to a **classic** Markdown template of that exact filename. A modern YAML issue *form* (`.yml`) uses a different chooser flow and would require editing the banner URL (regression). Keep classic `.md` to leave `BetaBanner.tsx` untouched.

### A31 cross-story orthogonal-AC invariants in scope

1. **Banner URL `template=beta-feedback.md` ↔ `.github/ISSUE_TEMPLATE/beta-feedback.md` filename** — direct-artifact-read parity test (AC-3). The load-bearing invariant: rename one side, the link 404s the template.
2. **Template wording ↔ E18-S2 tester-guide feedback section** — soft consistency (AC-4), A42 reread, not automated.
3. **`NEXT_PUBLIC_FEEDBACK_URL`/`SOURCE_URL` producer↔consumer** — verified wired at refresh (Dockerfile/build-images.yml/.env.example); E18-S3 + this story consume it.

### What this story does NOT do

- It does NOT modify `BetaBanner.tsx` (the link works).
- It does NOT implement a `mailto:` path (DEC-1=A: GitHub Issues is the committed transport).
- It does NOT build a backend feedback endpoint or in-app feedback form — out of Beta scope; GitHub Issues is the channel.
- It does NOT wire ADR-021's `/about` Source link (that is E20-S3/S4; the feedback link is a separate concern, noted only because the AC's architecture-note cites ADR-021).

## Quality-Gates Closing

| AC | Evidence | Status |
|---|---|---|
| AC-1 clickable feedback link | BetaBanner.test.tsx URL tests (env-override + GitHub-fallback + fork-fallback) — verified shipped | covered |
| AC-2 issue-template file | `.github/ISSUE_TEMPLATE/beta-feedback.md` (classic, frontmatter + bilingual structured body) | covered |
| AC-3 filename parity (A31) | feedback-template.test.ts: banner `template=` ↔ file existence + frontmatter (A51) | covered |
| AC-4 tester-aligned wording | A42 reread; bilingual DE/EN; Mailtrap/data-reset caveat mirrors E18-S2 | covered |
| AC-5 config.yml | `.github/ISSUE_TEMPLATE/config.yml` (`blank_issues_enabled: true`) (DEC-2=A) | covered |
| AC-6 no banner change + gates | BetaBanner.tsx unchanged; typecheck/eslint/prettier clean; vitest 174/174 | covered |
| AC-7 end-to-end click flow | live walkthrough (Q1) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **NEW (this story):** `.github/ISSUE_TEMPLATE/beta-feedback.md` (+ optional `config.yml`); a pure-Node filename-parity test (A51, no jsdom per A46).
- **Reused:** E18-S3's `BetaBanner.test.tsx` covers the link/URL construction — not re-tested here.
- **Live click-through evidence:** deferred to Wave-9 walkthrough per A47 (AC-7; needs public repo + browser + Beta deploy).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

**DEC-1 (feedback transport: GitHub Issues vs. mailto) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (GitHub Issues classic template — confirm the already-shipped choice; create `.github/ISSUE_TEMPLATE/beta-feedback.md`).
- (b) **Rationale:** story recommendation = A; user autonomous-mode verbatim quote = "das ganze epic umsetzen ohne unterbrechung und ohne stop bis alle stories implementiert sind. danach gemäss plan eine retro durchführen." (2026-06-05); architectural justification = the banner URL already commits to `/issues/new?template=beta-feedback.md`; mailto would regress the shipped+tested banner and leak the maintainer address into a public build var.
- (c) **Consequence chain:** create the template file (not modify the banner); `mailto:` path out of scope.

**DEC-2 (template format: classic `.md` vs. `.yml` form + config.yml) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (classic `.md` matching the shipped URL + minimal `config.yml`).
- (b) **Rationale:** story recommendation = A; same user quote; architectural justification = the banner URL says `beta-feedback.md`; a `.yml` issue form would require editing the banner URL (regression) + changes the `?template=` resolution; classic `.md` leaves `BetaBanner.tsx` untouched.
- (c) **Consequence chain:** `beta-feedback.md` (classic) + `config.yml` (`blank_issues_enabled: true`); banner unchanged.

### Spike outcome (Task 0.5)

`.github/ISSUE_TEMPLATE/` did not exist; the banner's feedback link already pointed at a non-existent `beta-feedback.md` template (silently degrading to a blank issue). The one real gap was the template file. Created it + config.yml + a filename-parity test. Zero production-code change (banner untouched).

### Completion Notes List

- **What was implemented:** `.github/ISSUE_TEMPLATE/beta-feedback.md` (classic bilingual DE/EN feedback template) + `.github/ISSUE_TEMPLATE/config.yml` (`blank_issues_enabled: true`) + `frontend/src/components/navigation/feedback-template.test.ts` (3 pure-Node parity tests, A51/A46).
- **Banner NOT modified** — the feedback link already worked; this story only supplies the missing template + locks the filename-parity invariant.
- **DEC-1=A (GitHub Issues) + DEC-2=A (classic .md + config.yml)** auto-resolved via A41; (a)/(b)/(c) Debug Log above.
- **Gates:** typecheck clean; eslint+prettier clean on the new test; full frontend suite 171 → **174** green; zero new deps.

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-7 end-to-end click flow):** on a green Beta deploy, a tester clicks the banner "Feedback geben" link, lands on the pre-filled `beta-feedback` issue template on the public `htos/iab-connect` repo, and submits an issue.

### File List

**NEW:**
- `.github/ISSUE_TEMPLATE/beta-feedback.md` (classic issue template)
- `.github/ISSUE_TEMPLATE/config.yml`
- `frontend/src/components/navigation/feedback-template.test.ts` (3 pure-Node tests)

**MODIFIED:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (e18-s4: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/e18-s4-add-feedback-channel.md` (this story file)

### Change Log

- 2026-06-05 — E18-S4 dev-story: created the missing `.github/ISSUE_TEMPLATE/beta-feedback.md` (classic, bilingual) + `config.yml` + a pure-Node filename-parity test locking the banner `template=beta-feedback.md` URL to the actual file (A51). DEC-1=A (GitHub Issues) + DEC-2=A (classic .md) auto-resolved via A41. BetaBanner.tsx unchanged. Full frontend suite 171→174 green. AC-1..AC-6 covered; AC-7 deferred-pending-beta-green per A47 → Q1.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A34** bulk spec-refresh at epic start (batch with E18-S1/S2/S3)
- **A35** + **A46** pure-Node file-read tests get NO jsdom/cleanup
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A51** A31 invariants tested via direct artifact-read (AC-3 filename parity)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-7)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-05)

The missing `.github/ISSUE_TEMPLATE/beta-feedback.md` (+ config.yml) is shipped; a pure-Node parity test locks the banner `template=beta-feedback.md` URL to the actual filename + frontmatter. Banner unchanged; full frontend suite 171→174 green. AC-1..AC-6 covered; AC-7 deferred-pending-beta-green per A47 → Q1.
