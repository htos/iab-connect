# Story E18-S4: Feedback channel

Status: ready-for-dev

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

- [ ] 0.1 Confirm `.github/ISSUE_TEMPLATE/` does not exist (`git ls-files .github/`).
- [ ] 0.2 Confirm the banner URL string `template=beta-feedback.md` in [BetaBanner.tsx:77](../../frontend/src/components/navigation/BetaBanner.tsx) (the filename the template must match).
- [ ] 0.3 Confirm the GitHub slug `htos/iab-connect` (the public repo the link targets).
- [ ] 0.4 Resolve DEC-1 + DEC-2 (A41 escape per A43 if pre-declared; else AskUserQuestion).
- [ ] 0.5 Record spike outcome in Dev Agent Record.

### Task 1: Author the issue template (AC-2, AC-4)

- [ ] 1.1 Create `.github/ISSUE_TEMPLATE/beta-feedback.md` with classic frontmatter (`name`, `about`, `title: "[Beta-Feedback] "`, `labels: beta-feedback`).
- [ ] 1.2 Body: structured sections (Umgebung/Environment = Beta; Was ich getan habe / What I did; Erwartet / Expected; Tatsächlich / Actual; Screenshots; Schweregrad / Severity). Align wording with E18-S2's tester guide (AC-4).
- [ ] 1.3 (DEC-2=A only) Create `.github/ISSUE_TEMPLATE/config.yml` (`blank_issues_enabled: true`) (AC-5).

### Task 2: Lock the filename-parity invariant (AC-3)

- [ ] 2.1 Add a pure-Node regression test (NO jsdom/cleanup per A46) that reads the `BetaBanner.tsx` source, extracts the `template=<name>` filename from the fallback URL, and asserts a matching file exists at `.github/ISSUE_TEMPLATE/<name>` (A51 direct-artifact-read). Co-locate sensibly (e.g. extend `BetaBanner.i18n.test.ts` from E18-S3, or a new `feedback-template.test.ts`).
- [ ] 2.2 Confirm the test fails if either the template filename or the banner URL drifts (negative check during authoring).

### Task 3: Quality gates (AC-6) + close (AC-7 deferred)

- [ ] 3.1 Confirm `BetaBanner.tsx` is NOT modified (the link already works).
- [ ] 3.2 `npm run typecheck` / `lint` / `format:check` clean; Vitest green; record test-count delta.
- [ ] 3.3 A42 reread of the template (operator/tester-facing): no sprint leakage, intelligible to German testers, severity guidance clear.
- [ ] 3.4 AC-Subitem Completion Check (A29) — fill the Quality-Gates table.
- [ ] 3.5 AC-7 end-to-end click flow deferred per A47 → Completion Notes Q-item.
- [ ] 3.6 Flip status to `review`.

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

| AC | Planned evidence | Status |
|---|---|---|
| AC-1 clickable feedback link | existing BetaBanner.test.tsx URL tests | _pending verify_ |
| AC-2 issue-template file | `.github/ISSUE_TEMPLATE/beta-feedback.md` created | _pending dev-story_ |
| AC-3 filename parity (A31) | NEW pure-Node parity test (A51) | _pending_ |
| AC-4 tester-aligned wording | A42 reread + E18-S2 cross-check | _pending_ |
| AC-5 config.yml (optional) | `config.yml` if DEC-2=A, else documented out-of-scope | _pending_ |
| AC-6 no banner change + gates | typecheck/lint/format/vitest green; BetaBanner.tsx unchanged | _pending_ |
| AC-7 end-to-end click flow | live walkthrough (Q-item) | _deferred-pending-beta-green (A47)_ |

## Tests / Evidence

- **NEW (this story):** `.github/ISSUE_TEMPLATE/beta-feedback.md` (+ optional `config.yml`); a pure-Node filename-parity test (A51, no jsdom per A46).
- **Reused:** E18-S3's `BetaBanner.test.tsx` covers the link/URL construction — not re-tested here.
- **Live click-through evidence:** deferred to Wave-9 walkthrough per A47 (AC-7; needs public repo + browser + Beta deploy).

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

_(DEC-1 + DEC-2 resolution per A43 (a)/(b)/(c) template to be recorded here)_

### Completion Notes List

_(to be filled — include the A47 Q-item for AC-7 end-to-end click flow; note BetaBanner.tsx unchanged)_

### File List

_(expected NEW: `.github/ISSUE_TEMPLATE/beta-feedback.md` [+ `config.yml` if DEC-2=A] + a parity test; MODIFIED: `sprint-status.yaml`)_

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A34** bulk spec-refresh at epic start (batch with E18-S1/S2/S3)
- **A35** + **A46** pure-Node file-read tests get NO jsdom/cleanup
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A51** A31 invariants tested via direct artifact-read (AC-3 filename parity)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-7)

## Story Completion Status

Status: ready-for-dev

Ultimate context engine analysis completed — comprehensive developer guide created. The feedback LINK already ships and is tested; the one real deliverable is `.github/ISSUE_TEMPLATE/beta-feedback.md` (with a filename-parity test locking it to the banner URL). Do NOT modify the banner or switch to mailto.
