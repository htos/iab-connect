# Epic-7 Boundary Code Review — Accessibility & Localization (REQ-056 + REQ-055)

Date: 2026-06-07
Reviewer: claude-opus-4-8[1m] (autonomous epic-boundary review, hybrid CR+ER per `feedback_bmad_workflow`)
Scope: full Epic-7 working-tree diff — e7-s1 (a11y baseline + audit), e7-s2 (shared-component a11y), e7-s3 (Hindi expansion path), e7-s4 (Event/BlogPost content language).
Method: 3-layer adversarial (Blind Hunter / Edge Case Hunter / Acceptance Auditor).

## Outcome

**APPROVED after 1 patch applied.** One HIGH-severity diff-hygiene finding (self-inflicted) was found and fully remediated during the review; the remaining findings are Low/dismissed. All quality gates green after remediation.

## Patches applied

### P1 (HIGH) — `prettier --write` reformatted pre-drifted files + CRLF line-ending churn → ~2000 lines of unrelated diff

**Symptom.** The initial epic diff was 2554 insertions / 1193 deletions. Investigation (`git diff --ignore-space-at-eol`, `git ls-files --eol`, binary-safe temp-copy `prettier --check` of the HEAD blobs) showed the bulk was NOT logical change:

- **Frontend (11 files):** during each story's A58 changed-files gate, `prettier --write` was run on files that were already prettier-drifted at HEAD (the repo carries ~2543 such files per A58). Prettier reformatted the **entire** file, injecting hundreds of unrelated formatting changes into the epic diff (e.g. `events/[id]/edit/page.tsx` +574/−273, `events/new` +678, `members` +408, `events.ts` +241). This bundles a repo-wide format cleanup into a feature epic — exactly what A58 says to defer to a dedicated chore.
- **Backend (2 files):** `BlogPost.cs` + `BlogPostConfiguration.cs` working-tree copies were CRLF while the index is LF (`core.autocrlf=false`), so `git diff` showed full-file churn (the real change was 13 / 3 lines).

**Root cause.** (a) The per-story prettier gate was mis-applied: A58 says scope the *check* to changed files, but `prettier --write` rewrites the whole file — on a pre-drifted file that means wholesale reformatting. The check should validate only that *my added lines* are clean (new files), never reformat a pre-drifted modified file. (b) An unreliable verification (`git show HEAD:f | prettier --stdin-filepath` through a git-bash pipe) falsely reported the drifted files as "clean at HEAD", masking the problem until the boundary diff review.

**Fix.** Restored all 13 churned files to HEAD (`git checkout HEAD -- …`) and re-applied **only** the logical changes by hand, matching each file's existing (drifted) style and LF endings; left the pre-existing drift untouched (A58). New files remain prettier-clean. Result: diff collapsed to **284 insertions / 55 deletions** — purely E7 logical change. All gates re-run green (backend build 0/0, Application 20 + Api 40 focused, frontend tsc + 222 vitest + eslint clean; new files prettier-clean).

## Findings dismissed / accepted (no patch)

- **`Event.SetContentLanguage` is called unconditionally in `CreateEvent`** (Blind, Low) — unlike the other optional setters it runs even when `contentLanguage` is null, touching `UpdatedAt` on a freshly-created event. Harmless: the value is correct (null), and the existing create path already invokes mutators that set `UpdatedAt`. Not worth a guard.
- **`request.ts` `onError` swallows all next-intl errors** (Edge, Low) — intended (AC-3 "fall back safely, never throw"). The deep-merge English base means hi never has a missing key, and the `de≡en` parity test guards the full locales, so the swallow only ever masks an impossible case. Accepted.
- **Public language badge `tLang(contentLanguage)` for an out-of-set DB value** (Edge, Low) — would render `language.<code>` via `getMessageFallback`. Impossible in practice: the write boundary (`ContentLanguages.Normalize`) rejects anything outside `{de,en,hi}`. Accepted.
- **`getMessageFallback` returns the raw `namespace.key` path** (Edge, Low) — acceptable degraded display; better than a thrown error or a blank (AC-3). Accepted.

## Acceptance audit (per story)

- **E7-S1:** baseline doc + 12-page audit + page-local a11y fixes; live-browser checks correctly `[!]` (A47). Route-vs-inventory reconciliation documented. ✅
- **E7-S2:** Input aria + design-system focus token; dialog i18n; Textarea/Select/Checkbox caller-contract docs; Badge/Alert confirmed; net-new component a11y tests (8). ✅
- **E7-S3:** hi wired end-to-end (lockstep-tested); deep-merge English-base safe fallback (AC-3 structural); seed `hi.json`; switcher; DE/EN parity bug fixed + global parity guard. ✅
- **E7-S4:** ContentLanguage on Event+BlogPost (domain write-boundary validator → 400, EF, additive data-preserving migration proven by Testcontainers, public+admin DTOs, event admin select, public badges); blog-admin UI correctly **deferred** (A65, E7-FT-1) not marked ✅. Auth unchanged (40 Api tests). ✅

## Quality gates (post-remediation)

- Backend: solution build 0 warn / 0 err; `ContentLanguageTests` 20/20; Event/Blog Api 40/40; `ContentLanguageMigrationTests` 4/4 (Testcontainers, Docker present); full Application.Tests 1556/1556; full Api.Tests 249/249.
- Frontend: `tsc --noEmit` clean; `vitest run` 222/222 (42 files, +13 new); `eslint` clean on all changed files; `prettier --check` clean on all new files; pre-existing repo drift on modified files left untouched (A58).

## New action items proposed for the retrospective → project-context.md

- **A72** — A58's changed-files gate is **check-only**: never `prettier --write` a pre-drifted *modified* file (it reformats the whole file and bundles an unrelated cleanup into the epic). Format only genuinely *new* files; for modified pre-drifted files, hand-match the surrounding style and rely on the eslint changed-files gate. (Root cause of P1.)
- **A73** — On a `core.autocrlf=false` repo whose index is LF, verify edited files stay LF (the Edit/Write tooling can introduce CRLF on Windows, producing whole-file `git diff` churn). Check with `git ls-files --eol`; the authoritative prettier-drift check writes the HEAD blob to a temp file (binary-safe redirect) rather than piping through a shell (pipes can flip line endings and give false "clean" results).
